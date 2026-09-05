import type { MetadataRoute } from 'next';
import { getPage, getRoutes } from '@/lib/content';
import { LOCALES, altPaths } from '@/lib/i18n';
import { SITE_ORIGIN } from '@/lib/seo';

/**
 * One entry per route per locale, each carrying its `languages` alternates so
 * the emitted sitemap is a proper bilingual one rather than two flat lists.
 *
 * Documents still carrying placeholder source copy are left out. Submitting a
 * page to a crawler is an active request to index it, which would contradict the
 * `noindex` those same pages now render — so the two read from one flag.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return getRoutes().flatMap((r) => {
    const alts = altPaths(r.route);
    return LOCALES.filter((locale) => !getPage(locale, r.route)?.placeholder).map((locale) => ({
      url: `${SITE_ORIGIN}${alts[locale]}`,
      /* The page's real last edit, from D1 via content/routes.json.
         This used to be `new Date()`, which meant every URL claimed to have
         changed at build time — and a build runs on every Publish, so all 100
         lastmods moved together whenever anyone touched anything. A crawler
         discounts a sitemap that behaves like that, which costs exactly the
         pages that did change. Omitted rather than faked when the export has
         no timestamp to give. */
      lastModified: r.updated ? new Date(r.updated) : undefined,
      changeFrequency: 'monthly' as const,
      priority: r.route === '/' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_ORIGIN}${alts[l]}`])),
      },
    }));
  });
}
