import Arrow from './Arrow';
import LangSwitch from './LangSwitch';
import Search, { type SearchDoc } from './Search';
import { localePath, type Locale } from '@/lib/i18n';
import { ui } from '@/lib/ui';
import { asset } from '@/lib/assets';
import { getRouteTitles, getSettings, type Chrome, type Media } from '@/lib/content';

/* Every element mirrors the original chrome markup one-for-one — the class
   names are the contract the shipped CSS is written against, so the geometry
   comes out identical rather than being re-derived. Only the content and the
   locale prefixing are new. */

type WithLocale = { chrome: Chrome; locale: Locale };

/**
 * The utility links and the language switch, as the header's right-hand side.
 *
 * This used to be a full-width strip of its own above the header, which is what
 * left the header row with nothing in it but a logo and 1124px of air: the nav
 * was in one band and the brand in another, so neither filled its own line. The
 * reference does not split them — thalesgroup.com puts the logo in a block on
 * the left and the utility row AND the main nav to its right, sharing the same
 * header. Folding the two bands into one row is that same idea with our smaller
 * link set, and it removes a whole 41px band at the same time.
 *
 * Still `.utility`, and still `.utility__inner` inside it. Those class names are
 * a contract in two directions: the shipped theme layer styles `.utility a`, and
 * scripts/pipeline.mjs asserts `class="utility"` appears in every rendered route
 * as its "complete chrome" check. Renaming would have quietly cost both.
 */
export function UtilityNav({ chrome, locale }: WithLocale) {
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
 *
 * The `::before` reads its image from a CSS variable (`--logo-mark-circle` /
 * `--logo-lockup`, 3lines.css). Setting that variable inline from the content's
 * own `img.src` is what makes the logo CMS-driven: without it the stylesheet's
 * hardcoded URL wins and changing the image in the CMS changes nothing.
 */
function Logo({
  img,
  locale,
  className,
  style,
  wordmark,
  cssVar,
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
  /** Which theme-layer variable this mark paints through. */
  cssVar: '--logo-mark-circle' | '--logo-lockup';
}) {
  const s = getSettings();
  const withImage = {
    ...style,
    [cssVar]: `url("${asset(img.src)}")`,
  } as React.CSSProperties;
  return (
    <a className={className} href={localePath(locale, '/')} aria-label={img.alt} style={withImage}>
      {wordmark ? (
        <span className="hdr__wordmark" aria-hidden="true">
          <span className="hdr__wordmark-name">{s.wordmarkName ?? 'LINES'}</span>
          <span className="hdr__wordmark-tag">{s.wordmarkTag ?? 'Advanced Technologies Company'}</span>
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

        <Logo img={chrome.logoImg} locale={locale} className="hdr__logo" wordmark cssVar="--logo-mark-circle" />

        {/* Replaces `.hdr__spacer`, a 44px element whose only job was to balance
            the burger so the logo sat centred in a 1345px cell. Centring the
            brand in an empty row is what the space was FOR; once the row
            carries navigation there is nothing to balance, and the logo reads
            better hard left — which is where the reference puts it. */}
        <UtilityNav chrome={chrome} locale={locale} />

        {/* Far end of the row, past the language control — the same slot
            thalesgroup.com gives it (a 66px square at the right edge of the nav
            row, behind its own rule). `searchDocs` is built from the bundled
            route table, so this costs no filesystem read; see Search.tsx. */}
        <Search docs={searchDocs(locale)} labels={searchLabels(locale)} />
      </div>
    </header>
  );
}

/**
 * The search index: every route, titled in this locale.
 *
 * `getRouteTitles()` is one of the documents lib/content.ts bundles statically,
 * which is what makes this safe to call from a header that also renders inside
 * the Worker. Reading the per-page documents instead would give richer matches
 * and fail in production only.
 */
function searchDocs(locale: Locale): SearchDoc[] {
  return Object.entries(getRouteTitles())
    .map(([route, titles]) => ({ title: titles[locale] ?? '', href: localePath(locale, route) }))
    .filter((d) => d.title !== '');
}

function searchLabels(locale: Locale) {
  const t = ui(locale);
  return {
    open: t.openSearch,
    placeholder: t.searchPlaceholder,
    noResults: t.searchNoResults,
    close: t.close,
  };
}

export function MegaMenu({ chrome, locale }: WithLocale) {
  const firstTabKey = chrome.mega.tabs.find((t) => !t.href)?.key;
  return (
    <div className="mega" id="mega" role="dialog" aria-modal="true" aria-label={ui(locale).mainMenu}>
      <div className="mega__bar">
        {/* Same lockup as the header: this bar stands in for the header while
            the menu is open, so the brand must not change shape on open. */}
        <Logo
          img={chrome.logoImg}
          locale={locale}
          className="hdr__logo"
          style={{ padding: 0 }}
          wordmark
          cssVar="--logo-mark-circle"
        />
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

/* SearchLayer was a no-op placeholder here, standing in for the reference's
   search overlay — a clone artefact whose submit handler called alert(). It is
   gone because the overlay is real now and ships with its own trigger; see
   components/Search.tsx. */

export function Footer({ chrome, locale }: WithLocale) {
  const { columns } = chrome.footer;

  /* The bar's address, badge and copyright come from Site info in the CMS —
     chrome.json no longer carries them, so editing "Copyright year" or the
     address in the admin is the only source and actually changes the footer. */
  const s = getSettings();
  const note = s.address ?? '';
  const badge = s.establishedBadge?.[locale] ?? '';
  const copyright =
    s.copyrightYear && s.companyName?.[locale]
      ? `© ${s.copyrightYear} ${s.companyName[locale]}`
      : '';

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
                <Logo
                  img={chrome.footerLogoImg}
                  locale={locale}
                  className="ftr__logo"
                  cssVar="--logo-lockup"
                />
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
          {/* Class names stay .a11y/.pill — they carry the green pill styling
              in style.css; only the data behind them changed. */}
          <span className="a11y">
            {note} <span className="pill">{badge}</span>
          </span>
          <span className="right">{copyright}</span>
        </div>
      </div>
    </footer>
  );
}
