/**
 * One gated verification pipeline.
 *
 * Every stage is a hard gate: the first genuine failure stops the run, so a
 * later stage can never report "pass" on top of an earlier failure. The final
 * stage re-opens the visual report from disk and validates it as an artifact
 * rather than trusting any exit code.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { ROUTES, VIEWPORTS } from './lib/browser.mjs';

const PORT = Number(process.env.AUDIT_PORT || 3200);
const BASE = `http://127.0.0.1:${PORT}`;
const RUN_DIR = path.join('audit-runs', `verify-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const LOG = path.join(RUN_DIR, 'pipeline.log');

fs.mkdirSync(RUN_DIR, { recursive: true });

let stageNo = 0;
const results = [];

function log(line) {
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

function die(stage, reason, detail) {
  log(`\n✗ STAGE ${stage} FAILED — ${reason}`);
  if (detail) log(String(detail).split('\n').slice(0, 40).map((l) => '    ' + l).join('\n'));
  log(`\nPIPELINE ABORTED at stage ${stage}. Later stages did not run.`);
  results.push({ stage, status: 'failed', reason });
  fs.writeFileSync(path.join(RUN_DIR, 'stages.json'), JSON.stringify(results, null, 2));
  if (server) server.kill();
  process.exit(1);
}

/**
 * Record a stage that was deliberately not run.
 *
 * Distinct from `ok` in stages.json on purpose: a skipped stage is not a passed
 * one, and a run that skipped something must not read as fully green either to
 * a person scanning the log or to anything parsing the artifact.
 */
function skip(name, why) {
  stageNo++;
  log(`\n── stage ${stageNo}: ${name} ──`);
  log(`  ⊘ SKIPPED — ${why}`);
  results.push({ stage: stageNo, name, status: 'skipped', reason: why });
}

function run(name, cmd, args, env = {}) {
  stageNo++;
  log(`\n── stage ${stageNo}: ${name} ──`);
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  fs.appendFileSync(LOG, out);
  const tail = out.trim().split('\n').slice(-14).join('\n');
  if (tail) log(tail.split('\n').map((l) => '  ' + l).join('\n'));
  if (r.status !== 0) die(stageNo, `${name} exited ${r.status}`, out.trim().split('\n').slice(-25).join('\n'));
  results.push({ stage: stageNo, name, status: 'ok' });
  return out;
}

const portBusy = (port) =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(true));
    s.once('listening', () => s.close(() => resolve(false)));
    s.listen(port, '127.0.0.1');
  });

let server = null;

/* ------------------------------------------------ 1. process safety check -- */

stageNo++;
log(`── stage ${stageNo}: process safety ──`);
if (await portBusy(PORT))
  die(stageNo, `port ${PORT} is already in use — another server or audit may be running. Stop it first.`);

const ps = spawnSync(
  'powershell',
  ['-NoProfile', '-Command', "(Get-Process chrome -ErrorAction SilentlyContinue | Measure-Object).Count"],
  { encoding: 'utf8' }
);
const chromeCount = Number((ps.stdout || '0').trim()) || 0;
log(`  port ${PORT}: free`);
log(`  pre-existing chrome processes: ${chromeCount} (audit launches its own isolated instance)`);
log(`  fresh run directory: ${RUN_DIR}`);
results.push({ stage: stageNo, name: 'process safety', status: 'ok' });

/* --------------------------------------------------------- 2..4 content -- */

/**
 * The extract stage reads the sibling checkout (`../3lines-website`) for the copy
 * that lives only in its compiled JS and prerendered HTML. Its output,
 * source-content/non-cms.json, is committed precisely so the build never depends
 * on that checkout being present — extract-non-cms.mjs says as much in its own
 * docblock. Without the sibling it exits 1, which used to abort the whole
 * pipeline before the build, on a machine where nothing was actually wrong.
 *
 * So: run it when the sibling is there (re-deriving is how we catch drift), and
 * skip it loudly when it is not. What it produces is already on disk either way.
 * The ingest stage below reads only source-content/ and is unaffected.
 */
const SIBLING = path.resolve(import.meta.dirname, '..', '..', '3lines-website');
if (fs.existsSync(SIBLING)) {
  run('extract non-CMS copy', 'node', ['scripts/extract-non-cms.mjs']);
} else {
  skip(
    'extract non-CMS copy',
    `sibling checkout not found at ${SIBLING} — using the committed source-content/non-cms.json. ` +
      'Clone 3lines-website beside this repo to re-derive it.'
  );
}

