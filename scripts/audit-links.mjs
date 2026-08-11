/**
 * Internal link + reachability audit against the running clone.
 *
 * Verifies: no broken internal links, no unreachable routes, no orphans, and
 * no internal link accidentally rewritten to an external host.
 */
import { ROUTES } from './lib/browser.mjs';
import { load } from 'cheerio';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:3200';
const SOURCE_HOST = 'thales-group-3lines.vercel.app';

const errors = [];
const seenTargets = new Map(); // url -> occurrences
const reachedFrom = new Map(); // route -> Set(referrers)
let occurrences = 0;
let hashOnly = 0;
let external = 0;

const status = new Map();
async function head(url) {
  if (status.has(url)) return status.get(url);
  const res = await fetch(url, { redirect: 'manual' });
  status.set(url, res.status);
  return res.status;
}

for (const route of ROUTES) {
  const res = await fetch(BASE + route);
  if (res.status !== 200) {
    errors.push(`route ${route} returned ${res.status}`);
    continue;
  }
  const $ = load(await res.text());

  const anchors = $('a[href]').toArray();
  if (!anchors.length) errors.push(`route ${route} has no links at all`);

  for (const a of anchors) {
    const href = $(a).attr('href');
    occurrences++;

    if (!href || href === '#') {
      hashOnly++;
      continue;
    }
    if (href.startsWith('#')) {
      hashOnly++;
      continue;
    }
    if (/^[a-z]+:/i.test(href) || href.startsWith('//')) {
      external++;
      if (href.includes(SOURCE_HOST))
        errors.push(`${route}: internal link leaked as an absolute source URL — ${href}`);
      continue;
    }
    if (/\.html(\?|#|$)/i.test(href))
      errors.push(`${route}: unresolved .html link survived into the output — ${href}`);

    const target = href.split('#')[0] || '/';
    const abs = new URL(target, BASE + route).toString();
    seenTargets.set(abs, (seenTargets.get(abs) || 0) + 1);

    const code = await head(abs);
    if (code !== 200) errors.push(`${route}: broken internal link ${href} -> ${code}`);

    const path = new URL(abs).pathname.replace(/\/$/, '') || '/';
    if (!reachedFrom.has(path)) reachedFrom.set(path, new Set());
    reachedFrom.get(path).add(route);
  }
}

// Orphan check: every known route must be linked from at least one other page.
for (const route of ROUTES) {
  const refs = reachedFrom.get(route);
  if (!refs || refs.size === 0) errors.push(`route ${route} is orphaned — nothing links to it`);
}

// Reachability check: every known route must actually serve 200.
for (const route of ROUTES) {
  const code = await head(BASE + route);
  if (code !== 200) errors.push(`route ${route} unreachable — ${code}`);
}

console.log(`  routes checked:      ${ROUTES.length}`);
console.log(`  link occurrences:    ${occurrences}`);
console.log(`  distinct targets:    ${seenTargets.size}`);
console.log(`  in-page/# anchors:   ${hashOnly}`);
console.log(`  external links:      ${external}`);
console.log(`  broken links:        ${errors.filter((e) => e.includes('broken')).length}`);

if (errors.length) {
  console.error(`\nLINK AUDIT FAILED — ${errors.length} problem(s):`);
  console.error(errors.map((e) => '  ' + e).join('\n'));
  process.exit(1);
}
console.log('\nLINK AUDIT OK — 0 broken links, 0 unreachable routes, 0 orphans.');
