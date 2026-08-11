/**
 * The source markup links between pages with `*.html` hrefs. The deployment
 * 308-redirects those to clean paths, so we resolve them at render time to the
 * final destination — same target, no redirect hop, and the link audit sees the
 * real route rather than a redirect stub.
 */
export function toRoute(href: string | undefined): string {
  if (!href) return '#';
  if (/^[a-z]+:/i.test(href) || href.startsWith('//')) return href;
  if (href.startsWith('#')) return href;

  const m = href.match(/^([^#?]*)([#?].*)?$/);
  if (!m) return href;

  const rest = m[2] ?? '';
  let file = m[1].replace(/^\.?\//, '').replace(/\.html$/i, '');
  if (file === 'index') file = '';

  return '/' + file + rest;
}
