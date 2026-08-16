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
import { mergeProps } from './lib/localization.mjs';

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
