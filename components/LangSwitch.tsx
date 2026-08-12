'use client';

import { usePathname } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n';
import type { LangLink } from '@/lib/content';

/**
 * Language switch.
 *
 * Route ids are locale-less and the ingest guarantees every route exists in both
 * locales, so switching language is a prefix swap on the current path — which
 * leaves you on the page you were already reading.
 *
 * This previously linked to `/` in the target locale, so a reader four levels
 * into the Arabic service tree who wanted the English text was thrown back to
 * the English home page: the classic bilingual-site annoyance, and the one the
 * comment here always claimed the component avoided.
 *
 * `usePathname` is the reason this is a client component. The locale layout
 * receives only the `locale` param — a segment layout never sees the rest of the
 * path — so the switch cannot be built server-side without threading the route
 * through every page. It still prerenders: `usePathname` resolves to the real
 * path during static generation, so the emitted HTML carries correct hrefs and
 * works with JavaScript disabled.
 */
export default function LangSwitch({ links, locale }: { links: LangLink[]; locale: Locale }) {
  const pathname = usePathname() || `/${locale}`;

  const swap = (target: Locale) => {
    const seg = pathname.split('/').filter(Boolean);
    if (seg.length && isLocale(seg[0])) seg[0] = target;
    else seg.unshift(target);
    return '/' + seg.join('/');
  };

  return (
    <span className="utility__lang">
      {links.map((l, i) => (
        <a
          key={i}
          href={swap(l.locale)}
          lang={l.locale}
          hrefLang={l.locale}
          aria-current={l.current ? 'true' : undefined}
        >
          {l.label}
        </a>
      ))}
    </span>
  );
}
