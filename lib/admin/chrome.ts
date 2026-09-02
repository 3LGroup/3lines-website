import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { mergeProps, splitProps, type Json } from '@/lib/localization';
import { isAdmissibleAsset } from './media';
import { validateHref } from './hrefs';
import type { Locale } from './content';

const LOCALES: Locale[] = ['en', 'ar', 'ja', 'ko'];
const CHROME_ID = 'chrome';

/* ---------------------------------------------------------------- editing -- */

/**
 * The editor's view of the chrome: ONE structural tree whose copy leaves hold
 * both languages side by side.
 *
 * The storage model (a locale-free document plus one overlay per locale) makes
 * EN/AR structural divergence unrepresentable; this shape carries the same
 * guarantee into the editor. Adding a link adds it to both languages at once,
 * because there is only one list to add it to.
 */
export interface L10nText {
  en: string;
  ar: string;
  ja: string;
  ko: string;
}

export interface NavLink {
  label: L10nText;
  href: string;
}

export interface NavChrome {
  skip: { label: L10nText; href: string };
  logoImg: { src: string; alt: L10nText };
  footerLogoImg: { src: string; alt: L10nText };
  utility: { links: NavLink[]; lang: { label: L10nText; locale: string }[] };
  mega: {
    tabs: { key: string; label: L10nText; href?: string }[];
    panels: { key: string; title: L10nText; links: NavLink[]; cta: NavLink }[];
  };
  footer: { columns: { logo?: boolean; title: L10nText; links: NavLink[] }[] };
}

/* ------------------------------------------------------------------- read -- */

type Doc = Record<string, any>;

async function readDocs(): Promise<Record<Locale, Doc>> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.chromeDocs)
    .where(eq(schema.chromeDocs.id, CHROME_ID))
    .limit(1);
  if (!row) {
    throw new Error(
      'The navigation has not been imported into this database yet — run `npm run db:import:local`.'
    );
  }
  const tr = await db
    .select()
    .from(schema.chromeTranslations)
    .where(eq(schema.chromeTranslations.id, CHROME_ID));
  const trOf = new Map(tr.map((t) => [t.locale, t.props as Json]));

  return Object.fromEntries(
    LOCALES.map((l) => [l, mergeProps(row.props as Json, trOf.get(l) ?? null) as Doc])
  ) as Record<Locale, Doc>;
}

/**
 * Every merged document shares every structural value — the importer and every
 * save assert it — so arrays align index-for-index across all four locales and
 * picking by the same path from each document cannot mispair.
 */
export async function getNavigation(): Promise<NavChrome> {
  const docs = await readDocs();
  const en = docs.en;

  const loc = (pick: (d: Doc) => unknown): L10nText =>
    Object.fromEntries(
      LOCALES.map((l) => {
        const v = pick(docs[l] ?? ({} as Doc));
        return [l, typeof v === 'string' ? v : ''];
      })
    ) as unknown as L10nText;

  const zipLinks = (pick: (d: Doc) => Doc[] | undefined): NavLink[] =>
    (pick(en) ?? []).map((l: Doc, i: number) => ({
      label: loc((d) => pick(d)?.[i]?.label),
      href: String(l.href ?? ''),
    }));

  return {
    skip: { label: loc((d) => d.skip?.label), href: String(en.skip?.href ?? '#main') },
    logoImg: { src: String(en.logoImg?.src ?? ''), alt: loc((d) => d.logoImg?.alt) },
    footerLogoImg: {
      src: String(en.footerLogoImg?.src ?? ''),
      alt: loc((d) => d.footerLogoImg?.alt),
    },
    utility: {
      links: zipLinks((d) => d.utility?.links),
      lang: (en.utility?.lang ?? []).map((l: Doc, i: number) => ({
        label: loc((d) => d.utility?.lang?.[i]?.label),
        locale: String(l.locale ?? ''),
      })),
    },
    mega: {
      tabs: (en.mega?.tabs ?? []).map((t: Doc, i: number) => ({
        key: String(t.key ?? ''),
        label: loc((d) => d.mega?.tabs?.[i]?.label),
        ...(t.href !== undefined ? { href: String(t.href) } : {}),
      })),
      panels: (en.mega?.panels ?? []).map((p: Doc, i: number) => ({
        key: String(p.key ?? ''),
        title: loc((d) => d.mega?.panels?.[i]?.title),
        links: zipLinks((d) => d.mega?.panels?.[i]?.links),
        cta: {
          label: loc((d) => d.mega?.panels?.[i]?.cta?.label),
          href: String(p.cta?.href ?? ''),
        },
      })),
    },
    footer: {
      columns: (en.footer?.columns ?? []).map((c: Doc, i: number) => ({
        ...(c.logo ? { logo: true } : {}),
        title: loc((d) => d.footer?.columns?.[i]?.title),
        links: zipLinks((d) => d.footer?.columns?.[i]?.links),
      })),
    },
  };
}

