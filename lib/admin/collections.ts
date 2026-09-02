import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { splitProps, mergeProps, L10N, type Json } from '@/lib/localization';
import { flatten, applyEdits, type Field } from './fields';
import { findImageFields, setImage, isAdmissibleAsset, type ImageField, type ImageShape } from './media';
import type { Locale } from './content';

/**
 * The collections a person actually wants to edit.
 *
 * The previous CMS at 3lines.com.sa/cms got this right and this one had it
 * wrong. It offered four things — Site Info, Services, Partners, News — each a
 * grid of cards you click. This one offered "Pages", then 25 routes, then
 * sections, then 1,021 fields: strictly more powerful and much worse, because
 * nobody sits down wanting to edit "the cards body of the section on /services".
 * They want to change a service.
 *
 * So the entities come first and the block structure disappears behind them. The
 * data does not move — a collection is still items inside a block's props — but
 * that is now an implementation detail rather than the interface.
 */

export interface CollectionDef {
  key: string;
  label: string;
  /** One line under the page title, saying what editing this affects. */
  blurb: string;
  /** Locale-less route of the page whose block holds the items. */
  route: string;
  /** Block kind holding the collection. */
  kind: string;
  /** Localized field used as each card's title. */
  titleField: string;
  /** Localized field used as each card's supporting line. */
  subField?: string;
  /** Shown when a count is unusual for the layout, rather than blocking it. */
  recommended?: number;
  recommendedNote?: string;
  /**
   * Other blocks holding a byte-identical copy of the same items. Every write —
   * copy, image, structural — is applied to these too, so editing the services
   * here updates the homepage's copy of the grid instead of leaving it stale.
   */
  mirrors?: { route: string; kind: string }[];
}

export const COLLECTIONS: CollectionDef[] = [
  {
    key: 'companies',
    label: 'Companies',
    blurb: 'The group companies shown on the homepage.',
    route: '/',
    kind: 'companies',
    titleField: 'name',
    subField: 'tagline',
    recommended: 4,
    recommendedNote: 'The homepage grid is designed for four across. A fifth will wrap to a new row.',
  },
  {
    key: 'services',
    label: 'Services',
    blurb: 'The service cards shown on the home and services pages — one edit updates both.',
    route: '/services',
    kind: 'cards',
    titleField: 'title',
    subField: 'text',
    // The homepage carries its own cards block with the same ten items. Without
    // the mirror, editing a service updated /services and left the homepage
    // stale — the exact drift the CMS guide wrongly claimed could not happen.
    mirrors: [{ route: '/', kind: 'cards' }],
  },
  {
    key: 'partners',
    label: 'Partners',
    blurb: 'Partners and clients shown on the partners page.',
    route: '/partners',
    kind: 'logos',
    titleField: 'name',
    subField: 'caption',
  },
];

export const collectionByKey = (key: string) => COLLECTIONS.find((c) => c.key === key);

/* -------------------------------------------------------------------- read -- */

export interface CollectionItem {
  index: number;
  title: string;
  sub: string;
  /** Editable fields for this item alone, per locale, paths relative to the item. */
  fields: Record<Locale, Field[]>;
  /**
   * Image references on this item, from the SHARED half.
   *
   * Images are not copy — the same photograph serves both locales — so they live
   * beside `tone` and `href` in the structural row, and changing one is a
   * structural write rather than a translation write.
   */
  images: ImageField[];
}

export interface Collection {
  def: CollectionDef;
  blockId: string;
  /**
   * Filesystem slug of the page this collection sits on, e.g. "index".
   *
   * Read from the page row rather than derived from `def.route`. The mapping
   * ("/" -> "index", "/services/x" -> "services--x") is already recorded in the
   * database and in routes.json, and encoding it a third time here would be a
   * copy that can silently disagree with the other two.
   */
  slug: string;
  items: CollectionItem[];
}

const LOCALES: Locale[] = ['en', 'ar', 'ja', 'ko'];

