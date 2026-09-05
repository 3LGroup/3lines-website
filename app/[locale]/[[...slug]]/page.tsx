import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BlockRenderer from '@/components/blocks/Blocks';
import { getPage, getRoutes } from '@/lib/content';
import { pageSchema } from '@/lib/schema';
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

/**
 * True, so an unknown slug under a KNOWN locale reaches Page(), whose
 * `notFound()` renders the localized 404 inside the locale's own layout —
 * with dynamicParams=false those URLs got Next's bare default 404 instead,
 * outside any layout, in English, with no navigation.
 *
 * The locale layout keeps its own dynamicParams=false, so /xx/anything is
 * still refused before any rendering. The dynamic render this allows is
 * Worker-safe by construction: getPage resolves the route against the bundled
 * routes.json first and returns null for anything unknown, so no filesystem
 * read is ever attempted for a URL that is not a real page.
 */
export const dynamicParams = true;

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
    /* `keywords` is deliberately not emitted.
       Google has ignored the meta keywords tag for well over a decade and Bing
       treats it as a spam signal, so the best case was neutral. The actual case
       was worse: the value is byte-identical across all four locales — the
       Japanese and Korean pages carried Arabic tokens and an English keyword
       list — and contains an empty term from a doubled comma ("parts,,ground").

       The field is still stored and still editable in the CMS; it simply has no
       consumer. Retiring it there is a separate change, in D1 and the admin form,
       not here. */
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
        ...Object.fromEntries(LOCALES.map((l) => [l, `${SITE_ORIGIN}${alts[l]}`])),
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

  const route = routeOf(slug);
  const doc = getPage(locale, route);
  if (!doc) notFound();

  /* Page-level JSON-LD: breadcrumbs everywhere below the top level, plus Service
     on the ten service pages and NewsArticle on the four news items. The
     Organization block stays in the layout — it describes the site, not the
     page. Returns null when a route has nothing to add, so the flat pages do not
     carry an empty graph. */
  const schema = pageSchema(locale, route, doc);

  return (
    <>
      {schema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ) : null}
      {doc.blocks.map((block, i) => (
        <BlockRenderer block={block} locale={locale} key={i} />
      ))}
    </>
  );
}
