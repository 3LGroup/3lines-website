import fs from 'node:fs';
import path from 'node:path';
import type { Locale } from './blocks';
import { SITE_ORIGIN } from './seo';

/**
 * JSON-LD, built from the same source records the pages render from, so the
 * structured data cannot drift from the visible content.
 *
 * Next's metadata API has no JSON-LD slot, so this is rendered as a script tag
 * by the layout.
 */

const readSource = <T,>(file: string): T =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'source-content', file), 'utf8')) as T;

interface SiteInfo {
  address: string;
  commercialRegNo: string;
  vatRegNo: string;
  linkedIn: string;
  companyDescription: Record<string, string>;
}

interface Constants {
  data: {
    name_en: string;
    name_ar: string;
    email: string;
    phone: string;
    logo_uri: string;
  };
}

export function organizationSchema(locale: Locale) {
  const site = readSource<SiteInfo>('siteInfo.json');
  const { data: c } = readSource<Constants>('constants.json');

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: locale === 'ar' ? c.name_ar : c.name_en,
    alternateName: locale === 'ar' ? c.name_en : c.name_ar,
    url: `${SITE_ORIGIN}/${locale}`,
    logo: `${SITE_ORIGIN}/${c.logo_uri.replace(/^\//, '')}`,
    description: site.companyDescription[locale] ?? site.companyDescription.en,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address,
      addressLocality: 'Riyadh',
      postalCode: '13215',
      addressCountry: 'SA',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: c.phone,
      email: c.email,
      availableLanguage: ['English', 'Arabic'],
    },
    sameAs: [site.linkedIn].filter(Boolean),
    identifier: [
      { '@type': 'PropertyValue', name: 'Commercial Registration', value: site.commercialRegNo },
      { '@type': 'PropertyValue', name: 'VAT Registration', value: site.vatRegNo },
    ],
  };
}
