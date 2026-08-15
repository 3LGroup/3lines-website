/**
 * Precompute the content hashes that lib/assets.ts serves.
 *
 * `asset()` used to hash the file itself, at render time, with
 * fs.readFileSync(process.cwd() + '/public' + path). That worked while every
 * page was prerendered at build, because "render time" and "build time" were
 * the same moment and the repo was on disk.
 *
 * On Cloudflare that stops being true. public/ is uploaded to Workers Static
 * Assets, not bundled into the Worker, so at request time there is no
 * process.cwd() containing it. The read fails, asset() catches, and every
 * stylesheet and script on any runtime-rendered route ships as `?v=missing`.
 * That failure is invisible in a cold browser and cache-poisons returning
 * visitors — exactly the class of bug lib/assets.ts was written to eliminate.
 *
 * So the hashing moves to build time and the result is committed, the same way
 * content/ is: a generated artifact whose diff is reviewable. `npm run build`
 * regenerates it first, so it cannot silently go stale.
 *
 * The algorithm is unchanged — sha1 of the file's bytes, hex, first 8 chars —
 * so every emitted URL is byte-identical to what the old implementation
 * produced, and scripts/audit-assets.mjs keeps passing without modification.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'lib', 'asset-manifest.json');

/** Every file under public/, as the `/`-rooted URL path asset() is called with. */
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const manifest = {};
let bytes = 0;

for (const file of walk(PUBLIC)) {
  const buf = fs.readFileSync(file);
  bytes += buf.length;
  // Forward slashes regardless of platform: this is a URL, not a path.
  const url = '/' + path.relative(PUBLIC, file).split(path.sep).join('/');
  manifest[url] = createHash('sha1').update(buf).digest('hex').slice(0, 8);
}

// Sorted so a regenerated manifest diffs as "these files changed" rather than
// as a reordering of everything.
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));

fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');

const count = Object.keys(sorted).length;
console.log(`ASSET MANIFEST OK — ${count} files, ${(bytes / 1024 / 1024).toFixed(2)} MB hashed`);
console.log(`  ${path.relative(ROOT, OUT)}`);
