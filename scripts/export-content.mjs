/**
 * Export the CMS database back to content/.
 *
 * This is the seam that lets the whole migration be non-destructive. The public
 * site keeps reading content/*.json exactly as it does today, so lib/content.ts,
 * both block renderers and every audit script stay untouched — the CMS replaces
 * the PRODUCER of that JSON, not the consumer.
 *
 * Correctness is defined byte-for-byte, not semantically. content/ is committed,
 * which makes it a golden fixture: after importing and exporting, `git diff
 * content/` must be EMPTY. That turns "no content was lost" from an argument
 * into a check, and it is the reason so much care goes into key order below.
 *
 *   node scripts/export-content.mjs            # from local D1
 *   node scripts/export-content.mjs --remote   # from the real D1 (needs auth)
 *
 * Reads happen in four bulk queries rather than per page: D1 caps a Worker
 * invocation at 50 queries on the free plan, and a per-page loop would exceed
 * that at 25 pages x 2 locales before it did anything useful.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mergeProps } from '../lib/localization.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const REMOTE = process.argv.includes('--remote');
const DB = '3lines-cms';

/**
 * wrangler's own JS entry, run under node directly.
 *
 * Not `npx`, and not a shell. On Windows npx resolves to npx.cmd, which
 * execFileSync cannot spawn without shell:true (EINVAL) — and turning the shell
 * on would then require quoting SQL that contains spaces, quotes and Arabic
 * text. Invoking the entry script sidesteps both.
 */
const WRANGLER = path.join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

/** One bulk query through wrangler, which works identically local and remote. */
function query(sql) {
  const out = execFileSync(
    process.execPath,
    [WRANGLER, 'd1', 'execute', DB, REMOTE ? '--remote' : '--local', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } }
  );
  // wrangler prints its banner before the JSON; take from the first bracket.
  const start = out.indexOf('[');
  if (start === -1) throw new Error(`no JSON in wrangler output:\n${out.slice(0, 400)}`);
  return JSON.parse(out.slice(start))[0].results;
}

/* --------------------------------------------------------------- read all -- */

const localeRows = query('SELECT code FROM locales WHERE is_enabled = 1 ORDER BY position');
const LOCALES = localeRows.map((r) => r.code);

const pages = query(
  'SELECT id, route, slug, status, source_refs, position FROM pages ORDER BY position'
);
const pageTr = query(
  'SELECT page_id, locale, title, description, keywords FROM page_translations'
);
const blocks = query(
  'SELECT id, page_id, parent_id, kind, position, props FROM blocks ORDER BY position'
);
const blockTr = query('SELECT block_id, locale, props FROM block_translations');

/* ---------------------------------------------------------------- assemble -- */

const trByPage = new Map();
for (const t of pageTr) trByPage.set(`${t.page_id}:${t.locale}`, t);

const trByBlock = new Map();
for (const t of blockTr) trByBlock.set(`${t.block_id}:${t.locale}`, t);

const topLevel = new Map(); // pageId -> blocks[]
const children = new Map(); // parentId -> blocks[]
for (const b of blocks) {
  const bucket = b.parent_id ? children : topLevel;
  const key = b.parent_id ?? b.page_id;
  if (!bucket.has(key)) bucket.set(key, []);
  bucket.get(key).push(b);
}
for (const list of [...topLevel.values(), ...children.values()]) {
  list.sort((a, b) => a.position - b.position);
}

const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

/**
 * Rebuild one block for one locale.
 *
 * `bodies` is re-appended LAST because that is where it sits on every section in
 * the corpus, and JSON.stringify follows insertion order — putting it anywhere
 * else would produce a semantically identical file that still fails the byte
 * comparison.
 */
function buildBlock(row, locale) {
  const shared = parse(row.props);
  const localized = parse(trByBlock.get(`${row.id}:${locale}`)?.props ?? null);
  const node = mergeProps(shared, localized);

  const kids = children.get(row.id);
  if (kids?.length) node.bodies = kids.map((k) => buildBlock(k, locale));
  return node;
}

let written = 0;
const problems = [];