run('content ingestion', 'node', ['scripts/ingest-3lines.mjs']);
run('content ↔ schema ↔ renderer parity (both locales)', 'node', ['scripts/audit-content.mjs']);

// Needs no server and no database — it is a property of the classification in
// lib/localization.mjs, so it runs here, before the build, and fails in
// milliseconds rather than after a twenty-minute pipeline.
run('localization split (lossless + locale-invariant)', 'node', ['scripts/audit-localization.mjs']);

// Also offline, and deliberately BEFORE the build. audit-assets.mjs already
// checks cache-busting, but from served HTML, so it needs a build and a running
// server and lands twenty minutes in. A stale manifest is knowable from the
// files alone, and it has already shipped once — caught here it costs a second.
run('asset manifest freshness', 'node', ['scripts/audit-manifest.mjs']);

stageNo++;
log(`\n── stage ${stageNo}: clean build artifacts ──`);
fs.rmSync('.next', { recursive: true, force: true });
log('  removed .next/');
results.push({ stage: stageNo, name: 'clean', status: 'ok' });

run('build', 'npx', ['next', 'build']);
run('typecheck', 'npx', ['tsc', '--noEmit']);

/* ---------------------------------------------------------- start server -- */

stageNo++;
log(`\n── stage ${stageNo}: start production server ──`);
server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: false,
});
server.stdout.on('data', (d) => fs.appendFileSync(LOG, d.toString()));
server.stderr.on('data', (d) => fs.appendFileSync(LOG, d.toString()));
log(`  spawned next start on ${PORT}`);
results.push({ stage: stageNo, name: 'start server', status: 'ok' });

/* ------------------------------------------------------- readiness check -- */

stageNo++;
log(`\n── stage ${stageNo}: readiness check ──`);
let ready = false;
for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch(BASE + '/');
    if (res.status === 200) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!ready) die(stageNo, 'server never became ready');
log('  server responding 200');
results.push({ stage: stageNo, name: 'readiness', status: 'ok' });

/* --------------------------------------------------- content sanity check -- */

stageNo++;
log(`\n── stage ${stageNo}: functional/content sanity ──`);
const MARKERS = ['class="hdr"', 'class="utility"', 'id="main"', 'class="ftr"', 'class="socialstrip"'];
for (const route of ROUTES) {
  const res = await fetch(BASE + route);
  if (res.status !== 200) die(stageNo, `${route} returned ${res.status}`);
  const html = await res.text();
  for (const m of MARKERS) if (!html.includes(m)) die(stageNo, `${route} is missing required markup: ${m}`);
  if (html.length < 8000) die(stageNo, `${route} looks truncated (${html.length} bytes)`);
}
log(`  ${ROUTES.length} routes served with complete chrome and body markup`);
results.push({ stage: stageNo, name: 'content sanity', status: 'ok' });

/* --------------------------------------------------- console/runtime audit -- */

run('console, hydration and asset audit', 'node', ['scripts/audit-console.mjs'], { AUDIT_BASE: BASE });

// Every other stage runs with caching disabled, so none of them can see a stale
// cache-busting query — the failure mode where the server is right and returning
// visitors still get the previous build.
run('asset cache-busting audit', 'node', ['scripts/audit-assets.mjs'], { AUDIT_BASE: BASE });

/* ------------------------------------------------------------ link audit -- */

run('internal link + reachability audit', 'node', ['scripts/audit-links.mjs'], { AUDIT_BASE: BASE });

/* ----------------------------------------------------------- admin audit -- */

// Runs against the same server as every other audit, so it checks the built
// output rather than the source: whether /admin actually redirects, what the
// pages actually link, and whether the duplicated design tokens still agree.
run('admin isolation + token drift audit', 'node', ['scripts/audit-admin.mjs'], {
  AUDIT_BASE: BASE,
});

/* ------------------------------------------------- harness negative control -- */

run('visual harness self-test (negative control)', 'node', ['scripts/audit-visual.mjs'], {
  AUDIT_BASE: BASE,
  AUDIT_MODE: 'baseline',
  AUDIT_SELFTEST: '1',
  AUDIT_VIEWPORTS: '1440x900',
  AUDIT_RUN_DIR: path.join(RUN_DIR, 'selftest'),
});

/* ------------------------------------------------------ visual audits -- */

