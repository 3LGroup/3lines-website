import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env['ProgramFiles(x86)']}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
  `${process.env['ProgramFiles(x86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export function chromePath() {
  const found = CANDIDATES.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('No Chrome/Edge executable found for the audit harness.');
  return found;
}

export async function launch() {
  return puppeteer.launch({
    executablePath: chromePath(),
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--hide-scrollbars'],
  });
}

/**
 * Pin every source of non-determinism before measuring:
 *  - the site's localStorage theme toggle (defaults to prefers-color-scheme)
 *  - CSS animations/transitions and the IntersectionObserver reveal states
 * Without this, two runs of the same page disagree and the diff is noise.
 */
export async function preparePage(page, viewport) {
  // Without this, later page loads in the same browser return 304 from cache and
  // measurements can drift from what a cold visitor actually gets.
  await page.setCacheEnabled(false);
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('tl-theme', 'light');
    } catch {}
  });
}

/**
 * Force every animation to its final state before measuring.
 *
 * The count-up figures are the subtle one: main.js drives them with a
 * requestAnimationFrame loop that keeps overwriting textContent for ~1400ms
 * after the element scrolls into view. Setting the final value once is not
 * enough — the running loop overwrites it and the measured text width (and so
 * every downstream y position) varies run to run. So: let the loop finish, then
 * pin the values, then verify they are stable before measuring.
 */
const COUNTUP_MS = 1400;

export async function settle(page) {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important}
              .reveal{opacity:1!important;transform:none!important}`,
  });

  const pin = () =>
    page.evaluate(() => {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
      document.querySelectorAll('[data-count]').forEach((el) => {
        const target = parseFloat(el.getAttribute('data-count'));
        el.textContent =
          Math.round(target).toLocaleString('en-GB') + (el.getAttribute('data-suffix') || '');
      });
      window.scrollTo(0, 0);
      return Array.from(document.querySelectorAll('[data-count]'), (el) => el.textContent).join('|');
    });

  await pin();
  // Outlast the count-up animation, then pin again so nothing is mid-flight.
  await new Promise((r) => setTimeout(r, COUNTUP_MS + 400));
  const a = await pin();
  await new Promise((r) => setTimeout(r, 250));
  const b = await pin();

  if (a !== b) throw new Error('page did not settle: count-up values still changing');
}

export const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '375x812', width: 375, height: 812 },
];

/**
 * Every route, in every locale. Read from the ingested manifest rather than
 * duplicated here, so a route added to the content system is audited
 * automatically instead of being silently skipped.
 */
const manifest = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'content', 'routes.json'), 'utf8')
);

export const LOCALES = ['en', 'ar'];

export const ROUTES = LOCALES.flatMap((l) =>
  manifest.map((r) => `/${l}${r.route === '/' ? '' : r.route}`)
);