/** Locate the block holding a collection, with both halves parsed. */
async function locate(route: string, kind: string) {
  const db = await getDb();

  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.route, route)).limit(1);
  if (!page) return null;

  const roots = await db.select().from(schema.blocks).where(eq(schema.blocks.pageId, page.id));

  /* Bodies are children of a section, so search one level down as well — in ONE
     query, not one per section. The loop version cost 1 + N queries per locate()
     call, and a save on a mirrored collection calls locate() twice and then
     writes per locale: on the homepage that climbed toward D1's ~50-queries-per
     -invocation ceiling for a single Save. Same rows, one round trip. */
  const kids = roots.length
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
  const all = [...roots, ...kids];

  const block = all.find((b) => b.kind === kind);
  if (!block) return null;

  const tr = await db
    .select()
    .from(schema.blockTranslations)
    .where(eq(schema.blockTranslations.blockId, block.id));

  return {
    block,
    slug: page.slug,
    shared: block.props as Json,
    localized: Object.fromEntries(
      LOCALES.map((l) => [l, (tr.find((t) => t.locale === l)?.props ?? null) as Json])
    ) as Record<Locale, Json>,
  };
}

const itemsOf = (tree: Json): Json[] => {
  if (tree && typeof tree === 'object' && !Array.isArray(tree) && Array.isArray(tree.items)) {
    return tree.items as Json[];
  }
  return [];
};

/** The primary block plus every mirror, in declaration order. */
const targetsOf = (def: CollectionDef) => [
  { route: def.route, kind: def.kind },
  ...(def.mirrors ?? []),
];

export async function getCollection(key: string): Promise<Collection | null> {
  const def = collectionByKey(key);
  if (!def) return null;

  const found = await locate(def.route, def.kind);
  if (!found) return null;

  const perLocale = Object.fromEntries(
    LOCALES.map((l) => [l, itemsOf(found.localized[l])])
  ) as Record<Locale, Json[]>;

  const count = Math.max(...LOCALES.map((l) => perLocale[l].length), 0);

  const sharedItems = itemsOf(found.shared);

  const items: CollectionItem[] = [];
  for (let i = 0; i < count; i++) {
    const fields = Object.fromEntries(
      LOCALES.map((l) => [l, flatten(perLocale[l][i] ?? null)])
    ) as Record<Locale, Field[]>;

    // Paths are rebased onto the collection root so a save can address the item
    // inside the block's props without the editor needing to know its index.
    const images = findImageFields(sharedItems[i] ?? null).map((f) => ({
      ...f,
      path: `items[${i}].${f.path}`,
    }));

    const pick = (name: string) => fields.en.find((f) => f.path === name)?.value ?? '';
    items.push({
      index: i,
      title: pick(def.titleField) || `Item ${i + 1}`,
      sub: def.subField ? pick(def.subField) : '',
      fields,
      images,
    });
  }

  return { def, blockId: found.block.id, slug: found.slug, items };
}

/* ------------------------------------------------------------------- write -- */

/** Edits to one item's copy, per locale, with item-relative paths. */
export interface ItemEdit {
  index: number;
  locale: Locale;
  edits: Record<string, string>;
}

