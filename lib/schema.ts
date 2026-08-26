import type { Locale } from './blocks';
import { SITE_ORIGIN } from './seo';
import { getSettings } from './content';

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
  const other: Locale = locale === 'ar' ? 'en' : 'ar';

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: s.companyName?.[locale] ?? s.companyName?.en ?? '',
    alternateName: s.companyName?.[other] ?? '',
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
      availableLanguage: ['English', 'Arabic'],
    },
    sameAs: [s.linkedIn].filter(Boolean),
    identifier: [
      { '@type': 'PropertyValue', name: 'Commercial Registration', value: s.commercialRegNo ?? '' },
      { '@type': 'PropertyValue', name: 'VAT Registration', value: s.vatRegNo ?? '' },
    ],
  };
}
