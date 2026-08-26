import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { L10N, mergeProps, splitProps, type Json } from '@/lib/localization';
import { labelForPath } from './fields';
import { isAdmissibleAsset, wrapImgVar, type ImageShape } from './media';
import { validateHref } from './hrefs';
import type { Locale } from './content';

const LOCALES: Locale[] = ['en', 'ar'];
const now = () => Math.floor(Date.now() / 1000);

/**
 * Deterministic id, IDENTICAL to scripts/import-to-cms.mjs `idFor`.
 *
 * CMS-created pages and news items must use the same id scheme as the importer:
 * with random UUIDs, a later importer re-run would ON CONFLICT(route) keep the
 * random id while every other statement referenced the derived one — a foreign
 * key violation that failed the whole seed batch.
 */
export function idFor(seed: string): string {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Structural operations on pages and blocks: reorder, add, remove, and the
 * shared-half fields (links, images, numbers, tones) the copy editor is
 * deliberately unable to reach.
 *
 * Everything that rewrites BOTH halves goes through the merged-document path:
 * read the shared row and each locale's overlay, merge them, apply the change
 * to each locale's merged tree in lockstep, split again, and refuse to write
 * unless the two shared halves came out identical and each locale round-trips.
 * Those are the same assertions the importer runs over the whole corpus — an
 * operation that would corrupt the split fails loudly instead of saving.
 */

/* -------------------------------------------------------------- templates -- */

/**
 * A new block starts from a MERGED document per locale (the shape the exporter
 * writes), and is split on insert. Authoring templates in the merged shape
 * keeps them readable and lets the split machinery — not the template author —
 * decide which half each key belongs in.
 */
const BODY_TEMPLATES: Record<string, { label: string; en: Json; ar: Json }> = {
  prose: {
    label: 'Paragraphs',
    en: { kind: 'prose', paragraphs: [{ text: 'New paragraph.' }] },
    ar: { kind: 'prose', paragraphs: [{ text: 'فقرة جديدة.' }] },
  },
  defs: {
    label: 'Titled blurbs',
    en: {
      kind: 'defs',
      columns: 3,
      items: [{ title: 'New item', text: 'Describe it here.' }],
    },
    ar: {
      kind: 'defs',
      columns: 3,
      items: [{ title: 'عنصر جديد', text: 'أضف الوصف هنا.' }],
    },
  },
  figures: {
    label: 'Statistics row',
    en: {
      kind: 'figures',
      items: [
        { count: 0, prefix: '+', label: 'New statistic' },
        { count: 0, prefix: '+', label: 'New statistic' },
        { count: 0, prefix: '+', label: 'New statistic' },
        { count: 0, prefix: '+', label: 'New statistic' },
      ],
    },
    ar: {
      kind: 'figures',
      items: [
        { count: 0, prefix: '+', label: 'إحصائية جديدة' },
        { count: 0, prefix: '+', label: 'إحصائية جديدة' },
        { count: 0, prefix: '+', label: 'إحصائية جديدة' },
        { count: 0, prefix: '+', label: 'إحصائية جديدة' },
      ],
    },
  },
  specList: {
    label: 'Fact strip',
    en: { kind: 'specList', items: ['New fact'] },
    ar: { kind: 'specList', items: ['معلومة جديدة'] },
  },
  slider: {
    label: 'Rotating headlines',
    en: {
      kind: 'slider',
      items: [
        { heading: 'New headline', sub: 'Supporting line.' },
        { heading: 'Second headline', sub: 'Supporting line.' },
      ],
    },
    ar: {
      kind: 'slider',
      items: [
        { heading: 'عنوان جديد', sub: 'سطر داعم.' },
        { heading: 'عنوان ثانٍ', sub: 'سطر داعم.' },
      ],
    },
  },
  tiles: {
    label: 'Linked tiles',
    en: { kind: 'tiles', items: [{ title: 'New tile', href: '/', art: null }] },
    ar: { kind: 'tiles', items: [{ title: 'بلاطة جديدة', href: '/', art: null }] },
  },
  feature: {
    label: 'Media beside copy',
    en: {
      kind: 'feature',
      media: { art: null },
      heading: 'New feature',
      lede: 'Describe it here.',
    },
    ar: {
      kind: 'feature',
      media: { art: null },
      heading: 'ميزة جديدة',
      lede: 'أضف الوصف هنا.',
    },
  },
};

export const ADDABLE_BODY_KINDS = Object.entries(BODY_TEMPLATES).map(([kind, t]) => ({
  kind,
  label: t.label,
}));

const SECTION_TEMPLATE = {
  en: { type: 'section', tone: 'plain', head: { layout: 'stacked', heading: 'New section' } },
  ar: { type: 'section', tone: 'plain', head: { layout: 'stacked', heading: 'قسم جديد' } },
} as const;

/* ------------------------------------------------- merged-document plumbing -- */

type Row = typeof schema.blocks.$inferSelect;

async function readBlock(blockId: string) {
  const db = await getDb();
  const [row] = await db.select().from(schema.blocks).where(eq(schema.blocks.id, blockId)).limit(1);
  if (!row) throw new Error('That block no longer exists — reload the page.');
  const tr = await db
    .select()
    .from(schema.blockTranslations)
    .where(eq(schema.blockTranslations.blockId, blockId));
  const localized = Object.fromEntries(
    LOCALES.map((l) => [l, (tr.find((t) => t.locale === l)?.props ?? null) as Json])
  ) as Record<Locale, Json>;
  return { row, localized };
}

/** Split per-locale merged docs, assert the invariants, write both halves. */
async function writeMerged(blockId: string, merged: Record<Locale, Json>): Promise<void> {
  const split = Object.fromEntries(LOCALES.map((l) => [l, splitProps(merged[l])])) as Record<
    Locale,
    { shared: Json; localized: Json }
  >;
  const ref = JSON.stringify(split.en.shared);
  for (const l of LOCALES) {
    if (JSON.stringify(split[l].shared) !== ref) {
      throw new Error('Internal error: the locales diverged structurally. Nothing was saved.');
    }
    if (JSON.stringify(mergeProps(split[l].shared, split[l].localized)) !== JSON.stringify(merged[l])) {
      throw new Error('Internal error: the change did not round-trip. Nothing was saved.');
    }
  }

  const db = await getDb();
  await db
    .update(schema.blocks)
    .set({ props: split.en.shared as Record<string, unknown>, updatedAt: now() })
    .where(eq(schema.blocks.id, blockId));
  for (const l of LOCALES) {
    await db
      .insert(schema.blockTranslations)
      .values({
        blockId,
        locale: l,
        props: (split[l].localized ?? {}) as Record<string, unknown>,
        updatedAt: now(),
      })
      .onConflictDoUpdate({
        target: [schema.blockTranslations.blockId, schema.blockTranslations.locale],
        set: { props: (split[l].localized ?? {}) as Record<string, unknown>, updatedAt: now() },
      });
  }
}

/* ------------------------------------------------------ block-level moves -- */

/** All rows sharing a scope (top level of a page, or the bodies of a section). */
async function scopeOf(row: Row): Promise<Row[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.blocks)
    .where(
      row.parentId
        ? eq(schema.blocks.parentId, row.parentId)
        : and(eq(schema.blocks.pageId, row.pageId!), isNull(schema.blocks.parentId))
    )
    .orderBy(asc(schema.blocks.position));
}

