import { LOCALES, type Locale, type PageDoc } from './blocks';
import { SITE_ORIGIN } from './seo';
import { getNews, getRouteTitles, getSettings } from './content';
import { localePath } from './i18n';

/** schema.org wants language names, not BCP-47 tags, in availableLanguage. */
const LANGUAGE_NAME: Record<Locale, string> = {
  en: 'English',
  ar: 'Arabic',
  ja: 'Japanese',
  ko: 'Korean',
};

/**
 * JSON-LD, built from content/settings.json — the file the CMS exports — so a
 * Site-info edit in the admin actually reaches the structured data. This used
 * to read source-content/, the archived migration input, which meant every CMS
 * edit was invisible here; that was the exact breakage the export script's
 * comment warned about.
 *
 * Next's metadata API has no JSON-LD slot, so this is rendered as a script tag
 * by the layout.
 */
export function organizationSchema(locale: Locale) {
  const s = getSettings();
  /* Every other locale's name, not "the other one". This was
     `locale === 'ar' ? 'en' : 'ar'`, a two-locale ternary that left the Japanese
     and Korean pages declaring the Arabic name as their alternate. schema.org
     accepts a list here. */
  const name = s.companyName?.[locale] ?? s.companyName?.en ?? '';
  /* Deduped, and never repeating the primary name: ja and ko both still carry
     the untranslated English company name, so a naive list emitted it twice
     alongside the name already in `name`. */
  const alternateNames = [
    ...new Set(
      LOCALES.filter((l) => l !== locale)
        .map((l) => s.companyName?.[l])
        .filter((n): n is string => Boolean(n) && n !== name)
    ),
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    alternateName: alternateNames,
    url: `${SITE_ORIGIN}/${locale}`,
    logo: `${SITE_ORIGIN}/${(s.logoUri ?? 'assets/logos/logo.png').replace(/^\//, '')}`,
    description: s.companyDescription?.[locale] ?? s.companyDescription?.en ?? '',
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.address ?? '',
      addressLocality: s.city ?? 'Riyadh',
      postalCode: s.postalCode ?? '13215',
      addressCountry: s.country ?? 'SA',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: s.phone ?? '',
      email: s.email ?? '',
      /* Derived from LOCALES rather than listed, so adding a locale does not
         leave this claiming the site speaks two languages when it speaks four. */
      availableLanguage: LOCALES.map((l) => LANGUAGE_NAME[l]),
    },
    sameAs: [s.linkedIn].filter(Boolean),
    identifier: [
      { '@type': 'PropertyValue', name: 'Commercial Registration', value: s.commercialRegNo ?? '' },
      { '@type': 'PropertyValue', name: 'VAT Registration', value: s.vatRegNo ?? '' },
    ],
  };
}

/**
 * Everything a single page contributes, as one @graph.
 *
 * Rendered by the page rather than the layout, because all of it is
 * route-dependent. The Organization block stays in the layout: it describes the
 * site, not the page, and repeating it on all 100 routes would be a hundred
 * copies of the same claim.
 *
 * Deliberately NOT included: WebSite.potentialAction / SearchAction. The site
 * does have a search (components/Search.tsx), but it is an overlay that filters
 * a bundled index in the browser — there is no results URL, so there is no
 * urlTemplate to give. Declaring one would point crawlers at a route that does
 * not exist.
 */
export function pageSchema(locale: Locale, route: string, doc: PageDoc) {
  const graph: Record<string, unknown>[] = [];
  const url = `${SITE_ORIGIN}${localePath(locale, route)}`;
  const titles = getRouteTitles();
  const titleOf = (r: string) => titles[r]?.[locale] ?? titles[r]?.en ?? r;

  /* Breadcrumbs for anything below the top level. The service and news pages sit
     three deep and showed no trail in results at all. Built from the route's own
     path segments against route-titles.json, so a page whose parent has no
     document of its own still gets a correctly named crumb. */
  const segments = route.split('/').filter(Boolean);
  if (segments.length) {
    const trail = ['/'];
    for (let i = 0; i < segments.length; i += 1) trail.push(`/${segments.slice(0, i + 1).join('/')}`);
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: trail.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: r === '/' ? titleOf('/') : titleOf(r),
        item: `${SITE_ORIGIN}${localePath(locale, r)}`,
      })),
    });
  }

  if (route.startsWith('/services/')) {
    const s = getSettings();
    graph.push({
      '@type': 'Service',
      name: doc.title,
      description: doc.description,
      url,
      serviceType: doc.title,
      provider: { '@type': 'Organization', name: s.companyName?.[locale] ?? s.companyName?.en ?? '' },
      areaServed: { '@type': 'Country', name: s.country ?? 'SA' },
    });
  }

  if (route.startsWith('/news/')) {
    /* The listing carries the date and the image; the article document does not.
       Matching on route keeps the two from drifting apart. */
    const item = getNews(locale).find((n) => n.route === route);
    graph.push({
      '@type': 'NewsArticle',
      headline: doc.title,
      description: doc.description,
      url,
      mainEntityOfPage: url,
      inLanguage: locale,
      ...(item?.date ? { datePublished: item.date } : {}),
      ...(item?.media?.src ? { image: `${SITE_ORIGIN}${item.media.src}` } : {}),
      publisher: { '@type': 'Organization', name: getSettings().companyName?.[locale] ?? '' },
    });
  }

  if (!graph.length) return null;
  return { '@context': 'https://schema.org', '@graph': graph };
}
