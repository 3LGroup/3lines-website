/**
 * Admin isolation and token-drift audit.
 *
 * Two things this protects, both of which fail silently otherwise.
 *
 * Isolation: the admin and the public site are separate root layouts precisely
 * so neither can load the other's CSS. That is a property of the file tree, but
 * it is one import statement away from being untrue, and the symptom —
 * 3lines.css re-skinning every element in the admin with !important — would
 * look like an admin styling bug rather than a leak.
 *
 * Token drift: app/admin/admin.css duplicates the :root and html.dark blocks
 * from public/assets/css/3lines.css so the admin can be styled without loading
 * the public sheet. A duplicate that nothing checks is a copy that diverges.
 * This diffs them by name and fails on any disagreement.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:3200';
const ROOT = path.resolve(import.meta.dirname, '..');

const problems = [];
const fail = (m) => problems.push(m);
const ok = (m) => console.log(`  ✓ ${m}`);

/* ------------------------------------------------------------- isolation -- */

const PUBLIC_ASSETS = [
  'assets/css/style.css',
  'assets/css/3lines.css',
  'assets/css/rtl.css',
  'assets/js/main.js',
];

const res = await fetch(`${BASE}/admin`, { redirect: 'manual' });
if (res.status !== 307 && res.status !== 302) {
  fail(`GET /admin without a session returned ${res.status}, expected a redirect to the login page`);
} else {
  const to = res.headers.get('location') || '';
  if (!to.includes('/admin/login')) fail(`GET /admin redirected to ${to}, expected /admin/login`);
  else ok(`unauthenticated /admin -> ${res.status} ${to}`);
}

const loginHtml = await (await fetch(`${BASE}/admin/login`)).text();
if (!loginHtml.includes('adm-login')) fail('/admin/login did not render the admin shell markup');
else ok('/admin/login renders');

for (const asset of PUBLIC_ASSETS) {
  if (loginHtml.includes(asset)) fail(`/admin/login links the public site's ${asset}`);
}
if (!problems.length) ok(`/admin/login links none of ${PUBLIC_ASSETS.length} public stylesheets/scripts`);

// The reverse direction: no admin class or stylesheet may reach a public page.
const publicHtml = await (await fetch(`${BASE}/en`)).text();
if (/\badm-/.test(publicHtml)) fail('/en contains an "adm-" class — admin styles leaked into the public tree');
else ok('/en contains no admin markup');

/* ------------------------------------------------------------ noindexing -- */

const robots = await (await fetch(`${BASE}/robots.txt`)).text();
if (!/^Disallow:\s*\/admin/m.test(robots)) fail('robots.txt does not disallow /admin');
else ok('robots.txt disallows /admin');

if (!/noindex/i.test(loginHtml)) fail('/admin/login does not render a noindex robots meta');
else ok('/admin/login renders noindex');

/* ---------------------------------------------------------- token drift -- */

/**
 * Compare declarations by meaning, not by formatting.
 *
 * `'DM Sans', ui-sans-serif` and `'DM Sans',ui-sans-serif` are the same font
 * stack, and `rgb(0 0 0 / .05)` is the same colour as `rgb(0 0 0 / 0.05)`. A
 * check that flags those is a check people learn to ignore, and the whole point
 * of this one is that a failure means something.
 */
function normalize(value) {
  return value
    .replace(/\s*,\s*/g, ',')
    .replace(/(^|[\s(,/])\.(\d)/g, '$10.$2') // .05 -> 0.05
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull one `selector{ … }` block out of a stylesheet and parse its custom props.
 *
 * Comments are stripped from the WHOLE file before the selector is located, not
 * just from the matched block. Searching first meant `indexOf('html.dark')`
 * matched the phrase inside this file's own header comment, then read the brace
 * of the next rule along — so the admin's light tokens were compared against the
 * theme's dark ones and every single one "differed".
 */
function tokens(rawCss, selector) {
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
  // Anchor on the selector immediately followed by its block, so `:root` cannot
  // match inside a longer selector such as `:root:not(...)`.
  const re = new RegExp(`(^|[},])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'm');
  const m = re.exec(css);
  if (!m) return null;

  const open = css.indexOf('{', m.index + m[0].length - 1);
  const close = css.indexOf('}', open);
  if (open === -1 || close === -1) return null;

  const out = new Map();
  for (const decl of css.slice(open + 1, close).split(';')) {
    const d = decl.match(/^\s*(--[\w-]+)\s*:\s*(.+?)\s*$/);
    if (d) out.set(d[1], normalize(d[2]));
  }
  return out;
}

const themeCss = fs.readFileSync(path.join(ROOT, 'public/assets/css/3lines.css'), 'utf8');
const adminCss = fs.readFileSync(path.join(ROOT, 'app/admin/admin.css'), 'utf8');

for (const selector of [':root', 'html.dark']) {
  const theirs = tokens(themeCss, selector);
  const ours = tokens(adminCss, selector);
  if (!theirs) { fail(`could not parse ${selector} from 3lines.css`); continue; }
  if (!ours) { fail(`could not parse ${selector} from admin.css`); continue; }

  let compared = 0;
  for (const [name, value] of theirs) {
    // Admin need not redeclare every token — only the ones it uses. But any it
    // does redeclare must agree, or the two surfaces drift apart on brand.
    if (!ours.has(name)) continue;
    compared++;
    if (ours.get(name) !== value) {
      fail(`${selector} token ${name} differs:\n      3lines.css: ${value}\n      admin.css:  ${ours.get(name)}`);
    }
  }
  if (compared === 0) fail(`${selector}: admin.css shares no tokens with 3lines.css — is the copy still there?`);
  else ok(`${selector}: ${compared} shared tokens identical`);
}

/* ------------------------------------------------------------------ done -- */

if (problems.length) {
  console.error(`\nADMIN AUDIT FAILED — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  // exitCode rather than process.exit(): an immediate exit while undici still
  // holds keep-alive sockets trips a libuv assertion on Windows and reports a
  // meaningless code 9 instead of 1. Setting it lets the loop drain first.
  process.exitCode = 1;
} else {
  console.log('\nADMIN AUDIT OK');
}
