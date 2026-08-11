import type { MetadataRoute } from 'next';
import { getRoutes } from '@/lib/content';
import { LOCALES, altPaths } from '@/lib/i18n';

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://www.3lines.com.sa';

/**
 * One entry per route per locale, each carrying its `languages` alternates so
 * the emitted sitemap is a proper bilingual one rather than two flat lists.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return getRoutes().flatMap((r) => {
    const alts = altPaths(r.route);
    return LOCALES.map((locale) => ({
      url: `${SITE_ORIGIN}${alts[locale]}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: r.route === '/' ? 1 : 0.7,
      alternates: {
        languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_ORIGIN}${alts[l]}`])),
      },
    }));
  });
}
