import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { Footer, Header, MegaMenu, SearchLayer, UtilityBar } from '@/components/Chrome';
import { getChrome } from '@/lib/content';
import { organizationSchema } from '@/lib/schema';
import { asset } from '@/lib/assets';
import { DIR, LOCALES, isLocale, type Locale } from '@/lib/i18n';

/* This is the root layout. It lives under [locale] because <html lang> and
   <dir> have to come from the route, and only a segment layout receives params.
   Reading headers() instead would opt the whole tree out of static generation. */

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://www.3lines.com.sa';

const THEME_INIT = `(function(){
  var K='tl-theme';
  var root=document.documentElement, b=document.getElementById('tl-theme'), l=document.getElementById('tl-theme-label');
  function set(d){ root.classList.toggle('dark',d); if(l) l.textContent=d?'Light':'Dark'; try{localStorage.setItem(K,d?'dark':'light')}catch(e){} }
  var saved=null; try{saved=localStorage.getItem(K)}catch(e){}
  set(saved ? saved==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(b) b.addEventListener('click',function(){ set(!root.classList.contains('dark')); });
})();`;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: { default: '3Lines Advanced Technologies', template: '%s | 3Lines' },
    openGraph: {
      siteName: '3Lines Advanced Technologies',
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_SA',
      type: 'website',
    },
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

  return (
    <html lang={locale} dir={DIR[locale]}>
      <head>
        {/* All Latin faces are self-hosted, so there are no third-party font
            requests and no render-blocking @import. This also removes the last
            source of audit flakiness: fonts.gstatic.com intermittently 404'd a
            .woff2 on a different route every run. */}
        <link rel="stylesheet" href={asset('/assets/fonts/google-local.css')} />
        {/* Arabic face, self-hosted and unicode-range gated, so English pages
            download zero Arabic bytes and the Latin rendering is unchanged. */}
        {locale === 'ar' ? <link rel="stylesheet" href={asset('/assets/fonts/tajawal.css')} /> : null}
        {/* Content-hashed: editing any of these changes its URL, so a returning
            browser can never keep serving a stale stylesheet. */}
        <link rel="stylesheet" href={asset('/assets/css/style.css')} />
        <link rel="stylesheet" href={asset('/assets/css/3lines.css')} />
        <link rel="stylesheet" href={asset('/assets/css/rtl.css')} />
        <link rel="icon" href={asset('/assets/logos/favicon.png')} />
      </head>
      <body>
        <div className="skips">
          <a href={chrome.skip.href}>{chrome.skip.label}</a>
        </div>

        <UtilityBar chrome={chrome} locale={locale} />
        <Header chrome={chrome} locale={locale} />
        <MegaMenu chrome={chrome} locale={locale} />
        <SearchLayer />

        <main id="main">{children}</main>

        <Footer chrome={chrome} locale={locale} />

        <Script src={asset('/assets/js/main.js')} strategy="afterInteractive" />

        <button className="tl-theme" type="button" id="tl-theme" aria-label="Toggle colour scheme">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <span id="tl-theme-label">Dark</span>
        </button>

        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />

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
