import fs from 'node:fs';
import path from 'node:path';
import type { Block, Locale, PageDoc, SvgNode } from './blocks';

const DIR = path.join(process.cwd(), 'content');

/**
 * Parsed documents are memoized in production builds.
 *
 * Every one of these files is read straight off disk and re-parsed on each call,
 * and the call graph fans out badly: `getPage` resolved its route by reading
 * `routes.json` again, so `allDocs()` — used by the sitemap, the schema builder
 * and the audits — re-read and re-parsed that file once per route on top of the
 * document itself. The content is immutable for the lifetime of a build, so the
 * repeat work buys nothing.
 *
 * Dev is deliberately left uncached: content JSON is not part of the module
 * graph, so Next never invalidates it, and a cache there would mean restarting
 * the server to see an edit.
 */
const MEMOIZE = process.env.NODE_ENV === 'production';
const docs = new Map<string, unknown>();

const read = <T,>(...seg: string[]): T => {
  const key = seg.join('/');
  if (MEMOIZE && docs.has(key)) return docs.get(key) as T;
  const value = JSON.parse(fs.readFileSync(path.join(DIR, ...seg), 'utf8')) as T;
  if (MEMOIZE) docs.set(key, value);
  return value;
};

export interface RouteEntry {
  /** Locale-less route id, e.g. "/services/simulation-systems". */
  route: string;
  slug: string;
}

export interface Media {
  src: string;
  alt: string;
  invert?: boolean;
}

export interface NewsItem {
  slug: string;
  route: string;
  tag: string;
  type: string;
  date: string;
  title: string;
  media: Media | null;
  art: SvgNode | null;
}

export interface ChromeLink {
  label: string;
  href: string;
  ext?: boolean;
}

export interface LangLink {
  label: string;
  locale: Locale;
  current?: boolean;
}

export interface Chrome {
  note: string;
  skip: ChromeLink;
  /** Compact mark, used in the header. */
  logoImg: Media;
  /** Full lockup, used in the footer. */
  footerLogoImg: Media;
  utility: { links: ChromeLink[]; lang: LangLink[] };
  mega: {
    tabs: { key: string; label: string }[];
    panels: { key: string; title: string; links: ChromeLink[]; cta: ChromeLink }[];
  };
  footer: {
    columns: { logo?: boolean; title: string; links: ChromeLink[] }[];
    bar: { links: ChromeLink[]; a11yLabel: string; a11yPill: string; copyright: string };
  };
}

/** Every route id, locale-independent. The locale prefix is applied at render. */
export const getRoutes = (): RouteEntry[] => read<RouteEntry[]>('routes.json');

/** Route id -> filesystem slug, as a lookup rather than a scan per call. */
let index: Map<string, string> | null = null;

function slugOf(route: string): string | undefined {
  if (!index || !MEMOIZE) index = new Map(getRoutes().map((r) => [r.route, r.slug]));
  return index.get(route);
}

export const getChrome = (locale: Locale): Chrome => read<Chrome>(locale, 'chrome.json');

export const getNews = (locale: Locale): NewsItem[] => read<NewsItem[]>(locale, 'news-items.json');

/** Resolve a route id to its document for a locale, or null if unknown. */
export function getPage(locale: Locale, route: string): PageDoc | null {
  const slug = slugOf(route);
  if (slug === undefined) return null;
  const file = path.join(DIR, locale, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return read<PageDoc>(locale, `${slug}.json`);
}

export function allDocs(locale: Locale): PageDoc[] {
  return getRoutes()
    .map((r) => getPage(locale, r.route))
    .filter((d): d is PageDoc => d !== null);
}

export function allBlocks(locale: Locale): { route: string; block: Block }[] {
  return allDocs(locale).flatMap((doc) => doc.blocks.map((block) => ({ route: doc.route, block })));
}
