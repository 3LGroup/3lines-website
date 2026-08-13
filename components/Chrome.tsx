import Arrow from './Arrow';
import LangSwitch from './LangSwitch';
import { localePath, type Locale } from '@/lib/i18n';
import { ui } from '@/lib/ui';
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
        {/* Keeps you on the current page across the language switch — see
            LangSwitch for why that needs a client component. */}
        <LangSwitch links={chrome.utility.lang} locale={locale} />
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
  wordmark,
}: {
  img: Media;
  locale: Locale;
  className: string;
  style?: React.CSSProperties;
  /**
   * Sets the "LINES / Advanced Technologies Company" lockup beside the mark, as
   * the reference header does (assets/enhance.js §18b). The mark alone is only
   * half the reference's branding. aria-hidden because the link already carries
   * its accessible name on aria-label, and the reference keeps it decorative
   * for the same reason.
   */
  wordmark?: boolean;
}) {
  return (
    <a className={className} href={localePath(locale, '/')} aria-label={img.alt} style={style}>
      {wordmark ? (
        <span className="hdr__wordmark" aria-hidden="true">
          <span className="hdr__wordmark-name">LINES</span>
          <span className="hdr__wordmark-tag">Advanced Technologies Company</span>
        </span>
      ) : null}
    </a>
  );
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
          aria-label={ui(locale).openMenu}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>

        <Logo img={chrome.logoImg} locale={locale} className="hdr__logo" wordmark />

        <span className="hdr__spacer" />
      </div>
    </header>
  );
}

export function MegaMenu({ chrome, locale }: WithLocale) {
  const firstTabKey = chrome.mega.tabs.find((t) => !t.href)?.key;
  return (
    <div className="mega" id="mega" role="dialog" aria-modal="true" aria-label={ui(locale).mainMenu}>
      <div className="mega__bar">
        {/* Same lockup as the header: this bar stands in for the header while
            the menu is open, so the brand must not change shape on open. */}
        <Logo img={chrome.logoImg} locale={locale} className="hdr__logo" style={{ padding: 0 }} wordmark />
        <button className="mega__close" type="button">
          {ui(locale).close}{' '}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mega__body">
        {/* Mixed list. Items carrying an href are destinations and render as
            plain links; the rest are tabs that swap the panel beside them.
            The link class is deliberately NOT `megatab` — main.js drives the
            tabs by querying that class and toggling the panel named in
            data-target, so a link wearing it would try to open a panel that
            does not exist, on top of navigating. Keeping the classes distinct
            means the tab script needs no knowledge of links at all, and its
            arrow-key cycling stays over the real tabs only. */}
        <ul className="megatabs" role="tablist">
          {chrome.mega.tabs.map((t) => (
            <li key={t.key}>
              {t.href ? (
                <a className="megalink" href={localePath(locale, t.href)}>
                  {t.label} <Arrow />
                </a>
              ) : (
                <button
                  className="megatab"
                  role="tab"
                  data-target={t.key}
                  /* The first TAB, not the first item — a link carries no
                     selected state, so indexing the whole list would leave no
                     tab selected if the order ever put a link first. */
                  aria-selected={t.key === firstTabKey ? 'true' : 'false'}
                >
                  {t.label} <Arrow />
                </button>
              )}
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
          {/* Class names stay .a11y/.pill — they carry the green pill styling
              in style.css; only the data behind them changed. */}
          <span className="a11y">
            {bar.note} <span className="pill">{bar.badge}</span>
          </span>
          <span className="right">{bar.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
