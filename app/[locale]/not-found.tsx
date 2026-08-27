import { getRouteTitles, getRoutes } from '@/lib/content';
import { LOCALES, type Locale } from '@/lib/i18n';
import { ui } from '@/lib/ui';
import NotFoundBody from './NotFoundBody';

/**
 * 404 for the locale tree.
 *
 * Without this, an unmatched path under the optional catch-all throws
 * `NoFallbackError` in the server log instead of rendering a page.
 *
 * A not-found boundary receives no params, so the locale cannot be known here
 * on the server. Both languages' strings and links are prepared and a small
 * client component picks the right set from the URL — the previous version
 * rendered English text and `/en` links to Arabic readers.
 */
export default function NotFound() {
  const routes = getRoutes().slice(0, 6);

  /* Titles come from the bundled map, NOT from getPage. getPage reads a
     per-page document off the filesystem, and the 50 of those are deliberately
     unbundled — so in the Worker this boundary silently fell back to printing
     raw route ids as link text while localhost showed real titles. */
  const titles = getRouteTitles();

  const payload = Object.fromEntries(
    LOCALES.map((locale: Locale) => [
      locale,
      {
        strings: ui(locale),
        links: routes.map((r) => ({
          href: `/${locale}${r.route === '/' ? '' : r.route}`,
          // The page's own title, not the raw route id the old page printed.
          label: titles[r.route]?.[locale] ?? r.route,
        })),
      },
    ])
  );

  return <NotFoundBody payload={payload} />;
}
