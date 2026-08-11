import Arrow from './Arrow';
import { localePath, type Locale } from '@/lib/i18n';
import type { Chrome, Media } from '@/lib/content';

/* Every element mirrors the original chrome markup one-for-one — the class
   names are the contract the shipped CSS is written against, so the geometry
   comes out identical rather than being re-derived. Only the content and the
   locale prefixing are new. */

type WithLocale = { chrome: Chrome; locale: Locale };

export function UtilityBar({ chrome, locale }: WithLocale) {
  return (
    <div className="utility">
      <div className="utility__inner">
        {chrome.utility.links.map((l, i) => (
          <a key={i} href={localePath(locale, l.href)}>
            {l.label}
          </a>
        ))}
        <span className="utility__lang">
          {chrome.utility.lang.map((l, i) => (
            // The language switch points at the *same* page in the other
            // locale, not at its home page — losing your place when switching
            // language is the classic bilingual-site annoyance.
            <a
              key={i}
              href={localePath(l.locale, '/')}
              lang={l.locale}
              aria-current={l.current ? 'true' : undefined}
            >
              {l.label}
            </a>
          ))}
        </span>
      </div>
    </div>
  );
}

/**
 * Brand link — intentionally empty.
 *
 * The theme layer already paints the 3Lines wordmark as a `::before` on
 * `.hdr__logo` / `.ftr__logo` and hides the clone's own `> svg`. Rendering an
 * <img> here does not replace that mark, it stacks a second one beside it —
 * which is why the header showed the logo twice. The label is carried on
 * aria-label so the link still has an accessible name.
 */
function Logo({
  img,
  locale,
  className,
  style,
}: {
  img: Media;
  locale: Locale;
  className: string;
  style?: React.CSSProperties;
}) {
  return <a className={className} href={localePath(locale, '/')} aria-label={img.alt} style={style} />;
}

export function Header({ chrome, locale }: WithLocale) {
  return (
    <header className="hdr">
      <div className="hdr__inner">
        <button
          className="hdr__burger"
          type="button"
          aria-expanded="false"
          aria-controls="mega"
          aria-label="Open main menu"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>

        <Logo img={chrome.logoImg} locale={locale} className="hdr__logo" />

        <span className="hdr__spacer" />
      </div>
    </header>
  );
}

export function MegaMenu({ chrome, locale }: WithLocale) {
  return (
    <div className="mega" id="mega" role="dialog" aria-modal="true" aria-label="Main menu">
      <div className="mega__bar">
        <Logo img={chrome.logoImg} locale={locale} className="hdr__logo" style={{ padding: 0 }} />
        <button className="mega__close" type="button">
          Close{' '}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mega__body">
        <ul className="megatabs" role="tablist">
          {chrome.mega.tabs.map((t, i) => (
            <li key={t.key}>
              <button
                className="megatab"
                role="tab"
                data-target={t.key}
                aria-selected={i === 0 ? 'true' : 'false'}
              >
                {t.label} <Arrow />
              </button>
            </li>
          ))}
        </ul>

        <div>
          {chrome.mega.panels.map((p, i) => (
            <div className={i === 0 ? 'megapanel is-on' : 'megapanel'} data-panel={p.key} key={p.key}>
              <h3>{p.title}</h3>
              <div className="megapanel__links">
                {p.links.map((l, j) => (
                  <a key={j} href={localePath(locale, l.href)}>
                    {l.label}
                  </a>
                ))}
              </div>
              <div className="megapanel__cta">
                <a className="btn btn--wire" href={localePath(locale, p.cta.href)}>
                  {p.cta.label} <Arrow />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Kept as a no-op placeholder so the layout's DOM shape is unchanged.
 * The original search overlay was a clone artefact whose submit handler called
 * alert(); it is not wired to anything real, so it is not shipped.
 */
export function SearchLayer() {
  return null;
}

export function Footer({ chrome, locale }: WithLocale) {
  const { columns, bar } = chrome.footer;
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr__grid">
          {columns.map((col, i) => (
            <div key={i}>
              {col.logo ? (
                /* Full lockup in the footer, compact mark in the header — the
                   reference's own split, and why the header stops showing the
                   monogram twice. */
                <Logo img={chrome.footerLogoImg} locale={locale} className="ftr__logo" />
              ) : null}
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l, j) => (
                  <li key={j}>
                    <a href={localePath(locale, l.href)}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="ftr__bar">
          {bar.links.map((l, i) => (
            <a key={i} href={localePath(locale, l.href)}>
              {l.label}
            </a>
          ))}
          <span className="a11y">
            {bar.a11yLabel} <span className="pill">{bar.a11yPill}</span>
          </span>
          <span className="right">{bar.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
