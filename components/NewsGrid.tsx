import Arrow from './Arrow';
import { getNews } from '@/lib/content';
import { localePath, type Locale } from '@/lib/i18n';

/**
 * News card grid. `limit` mirrors the source's data-limit, so the homepage
 * teaser and the full listing share one renderer and one dataset.
 *
 * Covers paint through the `--img` custom property, which is how every other
 * media plate in this design system works.
 */
export default function NewsGrid({ limit, locale }: { limit?: number; locale: Locale }) {
  const items = getNews(locale);
  const shown = typeof limit === 'number' ? items.slice(0, limit) : items;

  /* The stored date is ISO (the sortable, editable form); the card shows it in
     the reader's language — Arabic month names on the Arabic cards, which used
     to render the raw "2026-05-12" in both trees. Latin digits in both, matching
     the rest of the site's numerals. UTC pinning keeps prerender output
     independent of the build machine's timezone. */
  const dateFmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-u-nu-latn' : 'en-GB', {
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
            style={n.media ? ({ ['--img']: `url('${n.media.src}')` } as React.CSSProperties) : undefined}
          />
          <div className="ncard__body">
            {n.tag ? <span className="tag">{n.tag}</span> : null}
            <h3>{n.title}</h3>
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
