/**
 * Extract the 3Lines copy that has no CMS home.
 *
 * Per 3lines-website/docs/CONTENT.md ("Not in the CMS"), a material amount of real
 * copy lives only in code and would be silently lost by a JSON-only migration:
 *
 *   hero rotating words   -> docs/content-inventory.json (homepage.heroRotatingWords)
 *   "Why 3Lines" slider   -> docs/content-inventory.json (homepage.whyThreeLinesSlider)
 *                            NB: content/slides.json is EMPTY; the slider is hardcoded
 *   about pillars/vision/values -> docs/content-inventory.json (about.{en,ar})
 *   Certifications & Licences   -> assets/enhance.js  (certsSection, `var T = {...}`)
 *
 * Output: source-content/non-cms.json, committed so the build never depends on the
 * sibling project being present.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'source-content');
const SIBLING = path.resolve(ROOT, '..', '3lines-website');

const LOCALES = ['en', 'ar'];
const problems = [];
const fail = (m) => problems.push(m);

/* ------------------------------------------------ from content-inventory.json -- */

const inv = JSON.parse(fs.readFileSync(path.join(SRC, 'content-inventory.json'), 'utf8'));

const pickLocales = (obj, what) => {
  const out = {};
  for (const l of LOCALES) {
    if (!obj || obj[l] === undefined) fail(`${what}: missing locale "${l}"`);
    else out[l] = obj[l];
  }
  return out;
};

const heroWords = pickLocales(inv.homepage?.heroRotatingWords, 'heroRotatingWords');

const slider = (inv.homepage?.whyThreeLinesSlider || []).map((s, i) => ({
  heading: pickLocales(s.heading, `slider[${i}].heading`),
  sub: pickLocales(s.sub, `slider[${i}].sub`),
}));

const about = {};
for (const l of LOCALES) {
  const a = inv.about?.[l];
  if (!a) {
    fail(`about: missing locale "${l}"`);
    continue;
  }
  about[l] = { pillars: a.pillars || [], vision: a.vision || [], values: a.values || [] };
}

/* --------------------------------------------------------- from enhance.js -- */

/** Decode the HTML entities the source copy is authored with. */
const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&mdash;': '—',
  '&middot;': '·',
  '&nbsp;': ' ',
};
const decode = (s) => String(s).replace(/&[a-z]+;/g, (m) => ENTITIES[m] ?? m);

/**
 * The meta lines are authored as `<b>Label</b> value &middot; <b>Label</b> value`.
 * Turn them into structured pairs rather than shipping raw HTML through the
 * renderer — the block system deliberately avoids injecting markup.
 */
function parseMeta(html) {
  const out = [];
  const re = /<b>(.*?)<\/b>\s*([^<]*)/g;
  let m;
  while ((m = re.exec(html))) {
    const label = decode(m[1]).trim();
    const value = decode(m[2])
      .replace(/[· ]+\s*$/, '')
      .trim();
    if (label) out.push({ label, value });
  }
  return out;
}

