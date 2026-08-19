import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import { redirect } from 'next/navigation';
import { asset } from '@/lib/assets';
import { readSession } from '@/lib/admin/session';

/**
 * A third root layout, for the preview iframe.
 *
 * It must load the PUBLIC stylesheets, which the admin deliberately never does
 * — 3lines.css re-skins global elements with !important and would eat the admin
 * chrome. In an iframe that is not a problem: the preview is a separate
 * document, so it can dress exactly like the real site while the admin around
 * it stays untouched. That separation is the reason this is an iframe rather
 * than an inline render.
 *
 * There is no app/layout.tsx, so this sits beside app/[locale]/layout.tsx and
 * app/admin/layout.tsx as a sibling root rather than nesting under either.
 */

export const metadata: Metadata = {
  title: 'Preview',
  // Unpublished content rendered at a stable URL. It is behind a session, but a
  // crawler that somehow reached it must not index a draft as if it were live.
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default async function PreviewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale?: string }>;
}) {
  // Checked here as well as in the page: the preview renders unpublished
  // content, and a layout is not a security boundary on its own.
  if (!(await readSession())) redirect('/admin/login');

  const { locale } = await params;
  const isArabic = locale === 'ar';

  return (
    <html lang={isArabic ? 'ar' : 'en'} dir={isArabic ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href={asset('/assets/fonts/google-local.css')} />
        {isArabic ? <link rel="stylesheet" href={asset('/assets/fonts/tajawal.css')} /> : null}
        <link rel="stylesheet" href={asset('/assets/css/style.css')} />
        <link rel="stylesheet" href={asset('/assets/css/3lines.css')} />
        <link rel="stylesheet" href={asset('/assets/css/rtl.css')} />
        <style>{`
          /* The preview shows sections, not the whole page: no header, footer or
             mega-menu, because none of those are editable here yet and their
             absence is less misleading than a stale copy of them. Trim the outer
             padding so the first section starts at the top of the frame. */
          body{margin:0}
          main{display:block}
        `}</style>
      </head>
      <body>
        <main id="main">{children}</main>
        {/* The real site script: counters, the slider and the marquee are all
            driven by it, and without it a preview of the "Why 3Lines" band would
            show one slide and a dead list. */}
        <Script src={asset('/assets/js/main.js')} strategy="afterInteractive" />
      </body>
    </html>
  );
}
