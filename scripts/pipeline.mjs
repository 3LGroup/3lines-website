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

run('extract non-CMS copy', 'node', ['scripts/extract-non-cms.mjs']);
run('content ingestion', 'node', ['scripts/ingest-3lines.mjs']);
run('content ↔ schema ↔ renderer parity (both locales)', 'node', ['scripts/audit-content.mjs']);

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
];

let bad = 0;
for (const [name, ok, detail] of checks) {
  log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) bad++;
}
if (bad) die(stageNo, `${bad} artifact validation check(s) failed`);

log(`\n  elements compared: ${report.totalElementsCompared}`);
log(`  properties compared: ${report.totalPropsCompared}`);
log(`  structural count findings: ${report.totalCountFindings}`);
log(`  geometry findings: ${report.totalGeometryFindings}`);
results.push({ stage: stageNo, name: 'artifact validation', status: 'ok' });

fs.writeFileSync(path.join(RUN_DIR, 'stages.json'), JSON.stringify(results, null, 2));

log(`\n✓ PIPELINE PASSED — ${results.length} stages, run dir: ${RUN_DIR}`);
log(`  authoritative report: ${reportPath}`);

server.kill();
// next start spawns a child node process; make sure the port is actually released.
spawnSync('powershell', [
  '-NoProfile',
  '-Command',
  `Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`,
]);
process.exit(0);
