import fs from 'node:fs';
import path from 'node:path';
import type { Block, Locale, PageDoc, SvgNode } from './blocks';

import routesJson from '../content/routes.json';
import chromeEn from '../content/en/chrome.json';
import chromeAr from '../content/ar/chrome.json';
import newsEn from '../content/en/news-items.json';
import newsAr from '../content/ar/news-items.json';
import settingsJson from '../content/settings.json';
import uiEn from '../content/en/ui.json';
import uiAr from '../content/ar/ui.json';

const DIR = path.join(process.cwd(), 'content');

/**
 * The documents that must survive without a filesystem.
 *
 * Every public route is prerendered, so `fs` below is answered at build time
 * where content/ genuinely exists. The preview is not: it is force-dynamic and
 * renders inside the Worker, where process.cwd() is `/bundle` and content/ was
 * never uploaded — it is neither in the Worker bundle nor in Static Assets. So
 * the newsGrid body called getNews(), the read failed, and the preview iframe
 * died with "no such file or directory, readAll '/bundle/content/en/news-items.json'"
 * while the CMS around it and the whole public site worked. That asymmetry is
 * exactly why it took a Worker log to see.
 *
 * Importing these statically makes esbuild inline them, so the read cannot fail
 * at runtime. lib/assets.ts already solved the same Worker-has-no-filesystem
 * problem for the asset manifest, for the same reason and in the same way.
 *
 * Only the chrome, the route table, the news index and the site settings are
 * here — the things a request-time render reaches for. The 50 per-page
 * documents stay on `fs`: they are read by generateStaticParams at build time,
 * and bundling the whole corpus would add it to every Worker invocation to
 * serve a path that is never taken at runtime.
 */
const BUNDLED: Record<string, unknown> = {
  'routes.json': routesJson,
  'en/chrome.json': chromeEn,
  'ar/chrome.json': chromeAr,
  'en/news-items.json': newsEn,
  'ar/news-items.json': newsAr,
  'settings.json': settingsJson,
  'en/ui.json': uiEn,
  'ar/ui.json': uiAr,
};

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

  // Bundled copies win, and are checked before the cache is even consulted for
  // them: they cost nothing to return and they are the only path that works
  // when this runs in a Worker rather than during the build.
  const bundled = BUNDLED[key];
  if (bundled !== undefined) return bundled as T;

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
}

/**
 * The header, mega menu and footer. CMS-owned: stored in D1 (chrome_docs /
 * chrome_translations) and exported to content/{locale}/chrome.json.
 *
 * Two fields the file used to carry are gone on purpose: the footer bar's
 * note/badge/copyright now render from Site info (settings.json) so editing
 * the year or address changes the footer, and the language switcher's
 * `current` flag is computed at render — storing it per locale was the one
 * structural divergence between the two chrome documents.
 */
export interface Chrome {
  skip: ChromeLink;
  /** Compact mark, used in the header. */
  logoImg: Media;
  /** Full lockup, used in the footer. */
  footerLogoImg: Media;
  utility: { links: ChromeLink[]; lang: LangLink[] };
  mega: {
    /**
     * An item with an `href` is a direct link — a destination with nothing
     * beneath it, so it navigates rather than opening a panel. Items without
     * one are tabs and must have a matching entry in `panels`.
     */
    tabs: { key: string; label: string; href?: string }[];
    panels: { key: string; title: string; links: ChromeLink[]; cta: ChromeLink }[];
  };
  footer: {
    columns: { logo?: boolean; title: string; links: ChromeLink[] }[];
  };
}

/**
 * Site-wide values, edited under the CMS's "Site info" and exported to
 * content/settings.json.
 *
 * Localized values are `{ en, ar }` records; the rest are single shared strings
 * where null means "deliberately unset" — settings.whatsapp being null is what
 * keeps the WhatsApp icon out of the social strip. Every consumer must treat a
 * missing key as absent rather than crash: the file predates several of these
 * keys and older exports may still be on disk.
 */
export interface Settings {
  address: string | null;
  commercialRegNo: string | null;
  vatRegNo: string | null;
  linkedIn: string | null;
  copyrightYear: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  companyDescription: Partial<Record<Locale, string>>;
  companyName: Partial<Record<Locale, string>>;
  /** Short brand name for page titles and share cards, per locale. */
  siteName?: Partial<Record<Locale, string>>;
  /** Suffix after the page title in the browser tab ("%s | 3Lines"). */
  titleBrand?: string | null;
  /** The "LINES" half of the header lockup beside the logo mark. */
  wordmarkName?: string | null;
  /** The "Advanced Technologies Company" line under the wordmark. */
  wordmarkTag?: string | null;
  /** The green "Established 2019" pill in the footer bar, per locale. */
  establishedBadge?: Partial<Record<Locale, string>>;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  /** Public path of the logo used in structured data. */
  logoUri?: string | null;
  /** Public path of the browser-tab icon. */
  faviconUri?: string | null;
}

export const getSettings = (): Settings => read<Settings>('settings.json');

/**
 * Interface microcopy — the strings that belong to the design rather than to
 * any page: menu buttons, aria labels, the theme toggle, the 404 page. Edited
 * under the CMS's "Interface text" and exported to content/{locale}/ui.json;
 * lib/ui.ts overlays these onto its literal fallbacks.
 */
export const getUiStrings = (locale: Locale): Partial<Record<string, string>> =>
  read<Partial<Record<string, string>>>(locale, 'ui.json');

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
