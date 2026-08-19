// Quick full-page screenshot helper for eyeballing pages during development.
// Usage: node scripts/snap.mjs <outDir> [route ...]
import fs from 'node:fs';
import path from 'node:path';
import { launch, preparePage, settle } from './lib/browser.mjs';

const [outDir, ...routes] = process.argv.slice(2);
if (!outDir) throw new Error('usage: node scripts/snap.mjs <outDir> [route ...]');
const BASE = process.env.SNAP_BASE || 'http://127.0.0.1:3200';
const list = routes.length ? routes : ['/en'];
fs.mkdirSync(outDir, { recursive: true });

const WIDTH = Number(process.env.SNAP_W) || 1440;
const HEIGHT = Number(process.env.SNAP_H) || 900;
const THEME = process.env.SNAP_THEME || 'light';

const browser = await launch();
const page = await browser.newPage();
await preparePage(page, { width: WIDTH, height: HEIGHT });
if (THEME === 'dark') {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('tl-theme', 'dark');
    } catch {}
  });
}
for (const route of list) {
  await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 60000 });
  try {
    await settle(page);
  } catch (e) {
    console.log(`  (settle warning on ${route}: ${e.message})`);
  }
  const name = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log(`  saved ${name}.png`);
}
await browser.close();
