import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlockRenderer from '@/components/blocks/Blocks';
import { getPage, getRoutes } from '@/lib/content';
import { LOCALES, altPaths, isLocale, type Locale } from '@/lib/i18n';

type Params = { params: Promise<{ locale: string; slug?: string[] }> };

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://www.3lines.com.sa';

/** Every ingested route becomes a real static page in every locale. */
export function generateStaticParams() {
  return LOCALES.flatMap((locale) =>
    getRoutes().map((r) => ({
      locale,
      // "/" is the optional catch-all with no segments.
      slug: r.route === '/' ? [] : r.route.replace(/^\//, '').split('/'),
    }))
  );
}

export const dynamicParams = false;

/** Rebuild the locale-less route id from the URL segments. */
const routeOf = (slug?: string[]) => '/' + (slug ?? []).join('/');

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) return {};
  const locale = raw as Locale;

  const route = routeOf(slug);
  const doc = getPage(locale, route);
  if (!doc) return {};

  const alts = altPaths(route);

  return {
    title: doc.title,
    description: doc.description,
    keywords: doc.keywords,
    alternates: {
      canonical: `${SITE_ORIGIN}${alts[locale]}`,
      languages: {
        en: `${SITE_ORIGIN}${alts.en}`,
        ar: `${SITE_ORIGIN}${alts.ar}`,
        'x-default': `${SITE_ORIGIN}${alts.en}`,
      },
    },
    openGraph: {
      title: doc.title,
      description: doc.description,
      url: `${SITE_ORIGIN}${alts[locale]}`,
    },
  };
}

export default async function Page({ params }: Params) {
  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const doc = getPage(locale, routeOf(slug));
  if (!doc) notFound();

  return (
    <>
      {doc.blocks.map((block, i) => (
        <BlockRenderer block={block} locale={locale} key={i} />
      ))}
    </>
  );
}
