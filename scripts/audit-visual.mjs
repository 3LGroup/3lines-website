/**
 * Structural / geometric comparison between the source deployment and the clone.
 *
 * Method, in order:
 *   1. For each selector, record the FULL element list on both sides.
 *   2. If the counts differ, emit ONE count finding and skip geometry for that
 *      selector entirely — a count mismatch must never be laundered into N
 *      misleading geometry diffs.
 *   3. Only when counts match, compare element-by-element at the same index.
 *
 * Everything is written to a fresh run directory; nothing is ever appended to a
 * previous report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, preparePage, settle, ROUTES, VIEWPORTS as ALL_VIEWPORTS } from './lib/browser.mjs';
import { SELECTORS, MEASURE, routeKey } from './lib/measure.mjs';

// Optional filter for iterating on one viewport; the authoritative run sets none.
const only = process.env.AUDIT_VIEWPORTS;
const VIEWPORTS = only ? ALL_VIEWPORTS.filter((v) => only.split(',').includes(v.name)) : ALL_VIEWPORTS;
if (!VIEWPORTS.length) throw new Error(`No viewports matched AUDIT_VIEWPORTS="${only}"`);

const SOURCE = process.env.AUDIT_SOURCE || 'https://thales-group-3lines.vercel.app';
const LOCAL = process.env.AUDIT_BASE || 'http://127.0.0.1:3200';
const RUN_DIR = process.env.AUDIT_RUN_DIR || path.join('audit-runs', `run-${Date.now()}`);

/**
 * Reference mode.
 *
 *   live     — diff against the original source deployment (fidelity testing)
 *   baseline — diff against a committed snapshot of our own geometry (regression
 *              testing)
 *
 * `live` only means anything while this project is a reproduction of that source.
 * Once the content is replaced the source stops being a valid reference, and
 * every selector would report a count mismatch — the audit would go permanently
 * red and get switched off, which is the worst possible outcome for a project
 * built on hard gates. So the *reference* is swappable; the *method* (full
 * element lists, counts before geometry, font parity as its own class, the
 * negative control) is identical either way.
 */
const MODE = process.env.AUDIT_MODE || 'live';
if (!['live', 'baseline'].includes(MODE)) throw new Error(`Unknown AUDIT_MODE "${MODE}"`);

const BASELINE_DIR = process.env.AUDIT_BASELINE_DIR || 'baseline';

const baselinePath = (vp, route) => path.join(BASELINE_DIR, vp, `${routeKey(route)}.json`);