/* ------------------------------------------------------------------ write -- */

function requireText(t: L10nText, where: string): void {
  if (!t.en.trim() || !t.ar.trim()) {
    throw new Error(`${where}: both the English and Arabic text are required.`);
  }
}

/** Rebuild one locale's chrome.json document, in the canonical key order. */
function unzipDoc(nav: NavChrome, locale: Locale): Doc {
  const t = (v: L10nText) => v[locale];
  const link = (l: NavLink) => ({ label: t(l.label), href: l.href });

  return {
    skip: { label: t(nav.skip.label), href: nav.skip.href },
    logoImg: { src: nav.logoImg.src, alt: t(nav.logoImg.alt) },
    footerLogoImg: { src: nav.footerLogoImg.src, alt: t(nav.footerLogoImg.alt) },
    utility: {
      links: nav.utility.links.map(link),
      lang: nav.utility.lang.map((l) => ({ label: t(l.label), locale: l.locale })),
    },
    mega: {
      tabs: nav.mega.tabs.map((tab) => ({
        key: tab.key,
        label: t(tab.label),
        ...(tab.href !== undefined ? { href: tab.href } : {}),
      })),
      panels: nav.mega.panels.map((p) => ({
        key: p.key,
        title: t(p.title),
        links: p.links.map(link),
        cta: link(p.cta),
      })),
    },
    footer: {
      columns: nav.footer.columns.map((c) => ({
        ...(c.logo ? { logo: true } : {}),
        title: t(c.title),
        links: c.links.map(link),
      })),
    },
  };
}

