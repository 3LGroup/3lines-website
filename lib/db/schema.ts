import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import type { Block, SectionBody } from '@/lib/blocks';

/**
 * CMS schema — phase A.
 *
 * Scoped to what a verbatim import and a byte-identical export need, and no
 * further. The entity tables that de-duplicate query-family blocks (services,
 * partners, companies, certifications, news_posts) arrive with phase B, once
 * phase A has proved the round-trip. Writing them now would mean shipping
 * tables nothing reads, which is how dead schema accretes — the same reason
 * `projects` is deliberately absent despite being named in the brief.
 *
 * Where the JSON line sits: a field earns a column iff something OUTSIDE its
 * own renderer needs it — a foreign key, a uniqueness or referential
 * constraint, a cross-entity query, or a workflow state. The leaf shape of a
 * 20-variant discriminated union is none of those, so it stays in a
 * Zod-validated `props` blob keyed on `kind`.
 *
 * SQLite differences from the Postgres sketch this was designed as, all
 * deliberate rather than reluctant:
 *   - ids are application-generated UUIDs, not uuidv7() — D1 has no such function
 *   - jsonb becomes text with mode:'json'; D1 supports the JSON functions if a
 *     query ever needs to reach inside, which nothing does today
 *   - no DEFERRABLE constraints, so (scope, position) uniqueness is enforced in
 *     application code by rewriting a whole scope in one statement rather than
 *     shifting rows one at a time
 *   - no materialized views; the translation-coverage view is a plain query
 */

const now = sql`(unixepoch())`;

/* ------------------------------------------------------------------ locales -- */

/**
 * A table, not an enum, so adding a locale is a row rather than a migration
 * plus a code deploy. Seeded with four and only two enabled: content-inventory
 * .json carries complete Japanese and Korean that scripts/ingest-3lines.mjs
 * discards at LOCALES=['en','ar'], and importing it disabled costs two rows per
 * translatable record and zero runtime — no route, no sitemap entry, no
 * hreflang — while making it recoverable instead of one script edit from gone.
 */
export const locales = sqliteTable('locales', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  nativeName: text('native_name').notNull(),
  dir: text('dir', { enum: ['ltr', 'rtl'] })
    .notNull()
    .default('ltr'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Where an untranslated value falls back to. Null for the default locale. */
  fallbackCode: text('fallback_code'),
  position: integer('position').notNull().default(0),
});

/* -------------------------------------------------------------------- pages -- */

export const pages = sqliteTable(
  'pages',
  {
    id: text('id').primaryKey(),
    /** Locale-LESS route id, e.g. "/services/simulation-systems". */
    route: text('route').notNull().unique(),
    /** Filesystem-safe slug the exporter writes to, e.g. "services--simulation-systems". */
    slug: text('slug').notNull().unique(),
    /**
     * 'placeholder' is not decoration: it drives BOTH noindex in
     * app/[locale]/[[...slug]]/page.tsx and exclusion from app/sitemap.ts. One
     * flag, two consumers, which is why it is a status rather than a boolean
     * pair that could contradict itself.
     */
    status: text('status', { enum: ['draft', 'placeholder', 'published', 'archived'] })
      .notNull()
      .default('draft'),
    /** PageDoc.source — provenance the content audit traces back through. */
    sourceRefs: text('source_refs', { mode: 'json' }).$type<string[]>(),
    position: integer('position'),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [index('pages_status_idx').on(t.status)]
);

export const pageTranslations = sqliteTable(
  'page_translations',
  {
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    locale: text('locale')
      .notNull()
      .references(() => locales.code),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /**
     * ONE string, verbatim. The source mixes English and Arabic tokens in a
     * single comma-separated value ("contact,us,تواصل,معنا"); splitting it into
     * an array or deduping across locales would silently rewrite authored SEO.
     */
    keywords: text('keywords'),
    /**
     * 'intentionally_identical' distinguishes a proper noun that is the same in
     * both languages (SAMI, XR) from 'source_fallback', which is English sitting
     * untranslated in an Arabic document. 185 strings currently match across
     * locales and the difference between those two cases is the entire point of
     * a translation-coverage report.
     */
    translationState: text('translation_state', {
      enum: ['translated', 'source_fallback', 'intentionally_identical', 'stale'],
    })
      .notNull()
      .default('translated'),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.locale] })]
);

/* ------------------------------------------------------------------- blocks -- */

/**
 * The 20 discriminators from lib/blocks.ts, as data.
 *
 * `level` separates the 5 top-level Block types from the 15 SectionBody kinds;
 * `family` is what lets phase B replace inline items with references without
 * touching the renderers. Counts are advice for the editor, NOT build gates —
 * the hard-coded `expected 4 companies` in the ingest is exactly the failure
 * this replaces.
 */
export const blockKinds = sqliteTable('block_kinds', {
  kind: text('kind').primaryKey(),
  level: text('level', { enum: ['block', 'body'] }).notNull(),
  family: text('family', { enum: ['authored', 'query', 'config'] }).notNull(),
  /** False hides it from the editor palette without deleting the renderer. */
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  minItems: integer('min_items'),
  maxItems: integer('max_items'),
  /** Soft target. Exceeding it warns in the editor rather than failing a build. */
  recommendedItems: integer('recommended_items'),
  label: text('label').notNull(),
  description: text('description'),
});