function extractCerts() {
  const file = path.join(SIBLING, 'assets', 'enhance.js');
  if (!fs.existsSync(file)) {
    fail(`enhance.js not found at ${file} — cannot extract the certifications band`);
    return null;
  }
  const js = fs.readFileSync(file, 'utf8');

  // Isolate the certsSection IIFE, then its `var T = { en: {...}, ar: {...} };`
  const sec = js.slice(js.indexOf('function certsSection()'));
  if (!sec) return fail('certsSection not found in enhance.js'), null;

  const start = sec.indexOf('var T = {');
  if (start === -1) return fail('certifications copy table (var T) not found'), null;
  const end = sec.indexOf('\n    };', start);
  if (end === -1) return fail('could not find the end of the certifications copy table'), null;

  const literal = sec.slice(start + 'var T = '.length, end + '\n    }'.length);
  const sandbox = {};
  vm.createContext(sandbox);
  let T;
  try {
    T = vm.runInContext('(' + literal + ')', sandbox, { timeout: 3000 });
  } catch (e) {
    return fail(`certifications copy table did not parse: ${e.message}`), null;
  }

  // Certificate plate images, in source order.
  const plates = [...sec.matchAll(/<img src="(\/assets\/certs\/[^"?]+)[^"]*"\s+alt="([^"]*)"/g)].map(
    (m) => ({ src: m[1], alt: m[2] })
  );
  if (!plates.length) fail('no certification plate images found');

  const out = {};
  for (const l of LOCALES) {
    const t = T[l];
    if (!t) {
      fail(`certifications: missing locale "${l}"`);
      continue;
    }
    out[l] = {
      eyebrow: decode(t.eye),
      heading: decode(t.h2),
      lede: decode(t.sub),
      items: [
        { title: decode(t.isoT), text: decode(t.isoD), meta: parseMeta(t.isoM) },
        { title: decode(t.gamiT), text: decode(t.gamiD), meta: parseMeta(t.gamiM) },
      ],
    };
  }
  return { copy: out, plates };
}

const certs = extractCerts();

/**
 * UI labels (section eyebrows, form field labels, form status strings, contact
 * channels). These are localized inline in enhance.js and have no CMS home, so
 * they must be lifted rather than re-authored — inventing Arabic UI copy is
 * guesswork, and the source already has translated strings.
 */