/**
 * Renumber a scope's rows to their given order, writing only rows whose stored
 * position disagrees. Every structural mutation ends by calling this: sparse or
 * duplicated positions are what made "↑ Earlier" silently do nothing (two rows
 * tied on the same position swap into themselves) and what let the exporter's
 * ORDER BY position become plan-dependent.
 */
async function renumber(rows: Row[]): Promise<void> {
  const db = await getDb();
  for (const [i, r] of rows.entries()) {
    if (r.position === i) continue;
    await db
      .update(schema.blocks)
      .set({ position: i, updatedAt: now() })
      .where(eq(schema.blocks.id, r.id));
  }
}

export async function moveBlock(blockId: string, direction: 'up' | 'down'): Promise<void> {
  const { row } = await readBlock(blockId);
  const siblings = await scopeOf(row);
  const i = siblings.findIndex((s) => s.id === blockId);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return;

  // Reorder by INDEX, then renumber the whole scope contiguously — index-based,
  // so it stays correct even over rows whose stored positions are tied.
  const next = [...siblings];
  [next[i], next[j]] = [next[j]!, next[i]!];
  await renumber(next);
}

export async function removeBlock(blockId: string): Promise<void> {
  const { row } = await readBlock(blockId);
  const siblings = await scopeOf(row);

  if (row.parentId && siblings.length <= 1) {
    throw new Error(
      'A section cannot be left empty — delete the whole section instead of its last content.'
    );
  }
  if (!row.parentId) {
    // What must survive is a page that still shows something: refuse removing
    // the last SECTION (the bands are trailing furniture, not content), and
    // refuse emptying the page entirely.
    const sections = siblings.filter((s) => s.kind === 'section');
    if (row.kind === 'section' && sections.length <= 1) {
      throw new Error('A page needs at least one section.');
    }
    if (siblings.length <= 1) {
      throw new Error('A page cannot be left empty.');
    }
  }

  const db = await getDb();
  // The child bodies and every translation row go with it via ON DELETE CASCADE.
  await db.delete(schema.blocks).where(eq(schema.blocks.id, blockId));
  // Close the gap so later inserts and moves see contiguous positions.
  await renumber(siblings.filter((s) => s.id !== blockId));
}

