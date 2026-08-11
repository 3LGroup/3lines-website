/**
 * The measurement contract, shared by the audit and the baseline capture.
 *
 * These two MUST use the same selector list and the same measure function, or a
 * baseline diff compares apples to oranges and reports differences that are
 * really just harness drift. Keeping them in one module makes that structural
 * rather than a convention someone has to remember.
 */

export const SELECTORS = [
  '.utility', '.utility__inner',
  '.hdr', '.hdr__inner', '.hdr__logo', '.hdr__burger', '.hdr__search',
  'main#main',
  '.hero', '.hero__inner', '.hero h1', '.hero p',
  '.pagehead', '.pagehead h1', '.crumbs',
  'section.section', 'section.section > .wrap',
  '.sec-head', '.kicker', '.h2', '.lede',
  '.tiles3', '.tile', '.tile__body', '.tile__body h3',
  '.cards3', '.pcard', '.pcard__media', '.pcard h3', '.pcard p',
  '.feature', '.feature__media', '.feature .h3',
  '.figures', '.figure__num', '.figure__lab',
  '.newsgrid', '.ncard', '.ncard__media', '.ncard__body', '.ncard h3', '.ncard__meta',
  '.careers', '.careers h2',
  '.socialstrip',
  '.arrowlink', '.btn',
  'footer.ftr', '.ftr__grid', '.ftr__grid > div', '.ftr__bar', '.ftr__logo',

  // 3Lines content components. Listed now so the baseline and the audit agree
  // even before every one of them exists on a page — a selector that matches
  // nothing on both sides is simply a 0/0 count, not a finding.
  '.heroslides', '.heroslide', '.dots', '.dot',
  '.defs', '.defcard', '.defcard__meta',
  '.speclist', '.speclist div',
  '.logos', '.logos div', '.logos img',
  '.certs', '.certs li', '.certs img',
  '.form', '.field', '.field input', '.field textarea', '.form__status',
  '.rotator', '.tags', '.tag',
];

/**
 * Runs in the page. Must be a real function — passing this to page.evaluate as a
 * string silently drops the argument, every selector matches zero elements, and
 * the audit reports a false pass.
 */
export const MEASURE = (selectors) => {
  const num = (v) => Math.round(parseFloat(v) * 100) / 100;
  const out = {};
  for (const sel of selectors) {
    const els = Array.from(document.querySelectorAll(sel));
    out[sel] = els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: num(r.x + window.scrollX), y: num(r.y + window.scrollY),
        w: num(r.width), h: num(r.height),
        mt: num(cs.marginTop), mb: num(cs.marginBottom),
        pt: num(cs.paddingTop), pb: num(cs.paddingBottom),
        pl: num(cs.paddingLeft), pr: num(cs.paddingRight),
        gap: cs.gap === 'normal' ? 0 : num(cs.rowGap || 0),
        cols: cs.gridTemplateColumns === 'none' ? '' : cs.gridTemplateColumns,
        fs: num(cs.fontSize), lh: cs.lineHeight === 'normal' ? 0 : num(cs.lineHeight),
        fw: cs.fontWeight, radius: num(cs.borderTopLeftRadius),
        display: cs.display, position: cs.position,
        fit: cs.objectFit, bgSize: cs.backgroundSize,
        hasBg: cs.backgroundImage !== 'none',
      };
    });
  }
  out.__doc = [{
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
    bodyOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  }];
  return out;
};

/** Filesystem-safe key for a route ("/" -> "_root", "/a/b" -> "a__b"). */
export const routeKey = (route) => route.replace(/^\/+|\/+$/g, '').replace(/\//g, '__') || '_root';
