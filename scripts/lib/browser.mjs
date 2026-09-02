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

/** How long to wait for forced-eager images before giving up and measuring. */
const IMAGE_LOAD_MS = 10000;

/**
 * Load every lazy image before measuring.
 *
 * Without this the harness is blind to images and non-deterministic about the
 * layout around them. `pin()` below scrolls to the top and nothing ever scrolls
 * back down, so an `img[loading="lazy"]` further down the page never enters the
 * viewport, never loads, and is measured as 0x0. On /about that is all three
 * certification images at every viewport in both locales — the audit could not
 * have caught a broken image there if it tried.
 *
 * Worse, it was not even consistently blind. Chrome loads lazy images within a
 * distance threshold of the viewport, so whether one loads depends on how far
 * down the page it sits — which depends on the viewport and on how the text
 * wraps. The committed baseline caught them loaded on /ar/about at exactly
 * 1024x768 and 768x1024 and unloaded everywhere else, and that single race is
 * the whole of the 54 "geometry findings" that a clean run kept reporting.
 *
 * Forcing eager is deterministic and viewport-independent. Scrolling to trigger
 * loading is not the alternative it appears to be: the page grows as images
 * arrive, so a scroll-to-bottom loop never terminates. That was tried.
 */
async function loadLazyImages(page) {
  await page.evaluate(async (timeoutMs) => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) {
      img.loading = 'eager';
    }
    // decode() resolves once the image is fetched and painted, and rejects on a
    // broken one — which is a finding for the audit to report, not a reason to
    // abort the sweep. Bounded, so one unreachable asset cannot hang the run.
    const all = Promise.all(
      Array.from(document.images, (i) => i.decode().catch(() => {}))
    );
    await Promise.race([all, new Promise((r) => setTimeout(r, timeoutMs))]);
  }, IMAGE_LOAD_MS);
}

export async function settle(page) {
  await page.addStyleTag({
    content: `*,*::before,*::after{animation:none!important;transition:none!important}
              .reveal{opacity:1!important;transform:none!important}`,
  });

  await loadLazyImages(page);

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

export const LOCALES = ['en', 'ar', 'ja', 'ko'];

export const ROUTES = LOCALES.flatMap((l) =>
  manifest.map((r) => `/${l}${r.route === '/' ? '' : r.route}`)
);
