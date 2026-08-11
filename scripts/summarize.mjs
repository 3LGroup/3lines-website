/** Summarise a visual audit report: group findings by selector + property. */
import fs from 'node:fs';

const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

console.log(`comparisons ${report.actualComparisons}/${report.expectedComparisons}  errored ${report.erroredComparisons}`);
console.log(`elements ${report.totalElementsCompared}  props ${report.totalPropsCompared}`);
console.log(`count findings ${report.totalCountFindings}  geometry findings ${report.totalGeometryFindings}\n`);

const byCount = new Map();
for (const c of report.comparisons)
  for (const f of c.counts) {
    const k = `${f.selector}  source=${f.source} local=${f.local}`;
    if (!byCount.has(k)) byCount.set(k, new Set());
    byCount.get(k).add(`${c.viewport}${c.route}`);
  }
if (byCount.size) {
  console.log('--- STRUCTURAL COUNT DIFFERENCES ---');
  for (const [k, where] of byCount) console.log(`  ${k}   (${where.size} page/viewport combos)`);
  console.log('');
}

const byProp = new Map();
for (const c of report.comparisons)
  for (const g of c.geometry)
    for (const d of g.diffs) {
      const k = `${g.selector} :: ${d.prop}`;
      if (!byProp.has(k)) byProp.set(k, { n: 0, samples: [] });
      const e = byProp.get(k);
      e.n++;
      if (e.samples.length < 3)
        e.samples.push(`${c.viewport}${c.route}[${g.index}] src=${d.source} loc=${d.local}`);
    }

console.log('--- GEOMETRY DIFFERENCES (by selector::prop) ---');
for (const [k, v] of [...byProp.entries()].sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${String(v.n).padStart(4)}x  ${k}\n           ${v.samples.join('\n           ')}`);
