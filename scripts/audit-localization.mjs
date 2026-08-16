/**
 * Prove the localization split before anything depends on it.
 *
 * The CMS stores each block once, with structure and order on a locale-free row
 * and copy on one row per locale. That split is the migration's single largest
 * content-loss risk, so it gets two assertions rather than a code review.
 *
 *   1. LOSSLESS — mergeProps(splitProps(x)) reproduces x exactly, including key
 *      order, for every block in every locale. Key order matters because the
 *      exporter has to write content/ byte-identically; reconstructing from two
 *      disjoint objects emitted {tone, bodies, type} where the source had
 *      {type, tone, bodies}, and that alone broke 286 of 368 blocks.
 *
 *   2. USEFUL — the shared half of EN deep-equals the shared half of AR. This is
 *      the assertion that actually matters: a split that classifies everything
 *      as shared passes check 1 perfectly and silently discards every Arabic
 *      string. Running it found two real misclassifications — a date inside
 *      defs meta values, and the four form status messages — both of which would
 *      have frozen Arabic copy into a column with no locale.
 *
 * Neither check needs a database. This is a property of the classification, so
 * it runs offline, in milliseconds, before the importer is allowed near D1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { splitProps, mergeProps } from '../lib/localization.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'content');
const LOCALES = ['en', 'ar'];

const S = (v) => JSON.stringify(v);
const problems = [];
const fail = (m) => problems.push(m);

const routes = JSON.parse(fs.readFileSync(path.join(CONTENT, 'routes.json'), 'utf8'));

/** First differing path between two structures, so a failure names a field. */
function firstDiff(a, b, trail = '') {
  if (S(a) === S(b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = firstDiff(a[i], b[i], `${trail}[${i}]`);
      if (d) return d;
    }
  }
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff(a[k], b[k], `${trail}.${k}`);
      if (d) return d;
    }
  }
  return { path: trail || '(root)', a, b };
}

const countLeaves = (v) =>
  v === null || v === undefined
    ? 0
    : Array.isArray(v)
      ? v.reduce((n, x) => n + countLeaves(x), 0)
      : typeof v === 'object'
        ? Object.values(v).reduce((n, x) => n + countLeaves(x), 0)
        : 1;

/** Every block and body of a document, flattened with a readable trail. */
function* walk(doc) {
  for (const [i, block] of doc.blocks.entries()) {
    yield { node: block, kind: block.type, trail: `blocks[${i}]` };
    if (block.type === 'section' && Array.isArray(block.bodies)) {
      for (const [j, body] of block.bodies.entries()) {
        yield { node: body, kind: body.kind, trail: `blocks[${i}].bodies[${j}]` };
      }
    }
  }
}

let roundTripped = 0;
let compared = 0;
let localizedLeaves = 0;

for (const r of routes) {
  const docs = {};
  for (const locale of LOCALES) {
    const file = path.join(CONTENT, locale, `${r.slug}.json`);
    if (!fs.existsSync(file)) {
      fail(`${locale}${r.route}: document missing at ${file}`);
      continue;
    }
    docs[locale] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  if (Object.keys(docs).length !== LOCALES.length) continue;

  const nodes = Object.fromEntries(LOCALES.map((l) => [l, [...walk(docs[l])]]));

  // Structural parity is asserted by audit-content.mjs check 7, but if it ever
  // fails, comparing halves index-by-index would report nonsense — so bail here
  // with the real reason rather than a hundred spurious diffs.
  if (nodes.en.length !== nodes.ar.length) {
    fail(`${r.route}: EN has ${nodes.en.length} blocks, AR has ${nodes.ar.length}`);
    continue;
  }

  for (const [i, en] of nodes.en.entries()) {
    const ar = nodes.ar[i];

    // 1. lossless, per locale
    for (const [locale, node] of [
      ['en', en.node],
      ['ar', ar.node],
    ]) {
      roundTripped++;
      const { shared, localized } = splitProps(node);
      const merged = mergeProps(shared, localized);
      if (S(merged) !== S(node)) {
        const d = firstDiff(node, merged);
        fail(
          `${locale}${r.route} ${en.trail} (${en.kind}): split/merge is not lossless at ${d?.path}\n` +
            `      original: ${S(d?.a)?.slice(0, 120)}\n` +
            `      merged:   ${S(d?.b)?.slice(0, 120)}`
        );
      }
    }

    // 3. structural — the discriminator must live on the locale-free row.
    //
    // Checks 1 and 2 are both blind to this. `type: "hero"` is identical in
    // Arabic, so classifying it as copy round-trips perfectly AND keeps the two
    // shared halves equal — while quietly storing the identity of every block
    // twice, in rows that are free to diverge. Found by building the editor and
    // seeing `type` offered as a text field.
    for (const [locale, node] of [
      ['en', en.node],
      ['ar', ar.node],
    ]) {
      const { shared } = splitProps(node);
      const disc = en.node.type !== undefined ? 'type' : 'kind';
      if (shared?.[disc] !== node[disc]) {
        fail(
          `${locale}${r.route} ${en.trail}: discriminator "${disc}" is not in the shared half ` +
            `(got ${S(shared?.[disc])}, expected ${S(node[disc])}) — it would be stored per locale`
        );
      }
    }

    // 2. useful — the shared half carries no locale-varying copy
    compared++;
    const se = splitProps(en.node);
    const sa = splitProps(ar.node);
    // Count a section's OWN copy only. Its bodies are walked as separate nodes,
    // and splitProps on a section returns their text too, so counting the whole
    // tree tallies every body twice — which inflated this figure from the true
    // 1,021 editable fields to 1,735 and sent me hunting for 714 missing rows
    // that were never missing.
    localizedLeaves += countLeaves(
      en.kind === 'section' && se.localized ? { ...se.localized, bodies: undefined } : se.localized
    );
    if (S(se.shared) !== S(sa.shared)) {
      const d = firstDiff(se.shared, sa.shared);
      fail(
        `${r.route} ${en.trail} (${en.kind}): locale-varying value classified as SHARED at ${d?.path}\n` +
          `      en: ${S(d?.a)?.slice(0, 120)}\n` +
          `      ar: ${S(d?.b)?.slice(0, 120)}\n` +
          `      -> add that key to LOCALIZED_KEYS in lib/localization.mjs`
      );
    }
  }
}

if (problems.length) {
  console.error(`LOCALIZATION AUDIT FAILED — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log('LOCALIZATION AUDIT OK');
  console.log(`  round-trips verified : ${roundTripped} (lossless, key order preserved)`);
  console.log(`  blocks compared      : ${compared} (shared half is locale-invariant)`);
  console.log(`  localized leaves     : ${localizedLeaves}`);
}