/**
 * One self-referencing table for both levels, not two.
 *
 * Block -> SectionBody is a parent/child edge, not two entity types. One table
 * gives one id space, one ordering scheme, one drag-and-drop endpoint and one
 * revision snapshot format. 184 rows site-wide.
 *
 * Deliberately LOCALE-FREE. Structure and order live here; only text lives in
 * block_translations. That makes EN/AR structural divergence unrepresentable
 * rather than something scripts/audit-content.mjs check 7 has to re-assert on
 * every build — and it means a translator physically cannot reorder the Arabic
 * page.
 */
export const blocks = sqliteTable(
  'blocks',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id').references(() => pages.id, { onDelete: 'cascade' }),
    /** Set instead of pageId for the shared CTA band and social strip. */
    globalKey: text('global_key'),
    /**
     * Null for a top-level block; the owning section for a body.
     *
     * The AnySQLiteColumn annotation is required for a self-reference — without
     * it TypeScript cannot infer the circular type and Drizzle emits no foreign
     * key at all, which would leave a deleted section's bodies orphaned rather
     * than cascaded.
     */
    parentId: text('parent_id').references((): AnySQLiteColumn => blocks.id, {
      onDelete: 'cascade',
    }),
    kind: text('kind')
      .notNull()
      .references(() => blockKinds.kind),
    position: integer('position').notNull(),
    /** SectionBlock.id — the in-page anchor (#services, #companies). */
    anchor: text('anchor'),
    /**
     * Deterministic migration key, e.g. "index.3-section.0-companies". Makes the
     * importer idempotent via ON CONFLICT, makes the verification diff readable,
     * and is NEVER read at render. Null for editor-created blocks.
     */
    stableKey: text('stable_key'),
    /** Locale-INVARIANT props only: tone, columns, variant, limit, count, lat/lng. */
    props: text('props', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [
    index('blocks_page_idx').on(t.pageId, t.position),
    index('blocks_parent_idx').on(t.parentId, t.position),
    unique('blocks_page_stable_key').on(t.pageId, t.stableKey),
  ]
);

export const blockTranslations = sqliteTable(
  'block_translations',
  {
    blockId: text('block_id')
      .notNull()
      .references(() => blocks.id, { onDelete: 'cascade' }),
    locale: text('locale')
      .notNull()
      .references(() => locales.code),
    /** Localized props only: heading, lede, text, label, alt, glance[]. */
    props: text('props', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    translationState: text('translation_state', {
      enum: ['translated', 'source_fallback', 'intentionally_identical', 'stale'],
    })
      .notNull()
      .default('translated'),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.blockId, t.locale] })]
);

/* ----------------------------------------------------------------- settings -- */

/**
 * siteInfo.json + constants.json, which lib/schema.ts currently reads from
 * source-content/ AT RUNTIME to build the Organization JSON-LD. That read has to
 * move here in the same change that archives source-content/, or JSON-LD breaks
 * in production.
 *
 * Nullable values are load-bearing: constants.whatsapp is null, and that null is
 * why no WhatsApp icon renders in the social strip. Migrating the rendered strip
 * instead of the inputs would lose the gating rule — populating the setting must
 * make the icon appear with no code change.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  /** Free-text note on why a value is what it is; carried over from $comment keys. */
  editorialNote: text('editorial_note'),
  updatedAt: integer('updated_at').notNull().default(now),
});

export const settingsTranslations = sqliteTable(
  'settings_translations',
  {
    key: text('key')
      .notNull()
      .references(() => settings.key, { onDelete: 'cascade' }),
    locale: text('locale')
      .notNull()
      .references(() => locales.code),
    value: text('value'),
  },
  (t) => [primaryKey({ columns: [t.key, t.locale] })]
);

/**
 * The 8 chrome strings hardcoded in lib/ui.ts plus non-cms.json's label tables.
 * Held for all four locales even though two are disabled, for the same reason
 * the locales table has four rows.
 */
export const uiStrings = sqliteTable(
  'ui_strings',
  {
    key: text('key').notNull(),
    locale: text('locale')
      .notNull()
      .references(() => locales.code),
    value: text('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.locale] })]
);

/* ------------------------------------------------------------ migration ops -- */

/**
 * A ledger, so a re-run is auditable and a partial run is detectable.
 *
 * contentChecksum hashes the canonicalized content/ tree. If it has moved since
 * the last run, the importer refuses without --force: that is the guard against
 * re-importing over edits an editor has already made in the CMS.
 */
export const migrationRuns = sqliteTable('migration_runs', {
  id: text('id').primaryKey(),
  phase: text('phase').notNull(),
  status: text('status', { enum: ['running', 'ok', 'failed'] }).notNull(),
  sourceGitSha: text('source_git_sha'),
  contentChecksum: text('content_checksum'),
  stats: text('stats', { mode: 'json' }).$type<Record<string, number>>(),
  startedAt: integer('started_at').notNull().default(now),
  finishedAt: integer('finished_at'),
  error: text('error'),
});

/* --------------------------------------------------------------------- types -- */

/** What the exporter reassembles: shared props merged with the locale's props. */
export type StoredBlock = typeof blocks.$inferSelect;
export type StoredBlockTranslation = typeof blockTranslations.$inferSelect;

/**
 * The contract the exporter must satisfy. lib/blocks.ts stays authoritative —
 * the database's job is to produce a structurally identical Block, so
 * components/blocks/Blocks.tsx and components/bodies/Bodies.tsx never change and
 * their assertNever exhaustiveness guarantee is preserved untouched.
 */
export type ExportedBlock = Block;
export type ExportedBody = SectionBody;
