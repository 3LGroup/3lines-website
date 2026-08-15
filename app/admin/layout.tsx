import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { asset } from '@/lib/assets';
import './admin.css';

/**
 * Root layout for /admin — a sibling of app/[locale]/layout.tsx, not a child.
 *
 * There is no app/layout.tsx in this project, which is what makes two root
 * layouts possible: each tree renders its own <html> and <body>, and Next scopes
 * CSS per layout entry. So the public site structurally cannot load admin.css
 * and the admin structurally cannot load style.css / 3lines.css / main.js.
 * Isolation is a property of the file tree here rather than a convention anyone
 * has to remember. scripts/audit-admin.mjs asserts it in both directions.
 *
 * Only the fonts are shared, and only because they are already self-hosted and
 * content-hashed: reusing them costs nothing and keeps the two surfaces set in
 * the same type.
 */

export const metadata: Metadata = {
  title: { default: 'CMS', template: '%s · 3Lines CMS' },
  // Belt to the braces of robots.txt and the X-Robots-Tag in public/_headers.
  // An admin that gets indexed is an admin whose login page is public.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The admin reads a session cookie on every request, so there is nothing here to
 * prerender. Without this Next tries to build /admin as static and either bakes
 * a logged-out shell or fails on cookies().
 */
export const dynamic = 'force-dynamic';

/**
 * Same key and same mechanism as the public site (app/[locale]/layout.tsx).
 *
 * Deliberately the same key: the preview iframe in M6 renders the real public
 * site on this origin, so a separate admin theme setting would mean the editor
 * choosing dark and the preview appearing light. Sharing the key makes the
 * preview inherit the choice instead of fighting it.
 *
 * Runs before hydration, hence suppressHydrationWarning on <html> below — React
 * would otherwise treat the class it did not render as a mismatch and revert it.
 */
const themeInit = `(function(){
  var K='tl-theme', root=document.documentElement;
  function set(d){ root.classList.toggle('dark',d); try{localStorage.setItem(K,d?'dark':'light')}catch(e){} }
  var saved=null; try{saved=localStorage.getItem(K)}catch(e){}
  set(saved ? saved==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.addEventListener('click',function(e){
    var b=e.target.closest && e.target.closest('[data-adm-theme]');
    if(b) set(!root.classList.contains('dark'));
  });
})();`;

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        {/* DM Sans + JetBrains Mono. Tajawal too, unconditionally: the admin
            chrome is English, but every content field has an Arabic twin, so
            the Arabic face is always needed on the editing screens. */}
        <link rel="stylesheet" href={asset('/assets/fonts/google-local.css')} />
        <link rel="stylesheet" href={asset('/assets/fonts/tajawal.css')} />
        <link rel="icon" href={asset('/assets/logos/favicon.png')} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {children}
      </body>
    </html>
  );
}
