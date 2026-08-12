import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlockRenderer from '@/components/blocks/Blocks';
import { getPage, getRoutes } from '@/lib/content';
import { LOCALES, altPaths, isLocale, type Locale } from '@/lib/i18n';
import { SITE_ORIGIN, openGraph } from '@/lib/seo';

type Params = { params: Promise<{ locale: string; slug?: string[] }> };

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
    /* The three legal pages still carry placeholder source copy ("Privacy
       Policy Content"). The ingest already marks them; honouring that mark here
       means the worst case is a page nobody can find via search, rather than
       "Privacy Policy Content" ranking as this company's privacy policy.
       `follow` stays on so the links out of them still carry. The flag clears
       itself the moment real copy lands — nothing to remember to undo. */
    robots: doc.placeholder ? { index: false, follow: true } : undefined,
    alternates: {
      canonical: `${SITE_ORIGIN}${alts[locale]}`,
      languages: {
        en: `${SITE_ORIGIN}${alts.en}`,
        ar: `${SITE_ORIGIN}${alts.ar}`,
        'x-default': `${SITE_ORIGIN}${alts.en}`,
      },
    },
    openGraph: openGraph(locale, {
      title: doc.title,
      description: doc.description,
      path: alts[locale],
    }),
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