run('structural visual audit @ 1440x900', 'node', ['scripts/audit-visual.mjs'], {
  AUDIT_BASE: BASE,
  AUDIT_MODE: 'baseline',
  AUDIT_VIEWPORTS: '1440x900',
  AUDIT_RUN_DIR: path.join(RUN_DIR, 'vp-1440'),
});

run('structural visual audit @ all 7 viewports', 'node', ['scripts/audit-visual.mjs'], {
  AUDIT_BASE: BASE,
  AUDIT_MODE: 'baseline',
  AUDIT_RUN_DIR: path.join(RUN_DIR, 'all-viewports'),
});

/* ------------------------------------------- final artifact validation -- */

stageNo++;
log(`\n── stage ${stageNo}: final artifact validation ──`);

const reportPath = path.join(RUN_DIR, 'all-viewports', 'report.json');
if (!fs.existsSync(reportPath)) die(stageNo, `report artifact missing at ${reportPath}`);

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (e) {
  die(stageNo, 'report.json does not parse', e.message);
}

const expected = VIEWPORTS.length * ROUTES.length;
const checks = [
  ['report parses', true],
  ['expected comparison count', report.actualComparisons === expected, `${report.actualComparisons}/${expected}`],
  ['all 7 viewports present', new Set(report.comparisons.map((c) => c.viewport)).size === VIEWPORTS.length],
  [
    'all routes present per viewport',
    VIEWPORTS.every((v) => report.comparisons.filter((c) => c.viewport === v.name).length === ROUTES.length),
  ],
  ['errored comparisons = 0', report.erroredComparisons === 0, String(report.erroredComparisons)],
  [
    'every comparison measured elements',
    report.comparisons.every((c) => c.elementsCompared > 0),
    `min=${Math.min(...report.comparisons.map((c) => c.elementsCompared))}`,
  ],
  ['report is complete, not partial', report.comparisons.length === report.actualComparisons],
  // The checks above prove the report is COMPLETE. These two prove it is CLEAN,
  // and until now nothing did: the counts were printed below and never
  // asserted, so nineteen stages of work could report a pass while the audit
  // sitting underneath them held real geometry regressions. It did — a run
  // passed with 54. Every green this project has had was green on
  // completeness, not on correctness.
  [
    'structural count findings = 0',
    report.totalCountFindings === 0,
    String(report.totalCountFindings),
  ],
  [
    'geometry findings = 0',
    report.totalGeometryFindings === 0,
    String(report.totalGeometryFindings),
  ],
];

let bad = 0;
for (const [name, ok, detail] of checks) {
  log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) bad++;
}
if (bad) {
  // Name the routes. "54 geometry findings" sends someone into a 2MB JSON to
  // work out where; the route and viewport is what actually starts the hunt.
  const offenders = report.comparisons
    .filter((c) => c.geometry.length || c.counts.length)
    .map((c) => `    ${c.viewport.padEnd(10)} ${c.route}  counts=${c.counts.length} geom=${c.geometry.length}`);
  if (offenders.length) {
    log(`\n  routes with findings (${offenders.length}):`);
    offenders.slice(0, 20).forEach((o) => log(o));
    if (offenders.length > 20) log(`    … and ${offenders.length - 20} more, see the report`);
  }
  die(stageNo, `${bad} artifact validation check(s) failed`);
}

log(`\n  elements compared: ${report.totalElementsCompared}`);
log(`  properties compared: ${report.totalPropsCompared}`);
log(`  structural count findings: ${report.totalCountFindings}`);
log(`  geometry findings: ${report.totalGeometryFindings}`);
results.push({ stage: stageNo, name: 'artifact validation', status: 'ok' });

fs.writeFileSync(path.join(RUN_DIR, 'stages.json'), JSON.stringify(results, null, 2));

const skipped = results.filter((r) => r.status === 'skipped');
log(`\n✓ PIPELINE PASSED — ${results.length - skipped.length}/${results.length} stages ran, run dir: ${RUN_DIR}`);
// Named, not just counted: "1 skipped" tells you nothing about whether the gap matters.
for (const s of skipped) log(`  ⊘ stage ${s.stage} skipped: ${s.name}`);
log(`  authoritative report: ${reportPath}`);

server.kill();
// next start spawns a child node process; make sure the port is actually released.
spawnSync('powershell', [
  '-NoProfile',
  '-Command',
  `Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
]);
process.exit(0);
