/**
 * RTL and Arabic typography audit.
 *
 * These rules are brand requirements, not preferences, and they fail silently:
 * Arabic is cursive, so positive tracking breaks the letterforms' joins and
 * negative tracking crushes them — but nothing errors, nothing 404s, and the
 * page still measures fine. This regressed once already, because the reset was
 * written as `:lang(ar) *` (0,1,0) and lost on specificity to `.ftr h4` (0,1,1).
 *
 * Asserts, for every Arabic route:
 *   - <html lang="ar" dir="rtl">
 *   - no element containing Arabic text carries letter-spacing
 *   - no horizontal overflow (the classic RTL failure)
 *   - the floating theme button stays bottom-RIGHT, which is deliberate
 */
import { launch, preparePage, settle, ROUTES } from './lib/browser.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:3200';
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '390x844', width: 390, height: 844 },
];

const AR_ROUTES = ROUTES.filter((r) => r.startsWith('/ar'));
const problems = [];
let arabicChecked = 0;
let comparisons = 0;

const browser = await launch();

for (const vp of VIEWPORTS) {
  for (const route of AR_ROUTES) {
    const page = await browser.newPage();
    try {
      await preparePage(page, vp);
      const res = await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 });
      if (!res || ![200, 304].includes(res.status())) {
        problems.push(`${route} @${vp.name}: HTTP ${res ? res.status() : 'none'}`);
        continue;
      }
      await page.evaluate(() => document.fonts.ready);
      await settle(page);

      const r = await page.evaluate(() => {
        const arabic = /[؀-ۿ]/;
        const spaced = [];
        let checked = 0;

        for (const el of document.querySelectorAll('body *')) {
          if (el.children.length) continue;
          const text = el.textContent || '';
          if (!arabic.test(text)) continue;
          checked++;
          const ls = getComputedStyle(el).letterSpacing;
          if (ls !== 'normal' && ls !== '0px')
            spaced.push({ cls: (el.className || el.tagName).toString().slice(0, 40), ls });
        }

        const overflowing = [];
        for (const el of document.querySelectorAll('body *')) {
          const box = el.getBoundingClientRect();
          if (box.width > 0 && (box.right > window.innerWidth + 1 || box.left < -1))
            overflowing.push((el.className || el.tagName).toString().slice(0, 40));
        }

        const fab = document.querySelector('.tl-theme');
        const fabCs = fab ? getComputedStyle(fab) : null;

        return {
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          checked,
          spaced,
          docOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          overflowing: overflowing.slice(0, 5),
          fabRight: fabCs ? fabCs.right : null,
          fabLeft: fabCs ? fabCs.left : null,
        };
      });

      comparisons++;
      arabicChecked += r.checked;

      if (r.lang !== 'ar') problems.push(`${route} @${vp.name}: <html lang="${r.lang}">, expected "ar"`);
      if (r.dir !== 'rtl') problems.push(`${route} @${vp.name}: <html dir="${r.dir}">, expected "rtl"`);
      if (!r.checked) problems.push(`${route} @${vp.name}: no Arabic text found — is this page actually translated?`);

      for (const s of r.spaced)
        problems.push(`${route} @${vp.name}: Arabic is letter-spaced (${s.ls}) on ${s.cls}`);

      if (r.docOverflow)
        problems.push(`${route} @${vp.name}: horizontal overflow — ${r.overflowing.join(', ')}`);

      // Brand decision: the floating utility button does NOT mirror in RTL.
      if (r.fabRight && parseFloat(r.fabRight) > 200)
        problems.push(`${route} @${vp.name}: theme button drifted from the right edge (right:${r.fabRight})`);
    } finally {
      await page.close();
    }
  }
}

await browser.close();

console.log(`  arabic routes:      ${AR_ROUTES.length}`);
console.log(`  viewports:          ${VIEWPORTS.map((v) => v.name).join(', ')}`);
console.log(`  comparisons:        ${comparisons}`);
console.log(`  arabic elements:    ${arabicChecked} checked for letter-spacing`);

if (problems.length) {
  console.error(`\nRTL AUDIT FAILED — ${problems.length} problem(s):`);
  console.error([...new Set(problems)].slice(0, 40).map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log('\nRTL AUDIT OK — lang/dir correct, no letter-spaced Arabic, no overflow.');
