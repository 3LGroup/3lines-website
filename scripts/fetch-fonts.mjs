/**
 * Self-host the remaining webfonts.
 *
 * Two reasons this matters beyond tidiness:
 *  - The families were pulled in by an `@import` *inside* 3lines.css, so the
 *    request could not even start until that stylesheet downloaded and parsed —
 *    render-blocking, third-party, on every page including English ones.
 *  - They are the last third-party requests, and the only remaining source of
 *    audit flakiness: fonts.gstatic.com intermittently 404s a .woff2 and the
 *    console audit records it on a different route every run.
 *
 * IBM Plex Sans Arabic is deliberately dropped — Tajawal, already self-hosted,
 * covers Arabic.
 *
 * Run: node scripts/fetch-fonts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'fonts');

// Every family the site actually renders with. Covering Inter and Saira too
// means the layout can drop its Google Fonts <link> entirely, taking
// third-party font requests to zero.
const SRC =
  'https://fonts.googleapis.com/css2' +
  '?family=DM+Sans:opsz,wght@9..40,300..700' +
  '&family=JetBrains+Mono:wght@400..700' +
  '&family=Inter:wght@300;400;500;600;700' +
  '&family=Saira:wght@500;600;700' +
  '&display=swap';

// A modern browser UA is required, otherwise Google serves legacy ttf/woff.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/131.0.0.0 Safari/537.36';

const res = await fetch(SRC, { headers: { 'user-agent': UA } });
if (!res.ok) {
  console.error(`Failed to fetch the font stylesheet: HTTP ${res.status}`);
  process.exit(1);
}
let css = await res.text();

const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]))];
if (!urls.length) {
  console.error('No .woff2 URLs found in the stylesheet — refusing to write a stylesheet that points nowhere.');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let downloaded = 0;
for (const url of urls) {
  // gstatic paths are stable and unique per family/weight/subset; flatten them.
  const name =
    'gf-' +
    url
      .replace('https://fonts.gstatic.com/s/', '')
      .replace(/[^a-zA-Z0-9.]+/g, '-')
      .replace(/-+/g, '-');

  const dest = path.join(OUT_DIR, name);
  if (!fs.existsSync(dest)) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (!r.ok) {
      console.error(`  FAILED ${url} -> HTTP ${r.status}`);
      process.exit(1);
    }
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    downloaded++;
  }
  css = css.split(url).join(`/assets/fonts/${name}`);
}

if (/fonts\.gstatic\.com/.test(css)) {
  console.error('Rewrite incomplete — the stylesheet still references gstatic.');
  process.exit(1);
}

const header =
  '/* Self-hosted from Google Fonts by scripts/fetch-fonts.mjs. Do not hand-edit.\n' +
  `   Source: ${SRC}\n` +
  '   DM Sans and JetBrains Mono are both OFL-licensed. */\n\n';

fs.writeFileSync(path.join(OUT_DIR, 'google-local.css'), header + css);

const faces = (css.match(/@font-face/g) || []).length;
console.log(`FONTS OK — ${faces} @font-face rules, ${urls.length} files (${downloaded} newly downloaded)`);
console.log(`  written: public/assets/fonts/google-local.css`);