for (const page of pages) {
  for (const locale of LOCALES) {
    const tr = trByPage.get(`${page.id}:${locale}`);
    if (!tr) {
      problems.push(`${locale}${page.route}: no page_translations row`);
      continue;
    }

    // Key order is the contract: route, locale, slug, source, title,
    // description, [keywords], [placeholder], blocks. Optional keys are omitted
    // entirely rather than emitted as null — 34 of 50 documents have no
    // keywords, and `"keywords": null` is a different file.
    const doc = {
      route: page.route,
      locale,
      slug: page.slug,
      source: parse(page.source_refs) ?? [],
      title: tr.title,
      description: tr.description,
    };
    if (tr.keywords !== null && tr.keywords !== undefined) doc.keywords = tr.keywords;
    if (page.status === 'placeholder') doc.placeholder = true;
    doc.blocks = (topLevel.get(page.id) ?? []).map((b) => buildBlock(b, locale));

    const file = path.join(CONTENT, locale, `${page.slug}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Two-space indent and a trailing newline, matching what the ingest emits.
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
    written++;
  }
}

/**
 * Remove page files for pages that no longer exist.
 *
 * The exporter never used to delete, so a page removed in the CMS dropped out
 * of routes.json but its document lingered on disk — invisible to the build,
 * confusing to every future diff. Only page documents are candidates: the
 * chrome, microcopy and news index files are owned by their own sections above.
 */
const KEEP = new Set(['chrome.json', 'ui.json', 'news-items.json']);
const liveSlugs = new Set(pages.map((p) => `${p.slug}.json`));
for (const locale of LOCALES) {
  const dir = path.join(CONTENT, locale);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json') || KEEP.has(file) || liveSlugs.has(file)) continue;
    fs.unlinkSync(path.join(dir, file));
    console.log(`  removed stale ${locale}/${file}`);
  }
}

/* -------------------------------------------------------- news + settings -- */

/**
 * news-items.json, per locale.
 *
 * Key order and shape must match what the ingest emitted, for the same reason
 * everything else here does: the gate compares bytes. `art` is always null in
 * the shipped content but the key is emitted, because dropping it would remove
 * the inline-SVG capability from the schema rather than just its value.
 */
const newsRows = query('SELECT id, slug, route, date, media_src, position FROM news_items ORDER BY position');
const newsTr = query('SELECT item_id, locale, title, tag, type, media_alt FROM news_item_translations');
const newsTrOf = new Map(newsTr.map((t) => [`${t.item_id}:${t.locale}`, t]));

for (const locale of LOCALES) {
  const items = newsRows.map((r) => {
    const t = newsTrOf.get(`${r.id}:${locale}`);
    return {
      slug: r.slug,
      route: r.route,
      tag: t?.tag ?? '',
      type: t?.type ?? '',
      date: r.date,
      title: t?.title ?? '',
      media: r.media_src ? { src: r.media_src, alt: t?.media_alt ?? '' } : null,
      art: null,
    };
  });
  fs.writeFileSync(
    path.join(CONTENT, locale, 'news-items.json'),
    JSON.stringify(items, null, 2) + '\n'
  );
}

/**
 * content/{locale}/chrome.json — header, mega menu and footer.
 *
 * Same merge as the page blocks: one structural document, one localized overlay
 * per locale. Written only when the row exists so this exporter still runs
 * against a database seeded before the chrome tables were added.
 */
const chromeRows = query(`SELECT id, props FROM chrome_docs WHERE id = 'chrome'`);
if (chromeRows.length) {
  const chromeTr = query(`SELECT locale, props FROM chrome_translations WHERE id = 'chrome'`);
  const chromeTrOf = new Map(chromeTr.map((t) => [t.locale, parse(t.props)]));
  const chromeShared = parse(chromeRows[0].props);
  for (const locale of LOCALES) {
    fs.writeFileSync(
      path.join(CONTENT, locale, 'chrome.json'),
      JSON.stringify(mergeProps(chromeShared, chromeTrOf.get(locale) ?? null), null, 2) + '\n'
    );
  }
}

/**
 * content/{locale}/ui.json — interface microcopy. Ordered by key so the file is
 * byte-stable regardless of edit order. Skipped entirely against a database
 * seeded before the ui_strings rows existed.
 */
const uiRows = query('SELECT key, locale, value FROM ui_strings ORDER BY key');
for (const locale of LOCALES) {
  const map = {};
  for (const r of uiRows) if (r.locale === locale) map[r.key] = r.value;
  if (Object.keys(map).length) {
    fs.writeFileSync(path.join(CONTENT, locale, 'ui.json'), JSON.stringify(map, null, 2) + '\n');
  }
}

/**
 * content/settings.json — the site-wide values lib/schema.ts needs for JSON-LD.
 *
 * New file rather than rewriting source-content/siteInfo.json: source-content/
 * is the archived migration input and must stop being read at runtime, which is
 * the whole point of moving these into the database.
 */
const settingRows = query('SELECT key, value FROM settings');
const settingTr = query('SELECT key, locale, value FROM settings_translations');

const settings = {};
for (const r of settingRows) settings[r.key] = r.value;
for (const r of settingTr) {
  if (!settings[r.key] || typeof settings[r.key] !== 'object') settings[r.key] = {};
  settings[r.key][r.locale] = r.value;
}
fs.writeFileSync(
  path.join(CONTENT, 'settings.json'),
  JSON.stringify(settings, null, 2) + '\n'
);

// routes.json is derived from the same rows, so a page added in the CMS appears
// in the manifest that drives generateStaticParams without a second step.
fs.writeFileSync(
  path.join(CONTENT, 'routes.json'),
  JSON.stringify(
    pages.map((p) => ({ route: p.route, slug: p.slug })),
    null,
    2
  ) + '\n'
);

if (problems.length) {
  console.error(`EXPORT FAILED — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log(`EXPORT OK — ${written} documents + routes.json from ${REMOTE ? 'remote' : 'local'} D1`);
  console.log(`  locales: ${LOCALES.join(', ')}`);
  console.log(`  pages:   ${pages.length}`);
  console.log(`  blocks:  ${blocks.length}`);
  console.log('\n  verify with: git diff --stat content/   (must be EMPTY)');
}
