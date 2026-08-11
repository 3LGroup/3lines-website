/**
 * Capture the clone's own geometry as a committed baseline.
 *
 * Why this exists: the visual audit's reference used to be the live source
 * deployment. That is only a valid reference while this project is a
 * reproduction of it. Once the content is replaced, every selector reports a
 * count mismatch, the audit goes permanently red, and it gets switched off —
 * losing the strongest guard in the project exactly when the largest change is
 * happening.
 *
 * So the reference becomes a snapshot of ourselves, and updating it becomes an
 * explicit, reviewable act rather than a side effect of a run. A provenance file
 * records when and from what the snapshot was taken, so nobody can quietly
 * regenerate the baseline to turn a red build green.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launch, preparePage, settle, ROUTES, VIEWPORTS } from './lib/browser.mjs';
import { SELECTORS, MEASURE, routeKey } from './lib/measure.mjs';

const LOCAL = process.env.AUDIT_BASE || 'http://127.0.0.1:3200';
const DIR = process.env.AUDIT_BASELINE_DIR || 'baseline';

if (fs.existsSync(DIR)) {
  console.log(`Replacing the existing baseline at ${DIR}/`);
  console.log('This is an intentional reset. Review the resulting diff before committing —');
  console.log('a baseline regenerated alongside source changes hides whatever those changes did.\n');
  fs.rmSync(DIR, { recursive: true, force: true });
}

const browser = await launch();
let files = 0;
let elements = 0;

/**
 * One capture attempt. Refuses to return data measured through a failed webfont:
 * baking wrong metrics into the reference would make every later run wrong.
 * Fonts come from a third-party CDN, so a transient failure is retried rather
 * than treated as a real defect.
 */
async function captureOnce(vp, route) {
  const page = await browser.newPage();
  try {
    await preparePage(page, vp);
    const res = await page.goto(LOCAL + route, { waitUntil: 'networkidle2', timeout: 60000 });
    const ok = res && (res.status() === 200 || res.status() === 304);
    if (!ok) throw new Error(`HTTP ${res ? res.status() : 'no response'}`);

    await page.evaluate(() => document.fonts.ready);
    const fonts = await page.evaluate(() =>
      Array.from(document.fonts).map((f) => ({ family: f.family, weight: f.weight, status: f.status }))
    );
    const failed = fonts.filter((f) => f.status === 'error');
    if (failed.length) {
      const e = new Error(`webfont failed to load: ${failed.map((f) => f.family).join(', ')}`);
      e.retryable = true;
      throw e;
    }

    await settle(page);
    const data = await page.evaluate(MEASURE, SELECTORS);
    data.__fonts = fonts.filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`).sort();
    return data;
  } finally {
    await page.close();
  }
}

for (const vp of VIEWPORTS) {
  fs.mkdirSync(path.join(DIR, vp.name), { recursive: true });
  for (const route of ROUTES) {
    let data, last;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        data = await captureOnce(vp, route);
        break;
      } catch (e) {
        last = e;
        if (!e.retryable) throw e;
        console.log(`      retry ${attempt}/4 (${vp.name}${route}): ${e.message}`);
        await new Promise((r) => setTimeout(r, 900 * attempt));
      }
    }
    if (!data) throw last;

    const n = Object.values(data).reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0);
    if (!n) throw new Error('captured zero elements — refusing to write an empty baseline');
    elements += n;

    fs.writeFileSync(path.join(DIR, vp.name, `${routeKey(route)}.json`), JSON.stringify(data, null, 2));
    files++;
    console.log(`  ${vp.name.padEnd(10)} ${route.padEnd(18)} ${n} elements`);
  }
}

await browser.close();

let commit = 'unknown';
try {
  commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* not a git repo yet — recorded as unknown rather than failing the capture */
}

fs.writeFileSync(
  path.join(DIR, 'provenance.json'),
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      commit,
      source: LOCAL,
      viewports: VIEWPORTS.map((v) => v.name),
      routes: ROUTES,
      files,
      elements,
      note:
        'Committed reference for scripts/audit-visual.mjs when AUDIT_MODE=baseline. ' +
        'Regenerate only as a deliberate, reviewed change.',
    },
    null,
    2
  ) + '\n'
);

const expected = VIEWPORTS.length * ROUTES.length;
if (files !== expected) {
  console.error(`\nBASELINE INCOMPLETE — wrote ${files}/${expected} files`);
  process.exit(1);
}

console.log(`\nBASELINE CAPTURED — ${files} files, ${elements} elements, commit ${commit.slice(0, 8)}`);
console.log(`  ${DIR}/provenance.json records when and from what.`);