/* ------------------------------------------------------------------ adding -- */

export async function insertBlock({
  pageId,
  parentId,
  kind,
  merged,
  position,
  anchor,
}: {
  pageId: string | null;
  parentId: string | null;
  kind: string;
  merged: Record<Locale, Json>;
  position: number;
  anchor?: string | null;
}): Promise<string> {
  const split = Object.fromEntries(LOCALES.map((l) => [l, splitProps(merged[l])])) as Record<
    Locale,
    { shared: Json; localized: Json }
  >;
  const ref = JSON.stringify(split.en.shared);
  for (const l of LOCALES) {
    if (JSON.stringify(split[l].shared) !== ref) {
      throw new Error(`Internal error: the ${kind} template diverges structurally.`);
    }
  }

  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(schema.blocks).values({
    id,
    pageId,
    parentId,
    kind,
    position,
    anchor: anchor ?? null,
    stableKey: null,
    props: split.en.shared as Record<string, unknown>,
  });
  for (const l of LOCALES) {
    await db.insert(schema.blockTranslations).values({
      blockId: id,
      locale: l,
      props: (split[l].localized ?? {}) as Record<string, unknown>,
    });
  }
  return id;
}

export async function addBody(sectionId: string, kind: string): Promise<void> {
  const template = BODY_TEMPLATES[kind];
  if (!template) throw new Error(`"${kind}" is not a kind this editor can create.`);

  const { row } = await readBlock(sectionId);
  if (row.kind !== 'section') throw new Error('Content can only be added inside a section.');

  const db = await getDb();
  const kids = await db
    .select()
    .from(schema.blocks)
    .where(eq(schema.blocks.parentId, sectionId));
  const position = kids.length ? Math.max(...kids.map((k) => k.position)) + 1 : 0;

  await insertBlock({
    pageId: null,
    parentId: sectionId,
    kind,
    merged: { en: structuredClone(template.en), ar: structuredClone(template.ar) } as Record<
      Locale,
      Json
    >,
    position,
  });
}