function readBaseline(vp, route) {
  const p = baselinePath(vp, route);
  if (!fs.existsSync(p))
    throw new Error(`no baseline for ${vp}${route} — run "npm run baseline:update" (${p})`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Position/size tolerance in px. Sub-pixel layout noise below this is ignored. */
const TOL = 1.5;


const GEOM = ['x', 'y', 'w', 'h'];
const BOX = ['mt', 'mb', 'pt', 'pb', 'pl', 'pr', 'gap', 'radius', 'fs', 'lh'];
const EXACT = ['fw', 'display', 'position', 'fit', 'bgSize', 'cols', 'hasBg'];

/**
 * Negative control. With AUDIT_SELFTEST=1 a small perturbation is injected into
 * the local page only; the run must then REPORT findings. A "0 differences"
 * result is only meaningful if the harness is demonstrably able to find some.
 */
const SELFTEST = process.env.AUDIT_SELFTEST === '1';

/**
 * Both sides pull the same webfonts from Google Fonts. A transient fetch failure
 * on either side silently changes heading metrics and shifts every element
 * below it — which shows up as dozens of bogus "geometry defects". Detect the
 * failed load and retry rather than measuring through it.
 */
async function measureOnce(browser, url, viewport, perturb) {
  const page = await browser.newPage();
  try {
    await preparePage(page, viewport);
    const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    // 304 is a valid revalidation response and renders identically to 200.
    const ok = res && (res.status() === 200 || res.status() === 304);
    if (!ok) throw new Error(`HTTP ${res ? res.status() : 'no response'}`);

    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() =>
      Array.from(document.fonts).map((f) => ({ family: f.family, weight: f.weight, status: f.status }))
    );
    const failed = fonts.filter((f) => f.status === 'error');
    if (failed.length)
      throw new FontError(failed.map((f) => `${f.family} ${f.weight}`).join(', '));

    await settle(page);
    if (perturb) await page.addStyleTag({ content: '.h2{padding-top:9px!important}' });

    const data = await page.evaluate(MEASURE, SELECTORS);
    data.__fonts = fonts.filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`).sort();
    return data;
  } finally {
    await page.close();
  }
}

class FontError extends Error {
  constructor(which) {
    super(`webfont failed to load: ${which}`);
  }
}

async function measure(browser, url, viewport, perturb = false) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await measureOnce(browser, url, viewport, perturb);
    } catch (e) {
      last = e;
      if (!(e instanceof FontError)) throw e;
      console.log(`      retry ${attempt}/3 (${url}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw last;
}

fs.mkdirSync(RUN_DIR, { recursive: true });

const browser = await launch();
const comparisons = [];
let errored = 0;

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    const entry = {
      viewport: vp.name,
      route,
      error: null,
      // Evidence that the comparison actually measured something. A run with
      // zero findings is only meaningful alongside a non-zero element count.
      elementsCompared: 0,
      propsCompared: 0,
      selectorsPresent: 0,
      fontMismatch: null,
      perSelectorCounts: {},
      counts: [],
      geometry: [],
    };
    try {
      // In baseline mode the reference is a committed file, so only one
      // navigation happens per comparison.
      const [src, loc] =
        MODE === 'baseline'
          ? [readBaseline(vp.name, route), await measure(browser, LOCAL + route, vp, SELFTEST)]
          : await Promise.all([
              measure(browser, SOURCE + route, vp),
              measure(browser, LOCAL + route, vp, SELFTEST),
            ]);

      // Font parity is its own finding class — never let it surface as geometry.
      const srcFonts = (src.__fonts || []).join(', ');
      const locFonts = (loc.__fonts || []).join(', ');
      if (srcFonts !== locFonts) entry.fontMismatch = { source: srcFonts, local: locFonts };

      for (const sel of [...SELECTORS, '__doc']) {
        const a = src[sel] || [];
        const b = loc[sel] || [];

        entry.perSelectorCounts[sel] = { source: a.length, local: b.length };
        if (a.length) entry.selectorsPresent++;

        if (a.length !== b.length) {
          // Structural count difference. Deliberately NOT followed by geometry.
          entry.counts.push({ selector: sel, source: a.length, local: b.length });
          continue;
        }

        entry.elementsCompared += a.length;
        entry.propsCompared += a.length * (GEOM.length + BOX.length + EXACT.length);

        for (let i = 0; i < a.length; i++) {
          const diffs = [];
          for (const k of GEOM) if (Math.abs(a[i][k] - b[i][k]) > TOL) diffs.push({ prop: k, source: a[i][k], local: b[i][k] });
          for (const k of BOX) if (Math.abs(a[i][k] - b[i][k]) > TOL) diffs.push({ prop: k, source: a[i][k], local: b[i][k] });
          for (const k of EXACT) if (String(a[i][k]) !== String(b[i][k])) diffs.push({ prop: k, source: a[i][k], local: b[i][k] });
          if (diffs.length) entry.geometry.push({ selector: sel, index: i, count: a.length, diffs });
        }
      }
    } catch (e) {
      entry.error = String(e.message || e);
      errored++;
    }
    comparisons.push(entry);
    const tag = entry.error
      ? `ERROR ${entry.error}`
      : `els=${entry.elementsCompared} counts=${entry.counts.length} geom=${entry.geometry.length}`;
    console.log(`  ${vp.name.padEnd(10)} ${route.padEnd(16)} ${tag}`);
  }
}

await browser.close();

const report = {
  mode: MODE,
  source: MODE === 'baseline' ? BASELINE_DIR : SOURCE,
  local: LOCAL,
  tolerancePx: TOL,
  viewports: VIEWPORTS.map((v) => v.name),
  routes: ROUTES,
  expectedComparisons: VIEWPORTS.length * ROUTES.length,
  actualComparisons: comparisons.length,
  erroredComparisons: errored,
  totalCountFindings: comparisons.reduce((n, c) => n + c.counts.length, 0),
  totalGeometryFindings: comparisons.reduce((n, c) => n + c.geometry.length, 0),
  totalFontMismatches: comparisons.filter((c) => c.fontMismatch).length,
  totalElementsCompared: comparisons.reduce((n, c) => n + c.elementsCompared, 0),
  totalPropsCompared: comparisons.reduce((n, c) => n + c.propsCompared, 0),
  comparisons,
};

fs.writeFileSync(path.join(RUN_DIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nreport: ${path.join(RUN_DIR, 'report.json')}`);
console.log(`  comparisons: ${report.actualComparisons}/${report.expectedComparisons}  errored: ${errored}`);
console.log(
  `  count findings: ${report.totalCountFindings}  geometry findings: ${report.totalGeometryFindings}  font mismatches: ${report.totalFontMismatches}`
);

if (SELFTEST) {
  const found = report.totalGeometryFindings + report.totalCountFindings;
  if (found === 0) {
    console.error('\nSELF-TEST FAILED — perturbation injected but the harness reported no findings.');
    console.error('A clean run from this harness would be meaningless. Fix the harness.');
    process.exit(1);
  }
  console.log(`\nSELF-TEST OK — harness detected ${found} finding(s) from the injected perturbation.`);
}

if (errored) process.exit(1);
