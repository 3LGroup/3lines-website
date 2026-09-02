import { getDb, schema } from '@/lib/db/client';
import type { Locale } from './content';

const LOCALES: Locale[] = ['en', 'ar', 'ja', 'ko'];

/**
 * What each ui_strings key is FOR, in editor language. The table stores bare
 * keys; without these labels the screen would read like a config file.
 */
export const UI_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: 'discover', label: 'Tile button', hint: 'The call-to-action on linked tile cards.' },
  { key: 'close', label: 'Menu close button' },
  { key: 'openMenu', label: 'Menu open button', hint: 'Read by screen readers on the ☰ button.' },
  { key: 'mainMenu', label: 'Menu dialog name', hint: 'Read by screen readers.' },
  { key: 'breadcrumb', label: 'Breadcrumb name', hint: 'Read by screen readers on page paths.' },
  { key: 'themeToggle', label: 'Theme toggle name', hint: 'Read by screen readers.' },
  { key: 'themeDark', label: 'Theme label: dark' },
  { key: 'themeLight', label: 'Theme label: light' },
  { key: 'notFoundTitle', label: '404 heading' },
  { key: 'notFoundBody', label: '404 explanation' },
  { key: 'notFoundBrowse', label: '404 links lead-in' },
  { key: 'whatsapp', label: 'WhatsApp label', hint: 'Accessible name of the WhatsApp icon.' },
  { key: 'honeypot', label: 'Spam-trap field label', hint: 'Never shown to people; leave as is.' },
];

export type UiValues = Record<string, Partial<Record<Locale, string>>>;

export async function getUiValues(): Promise<UiValues> {
  const db = await getDb();
  const rows = await db.select().from(schema.uiStrings);
  const out: UiValues = {};
  for (const r of rows) {
    if (!out[r.key]) out[r.key] = {};
    out[r.key][r.locale as Locale] = r.value;
  }
  return out;
}

export interface UiEdit {
  key: string;
  locale: Locale;
  value: string;
}

export async function saveUiStrings(edits: UiEdit[]): Promise<number> {
  if (!edits.length) return 0;
  const known = new Set(UI_FIELDS.map((f) => f.key));
  const db = await getDb();
  let n = 0;

  for (const e of edits) {
    if (!known.has(e.key)) throw new Error(`Unknown interface string "${e.key}".`);
    if (!LOCALES.includes(e.locale)) throw new Error(`Unknown locale "${e.locale}".`);
    // A blank would render a blank control; lib/ui.ts would fall back to the
    // literal anyway, so refuse rather than store something the site ignores.
    if (!e.value.trim()) throw new Error('An interface string cannot be empty.');
    await db
      .insert(schema.uiStrings)
      .values({ key: e.key, locale: e.locale, value: e.value })
      .onConflictDoUpdate({
        target: [schema.uiStrings.key, schema.uiStrings.locale],
        set: { value: e.value },
      });
    n++;
  }
  return n;
}
