'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n';
import type { UiStrings } from '@/lib/ui';

interface LocalizedNotFound {
  strings: UiStrings;
  links: { href: string; label: string }[];
}

/**
 * Picks the language for the 404 from the URL.
 *
 * The prerendered HTML is English; on an Arabic path the strings swap after
 * mount. The swap is deliberately post-hydration (state, not a server/client
 * branch) so the first client render matches the server HTML and the console
 * audit's zero-hydration-error gate keeps holding.
 */
export default function NotFoundBody({
  payload,
}: {
  payload: Record<string, LocalizedNotFound>;
}) {
  const pathname = usePathname() || '/en';
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    const first = pathname.split('/').filter(Boolean)[0];
    if (first && isLocale(first)) setLocale(first);
  }, [pathname]);

  const t = payload[locale] ?? payload.en;

  return (
    <section className="section" dir={locale === 'ar' ? 'rtl' : 'ltr'} lang={locale}>
      <div className="wrap">
        <p className="kicker">404</p>
        <h1 className="h2">{t.strings.notFoundTitle}</h1>
        <p className="lede" style={{ marginBottom: 30 }}>
          {t.strings.notFoundBody}
        </p>
        <p>{t.strings.notFoundBrowse}</p>
        <ul className="prose">
          {t.links.map((l) => (
            <li key={l.href}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
