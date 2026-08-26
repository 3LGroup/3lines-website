/**
 * Destinations an editor can point a link at.
 *
 * Internal links must be routes the site actually serves — the person editing
 * cannot check that "/servcies" is a typo, so the save has to. External and
 * protocol links pass with a syntax check only.
 */
export function validateHref(href: string, routes: Set<string>, where: string): void {
  if (!href) throw new Error(`${where}: the link needs a destination.`);
  if (href.startsWith('#')) return;
  if (/^https?:\/\//i.test(href) || /^(mailto|tel):/i.test(href)) return;
  if (href.startsWith('/')) {
    const clean = href.split('#')[0];
    if (routes.has(clean) || clean.startsWith('/assets/')) return;
    throw new Error(`${where}: "${href}" is not a page this site serves.`);
  }
  throw new Error(`${where}: "${href}" is not a link this editor can store.`);
}