function extractLabelTables() {
  const file = path.join(SIBLING, 'assets', 'enhance.js');
  if (!fs.existsSync(file)) return fail('enhance.js not found — cannot extract UI labels'), null;
  const js = fs.readFileSync(file, 'utf8');

  /** Evaluate a `var NAME = <literal>;` declaration safely. */
  function readVar(name, from = 0) {
    const at = js.indexOf(`var ${name} = `, from);
    if (at === -1) return null;
    const open = js.indexOf(js[js.indexOf('=', at) + 2] === '[' ? '[' : '{', at);
    if (open === -1) return null;
    const openCh = js[open];
    const closeCh = openCh === '[' ? ']' : '}';
    let depth = 0;
    let inStr = null;
    for (let i = open; i < js.length; i++) {
      const c = js[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') inStr = c;
      else if (c === openCh) depth++;
      else if (c === closeCh) {
        depth--;
        if (depth === 0) {
          const literal = js.slice(open, i + 1);
          try {
            const sandbox = {};
            vm.createContext(sandbox);
            return vm.runInContext('(' + literal + ')', sandbox, { timeout: 3000 });
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }

  const found = {};
  for (const name of ['EYE', 'LBL', 'HEAD', 'F', 'BTNS', 'CTA', 'SLIDES']) {
    const v = readVar(name);
    if (v) found[name] = v;
  }

  // `HEAD` is declared twice: one holds a section heading, the other the
  // About/Contact nav labels. Walk every declaration and keep the nav one.
  for (let at = js.indexOf('var HEAD = '); at !== -1; at = js.indexOf('var HEAD = ', at + 1)) {
    const v = readVar('HEAD', at);
    if (v && v.about && v.contact) {
      found.NAV = v;
      break;
    }
  }
  if (!found.NAV) fail('nav label table (HEAD with about/contact) not found in enhance.js');

  // `EYE` is likewise declared twice: the slider eyebrow, and the section
  // eyebrows keyed services/partners/news. Keep the keyed one separately.
  for (let at = js.indexOf('var EYE = '); at !== -1; at = js.indexOf('var EYE = ', at + 1)) {
    const v = readVar('EYE', at);
    if (v && v.services && v.news && v.partners) {
      found.SECTIONS = v;
      break;
    }
  }
  if (!found.SECTIONS) fail('section eyebrow table (EYE with services/partners/news) not found');

  return found;
}

const labelTables = extractLabelTables();

/**
 * The About stat row (+7 / 3 / +120 / +30). Prerendered into {lang}/about.html
 * and — unlike the pillars, vision and values — NOT captured by
 * docs/content-inventory.json, so it has to come from the HTML directly.
 */
function extractStats() {
  const out = {};
  for (const l of LOCALES) {
    const file = path.join(SIBLING, l, 'about.html');
    if (!fs.existsSync(file)) {
      fail(`about.html not found for "${l}" — cannot extract the stat row`);
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const rows = [
      ...html.matchAll(
        /<div class="text-3xl font-bold[^"]*"[^>]*>([^<]+)<\/div>\s*<div class="mt-2 text-sm[^"]*"[^>]*>([\s\S]*?)<\/div>/g
      ),
    ].map((m) => ({
      value: decode(m[1]).replace(/\s+/g, ' ').trim(),
      label: decode(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(),
    }));

    if (rows.length !== 4) fail(`about stat row (${l}): expected 4 figures, got ${rows.length}`);
    out[l] = rows;
  }
  return out;
}

const stats = extractStats();

/**
 * Hero frame words ("We provide" … "Globally", plus the CTA label). The
 * rotating words alone are meaningless without the sentence they sit inside,
 * and only the words were captured by the inventory. These live in the compiled
 * hero bundle, whose filename is content-hashed.
 */
function extractHeroFrame() {
  const dir = path.join(SIBLING, 'build', 'assets');
  if (!fs.existsSync(dir)) return fail('build/assets not found — cannot extract hero frame'), null;
  const file = fs.readdirSync(dir).find((f) => /^hero-.*\.js$/.test(f));
  if (!file) return fail('no hero-*.js bundle found'), null;

  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  const out = {};
  for (const key of ['we_provide', 'globally', 'who_we_are']) {
    const m = src.match(new RegExp(`${key}\\s*:\\s*\\{([^}]*)\\}`));
    if (!m) {
      fail(`hero frame: key "${key}" not found in ${file}`);
      continue;
    }
    for (const l of LOCALES) {
      const v = m[1].match(new RegExp(`${l}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (!v) fail(`hero frame: ${key}.${l} not found`);
      else (out[l] ??= {})[key] = decode(JSON.parse(`"${v[1]}"`));
    }
  }
  return { bundle: file, copy: out };
}

const heroFrame = extractHeroFrame();

/* ------------------------------------------------------------- validation -- */

if (heroWords.en?.length !== 4) fail(`expected 4 hero rotating words, got ${heroWords.en?.length}`);
if (slider.length !== 4) fail(`expected 4 slider slides, got ${slider.length}`);
for (const l of LOCALES) {
  if (about[l]?.pillars.length !== 3) fail(`about.${l}: expected 3 pillars, got ${about[l]?.pillars.length}`);
  if (about[l]?.values.length !== 6) fail(`about.${l}: expected 6 core values, got ${about[l]?.values.length}`);
  if (!about[l]?.vision.length) fail(`about.${l}: no vision paragraphs`);
  if (certs && certs.copy[l]?.items.length !== 2) fail(`certifications.${l}: expected 2 items`);
}

if (problems.length) {
  console.error('EXTRACTION FAILED:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}

const out = {
  $comment:
    'Copy with no CMS home. Generated by scripts/extract-non-cms.mjs from ' +
    'content-inventory.json and 3lines-website/assets/enhance.js. Do not hand-edit.',
  locales: LOCALES,
  heroRotatingWords: heroWords,
  whyThreeLinesSlider: slider,
  about,
  certifications: certs,
  aboutStats: stats,
  heroFrame,
  labelTables,
};

fs.writeFileSync(path.join(SRC, 'non-cms.json'), JSON.stringify(out, null, 2) + '\n');

console.log('EXTRACT OK');
console.log(`  hero words       ${heroWords.en.length} (${LOCALES.join('/')})`);
console.log(`  slider slides    ${slider.length}`);
console.log(`  about pillars    ${about.en.pillars.length}  vision ${about.en.vision.length}  values ${about.en.values.length}`);
console.log(`  certifications   ${certs.copy.en.items.length} items, ${certs.plates.length} plates`);