export async function addSection(slug: string): Promise<void> {
  const db = await getDb();
  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!page) throw new Error(`No page with slug "${slug}".`);

  const roots = await db
    .select()
    .from(schema.blocks)
    .where(and(eq(schema.blocks.pageId, page.id), isNull(schema.blocks.parentId)));

  /* New sections land BEFORE the trailing config bands (careers / socialStrip)
     when present — after them a section would render below the page's closing
     call-to-action, which is never what an editor means by "add a section". */
  const sorted = [...roots].sort((a, b) => a.position - b.position);
  let at = sorted.length;
  while (at > 0 && ['careers', 'socialStrip'].includes(sorted[at - 1].kind)) at--;

  /* Renumber the WHOLE scope around the gap, not just the tail. Positions can
     be sparse after deletions; renumbering only rows at index >= `at` left the
     new row able to collide with an existing position, after which the tied
     pair could never be reordered again. */
  for (const [i, r] of sorted.entries()) {
    const target = i < at ? i : i + 1;
    if (r.position === target) continue;
    await db
      .update(schema.blocks)
      .set({ position: target, updatedAt: now() })
      .where(eq(schema.blocks.id, r.id));
  }
  const sectionId = await insertBlock({
    pageId: page.id,
    parentId: null,
    kind: 'section',
    merged: {
      en: structuredClone(SECTION_TEMPLATE.en),
      ar: structuredClone(SECTION_TEMPLATE.ar),
    } as unknown as Record<Locale, Json>,
    position: at,
  });
  // Never empty: the renderer requires a section to carry at least one body.
  await addBody(sectionId, 'prose');
}

/* -------------------------------------------------------------- item lists -- */

/**
 * Which arrays inside each kind an editor may add to, remove from and reorder.
 * A whitelist, because some arrays are load-bearing in ways an editor cannot
 * see — form.fields is wired to the contact API's hardcoded field names.
 */
const ITEM_ARRAYS: Record<string, { path: string; label: string; min: number }[]> = {
  defs: [{ path: 'items', label: 'Items', min: 1 }],
  figures: [{ path: 'items', label: 'Statistics', min: 1 }],
  specList: [{ path: 'items', label: 'Facts', min: 1 }],
  slider: [{ path: 'items', label: 'Slides', min: 2 }],
  tiles: [{ path: 'items', label: 'Tiles', min: 1 }],
  cards: [{ path: 'items', label: 'Cards', min: 1 }],
  logos: [{ path: 'items', label: 'Logos', min: 1 }],
  certs: [{ path: 'items', label: 'Plates', min: 1 }],
  companies: [{ path: 'items', label: 'Companies', min: 1 }],
  feature: [{ path: 'checklist', label: 'Checklist', min: 0 }],
  overviewSplit: [{ path: 'glance', label: 'At-a-glance lines', min: 1 }],
  map: [{ path: 'details', label: 'Contact rows', min: 0 }],
  socialStrip: [{ path: 'items', label: 'Icons', min: 1 }],
  prose: [{ path: 'paragraphs', label: 'Paragraphs', min: 1 }],
};

export const itemArraysFor = (kind: string) => ITEM_ARRAYS[kind] ?? [];

/**
 * First-item templates for the lists that may be emptied (min: 0). Without one,
 * an emptied checklist or contact rail was irreversible: adding clones the last
 * item, and an empty list has nothing to clone.
 */
const ITEM_TEMPLATES: Record<string, Record<Locale, Json>> = {
  'feature.checklist': {
    en: { title: 'New point', text: 'Describe it here.' },
    ar: { title: 'نقطة جديدة', text: 'أضف الوصف هنا.' },
  },
  'map.details': {
    en: { label: 'New row', value: 'Value' },
    ar: { label: 'صف جديد', value: 'القيمة' },
  },
};

const getArray = (tree: Json, path: string): Json[] | null => {
  if (tree === null || typeof tree !== 'object' || Array.isArray(tree)) return null;
  const v = (tree as Record<string, Json>)[path];
  return Array.isArray(v) ? v : null;
};

export type ItemOp =
  | { op: 'addItem'; path: string }
  | { op: 'removeItem'; path: string; index: number }
  | { op: 'moveItem'; path: string; index: number; to: number };

