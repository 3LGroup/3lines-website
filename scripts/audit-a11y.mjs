/**
 * Accessibility audit.
 *
 * Hand-rolled rather than pulling in a scanner, for the same reason the rest of
 * this suite is: every check here is one I can explain, and a failure names the
 * element it found. It covers the WCAG failures that actually occur in a
 * content-driven site — missing accessible names, unlabelled inputs, broken
 * heading order, invisible focus, and insufficient contrast — and computes
 * contrast ratios properly rather than eyeballing the palette.
 *
 * FAIL blocks the build. WARN is recorded but does not.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, preparePage, settle, ROUTES } from './lib/browser.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:3200';
const RUN_DIR = process.env.AUDIT_RUN_DIR || path.join('audit-runs', `a11y-${Date.now()}`);

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

const errors = [];
const warnings = [];
const stats = { pages: 0, elements: 0, contrastChecked: 0 };

/** Runs in the page. Returns findings as plain data. */
const AUDIT = () => {
  const fail = [];
  const warn = [];
  let elements = 0;
  let contrastChecked = 0;

  const label = (el) => (el.className || el.tagName || '').toString().slice(0, 45);

  /* --- accessible names ------------------------------------------------- */
  const named = (el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && aria.trim()) return true;
    if (el.getAttribute('aria-labelledby')) return true;
    if ((el.textContent || '').trim()) return true;
    const img = el.querySelector('img[alt]');
    if (img && img.getAttribute('alt').trim()) return true;
    const t = el.getAttribute('title');
    return !!(t && t.trim());
  };

  for (const el of document.querySelectorAll('a[href], button')) {
    elements++;
    if (!named(el)) fail.push(`${el.tagName.toLowerCase()} has no accessible name — ${label(el)}`);
  }

  /* --- images ------------------------------------------------------------ */
  for (const img of document.querySelectorAll('img')) {
    elements++;
    if (img.getAttribute('alt') === null)
      fail.push(`img has no alt attribute — ${img.getAttribute('src') || label(img)}`);
  }

  /* --- form controls ----------------------------------------------------- */
  for (const c of document.querySelectorAll('input, textarea, select')) {
    elements++;
    if (c.type === 'hidden') continue;
    const id = c.getAttribute('id');
    const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
    const wrapped = c.closest('label');
    const aria = c.getAttribute('aria-label') || c.getAttribute('aria-labelledby');
    if (!hasLabel && !wrapped && !aria)
      fail.push(`form control has no label — ${c.name || label(c)}`);
  }

  /* --- heading order ----------------------------------------------------- */
  const heads = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const h1s = heads.filter((h) => h.tagName === 'H1');
  if (h1s.length === 0) fail.push('page has no <h1>');
  if (h1s.length > 1) fail.push(`page has ${h1s.length} <h1> elements`);
  let prev = 0;
  for (const h of heads) {
    const lvl = Number(h.tagName[1]);
    if (prev && lvl > prev + 1)
      warn.push(`heading order skips h${prev} -> h${lvl} ("${(h.textContent || '').trim().slice(0, 40)}")`);
    prev = lvl;
  }

  /* --- landmarks --------------------------------------------------------- */
  if (!document.querySelector('main')) fail.push('no <main> landmark');
  if (!document.querySelector('header')) warn.push('no <header> landmark');
  if (!document.querySelector('footer')) warn.push('no <footer> landmark');

  /* --- duplicate ids ----------------------------------------------------- */
  const ids = new Map();
  for (const el of document.querySelectorAll('[id]')) {
    const id = el.id;
    ids.set(id, (ids.get(id) || 0) + 1);
  }
  for (const [id, n] of ids) if (n > 1) fail.push(`duplicate id "${id}" (${n} elements)`);

  /* --- focus visibility --------------------------------------------------- */
  for (const el of document.querySelectorAll('a[href], button, input, textarea')) {
    const cs = getComputedStyle(el);
    if (cs.outlineStyle === 'none' && cs.outlineWidth === '0px') {
      // Only a problem if nothing else could show focus.
      const hasAlt = cs.boxShadow !== 'none' || cs.borderStyle !== 'none';
      if (!hasAlt) warn.push(`focus may be invisible (outline:none, no fallback) — ${label(el)}`);
    }
  }

  /* --- colour contrast (WCAG 2.1 AA) -------------------------------------- */
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(',').map((n) => parseFloat(n));
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const effectiveBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  for (const el of document.querySelectorAll('p, h1, h2, h3, h4, li, a, span, td, label, button')) {
    if (el.children.length) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.5) continue;

    const fg = parse(cs.color);
    if (!fg || fg.a < 0.5) continue;
    const bg = effectiveBg(el);
    contrastChecked++;

    const L1 = lum(fg);
    const L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const required = large ? 3 : 4.5;

    if (ratio < required)
      fail.push(
        `contrast ${ratio.toFixed(2)}:1 below ${required}:1 — "${text.slice(0, 30)}" (${label(el)}, ${cs.fontSize})`
      );
  }

  /* --- tap targets, WCAG 2.5.8 (mobile only, checked by the caller) --------- */

  /**
   * 24x24 is the minimum, but the success criterion has exceptions and this
   * check used to ignore them, which made it useless: it reported 780 warnings
   * on this site, every one of them a conforming footer link. A check that
   * cries wolf on every page is a check nobody reads, so the two exceptions
   * that actually apply to a content site are implemented here.
   *
   *   Spacing — an undersized target passes if a 24px-diameter circle centred
   *   on it intersects no other target. The footer lists are 20px tall on a
   *   31px vertical pitch, so they conform; a cramped icon row would not, and
   *   is still reported.
   *
   *   Inline — a link sitting in a sentence is sized by the line-height of
   *   text around it, which the author does not control per-link.
   *
   * Equivalent targets (the same href reachable at a conforming size elsewhere
   * on the page) are NOT implemented, so this can still over-report. It errs
   * toward reporting, which is the right direction for a warning.
   */
  /**
   * Only things a finger can actually reach.
   *
   * The closed mega menu keeps full layout at visibility:hidden/opacity:0, so
   * its links have real boxes sitting over the top of the page. Counting them
   * made every breadcrumb look like it was touching a neighbour, which is how
   * a spacing rule reports a collision with something that is not on screen.
   */
  const hittable = (el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.pointerEvents === 'none') return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      // opacity does not inherit into the computed style, so walk for it.
      if (parseFloat(getComputedStyle(n).opacity) === 0) return false;
      if (n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true') return false;
    }
    return true;
  };

  const targets = [];
  for (const el of document.querySelectorAll('a[href], button')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!hittable(el)) continue;
    targets.push({ el, r, cx: r.left + r.width / 2, cy: r.top + r.height / 2 });
  }

  /** In a sentence: inline, with non-target text beside it in its parent. */
  const inSentence = (el) => {
    if (getComputedStyle(el).display !== 'inline') return false;
    const parent = el.parentElement;
    if (!parent) return false;
    const own = (el.textContent || '').trim();
    const around = (parent.textContent || '').trim();
    return around.length > own.length + 1;
  };

  /** A 24px circle on this target touches nothing else clickable. */
  const wellSpaced = (t) => {
    for (const o of targets) {
      if (o.el === t.el || t.el.contains(o.el) || o.el.contains(t.el)) continue;
      // Closest point of the other target's box to this one's centre.
      const dx = Math.max(o.r.left - t.cx, 0, t.cx - o.r.right);
      const dy = Math.max(o.r.top - t.cy, 0, t.cy - o.r.bottom);
      if (Math.hypot(dx, dy) < 12) return false;
    }
    return true;
  };

  const small = [];
  for (const t of targets) {
    if (t.r.width >= 24 && t.r.height >= 24) continue;
    if (wellSpaced(t) || inSentence(t.el)) continue;
    small.push(`${Math.round(t.r.width)}x${Math.round(t.r.height)} — ${label(t.el)}`);
  }

  return { fail, warn, elements, contrastChecked, small };
};

