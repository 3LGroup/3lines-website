'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n';
import type { LangLink } from '@/lib/content';

/**
 * Language switch — a dropdown, in the pattern shadcn/Tabler popularised,
 * built natively because this site ships no component framework.
 *
 * Route ids are locale-less and the pipeline guarantees every route exists in
 * every locale, so switching language is a prefix swap on the current path —
 * it leaves you on the page you were already reading.
 *
 * `<details>/<summary>` rather than a scripted popover, deliberately: the menu
 * opens and its links navigate with JavaScript disabled, matching the rest of
 * the site. The one scripted nicety layered on top — closing when you click
 * elsewhere or press Escape — degrades to "closes on next toggle" without it.
 *
 * The menu lists each language under its NATIVE name. That is the one i18n
 * rule a switcher must not break: a Japanese reader lost on the Arabic page
 * must still find 日本語. Native names are universal constants, not
 * translations, which is why they live here and not in the CMS copy.
 *
 * `usePathname` keeps this a client component (a segment layout never sees the
 * rest of the path), but it still prerenders with real hrefs.
 */

const NATIVE: Record<string, string> = {
  en: 'English',
  ar: 'العربية',
  ja: '日本語',
  ko: '한국어',
};

export default function LangSwitch({
  links,
  locale,
  label,
}: {
  links: LangLink[];
  locale: Locale;
  /** Accessible name, passed in rather than read here: ui() is a server-side
      lookup and this is a client component. */
  label: string;
}) {
  const pathname = usePathname() || `/${locale}`;
  const root = useRef<HTMLDetailsElement>(null);

  const swap = (target: Locale) => {
    const seg = pathname.split('/').filter(Boolean);
    if (seg.length && isLocale(seg[0])) seg[0] = target;
    else seg.unshift(target);
    return '/' + seg.join('/');
  };

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const away = (e: MouseEvent) => {
      if (el.open && e.target instanceof Node && !el.contains(e.target)) el.open = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && el.open) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('click', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('click', away);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const current = links.find((l) => l.locale === locale);

  return (
    <details className="langmenu" ref={root}>
      {/* The description is a hidden child, not an aria-label.
          As an aria-label it REPLACED the visible text — the summary shows the
          current locale code, "EN" or "AR" — so the accessible name was
          "Change language" while the screen said "AR", and someone driving the
          page by voice could read the code aloud and nothing would happen. That
          is WCAG 2.5.3, and it only shows at desktop widths: style.css hides
          .hdr .utility below 900px, so no mobile audit can see it.
          As a child it is prepended instead, giving "Change language AR", which
          contains the visible label. Same fix as the theme toggle. */}
      <summary>
        <span className="sr-only">{label}</span>
        {/* Globe: Tabler Icons (MIT), inlined. */}
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
          <path d="M3.6 9h16.8" />
          <path d="M3.6 15h16.8" />
          <path d="M11.5 3a17 17 0 0 0 0 18" />
          <path d="M12.5 3a17 17 0 0 1 0 18" />
        </svg>
        <span className="langmenu__cur">{current?.label ?? locale.toUpperCase()}</span>
        <svg
          aria-hidden="true"
          className="langmenu__chev"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6l6 -6" />
        </svg>
      </summary>

      <ul className="langmenu__list" role="list">
        {links.map((l, i) => (
          <li key={i}>
            <a
              href={swap(l.locale)}
              lang={l.locale}
              hrefLang={l.locale}
              aria-current={l.locale === locale ? 'true' : undefined}
            >
              <span className="langmenu__native">{NATIVE[l.locale] ?? l.label}</span>
              <span className="langmenu__code" dir="ltr">
                {l.label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