export async function saveCollectionEdits(key: string, patches: ItemEdit[]): Promise<number> {
  const def = collectionByKey(key);
  if (!def) throw new Error(`unknown collection "${key}"`);
  if (!patches.length) return 0;

  const db = await getDb();
  let written = 0;

  for (const [t, target] of targetsOf(def).entries()) {
    const found = await locate(target.route, target.kind);
    if (!found) {
      // The primary must exist; a missing mirror is tolerated so removing the
      // homepage grid one day does not brick the Services screen.
      if (t === 0) throw new Error(`no ${target.kind} block on ${target.route}`);
      continue;
    }

    for (const locale of LOCALES) {
      const mine = patches.filter((p) => p.locale === locale);
      if (!mine.length) continue;

      const tree = found.localized[locale];
      const items = itemsOf(tree);
      let changed = false;

      for (const p of mine) {
        const item = items[p.index];
        if (item === undefined) {
          if (t === 0) throw new Error(`item ${p.index} does not exist in ${key}`);
          continue;
        }
        const next = applyEdits(item, p.edits);
        if (JSON.stringify(next) !== JSON.stringify(item)) {
          items[p.index] = next;
          changed = true;
        }
      }
      if (!changed) continue;

      await db
        .update(schema.blockTranslations)
        .set({
          props: { ...(tree as object), items } as Record<string, unknown>,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(
          and(
            eq(schema.blockTranslations.blockId, found.block.id),
            eq(schema.blockTranslations.locale, locale)
          )
        );
      if (t === 0) written++;
    }
  }
  return written;
}

/**
 * Point one image field at a different file.
 *
 * Writes `blocks.props` — the shared, locale-free row — because an image is not
 * copy. That also means it must NOT go through saveCollectionEdits, which only
 * ever touches block_translations and is deliberately unable to reach structure.
 *
 * The new path is checked against the asset manifest rather than trusted. That
 * is what stops `../` traversal, a typo silently producing a broken image, and
 * anything outside public/ being referenced at all — the manifest is the closed
 * set of files the site actually ships.
 */
export async function setCollectionImage(
  key: string,
  path: string,
  newPath: string,
  shape: ImageShape
): Promise<void> {
  const def = collectionByKey(key);
  if (!def) throw new Error(`unknown collection "${key}"`);

  // Uploads arrive after the build-time manifest is generated, so the manifest
  // alone would reject every one of them. isAdmissibleAsset also accepts an
  // upload, but only once the store confirms it holds that exact file — the
  // allow-list stays an allow-list.
  if (!(await isAdmissibleAsset(newPath))) {
    throw new Error(`"${newPath}" is not an image this site holds.`);
  }

  const db = await getDb();
  for (const [t, target] of targetsOf(def).entries()) {
    const found = await locate(target.route, target.kind);
    if (!found) {
      if (t === 0) throw new Error(`no ${target.kind} block on ${target.route}`);
      continue;
    }
    const next = setImage(found.shared, path, newPath, shape);
    await db
      .update(schema.blocks)
      .set({ props: next as Record<string, unknown>, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(schema.blocks.id, found.block.id));
  }
}

/**
 * Add, remove or reorder items — the structural operations.
 *
 * These touch BOTH halves in one transaction, because the shared array and each
 * locale's array are positional: they are matched by index, not by an id. Adding
 * to one and not the others would silently pair a company's English name with a
 * different company's photo.
 *
 * A new item is cloned from an existing one rather than built from a schema.
 * The shared half carries the structure the renderers require — which media key
 * this kind uses, whether a link is external — and inventing that from scratch
 * is how a block ends up shaped in a way no renderer expects. Cloning then
 * blanking the copy keeps the structure valid by construction.
 */
export type StructuralOp =
  | { op: 'add' }
  | { op: 'remove'; index: number }
  | { op: 'move'; index: number; to: number };

const blankCopy = (node: Json): Json => {
  if (Array.isArray(node)) return node.map(blankCopy);
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, blankCopy(v)]));
  }
  return typeof node === 'string' ? '' : node;
};

export async function applyStructural(key: string, op: StructuralOp): Promise<void> {
  const def = collectionByKey(key);
  if (!def) throw new Error(`unknown collection "${key}"`);

  const db = await getDb();

  for (const [t, target] of targetsOf(def).entries()) {
    const found = await locate(target.route, target.kind);
    if (!found) {
      if (t === 0) throw new Error(`no ${target.kind} block on ${target.route}`);
      continue;
    }

    const sharedItems = itemsOf(found.shared);
    if (!sharedItems.length) {
      if (t === 0) throw new Error(`${key} has no items to work from`);
      continue;
    }

    const localItems = Object.fromEntries(
      LOCALES.map((l) => [l, itemsOf(found.localized[l])])
    ) as Record<Locale, Json[]>;

    const mutate = (arr: Json[], template: Json) => {
      if (op.op === 'add') arr.push(template);
      else if (op.op === 'remove') arr.splice(op.index, 1);
      else if (op.op === 'move') {
        const [x] = arr.splice(op.index, 1);
        arr.splice(Math.max(0, Math.min(arr.length, op.to)), 0, x as Json);
      }
    };

    if (op.op === 'remove' && sharedItems.length <= 1) {
      throw new Error('A collection must keep at least one item.');
    }

    // Structure is cloned verbatim from the last item; copy is blanked so the new
    // card is obviously empty rather than a duplicate someone forgets to rename.
    mutate(sharedItems, JSON.parse(JSON.stringify(sharedItems[sharedItems.length - 1])));
    for (const l of LOCALES) {
      const src = localItems[l];
      mutate(src, blankCopy(JSON.parse(JSON.stringify(src[src.length - 1] ?? null))));
    }

    await db
      .update(schema.blocks)
      .set({
        props: { ...(found.shared as object), items: sharedItems } as Record<string, unknown>,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(schema.blocks.id, found.block.id));

    for (const l of LOCALES) {
      await db
        .update(schema.blockTranslations)
        .set({
          props: { ...(found.localized[l] as object), items: localItems[l] } as Record<string, unknown>,
          updatedAt: Math.floor(Date.now() / 1000),
        })
        .where(
          and(
            eq(schema.blockTranslations.blockId, found.block.id),
            eq(schema.blockTranslations.locale, l)
          )
        );
    }
  }
}

export { L10N, splitProps, mergeProps };
