import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { Footer, Header, MegaMenu } from '@/components/Chrome';
import { getChrome, getSettings } from '@/lib/content';
import { organizationSchema } from '@/lib/schema';
import { asset } from '@/lib/assets';
import { DIR, LOCALES, isLocale, type Locale } from '@/lib/i18n';
import { ui } from '@/lib/ui';
import { SITE_ORIGIN, openGraph, siteName, titleBrand } from '@/lib/seo';

/* This is the root layout. It lives under [locale] because <html lang> and
   <dir> have to come from the route, and only a segment layout receives params.
   Reading headers() instead would opt the whole tree out of static generation. */

/* The toggle labels the theme you would switch *to*, so they have to be
   localized alongside everything else in lib/ui.ts. They are injected as JSON
   literals rather than baked in, which is why this is a function. */
const themeInit = (dark: string, light: string) => `(function(){
  var K='tl-theme', DARK=${JSON.stringify(dark)}, LIGHT=${JSON.stringify(light)};
  var root=document.documentElement, b=document.getElementById('tl-theme'), l=document.getElementById('tl-theme-label');
  function set(d){ root.classList.toggle('dark',d); if(l) l.textContent=d?LIGHT:DARK; try{localStorage.setItem(K,d?'dark':'light')}catch(e){} }
  var saved=null; try{saved=localStorage.getItem(K)}catch(e){}
  set(saved ? saved==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(b) b.addEventListener('click',function(){ set(!root.classList.contains('dark')); });
})();`;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

/**
 * Deliberately NOT `dynamicParams = false`: a layout's segment config applies
 * to every route beneath it, so `false` here sent all unknown URLs to Next's
 * bare default 404 — outside this layout, in English, with no navigation —
 * instead of the localized not-found boundary. Unknown locales are still
 * refused: the `isLocale` guard below throws notFound() before rendering.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: { default: siteName(locale), template: `%s | ${titleBrand()}` },
    /* Pages return their own `openGraph`, which replaces this one wholesale
       rather than extending it — hence the shared builder. This value is what
       routes without their own metadata (not-found) fall back to. */
    openGraph: openGraph(locale, { title: siteName(locale), path: `/${locale}` }),
    /* The generated card is 1200x630, so ask for the large-image treatment
       rather than letting it be cropped to a thumbnail. */
    twitter: { card: 'summary_large_image' },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;
  const chrome = getChrome(locale);
  const t = ui(locale);

  /* suppressHydrationWarning on <html>: themeInit below runs before hydration
     and puts `dark` on that element. Without it React treats the class it did
     not render as a mismatch, reverts it, and the saved theme silently fails
     to stick on reload. */
  return (
    <html lang={locale} dir={DIR[locale]} suppressHydrationWarning>
      <head>
        {/* All Latin faces are self-hosted, so there are no third-party font
            requests and no render-blocking @import. This also removes the last
            source of audit flakiness: fonts.gstatic.com intermittently 404'd a
            .woff2 on a different route every run. */}
        {/* Preloads come first, and they are the difference between a stable page
            and a visibly reflowing one.

            Every @font-face here is `font-display: swap`, and a font referenced
            only from a stylesheet is discovered three hops in: HTML, then the CSS,
            then a unicode-range match, then finally the .woff2. Until it lands the
            browser paints a fallback and then reflows — which measured as CLS
            0.252 on /ar against a 0.10 budget, while /en sat at 0.00. The split is
            not a coincidence: Inter's fallback metrics happen to be close enough
            that the Latin swap is invisible, and no system Arabic face is close to
            Tajawal.

            `crossOrigin` is required even though these are same-origin: fonts are
            fetched in CORS mode, and a preload whose mode does not match the real
            request is discarded and silently fetched a second time. */}

        {/* DM Sans latin is the body and heading face on every locale —
            3lines.css sets --font-sans and applies it to body with !important, so
            this is what renders the H1, not Inter. The U+0000-00FF subset; the
            latin-ext twin is not needed above the fold. */}
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          crossOrigin=""
          href={asset('/assets/fonts/gf-dmsans-v17-rP2Hp2ywxg089UriCZOIHQ.woff2')}
        />

        {/* Arabic: 400 for body, 700 for every heading — rtl.css pins h1-h4 to 700
            because Tajawal ships no 600 and the stylesheet asks for it in a dozen
            places. 500 is used eight times and is left to be discovered normally;
            these two are what paint above the fold. 9 KB each. */}
        {locale === 'ar' ? (
          <>
            <link
              rel="preload"
              as="font"
              type="font/woff2"
              crossOrigin=""
              href={asset('/assets/fonts/tajawal-arabic-400-normal.woff2')}
            />
            <link
              rel="preload"
              as="font"
              type="font/woff2"
              crossOrigin=""
              href={asset('/assets/fonts/tajawal-arabic-700-normal.woff2')}
            />
          </>
        ) : null}

        <link rel="stylesheet" href={asset('/assets/fonts/google-local.css')} />
        {/* Arabic face, self-hosted and unicode-range gated, so English pages
            download zero Arabic bytes and the Latin rendering is unchanged. */}
        {locale === 'ar' ? <link rel="stylesheet" href={asset('/assets/fonts/tajawal.css')} /> : null}
        {/* Content-hashed: editing any of these changes its URL, so a returning
            browser can never keep serving a stale stylesheet. */}
        <link rel="stylesheet" href={asset('/assets/css/style.css')} />
        <link rel="stylesheet" href={asset('/assets/css/3lines.css')} />
        <link rel="stylesheet" href={asset('/assets/css/rtl.css')} />
        <link rel="icon" href={asset(getSettings().faviconUri ?? '/assets/logos/favicon.png')} />
      </head>
      <body>
        <div className="skips">
          <a href={chrome.skip.href}>{chrome.skip.label}</a>
        </div>

        {/* The utility links moved inside <Header> — they are the header's
            right-hand side now, not a band above it. See UtilityNav. */}
        <Header chrome={chrome} locale={locale} />
        <MegaMenu chrome={chrome} locale={locale} />
        {/* The search overlay is no longer a placeholder rendered here — it is
            real now, and lives with the button that opens it. See Search.tsx. */}

        <main id="main">{children}</main>

        <Footer chrome={chrome} locale={locale} />

        <Script src={asset('/assets/js/main.js')} strategy="afterInteractive" />

        {/* The description is a hidden child rather than an aria-label. As an
            aria-label it REPLACED the visible "Dark"/"Light" text as the button's
            accessible name, so someone driving the page by voice could read the
            word on screen and say it and nothing would happen — WCAG 2.5.3, Label
            in Name. As a child it is prepended instead, giving "Toggle colour
            scheme Dark", which contains the visible label. */}
        <button className="tl-theme" type="button" id="tl-theme">
          <span className="sr-only">{t.themeToggle}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          {/* Same reason as <html>: themeInit rewrites this label to the theme
              you would switch *to* before React hydrates, so the text it finds
              is deliberately not the text it rendered. */}
          <span id="tl-theme-label" suppressHydrationWarning>
            {t.themeDark}
          </span>
        </button>

        <script dangerouslySetInnerHTML={{ __html: themeInit(t.themeDark, t.themeLight) }} />

        {/* Built from the same source records the pages render from, so the
            structured data cannot drift from the visible content. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema(locale)) }}
        />
      </body>
    </html>
  );
}
