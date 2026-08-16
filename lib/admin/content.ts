import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { mergeProps, type Json } from '@/lib/localization';
import { flatten, type Field } from './fields';

/**
 * Reads and writes for the content editor.
 *
 * Everything here works on the LOCALIZED half only. Structure lives on
 * `blocks.props`, a locale-free row this module never updates, so no edit made
 * through the editor can change a layout, reorder anything, or make the two
 * language trees diverge. That is a property of what this file can reach, not a
 * rule someone has to remember.
 */

const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export interface PageSummary {
  slug: string;
  route: string;
  status: string;
  title: string;
  blocks: number;
  /** Editable strings on the page, per locale (they match by construction). */
  fields: number;
  /** Fields whose Arabic is byte-identical to the English. */
  untranslated: number;
}

export interface EditableBlock {
  id: string;
  kind: string;
  /** Section anchor, e.g. "companies" — shown so an editor can locate the band. */
  anchor: string | null;
  /** Nesting depth: 0 for a block, 1 for a body inside a section. */
  depth: number;
  /** Field lists per locale, aligned by path. */
  fields: Record<Locale, Field[]>;
}

export interface EditablePage {
  slug: string;
  route: string;
  status: string;
  titles: Record<Locale, string>;
  blocks: EditableBlock[];
}

/* -------------------------------------------------------------------- read -- */

/**
 * Order blocks the way they render: each top-level block, then its bodies.
 *
 * The table is self-referencing, so a flat `ORDER BY position` interleaves
 * parents and children meaninglessly. Depth is carried through so the editor can
 * indent bodies under their section without a second query per section.
 */
function nest(rows: (typeof schema.blocks.$inferSelect)[]): { row: (typeof rows)[number]; depth: number }[] {
  const children = new Map<string, typeof rows>();
  const roots: typeof rows = [];
  for (const r of rows) {
    if (r.parentId) {
      if (!children.has(r.parentId)) children.set(r.parentId, []);
      children.get(r.parentId)!.push(r);
    } else {
      roots.push(r);
    }
  }
  const byPosition = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.position - b.position;
  roots.sort(byPosition);

  const out: { row: (typeof rows)[number]; depth: number }[] = [];
  for (const root of roots) {
    out.push({ row: root, depth: 0 });
    for (const child of (children.get(root.id) ?? []).sort(byPosition)) {
      out.push({ row: child, depth: 1 });
    }
  }
  return out;
}

export async function listPages(): Promise<PageSummary[]> {
  const db = await getDb();

  // Four bulk reads, not one per page: D1 caps a Worker invocation at 50 queries
  // on the free plan and 25 pages x 2 locales would blow through that.
  const [pages, translations, blocks, blockTr] = await Promise.all([
    db.select().from(schema.pages).orderBy(asc(schema.pages.position)),
    db.select().from(schema.pageTranslations),
    db.select().from(schema.blocks),
    db.select().from(schema.blockTranslations),
  ]);

  const titleOf = new Map(translations.map((t) => [`${t.pageId}:${t.locale}`, t.title]));
  const trOf = new Map(blockTr.map((t) => [`${t.blockId}:${t.locale}`, t.props as Json]));

  // A body's page is its parent's, so resolve parents before counting.
  const pageOfBlock = new Map<string, string>();
  for (const b of blocks) if (b.pageId) pageOfBlock.set(b.id, b.pageId);
  for (const b of blocks) {
    if (!b.pageId && b.parentId) {
      const p = pageOfBlock.get(b.parentId);
      if (p) pageOfBlock.set(b.id, p);
    }
  }

  return pages.map((page) => {
    const own = blocks.filter((b) => pageOfBlock.get(b.id) === page.id);
    let fields = 0;
    let untranslated = 0;

    for (const b of own) {
      const en = flatten(trOf.get(`${b.id}:en`) ?? null);
      const ar = flatten(trOf.get(`${b.id}:ar`) ?? null);
      const arByPath = new Map(ar.map((f) => [f.path, f.value]));
      fields += en.length;
      // Identical is a signal, not proof: proper nouns like "SAMI" legitimately
      // match. It is still the only cheap way to surface copy nobody translated.
      for (const f of en) if (arByPath.get(f.path) === f.value) untranslated++;
    }

    return {
      slug: page.slug,
      route: page.route,
      status: page.status,
      title: titleOf.get(`${page.id}:en`) ?? page.slug,
      blocks: own.filter((b) => !b.parentId).length,
      fields,
      untranslated,
    };
  });
}

