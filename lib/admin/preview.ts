import { asc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { mergeProps, type Json } from '@/lib/localization';
import type { Block } from '@/lib/blocks';
import type { Locale } from './content';

/**
 * Rebuild a page's blocks from the database, for preview.
 *
 * Sourced from D1, NOT from content/. content/ holds the last PUBLISHED state,
 * so a preview built from it could never show the editor their own unpublished
 * change — which is the only thing a preview is for. Reading the database means
 * Save is enough to see the result, and Publish stays a separate, deliberate
 * act.
 *
 * The output is real `Block` objects, handed to the real
 * components/blocks/Blocks.tsx. There is no second renderer: a parallel one
 * would drift from the site it claims to be previewing, and the drift would be
 * invisible precisely because both look plausible.
 */
export async function previewBlocks(locale: Locale, slug: string): Promise<Block[] | null> {
  const db = await getDb();

  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!page) return null;

  // Two levels only — a block, and the bodies inside a section — so two queries
  // rather than a recursive CTE.
  const roots = await db
    .select()
    .from(schema.blocks)
    .where(eq(schema.blocks.pageId, page.id))
    .orderBy(asc(schema.blocks.position));

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
        .orderBy(asc(schema.blocks.position))
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

  const localized = new Map(
    tr.filter((t) => t.locale === locale).map((t) => [t.blockId, t.props as Json])
  );
  const childrenOf = new Map<string, typeof bodies>();
  for (const b of bodies) {
    if (!b.parentId) continue;
    if (!childrenOf.has(b.parentId)) childrenOf.set(b.parentId, []);
    childrenOf.get(b.parentId)!.push(b);
  }

  const build = (row: (typeof all)[number]): Json => {
    const node = mergeProps(row.props as Json, localized.get(row.id) ?? null) as Record<string, Json>;
    const kids = childrenOf.get(row.id);
    // `bodies` is appended last, matching where the exporter puts it and where
    // every section in the corpus carries it.
    if (kids?.length) node.bodies = kids.map(build);
    return node;
  };

  return roots.map(build) as unknown as Block[];
}
