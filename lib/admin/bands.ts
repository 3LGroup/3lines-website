import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import type { Json } from '@/lib/localization';
import { setAtPath } from './fields';
import { validateHref } from './hrefs';
import type { Locale } from './content';

const LOCALES: Locale[] = ['en', 'ar'];
const now = () => Math.floor(Date.now() / 1000);

/**
 * The two config bands — the careers call-to-action and the contact icon strip —
 * exist as an independent copy on nearly every page: the importer found no
 * global_key in the source, so "change Begin a conversation" meant editing
 * twenty pages one at a time.
 *
 * This edits them as what they are editorially: one band. A save fans the same
 * value out to every copy, localized fields per locale, the button destination
 * on the shared row. The per-page copies stay in the data model (a future page
 * CAN diverge deliberately, through Pages & SEO), but the common case — one
 * wording everywhere — is one form.
 */

export interface BandField {
  /** `careers:heading`, `careers:cta.label`, `careers:cta.href`, `socialStrip:label`. */
  key: string;
  label: string;
  hint?: string;
  localized: boolean;
  /** Current value(s). For localized fields, per locale; else the shared value. */
  value: Partial<Record<Locale, string>> | string;
  /** How many page copies this write fans out to. */
  copies: number;
  /** True when the copies do not all agree — the shown value is the most common. */
  mixed: boolean;
}

interface FieldDef {
  kind: string;
  path: string;
  label: string;
  hint?: string;
  localized: boolean;
  isHref?: boolean;
}

const FIELDS: FieldDef[] = [
  { kind: 'careers', path: 'heading', label: 'Careers band heading', localized: true },
  { kind: 'careers', path: 'cta.label', label: 'Careers band button', localized: true },
  {
    kind: 'careers',
    path: 'cta.href',
    label: 'Careers band destination',
    localized: false,
    isHref: true,
  },
  {
    kind: 'socialStrip',
    path: 'label',
    label: 'Contact strip heading',
    hint: 'The company name beside the icons at the foot of every page.',
    localized: true,
  },
];

const at = (tree: Json, path: string): string | undefined => {
  let node: Json = tree;
  for (const seg of path.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
    node = (node as Record<string, Json>)[seg];
  }
  return typeof node === 'string' ? node : undefined;
};

const commonest = (values: (string | undefined)[]): { value: string; mixed: boolean } => {
  const counts = new Map<string, number>();
  for (const v of values) if (v !== undefined) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = '';
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return { value: best, mixed: counts.size > 1 };
};

export async function listBands(): Promise<BandField[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.blocks)
    .where(inArray(schema.blocks.kind, ['careers', 'socialStrip']));
  const tr = rows.length
    ? await db
        .select()
        .from(schema.blockTranslations)
        .where(
          inArray(
            schema.blockTranslations.blockId,
            rows.map((r) => r.id)
          )
        )
    : [];

  return FIELDS.map((f) => {
    const mine = rows.filter((r) => r.kind === f.kind);
    if (f.localized) {
      let mixed = false;
      const value = Object.fromEntries(
        LOCALES.map((l) => {
          const c = commonest(
            mine.map((r) => {
              const t = tr.find((x) => x.blockId === r.id && x.locale === l);
              return t ? at(t.props as Json, f.path) : undefined;
            })
          );
          mixed = mixed || c.mixed;
          return [l, c.value];
        })
      ) as Partial<Record<Locale, string>>;
      return { key: `${f.kind}:${f.path}`, label: f.label, hint: f.hint, localized: true, value, copies: mine.length, mixed };
    }
    const c = commonest(mine.map((r) => at(r.props as Json, f.path)));
    return {
      key: `${f.kind}:${f.path}`,
      label: f.label,
      hint: f.hint,
      localized: false,
      value: c.value,
      copies: mine.length,
      mixed: c.mixed,
    };
  }).filter((f) => f.copies > 0);
}

export interface BandEdit {
  /** `<kind>:<path>` exactly as listBands returned it. */
  key: string;
  locale?: Locale;
  value: string;
}

export async function saveBands(edits: BandEdit[]): Promise<number> {
  if (!edits.length) return 0;
  const db = await getDb();
  let written = 0;

  for (const e of edits) {
    const sep = e.key.indexOf(':');
    const def = FIELDS.find((f) => f.kind === e.key.slice(0, sep) && f.path === e.key.slice(sep + 1));
    if (!def) throw new Error(`Unknown band field "${e.key}".`);
    if (!e.value.trim()) throw new Error(`${def.label} cannot be empty.`);

    const rows = await db.select().from(schema.blocks).where(eq(schema.blocks.kind, def.kind));
    if (!rows.length) continue;

    if (def.localized) {
      if (!e.locale) throw new Error(`${def.label} needs a locale.`);
      const tr = await db
        .select()
        .from(schema.blockTranslations)
        .where(
          inArray(
            schema.blockTranslations.blockId,
            rows.map((r) => r.id)
          )
        );
      for (const t of tr) {
        if (t.locale !== e.locale) continue;
        if (at(t.props as Json, def.path) === undefined) continue; // copy lacks the slot
        const next = setAtPath(t.props as Json, def.path, e.value);
        await db
          .update(schema.blockTranslations)
          .set({ props: next as Record<string, unknown>, updatedAt: now() })
          // Both PK columns via and() — a blockId-only WHERE would write this
          // locale's tree over the other locale's row too.
          .where(
            and(
              eq(schema.blockTranslations.blockId, t.blockId),
              eq(schema.blockTranslations.locale, t.locale)
            )
          );
      }
    } else {
      if (def.isHref) {
        const pageRows = await db.select({ route: schema.pages.route }).from(schema.pages);
        validateHref(e.value, new Set(pageRows.map((r) => r.route)), def.label);
      }
      for (const r of rows) {
        if (at(r.props as Json, def.path) === undefined) continue;
        const next = setAtPath(r.props as Json, def.path, e.value);
        await db
          .update(schema.blocks)
          .set({ props: next as Record<string, unknown>, updatedAt: now() })
          .where(eq(schema.blocks.id, r.id));
      }
    }
    written++;
  }
  return written;
}
