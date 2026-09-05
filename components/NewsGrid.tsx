import Arrow from './Arrow';
import type { HeadingLevel } from './bodies/Bodies';
import { getNews } from '@/lib/content';
import { contentAsset } from '@/lib/assets';
import { localePath, type Locale } from '@/lib/i18n';

/**
 * Which CLDR locale formats the card date.
 *
 * This was `locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB'`, a two-locale test that
 * silently sent Japanese and Korean readers an English date — "12 May 2026"
 * rather than 2026年5月12日 / 2026년 5월 12일. Latin digits are forced for Arabic
 * only, matching the numerals the rest of the Arabic tree renders; ja and ko use
 * Latin digits natively, so they need no extension.
 */
const DATE_LOCALE: Record<Locale, string> = {
  en: 'en-GB',
  ar: 'ar-u-nu-latn',
  ja: 'ja-JP',
  ko: 'ko-KR',
};


/**
 * News card grid. `limit` mirrors the source's data-limit, so the homepage
 * teaser and the full listing share one renderer and one dataset.
 *
 * Covers paint through the `--img` custom property, which is how every other
 * media plate in this design system works.
 */
export default function NewsGrid({
  limit,
  locale,
  level,
}: {
  limit?: number;
  locale: Locale;
  /** See the note on atLevel in Bodies.tsx. */
  level: HeadingLevel;
}) {
  const items = getNews(locale);
  const shown = typeof limit === 'number' ? items.slice(0, limit) : items;

  /* The stored date is ISO (the sortable, editable form); the card shows it in
     the reader's language — Arabic month names on the Arabic cards, which used
     to render the raw "2026-05-12" in both trees. Latin digits in both, matching
     the rest of the site's numerals. UTC pinning keeps prerender output
     independent of the build machine's timezone. */
  const dateFmt = new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const formatDate = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
  };

  return (
    <div className="newsgrid" id="newsgrid">
      {shown.map((n) => (
        <a className="ncard reveal" key={n.slug} href={localePath(locale, n.route)}>
          <div
            className="ncard__media"
            style={
              n.media
                ? ({ ['--img']: `url('${contentAsset(n.media.src)}')` } as React.CSSProperties)
                : undefined
            }
          />
          <div className="ncard__body">
            {n.tag ? <span className="tag">{n.tag}</span> : null}
            <h3 {...(level === 2 ? { 'aria-level': 2 } : {})}>{n.title}</h3>
            <div className="ncard__meta">
              <span>{n.type}</span>
              <span className="dot" />
              <span>{formatDate(n.date)}</span>
            </div>
            <span className="ncard__more">
              <Arrow />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
