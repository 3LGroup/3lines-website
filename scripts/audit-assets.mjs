/**
 * Cache-busting audit.
 *
 * Every other audit in this project runs in a cold browser with caching
 * disabled, so none of them can see a stale cache-busting query. That blind spot
 * cost real time: style.css was edited four times while still advertised as
 * `?v=3`, so the server served correct CSS that returning browsers never
 * re-fetched — fixes measured green here and looked broken to the user.
 *
 * This asserts that every versioned asset URL carries the *current* content hash
 * of the file it points at, so a stale reference is a build failure.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ROUTES } from './lib/browser.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:3200';
const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const problems = [];
const checked = new Map();

const hashOf = (rel) =>
  createHash('sha1').update(fs.readFileSync(path.join(PUBLIC, rel))).digest('hex').slice(0, 8);

// One page per template is enough — the chrome is shared, and the asset URLs
// come from the layout.
const SAMPLE = ['/en', '/ar', '/en/about', '/en/services', '/en/partners', '/en/contact'];

for (const route of SAMPLE) {
  const res = await fetch(BASE + route);
  if (res.status !== 200) {
    problems.push(`${route} returned ${res.status}`);
    continue;
  }
  const html = await res.text();

  // The version charset is restricted to the hash alphabet on purpose: Next
  // emits these URLs inside an escaped-JSON payload too, and a looser capture
  // swallows the escaping backslash before the closing quote.
  for (const m of html.matchAll(/(\/assets\/[^"'?\\]+\.(?:css|js))(?:\?v=([A-Za-z0-9]+))?/g)) {
    const [, publicPath, version] = m;
    const rel = publicPath.replace(/^\//, '');

    if (!fs.existsSync(path.join(PUBLIC, rel))) {
      problems.push(`${route}: references a missing asset — ${publicPath}`);
      continue;
    }
    if (!version) {
      problems.push(`${route}: ${publicPath} has no cache-busting query`);
      continue;
    }

    const expected = hashOf(rel);
    if (version !== expected)
      problems.push(
        `${route}: ${publicPath} advertises ?v=${version} but its content hash is ${expected} — ` +
          `returning browsers will keep the old file`
      );

    checked.set(publicPath, version);
  }
}

console.log(`  pages sampled:      ${SAMPLE.length}`);
console.log(`  versioned assets:   ${checked.size}`);
for (const [p, v] of checked) console.log(`    ${p} ?v=${v}`);

if (problems.length) {
  console.error(`\nASSET AUDIT FAILED — ${problems.length} problem(s):`);
  console.error(problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}
console.log('\nASSET AUDIT OK — every asset URL carries its current content hash.');