export async function applyItemOp(blockId: string, op: ItemOp): Promise<void> {
  const { row, localized } = await readBlock(blockId);
  const allowed = itemArraysFor(row.kind).find((a) => a.path === op.path);
  if (!allowed) throw new Error(`"${op.path}" is not a list this editor can change on ${row.kind}.`);

  const merged = Object.fromEntries(
    LOCALES.map((l) => [l, mergeProps(row.props as Json, localized[l])])
  ) as Record<Locale, Json>;

  for (const l of LOCALES) {
    let arr = getArray(merged[l], op.path);
    if (!arr) {
      // An emptied localized-only array collapses to no key at all; recreate it
      // for an add so a min:0 list is not a one-way door.
      if (op.op === 'addItem' && merged[l] && typeof merged[l] === 'object' && !Array.isArray(merged[l])) {
        arr = [];
        (merged[l] as Record<string, Json>)[op.path] = arr;
      } else {
        throw new Error(`No ${op.path} list found.`);
      }
    }

    if (op.op === 'addItem') {
      if (arr.length) {
        // Cloned, not blanked: a visible duplicate is obviously "the one I just
        // added", and blanking would also blank structural values like hrefs.
        arr.push(structuredClone(arr[arr.length - 1]));
      } else {
        const template = ITEM_TEMPLATES[`${row.kind}.${op.path}`];
        if (!template) throw new Error('There is no existing item to model the new one on.');
        arr.push(structuredClone(template[l]));
      }
    } else if (op.op === 'removeItem') {
      if (arr.length <= allowed.min) {
        throw new Error(`${allowed.label}: at least ${allowed.min} must remain.`);
      }
      if (op.index < 0 || op.index >= arr.length) throw new Error('That item no longer exists.');
      arr.splice(op.index, 1);
    } else {
      if (op.index < 0 || op.index >= arr.length) throw new Error('That item no longer exists.');
      const [x] = arr.splice(op.index, 1);
      arr.splice(Math.max(0, Math.min(arr.length, op.to)), 0, x);
    }
  }

  await writeMerged(blockId, merged);
}

/* ----------------------------------------------------------- shared fields -- */

const NUMBER_KEYS: Record<string, { min?: number; max?: number; int?: boolean }> = {
  count: { min: 0, int: true },
  lat: {},
  lng: {},
  zoom: { min: 1, max: 21, int: true },
  columns: { min: 2, max: 3, int: true },
  limit: { min: 1, int: true },
};
const TEXT_KEYS = new Set(['prefix', 'suffix']);
const SELECT_KEYS: Record<string, string[]> = {
  tone: ['plain', 'mist', 'navy'],
  variant: ['grid', 'marquee'],
};

export interface SharedField {
  path: string;
  label: string;
  value: string;
  control: 'href' | 'number' | 'text' | 'select';
  options?: string[];
}

/**
 * The shared-half leaves an editor may change, walked from blocks.props.
 * L10N sentinels (copy living in the other table) and SVG trees are skipped.
 */
export function sharedFields(props: Json, kind: string): SharedField[] {
  const out: SharedField[] = [];

  const walk = (node: Json, trail: string, key: string | null) => {
    if (node === null || node === undefined) return;
    if (node === L10N) return; // copy lives in the localized half
    if (key === 'art' || key === 'icon') return; // SVG trees are not fields

    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${trail}[${i}]`, key));
      return;
    }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        walk(v, trail ? `${trail}.${k}` : k, k);
      }
      return;
    }

    const label = labelForPath(trail);
    if (key === 'href') {
      // The social strip's destinations derive from Site info at render; its
      // stored hrefs are fallbacks that would mislead more than help.
      if (kind === 'socialStrip') return;
      out.push({ path: trail, label, value: String(node), control: 'href' });
    } else if (key !== null && key in NUMBER_KEYS) {
      out.push({ path: trail, label, value: String(node), control: 'number' });
    } else if (key !== null && TEXT_KEYS.has(key)) {
      out.push({ path: trail, label, value: String(node), control: 'text' });
    } else if (key !== null && key in SELECT_KEYS) {
      out.push({ path: trail, label, value: String(node), control: 'select', options: SELECT_KEYS[key] });
    }
  };

  walk(props, '', null);
  return out;
}

/** Set one shared leaf, with per-key validation. Rejects unknown keys outright. */
export async function setSharedField(blockId: string, path: string, value: string): Promise<void> {
  const { row } = await readBlock(blockId);
  const key = path.split('.').pop()!.replace(/\[\d+\]$/, '');

  let parsed: Json;
  if (key === 'href') {
    const db = await getDb();
    const pageRows = await db.select({ route: schema.pages.route }).from(schema.pages);
    validateHref(value, new Set(pageRows.map((r) => r.route)), labelForPath(path));
    parsed = value;
  } else if (key in NUMBER_KEYS) {
    const rule = NUMBER_KEYS[key];
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${labelForPath(path)} must be a number.`);
    if (rule.int && !Number.isInteger(n)) throw new Error(`${labelForPath(path)} must be a whole number.`);
    if (rule.min !== undefined && n < rule.min) throw new Error(`${labelForPath(path)} must be at least ${rule.min}.`);
    if (rule.max !== undefined && n > rule.max) throw new Error(`${labelForPath(path)} must be at most ${rule.max}.`);
    parsed = n;
  } else if (TEXT_KEYS.has(key)) {
    parsed = value;
  } else if (key in SELECT_KEYS) {
    if (!SELECT_KEYS[key].includes(value)) {
      throw new Error(`${labelForPath(path)} must be one of: ${SELECT_KEYS[key].join(', ')}.`);
    }
    parsed = value;
  } else {
    throw new Error(`"${key}" is not a field this editor can change.`);
  }

  const { setAtPath } = await import('./fields');
  const next = setAtPath(row.props as Json, path, parsed as never);

  const db = await getDb();
  await db
    .update(schema.blocks)
    .set({ props: next as Record<string, unknown>, updatedAt: now() })
    .where(eq(schema.blocks.id, blockId));
}

