import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import type { Locale } from './content';

const LOCALES: Locale[] = ['en', 'ar'];

/* ------------------------------------------------------------------- news -- */

export interface NewsPost {
  id: string;
  slug: string;
  route: string;
  date: string;
  title: Record<Locale, string>;
  tag: Record<Locale, string>;
}

export async function listNews(): Promise<NewsPost[]> {
  const db = await getDb();
  const [items, tr] = await Promise.all([
    db.select().from(schema.newsItems).orderBy(asc(schema.newsItems.position)),
    db.select().from(schema.newsItemTranslations),
  ]);
  const of = new Map(tr.map((t) => [`${t.itemId}:${t.locale}`, t]));

  return items.map((i) => ({
    id: i.id,
    slug: i.slug,
    route: i.route,
    date: i.date,
    title: Object.fromEntries(
      LOCALES.map((l) => [l, of.get(`${i.id}:${l}`)?.title ?? ''])
    ) as Record<Locale, string>,
    tag: Object.fromEntries(LOCALES.map((l) => [l, of.get(`${i.id}:${l}`)?.tag ?? ''])) as Record<
      Locale,
      string
    >,
  }));
}

export interface NewsEdit {
  id: string;
  /** `date` is shared; `title` and `tag` are per locale. */
  field: 'date' | 'title' | 'tag';
  locale?: Locale;
  value: string;
}

export async function saveNews(edits: NewsEdit[]): Promise<number> {
  if (!edits.length) return 0;
  const db = await getDb();
  let n = 0;

  for (const e of edits) {
    if (e.field === 'date') {
      // The newsroom sorts on this, and NewsGrid renders it verbatim — a value
      // the Date constructor cannot read would silently reorder the page.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.value)) {
        throw new Error(`Date must be YYYY-MM-DD (got "${e.value}").`);
      }
      await db
        .update(schema.newsItems)
        .set({ date: e.value, updatedAt: Math.floor(Date.now() / 1000) })
        .where(eq(schema.newsItems.id, e.id));
    } else {
      if (!e.locale) throw new Error(`${e.field} needs a locale`);
      if (!e.value.trim()) throw new Error(`${e.field} cannot be empty.`);
      await db
        .update(schema.newsItemTranslations)
        .set({ [e.field]: e.value, updatedAt: Math.floor(Date.now() / 1000) })
        .where(
          and(
            eq(schema.newsItemTranslations.itemId, e.id),
            eq(schema.newsItemTranslations.locale, e.locale)
          )
        );
    }
    n++;
  }
  return n;
}

/* -------------------------------------------------------------- site info -- */

/**
 * The fields the previous CMS offered under "Site Info", in its order.
 *
 * `localized: true` means the value lives in settings_translations and gets an
 * English and an Arabic input; the rest are single shared values — a VAT number
 * does not have a language.
 */
export const SITE_FIELDS = [
  {
    key: 'companyDescription',
    label: 'Company description',
    localized: true,
    multiline: true,
    hint: 'Used in the site’s structured data and shared previews.',
  },
  { key: 'address', label: 'Address', localized: false, multiline: true },
  { key: 'commercialRegNo', label: 'Commercial registration no.', localized: false },
  { key: 'vatRegNo', label: 'VAT registration no.', localized: false },
  { key: 'linkedIn', label: 'LinkedIn URL', localized: false },
  { key: 'copyrightYear', label: 'Copyright year', localized: false },
  { key: 'email', label: 'Email', localized: false },
  { key: 'phone', label: 'Phone', localized: false },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    localized: false,
    hint: 'Empty by design — filling it in makes the WhatsApp icon appear in the contact strip.',
  },

  {
    key: 'companyName',
    label: 'Company name',
    localized: true,
    group: 'Brand',
    hint: 'The legal name — appears in the footer copyright and the structured data.',
  },
  {
    key: 'siteName',
    label: 'Site name',
    localized: true,
    group: 'Brand',
    hint: 'Short brand name used in browser-tab titles and share cards.',
  },
  {
    key: 'titleBrand',
    label: 'Title suffix',
    localized: false,
    group: 'Brand',
    hint: 'Appears after every page title in the browser tab, e.g. "About | 3Lines".',
  },
  {
    key: 'wordmarkName',
    label: 'Header wordmark',
    localized: false,
    group: 'Brand',
    hint: 'The large word beside the logo mark in the header.',
  },
  {
    key: 'wordmarkTag',
    label: 'Header wordmark tagline',
    localized: false,
    group: 'Brand',
    hint: 'The small line under the header wordmark.',
  },
  {
    key: 'establishedBadge',
    label: 'Footer badge',
    localized: true,
    group: 'Brand',
    hint: 'The green pill in the footer bar, e.g. "Established 2019".',
  },
  { key: 'website', label: 'Website URL', localized: false, group: 'Address details' },
  { key: 'city', label: 'City', localized: false, group: 'Address details' },
  { key: 'postalCode', label: 'Postal code', localized: false, group: 'Address details' },
  {
    key: 'country',
    label: 'Country code',
    localized: false,
    group: 'Address details',
    hint: 'Two-letter country code used in the structured data, e.g. SA.',
  },
] as const;

export type SiteValues = Record<string, string | Record<string, string>>;

export async function getSiteInfo(): Promise<SiteValues> {
  const db = await getDb();
  const [rows, tr] = await Promise.all([
    db.select().from(schema.settings),
    db.select().from(schema.settingsTranslations),
  ]);

  const out: SiteValues = {};
  for (const r of rows) out[r.key] = r.value ?? '';
  for (const t of tr) {
    if (typeof out[t.key] !== 'object') out[t.key] = {};
    (out[t.key] as Record<string, string>)[t.locale] = t.value ?? '';
  }
  return out;
}

export interface SiteEdit {
  key: string;
  locale?: Locale;
  value: string;
}

export async function saveSiteInfo(edits: SiteEdit[]): Promise<number> {
  if (!edits.length) return 0;
  const db = await getDb();
  let n = 0;

  for (const e of edits) {
    if (e.locale) {
      // Upsert, not update: a key added to SITE_FIELDS after this database was
      // seeded has no row yet, and a bare UPDATE would silently save nothing
      // while the form said "Saved".
      await db
        .insert(schema.settingsTranslations)
        .values({ key: e.key, locale: e.locale, value: e.value })
        .onConflictDoUpdate({
          target: [schema.settingsTranslations.key, schema.settingsTranslations.locale],
          set: { value: e.value },
        });
    } else {
      // Empty writes NULL, not "". `whatsapp` being null is what suppresses the
      // WhatsApp icon; an empty string would render an icon linking nowhere.
      const value = e.value.trim() === '' ? null : e.value;
      await db
        .insert(schema.settings)
        .values({ key: e.key, value, updatedAt: Math.floor(Date.now() / 1000) })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value, updatedAt: Math.floor(Date.now() / 1000) },
        });
    }
    n++;
  }
  return n;
}
