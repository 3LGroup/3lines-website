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
              <span>{n.date}</span>
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
