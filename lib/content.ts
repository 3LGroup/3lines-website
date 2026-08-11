import fs from 'node:fs';
import path from 'node:path';
import type { Block, Locale, PageDoc, SvgNode } from './blocks';

const DIR = path.join(process.cwd(), 'content');

const read = <T,>(...seg: string[]): T =>
  JSON.parse(fs.readFileSync(path.join(DIR, ...seg), 'utf8')) as T;

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

export const getChrome = (locale: Locale): Chrome => read<Chrome>(locale, 'chrome.json');

export const getNews = (locale: Locale): NewsItem[] => read<NewsItem[]>(locale, 'news-items.json');

/** Resolve a route id to its document for a locale, or null if unknown. */
export function getPage(locale: Locale, route: string): PageDoc | null {
  const entry = getRoutes().find((r) => r.route === route);
  if (!entry) return null;
  const file = path.join(DIR, locale, `${entry.slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PageDoc;
}

export function allDocs(locale: Locale): PageDoc[] {
  return getRoutes()
    .map((r) => getPage(locale, r.route))
    .filter((d): d is PageDoc => d !== null);
}

export function allBlocks(locale: Locale): { route: string; block: Block }[] {
  return allDocs(locale).flatMap((doc) => doc.blocks.map((block) => ({ route: doc.route, block })));
}