export async function getPageForEdit(slug: string): Promise<EditablePage | null> {
  const db = await getDb();

  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!page) return null;

  const translations = await db
    .select()
    .from(schema.pageTranslations)
    .where(eq(schema.pageTranslations.pageId, page.id));

  // Top-level blocks by page, then their bodies by parent — two queries rather
  // than a recursive CTE, because the tree is exactly two levels deep.
  const roots = await db.select().from(schema.blocks).where(eq(schema.blocks.pageId, page.id));
  const bodies = roots.length
    ? await db
        .select()
        .from(schema.blocks)
        .where(
          inArray(
            schema.blocks.parentId,
            roots.map((r) => r.id)
          )
        )
    : [];

  const all = [...roots, ...bodies];
  const tr = all.length
    ? await db
        .select()
        .from(schema.blockTranslations)
        .where(
          inArray(
            schema.blockTranslations.blockId,
            all.map((b) => b.id)
          )
        )
    : [];
  const trOf = new Map(tr.map((t) => [`${t.blockId}:${t.locale}`, t.props as Json]));

  return {
    slug: page.slug,
    route: page.route,
    status: page.status,
    titles: Object.fromEntries(
      LOCALES.map((l) => [l, translations.find((t) => t.locale === l)?.title ?? ''])
    ) as Record<Locale, string>,
    blocks: nest(all)
      .map(({ row, depth }) => ({
        id: row.id,
        kind: row.kind,
        anchor: row.anchor,
        depth,
        fields: Object.fromEntries(
          LOCALES.map((l) => [l, flatten(trOf.get(`${row.id}:${l}`) ?? null)])
        ) as Record<Locale, Field[]>,
      }))
      // A block with nothing to edit (newsGrid carries no copy of its own) is
      // noise in an editor whose only job is copy.
      .filter((b) => b.fields.en.length > 0 || b.fields.ar.length > 0),
  };
}

/* ------------------------------------------------------------------- write -- */

export interface BlockEdit {
  blockId: string;
  locale: Locale;
  /** path -> new value. Only changed paths need be present. */
  edits: Record<string, string>;
}

/**
 * Apply edits to `block_translations` only.
 *
 * Reads each row, applies the patch to the stored tree and writes it back, so a
 * value the editor never showed cannot be dropped by the save. `blocks.props` is
 * never in the update set — structure is untouchable from here by construction.
 */
export async function saveBlockEdits(patches: BlockEdit[]): Promise<number> {
  if (!patches.length) return 0;
  const db = await getDb();
  const { applyEdits } = await import('./fields');

  const ids = [...new Set(patches.map((p) => p.blockId))];
  const rows = await db
    .select()
    .from(schema.blockTranslations)
    .where(inArray(schema.blockTranslations.blockId, ids));
  const current = new Map(rows.map((r) => [`${r.blockId}:${r.locale}`, r.props as Json]));

  let written = 0;
  for (const patch of patches) {
    const key = `${patch.blockId}:${patch.locale}`;
    const tree = current.get(key);
    if (tree === undefined) throw new Error(`no block_translations row for ${key}`);

    const next = applyEdits(tree, patch.edits);
    if (JSON.stringify(next) === JSON.stringify(tree)) continue;

    await db
      .update(schema.blockTranslations)
      .set({ props: next as Record<string, unknown>, updatedAt: Math.floor(Date.now() / 1000) })
      // `and(...)`, not `&&`. JavaScript's && would evaluate both SQL fragments
      // and hand Drizzle only the second, so the WHERE would match on locale
      // alone and rewrite every block's translations with one block's tree.
      .where(
        and(
          eq(schema.blockTranslations.blockId, patch.blockId),
          eq(schema.blockTranslations.locale, patch.locale)
        )
      );
    written++;
  }
  return written;
}

/** Reassemble a block exactly as the exporter would — used by preview. */
export function assemble(shared: Json, localized: Json): Json {
  return mergeProps(shared, localized);
}