export async function saveNavigation(nav: NavChrome): Promise<void> {
  const db = await getDb();

  // What counts as an internal destination, from the pages table — the same
  // list routes.json is exported from.
  const pageRows = await db.select({ route: schema.pages.route }).from(schema.pages);
  const routes = new Set(pageRows.map((r) => r.route));

  /* ------------------------------------------------------------ validate -- */

  requireText(nav.skip.label, 'Skip link');
  requireText(nav.logoImg.alt, 'Header logo alt text');
  requireText(nav.footerLogoImg.alt, 'Footer logo alt text');

  if (!nav.utility.links.length) throw new Error('The header needs at least one link.');
  for (const [i, l] of nav.utility.links.entries()) {
    requireText(l.label, `Header link ${i + 1}`);
    await validateHref(l.href, routes, `Header link ${i + 1}`);
  }
  for (const [i, l] of nav.utility.lang.entries()) {
    requireText(l.label, `Language label ${i + 1}`);
  }

  const panelKeys = new Set(nav.mega.panels.map((p) => p.key));
  for (const tab of nav.mega.tabs) {
    requireText(tab.label, `Menu tab "${tab.label.en || tab.key}"`);
    if (tab.href !== undefined) {
      await validateHref(tab.href, routes, `Menu tab "${tab.label.en}"`);
    } else if (!panelKeys.has(tab.key)) {
      // A tab without a destination opens the panel that shares its key; a tab
      // with neither would render a button that does nothing.
      throw new Error(`Menu tab "${tab.label.en}" has no destination and no panel to open.`);
    }
  }
  for (const p of nav.mega.panels) {
    requireText(p.title, `Menu panel "${p.title.en || p.key}"`);
    if (!p.links.length) throw new Error(`Menu panel "${p.title.en}" needs at least one link.`);
    for (const [i, l] of p.links.entries()) {
      requireText(l.label, `"${p.title.en}" link ${i + 1}`);
      await validateHref(l.href, routes, `"${p.title.en}" link ${i + 1}`);
    }
    requireText(p.cta.label, `"${p.title.en}" button`);
    await validateHref(p.cta.href, routes, `"${p.title.en}" button`);
  }

  for (const c of nav.footer.columns) {
    requireText(c.title, `Footer column "${c.title.en}"`);
    for (const [i, l] of c.links.entries()) {
      requireText(l.label, `"${c.title.en}" link ${i + 1}`);
      await validateHref(l.href, routes, `"${c.title.en}" link ${i + 1}`);
    }
  }

  for (const [field, src] of [
    ['Header logo', nav.logoImg.src],
    ['Footer logo', nav.footerLogoImg.src],
  ] as const) {
    if (!(await isAdmissibleAsset(src))) {
      throw new Error(`${field}: "${src}" is not an image this site ships.`);
    }
  }

  /* ------------------------------------------------------- split and save -- */

  const docs = Object.fromEntries(LOCALES.map((l) => [l, unzipDoc(nav, l)])) as Record<Locale, Doc>;
  const split = Object.fromEntries(LOCALES.map((l) => [l, splitProps(docs[l] as Json)])) as Record<
    Locale,
    { shared: Json; localized: Json }
  >;

  // Both guarantees the block pipeline enjoys, asserted here too: one structural
  // truth, and storage that reproduces its input exactly.
  const ref = JSON.stringify(split.en.shared);
  for (const l of LOCALES) {
    if (JSON.stringify(split[l].shared) !== ref) {
      throw new Error('Internal error: the two locales diverged structurally. Nothing was saved.');
    }
    if (JSON.stringify(mergeProps(split[l].shared, split[l].localized)) !== JSON.stringify(docs[l])) {
      throw new Error('Internal error: the navigation did not round-trip. Nothing was saved.');
    }
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .update(schema.chromeDocs)
    .set({ props: split.en.shared as Record<string, unknown>, updatedAt: now })
    .where(eq(schema.chromeDocs.id, CHROME_ID));
  for (const l of LOCALES) {
    await db
      .insert(schema.chromeTranslations)
      .values({ id: CHROME_ID, locale: l, props: split[l].localized as Record<string, unknown>, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.chromeTranslations.id, schema.chromeTranslations.locale],
        set: { props: split[l].localized as Record<string, unknown>, updatedAt: now },
      });
  }
}

/**
 * Swap one of the two logo images. Separate from saveNavigation for the same
 * reason collections split theirs: the picker posts a single image choice, not
 * the whole edited document, and must not clobber unsaved text edits.
 */
export async function setChromeImage(
  which: 'logoImg' | 'footerLogoImg',
  src: string
): Promise<void> {
  if (!(await isAdmissibleAsset(src))) {
    throw new Error(`"${src}" is not an image this site ships.`);
  }
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.chromeDocs)
    .where(eq(schema.chromeDocs.id, CHROME_ID))
    .limit(1);
  if (!row) throw new Error('The navigation has not been imported into this database yet.');

  const props = row.props as Doc;
  if (!props[which] || typeof props[which] !== 'object') {
    throw new Error(`The stored navigation has no ${which} slot.`);
  }
  props[which] = { ...props[which], src };

  await db
    .update(schema.chromeDocs)
    .set({ props, updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.chromeDocs.id, CHROME_ID));
}
