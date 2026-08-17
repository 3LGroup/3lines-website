/**
 * Is lib/asset-manifest.json current with public/?
 *
 * The manifest is what lib/assets.ts turns into `?v=<hash>` cache-busting URLs.
 * Let it fall behind the files it describes and the site serves a stale query
 * string for changed bytes: everyone with the old URL cached keeps the OLD
 * stylesheet, and nothing looks wrong to anyone testing in a fresh browser.
 * That is the exact failure lib/assets.ts was written to make impossible, and
 * its own docblock records it happening before — four consecutive fixes to
 * style.css all shipped under `?v=3`.
 *
 * It happened again: two stylesheets were edited, committed and pushed while
 * the manifest still held their previous hashes.
 *
 * scripts/audit-assets.mjs already covers this, but from the outside — it reads
 * served HTML and therefore needs a build and a running server, which puts it
 * twenty minutes into the pipeline. This is the same question asked offline in
 * about a second, so a stale manifest is caught before anything is built and
 * long before anything is pushed. The two are complementary: this one proves
 * the manifest matches the files, that one proves the HTML matches the manifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const MANIFEST = path.join(ROOT, 'lib', 'asset-manifest.json');

if (!fs.existsSync(MANIFEST)) {
  console.error('MANIFEST AUDIT FAILED — lib/asset-manifest.json does not exist.');
  console.error('  Run `npm run assets:manifest`.');
  process.exitCode = 1;
} else {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

  /** Same walk and same hash as scripts/build-asset-manifest.mjs. */
  function* walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) yield* walk(full);
      else yield full;
    }
  }

  const stale = [];
  const missing = [];
  const seen = new Set();

  for (const file of walk(PUBLIC)) {
    const url = '/' + path.relative(PUBLIC, file).split(path.sep).join('/');
    seen.add(url);
    const actual = createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
    const recorded = manifest[url];
    if (recorded === undefined) missing.push(url);
    else if (recorded !== actual) stale.push({ url, recorded, actual });
  }

  // A file deleted from public/ but still listed is harmless at runtime — the
  // entry is simply never looked up — but it means the manifest was not
  // regenerated, which is the thing being checked.
  const orphaned = Object.keys(manifest).filter((url) => !seen.has(url));

  const problems = stale.length + missing.length + orphaned.length;

  if (problems) {
    console.error(`MANIFEST AUDIT FAILED — ${problems} problem(s):`);
    for (const s of stale) {
      console.error(`  ✗ stale    ${s.url}`);
      console.error(`               manifest ${s.recorded}   file ${s.actual}`);
    }
    for (const m of missing) console.error(`  ✗ missing  ${m} exists in public/ but not in the manifest`);
    for (const o of orphaned) console.error(`  ✗ orphaned ${o} is in the manifest but not in public/`);
    console.error('\n  Fix: npm run assets:manifest   (then commit the result)');
    process.exitCode = 1;
  } else {
    console.log('MANIFEST AUDIT OK');
    console.log(`  ${seen.size} files, every hash matches lib/asset-manifest.json`);
  }
}