/** Point one image leaf in a block's shared props at a different asset. */
export async function setBlockImage(
  blockId: string,
  path: string,
  src: string,
  shape: ImageShape
): Promise<void> {
  if (!(await isAdmissibleAsset(src))) {
    throw new Error(`"${src}" is not an image this site holds.`);
  }
  const { row } = await readBlock(blockId);
  const { setAtPath } = await import('./fields');
  const value = shape === 'imgVar' ? wrapImgVar(src) : src;
  const next = setAtPath(row.props as Json, path, value);

  const db = await getDb();
  await db
    .update(schema.blocks)
    .set({ props: next as Record<string, unknown>, updatedAt: now() })
    .where(eq(schema.blocks.id, blockId));
}

/* ------------------------------------------------------------ page status -- */

export async function setPageStatus(
  slug: string,
  status: 'published' | 'placeholder'
): Promise<void> {
  const db = await getDb();
  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!page) throw new Error(`No page with slug "${slug}".`);
  await db
    .update(schema.pages)
    .set({ status, updatedAt: now() })
    .where(eq(schema.pages.id, page.id));
}

/* -------------------------------------------------------------- new pages -- */

const routeToSlug = (route: string) =>
  route === '/' ? 'index' : route.replace(/^\//, '').replace(/\//g, '--');

export async function createPage({
  route,
  titleEn,
  titleAr,
}: {
  route: string;
  titleEn: string;
  titleAr: string;
}): Promise<string> {
  if (!/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(route)) {
    throw new Error(
      'The address must look like /example or /example/sub-page — lowercase letters, numbers and hyphens.'
    );
  }
  if (!titleEn.trim() || !titleAr.trim()) {
    throw new Error('Both the English and Arabic title are required.');
  }

  const db = await getDb();
  const existing = await db.select().from(schema.pages).where(eq(schema.pages.route, route));
  if (existing.length) throw new Error(`A page already exists at ${route}.`);

  const slug = routeToSlug(route);
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${schema.pages.position}), -1)` })
    .from(schema.pages);

  // Deterministic, matching the importer's scheme — see idFor.
  const pageId = idFor(`page:${route}`);
  await db.insert(schema.pages).values({
    id: pageId,
    route,
    slug,
    // New pages start hidden from search engines and the sitemap. Flipping the
    // switch in the editor is a decision, not a side effect of creating.
    status: 'placeholder',
    sourceRefs: [],
    position: maxPos + 1,
  });
  for (const [locale, title] of [
    ['en', titleEn],
    ['ar', titleAr],
  ] as const) {
    await db.insert(schema.pageTranslations).values({
      pageId,
      locale,
      title: title.trim(),
      description: title.trim(),
      keywords: null,
      translationState: 'translated',
    });
  }

  // The standard page skeleton: breadcrumbs + heading, then one prose section.
  await insertBlock({
    pageId,
    parentId: null,
    kind: 'pageTitle',
    merged: {
      en: {
        type: 'pageTitle',
        crumbs: [{ label: 'Home', href: '/' }, { label: titleEn.trim() }],
        heading: titleEn.trim(),
      },
      ar: {
        type: 'pageTitle',
        crumbs: [{ label: 'الرئيسية', href: '/' }, { label: titleAr.trim() }],
        heading: titleAr.trim(),
      },
    } as unknown as Record<Locale, Json>,
    position: 0,
  });
  const sectionId = await insertBlock({
    pageId,
    parentId: null,
    kind: 'section',
    merged: {
      en: structuredClone(SECTION_TEMPLATE.en),
      ar: structuredClone(SECTION_TEMPLATE.ar),
    } as unknown as Record<Locale, Json>,
    position: 1,
  });
  await addBody(sectionId, 'prose');

  return slug;
}

/**
 * Refuse while anything still links to a page — a deleted page the header menu
 * points at is a broken site, not a tidier one. Matches both the bare route and
 * anchored forms ("/about" and "/about#team"): validateHref accepts anchored
 * internal links, so the scan must too.
 *
 * Exported so deleteNewsItem can run the SAME guards BEFORE it removes the news
 * row — checking after would leave the card deleted and the page stranded when
 * the page turns out to be referenced.
 */
export async function assertPageDeletable(
  route: string,
  pageId: string,
  opts: { ignoreNews?: boolean } = {}
): Promise<void> {
  const db = await getDb();

  const linksTo = (props: unknown): boolean => {
    const json = JSON.stringify(props);
    return json.includes(`"${route}"`) || json.includes(`"${route}#`);
  };

  const [chromeRow] = await db
    .select()
    .from(schema.chromeDocs)
    .where(eq(schema.chromeDocs.id, 'chrome'))
    .limit(1);
  if (chromeRow && linksTo(chromeRow.props)) {
    throw new Error(
      `The navigation or footer still links to ${route} — remove those links first (Navigation & footer).`
    );
  }
  if (!opts.ignoreNews) {
    const news = await db.select().from(schema.newsItems).where(eq(schema.newsItems.route, route));
    if (news.length) {
      throw new Error(`A news item still points at ${route} — delete it from News first.`);
    }
  }

  const blocks = await db
    .select({
      id: schema.blocks.id,
      props: schema.blocks.props,
      pageId: schema.blocks.pageId,
      parentId: schema.blocks.parentId,
    })
    .from(schema.blocks);
  // A body carries no pageId of its own; resolve it through its parent so the
  // page's own bodies do not read as "another page" linking here.
  const pageOf = new Map<string, string>();
  for (const b of blocks) if (b.pageId) pageOf.set(b.id, b.pageId);
  for (const b of blocks) {
    if (!b.pageId && b.parentId) {
      const p = pageOf.get(b.parentId);
      if (p) pageOf.set(b.id, p);
    }
  }
  for (const b of blocks) {
    if (pageOf.get(b.id) === pageId) continue;
    if (linksTo(b.props)) {
      throw new Error(`Another page still links to ${route} — remove that link first, then delete.`);
    }
  }
}

export async function deletePage(slug: string): Promise<void> {
  const db = await getDb();
  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
  if (!page) throw new Error(`No page with slug "${slug}".`);
  if (page.route === '/') throw new Error('The homepage cannot be deleted.');

  await assertPageDeletable(page.route, page.id);

  // The page cascade removes top-level blocks, whose own cascade removes their
  // bodies and translations. The explicit delete is belt-and-braces so a
  // database with foreign keys off cannot silently orphan the block tree.
  const roots = await db
    .select({ id: schema.blocks.id })
    .from(schema.blocks)
    .where(eq(schema.blocks.pageId, page.id));
  if (roots.length) {
    await db.delete(schema.blocks).where(
      inArray(
        schema.blocks.id,
        roots.map((r) => r.id)
      )
    );
  }
  await db.delete(schema.pages).where(eq(schema.pages.id, page.id));
}