/* -------------------------------------------------------------------- run -- */

fs.mkdirSync(RUN_DIR, { recursive: true });
const browser = await launch();
const report = [];

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    const page = await browser.newPage();
    try {
      await preparePage(page, vp);
      const res = await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 });
      if (!res || ![200, 304].includes(res.status())) {
        errors.push(`${route} @${vp.name}: HTTP ${res ? res.status() : 'none'}`);
        continue;
      }
      await page.evaluate(() => document.fonts.ready);
      await settle(page);

      const r = await page.evaluate(AUDIT);
      stats.pages++;
      stats.elements += r.elements;
      stats.contrastChecked += r.contrastChecked;

      for (const f of r.fail) errors.push(`${route} @${vp.name}: ${f}`);
      for (const w of r.warn) warnings.push(`${route} @${vp.name}: ${w}`);
      // Tap-target minimums only apply to touch viewports.
      const taps = vp.width < 500 ? r.small.map((s) => `tap target ${s}`) : [];
      for (const t of taps) warnings.push(`${route} @${vp.name}: ${t}`);

      // Tap-target findings go into the artifact too. They used to be pushed
      // to the console list only, so the saved report disagreed with what the
      // run printed — and the report is the thing anyone reads afterwards.
      report.push({ route, viewport: vp.name, fail: r.fail, warn: [...r.warn, ...taps] });
    } finally {
      await page.close();
    }
  }
}

await browser.close();

fs.writeFileSync(
  path.join(RUN_DIR, 'a11y.json'),
  JSON.stringify({ base: BASE, viewports: VIEWPORTS.map((v) => v.name), stats, report }, null, 2)
);

console.log(`  pages audited:      ${stats.pages}`);
console.log(`  interactive checked:${stats.elements}`);
console.log(`  contrast samples:   ${stats.contrastChecked}`);
console.log(`  report:             ${path.join(RUN_DIR, 'a11y.json')}`);

const uniq = (a) => [...new Set(a)];

if (warnings.length) {
  console.log(`\n  WARN — ${uniq(warnings).length} distinct:`);
  console.log(uniq(warnings).slice(0, 20).map((w) => '    ' + w).join('\n'));
}

if (errors.length) {
  console.error(`\nFAIL — A11Y AUDIT, ${uniq(errors).length} distinct problem(s):`);
  console.error(uniq(errors).slice(0, 40).map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
console.log('\nPASS — A11Y AUDIT: names, labels, headings, landmarks, ids, contrast.');
