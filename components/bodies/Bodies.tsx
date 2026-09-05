import Arrow from '../Arrow';
import { contentAsset, contentAssetVar } from '@/lib/assets';
import Svg from '../Svg';
import NewsGrid from '../NewsGrid';
import ContactForm from '../ContactForm';
import { localePath, type Locale } from '@/lib/i18n';
import { ui } from '@/lib/ui';
import { assertNever } from '@/lib/blocks';
import type {
  CardsBody,
  CertsBody,
  CompaniesBody,
  DefsBody,
  FeatureBody,
  Figure,
  FiguresBody,
  Link,
  LogosBody,
  MapBody,
  OverviewSplitBody,
  ProseBody,
  SectionBody,
  SliderBody,
  SpecListBody,
  TilesBody,
} from '@/lib/blocks';

/** `--img` is a real custom property in the source. The path inside it is
    content-hashed on the way through — see the note in lib/assets.ts on why
    these were the only URLs on the site without that guarantee. */
const imgStyle = (imgVar?: string, extra?: React.CSSProperties): React.CSSProperties | undefined => {
  if (!imgVar && !extra) return undefined;
  const url = contentAssetVar(imgVar);
  return { ...(url ? ({ ['--img']: url } as React.CSSProperties) : null), ...extra };
};

/**
 * Heading level for a body's own headings.
 *
 * Every body renderer emits <h3>, but a section only emits its <h2> when it has
 * a heading to put in it — so on a section without one the document went h1
 * straight to h3. The project's own a11y audit reports that on 20 of the 25
 * routes, in all four locales.
 *
 * `aria-level` rather than a different tag, because the CSS that sizes these
 * targets the element: `.tile__body h3`, `.pcard h3`, `.ccard h3`, `.ncard h3`.
 * Swapping to <h2> would fix the outline and resize half the site. This changes
 * what assistive technology computes and nothing else — the rendered pixels are
 * identical.
 */
export type HeadingLevel = 2 | 3;
const atLevel = (level: HeadingLevel) => (level === 2 ? { 'aria-level': 2 } : {});

/** Inline styles are captured verbatim as strings; re-parse into a style object. */
function parseStyle(style?: string): React.CSSProperties | undefined {
  if (!style) return undefined;
  const out: Record<string, string> = {};
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i === -1) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) continue;
    out[prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return out as React.CSSProperties;
}

const btnClass = (variant?: 'wire' | 'blue' | 'onDark') => `btn btn--${variant ?? 'wire'}`;

function Cta({ link, variant, locale }: { link: Link; variant?: 'wire' | 'blue' | 'onDark'; locale: Locale }) {
  return (
    <a className={btnClass(variant)} href={localePath(locale, link.href)}>
      {link.label} <Arrow />
    </a>
  );
}

function Figures({ items, style }: { items: Figure[]; style?: string }) {
  return (
    <div className="figures reveal" style={parseStyle(style)}>
      {items.map((f, i) => (
        <div key={i}>
          <div className="figure__num">
            {f.prefix ? <span className="figure__pre">{f.prefix}</span> : null}
            {/* The real number, not 0: this is the value shown with JavaScript
                disabled (and to crawlers). main.js resets to 0 and counts up
                when the row scrolls into view. */}
            <span data-count={f.count} data-suffix={f.suffix}>
              {f.count}
              {f.suffix ?? ''}
            </span>
          </div>
          <div className="figure__lab">{f.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- renderers -- */

function Tiles({ body, locale, level }: { body: TilesBody; locale: Locale; level: HeadingLevel }) {
  return (
    <div className="tiles3">
      {body.items.map((t, i) => (
        <a className="tile reveal" key={i} style={imgStyle(t.imgVar)} href={localePath(locale, t.href)}>
          {/* direct child: `.tile > svg` in the source CSS depends on it */}
          <Svg node={t.art} />
          <div className="tile__body">
            <h3 {...atLevel(level)}>{t.title}</h3>
            <span className="go">
              {ui(locale).discover} <Arrow />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

/* Repeated link text.
 *
 * Every card in a grid says "Learn more", so a screen reader's link list — and
 * Lighthouse's descriptive-link-text check — sees four identical entries with no
 * way to tell which is which. Appending the card's own heading in an sr-only span
 * makes the accessible name "Learn more — XR" while the visible label stays
 * "Learn more", which is the ordering WCAG 2.5.3 requires: the visible text has to
 * be contained in the accessible name, so it must not be prefixed.
 *
 * Rendered only when the two actually differ, so a link already named after its
 * destination is not read out twice.
 *
 * It must be the LAST child, after the arrow. `.arrowlink` is display:flex with
 * gap:11px, and although this span is position:absolute and therefore not a flex
 * item, placing it between the label and the arrow splits one anonymous flex item
 * into two — three items, two gaps, and the link renders 11px wider. The visual
 * audit caught exactly that: `.arrowlink w 100.59 -> 111.59` on 28 route/viewport
 * pairs. As the last child the item count is unchanged and the geometry is
 * identical. The accessible name is unaffected: the arrow is aria-hidden, so it
 * still computes as "Learn more — XR". */
function LinkContext({ heading }: { heading?: string }) {
  /* One template literal, not three JSX children: separate children make React
     emit <!-- --> separator comments between them, which is three text nodes for
     an assistive technology to join instead of one. */
  return heading ? <span className="sr-only">{` — ${heading}`}</span> : null;
}

function Cards({ body, locale, level }: { body: CardsBody; locale: Locale; level: HeadingLevel }) {
  return (
    <>
      <div className="cards3">
        {body.items.map((c, i) => (
          <div className="pcard reveal" key={i} id={c.id}>
            <div className="pcard__media" style={imgStyle(c.imgVar)}>
              <Svg node={c.art} />
            </div>
            <h3 {...atLevel(level)}>{c.title}</h3>
            {c.text ? <p>{c.text}</p> : null}
            {c.link ? (
              <a className="arrowlink" href={localePath(locale, c.link.href)}>
                {c.link.label} <Arrow />
                <LinkContext heading={c.link.label === c.title ? undefined : c.title} />
              </a>
            ) : null}
          </div>
        ))}
      </div>
      {body.cta ? (
        <div style={parseStyle(body.ctaWrapStyle)}>
          <Cta link={body.cta} variant={body.ctaVariant} locale={locale} />
        </div>
      ) : null}
    </>
  );
}

function Feature({ body, locale, level }: { body: FeatureBody; locale: Locale; level: HeadingLevel }) {
  return (
    <div className="feature">
      <div className="feature__media reveal" style={imgStyle(body.media.imgVar)}>
        <Svg node={body.media.art} />
      </div>
      <div className="reveal">
        {body.heading ? (
          <h3 className="h3" style={parseStyle(body.headingStyle)} {...atLevel(level)}>
            {body.heading}
          </h3>
        ) : null}
        {body.lede ? (
          <p className="lede" style={parseStyle(body.ledeStyle)}>
            {body.lede}
          </p>
        ) : null}
        {body.link ? (
          <a className="arrowlink" href={localePath(locale, body.link.href)}>
            {body.link.label} <Arrow />
            <LinkContext heading={body.link.label === body.heading ? undefined : body.heading} />
          </a>
        ) : null}
        {body.checklist?.length ? (
          <ul className="ticks ticks--lg">
            {body.checklist.map((c, i) => (
              <li key={i}>
                <b>{c.title}</b>
                {c.text ? ` ${c.text}` : null}
              </li>
            ))}
          </ul>
        ) : null}
        {body.figures ? <Figures items={body.figures} /> : null}
        {body.cta ? (
          <div style={parseStyle(body.ctaWrapStyle)}>
            <Cta link={body.cta} variant={body.ctaVariant} locale={locale} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Prose({ body }: { body: ProseBody }) {
  return (
    <div className="prose reveal">
      {body.paragraphs.map((p, i) => (
        <p key={i} style={parseStyle(p.style)}>
          {p.text}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------- 3Lines content bodies -- */

/**
 * The "Why 3Lines" carousel. Slides are all rendered; `main.js` cycles the
 * `is-on` class. The first slide carries it so the block is meaningful with
 * JavaScript disabled and in the audit's settled state.
 */
function Slider({ body, level }: { body: SliderBody; level: HeadingLevel }) {
  return (
    <div className="heroslides" data-slider>
      {body.items.map((s, i) => (
        <div className={i === 0 ? 'heroslide is-on' : 'heroslide'} key={i} data-slide={i}>
          <h3 {...atLevel(level)}>{s.heading}</h3>
          <p>{s.sub}</p>
        </div>
      ))}
      {/* The headings are rendered INSIDE the buttons rather than only as
          aria-labels. They were already announced to screen readers, so three
          of the four messages were reachable with assistive tech and invisible
          to everyone else — four anonymous 10px circles beside a band that was
          63% empty. Showing them fills the space with the content that was
          already there.

          Class names, data-goto and aria-current are untouched, so the slider
          in main.js keeps working with no change: it only toggles classes and
          the current flag. */}
      <div className="dots" role="tablist">
        {body.items.map((s, i) => (
          <button
            className="dot"
            key={i}
            type="button"
            role="tab"
            data-goto={i}
            aria-current={i === 0 ? 'true' : 'false'}
          >
            {/* No aria-label now the text is visible: an aria-label overrides
                the accessible name, and duplicating visible text is the setup
                for the two drifting apart later. */}
            <span className="dot__label">{s.heading}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Title + body cards with no media plate. */
function Defs({ body, level }: { body: DefsBody; level: HeadingLevel }) {
  return (
    <div className="defs" data-cols={body.columns}>
      {body.items.map((d, i) => (
        <div className="defcard reveal" key={i}>
          <h3 {...atLevel(level)}>{d.title}</h3>
          {d.text ? <p>{d.text}</p> : null}
          {d.meta?.length ? (
            <div className="defcard__meta">
              {d.meta.map((m, j) => (
                <span key={j}>
                  <b>{m.label}</b> {m.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SpecList({ body }: { body: SpecListBody }) {
  return (
    <div className="speclist reveal">
      {body.items.map((s, i) => (
        <div key={i}>{s}</div>
      ))}
    </div>
  );
}

/** Wide prose column beside a narrow "at a glance" card — one band, not two. */
function OverviewSplit({ body, level }: { body: OverviewSplitBody; level: HeadingLevel }) {
  return (
    <div className="ovsplit reveal">
      <div className="ovsplit__main">
        {body.heading ? (
          <h3 className="h3" {...atLevel(level)}>
            {body.heading}
          </h3>
        ) : null}
        {body.lede ? <p className="lede">{body.lede}</p> : null}
      </div>
      <aside className="ovsplit__aside">
        {body.glanceTitle ? <p className="kicker">{body.glanceTitle}</p> : null}
        <ul className="ticks">
          {body.glance.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/**
 * The group's operating companies — four equal cards in one row.
 *
 * `data-plate` is the only presentational hint carried, and it is derived, not
 * authored: which of the three media treatments a card gets follows from
 * whether it has a brand mark, a photograph, or neither.
 */
function Companies({ body, locale, level }: { body: CompaniesBody; locale: Locale; level: HeadingLevel }) {
  return (
    <div className="companies">
      {body.items.map((c, i) => (
        <article
          className="ccard reveal"
          key={c.id ?? i}
          id={c.id}
          data-plate={c.logo ? 'logo' : c.imgVar ? 'photo' : 'bare'}
        >
          <div className="ccard__media" style={imgStyle(c.imgVar)}>
            {c.logo ? (
              <img
                className="ccard__logo"
                src={contentAsset(c.logo.src)}
                alt={c.logo.alt}
                loading="lazy"
                decoding="async"
                data-invert={c.logo.invert ? '1' : undefined}
              />
            ) : null}
            {/* Pre-launch marker. aria-hidden because it repeats the visible
                status word already announced with the company name below. */}
            {/* dir="ltr": the status stays Latin in both locales, and its
                trailing "!" is bidi-neutral — without this it flips to the
                left of the word under RTL and renders "!Soon". */}
            {c.status ? (
              <span className="ccard__status" dir="ltr" aria-hidden="true">
                {c.status}
              </span>
            ) : null}
          </div>
          <div className="ccard__body">
            <h3 {...atLevel(level)}>
              {c.name}
              {c.status ? <span className="sr-only"> — {c.status}</span> : null}
            </h3>
            <p>{c.tagline}</p>
            {c.link ? (
              c.external ? (
                <a className="arrowlink" href={c.link.href} target="_blank" rel="noreferrer noopener">
                  {c.link.label} <Arrow />
                  <LinkContext heading={c.link.label === c.name ? undefined : c.name} />
                </a>
              ) : (
                <a className="arrowlink" href={localePath(locale, c.link.href)}>
                  {c.link.label} <Arrow />
                  <LinkContext heading={c.link.label === c.name ? undefined : c.name} />
                </a>
              )
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

/**
 * Click-to-load map.
 *
 * Deliberately renders NO iframe. Everything else on this site is self-hosted
 * — the fonts especially — so a map that called Google on every page view
 * would be the one third-party request in the whole build. The coordinates ride
 * on data attributes and main.js swaps in the embed after a click, which keeps
 * that promise while still giving a real map to anyone who wants one. `note`
 * says what the button does, so it is an informed choice rather than a
 * surprise connection.
 */
/**
 * Abstract street grid drawn behind the facade panel, so the placeholder reads
 * as "a map that has not been fetched yet" rather than an empty box. Decorative
 * only — the loader clears the facade wholesale when the real embed arrives.
 */
function MapArt() {
  return (
    <svg className="mapembed__art" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="var(--border, #D9D9E7)" strokeWidth="1.5" fill="none">
        <path d="M-20 96 H820 M-20 214 H820 M-20 332 H820" />
        <path d="M118 -20 V470 M300 -20 V470 M486 -20 V470 M664 -20 V470" />
      </g>
      <g stroke="var(--border, #D9D9E7)" strokeWidth="4" fill="none" opacity=".8">
        <path d="M-30 388 C 170 340, 330 420, 560 330 S 780 300, 830 250" />
        <path d="M60 -30 C 140 120, 90 260, 210 470" />
      </g>
      <g fill="var(--border, #D9D9E7)" opacity=".45">
        <rect x="136" y="112" width="70" height="44" rx="4" />
        <rect x="318" y="230" width="92" height="52" rx="4" />
        <rect x="524" y="120" width="60" height="60" rx="4" />
        <rect x="600" y="348" width="84" height="40" rx="4" />
        <rect x="180" y="288" width="52" height="52" rx="4" />
      </g>
      {/* Above the centred facade panel, close enough to the middle that the
          slice-crop on narrow viewports keeps it in frame. */}
      <g className="mapembed__pin">
        <circle className="mapembed__pulse" cx="520" cy="48" r="30" fill="var(--cyan, #87EDFF)" />
        <path
          d="M520 12 c -15.5 0 -28 12.5 -28 28 0 20 28 48 28 48 s 28 -28 28 -48 c 0 -15.5 -12.5 -28 -28 -28 z"
          fill="var(--primary, var(--navy, #123E5E))"
        />
        <circle cx="520" cy="40" r="10" fill="var(--card, #fff)" />
      </g>
    </svg>
  );
}

function MapEmbed({ body }: { body: MapBody }) {
  const facade = (
    <div
      className="mapembed reveal"
      data-lat={body.lat}
      data-lng={body.lng}
      data-zoom={body.zoom ?? 16}
      data-title={body.placeName}
    >
      <MapArt />
      <div className="mapembed__panel">
        <p className="mapembed__place">{body.placeName}</p>
        <p className="mapembed__addr">{body.address}</p>
        <button className="btn btn--wire mapembed__load" type="button">
          {body.ctaLabel} <Arrow />
        </button>
        <p className="mapembed__note">{body.note}</p>
      </div>
    </div>
  );

  if (!body.details?.length && !body.directions) return facade;

  return (
    <div className="maploc">
      {facade}
      <aside className="maploc__info reveal" aria-label={body.placeName}>
        {body.details?.length ? (
          <ul className="maploc__rows">
            {body.details.map((d, i) => {
              // Phone numbers are LTR strings; without an explicit direction the
              // bidi algorithm scrambles "+966 11 …" on the Arabic page.
              const dir = d.href?.startsWith('tel:') ? ('ltr' as const) : undefined;
              return (
                <li key={i}>
                  <span className="maploc__label">{d.label}</span>
                  <span className="maploc__value" dir={dir}>
                    {d.href ? <a href={d.href}>{d.value}</a> : d.value}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {body.directions ? (
          <a
            className="btn btn--blue maploc__cta"
            href={body.directions.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {body.directions.label} <Arrow />
          </a>
        ) : null}
      </aside>
    </div>
  );
}

function Logos({ body, locale }: { body: LogosBody; locale: Locale }) {
  const marquee = body.variant === 'marquee';

  const cell = (l: LogosBody['items'][number], key: string, ariaHidden?: boolean) => {
    const img = (
      <img
        src={contentAsset(l.media.src)}
        alt={ariaHidden ? '' : l.media.alt}
        loading="lazy"
        decoding="async"
        data-invert={l.media.invert ? '1' : undefined}
      />
    );
    return (
      <div key={key} aria-hidden={ariaHidden || undefined}>
        {l.href && !ariaHidden ? (
          <a href={l.href} target="_blank" rel="noreferrer noopener" title={l.name}>
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    );
  };

  return (
    <>
      {marquee ? (
        <div className="logos logos--marquee">
          {/* A real pause control, because the strip animates indefinitely and
              WCAG 2.2.2 asks for a way to stop motion that runs past five
              seconds. Pausing on :hover and :focus-within was already here and
              is worth keeping, but neither exists on a touch screen, which is
              most of this page's traffic.

              main.js does the toggling and rewrites the label; both strings are
              rendered here so they stay translated and CMS-editable.

              CSS hides it unless html.js is set, the same flag the reveal
              animation uses. Without JavaScript the button could not do
              anything, and offering a dead control is worse than offering none —
              the strip does keep moving for that visitor, which is a gap, but a
              far smaller one than today's, where nobody on a touch screen has
              any way to stop it at all. */}
          <button
            type="button"
            className="logos__pause"
            data-pause={ui(locale).pauseMotion}
            data-resume={ui(locale).resumeMotion}
            aria-pressed="false"
          >
            <span className="logos__pause-label">{ui(locale).pauseMotion}</span>
          </button>
          {/* The list is rendered twice so the -50% scroll loops seamlessly. The
              duplicate is aria-hidden so screen readers hear each partner once. */}
          <div className="logos__track">
            {body.items.map((l, i) => cell(l, `a${i}`))}
            {body.items.map((l, i) => cell(l, `b${i}`, true))}
          </div>
        </div>
      ) : (
        /* Catalogue treatment: the dedicated page names each partner, where the
           homepage strip deliberately does not. */
        <div className="logos logos--catalogue">
          {body.items.map((l, i) => {
            const tile = (
              <>
                {l.type ? <span className="logos__tag">{l.type}</span> : null}
                <span className="logos__mark">
                  {/* Empty alt when the logo's alt text is the partner's name,
                      because <strong>{l.name}</strong> is right beside it and the
                      two are the same string in every content file — so every
                      partner in this grid was announced twice. The marquee above
                      solves the same problem by aria-hiding its duplicate track.
                      A logo whose alt says something the name does not still
                      carries it. */}
                  <img
                    src={contentAsset(l.media.src)}
                    alt={l.media.alt === l.name ? '' : l.media.alt}
                    loading="lazy"
                    decoding="async"
                    data-invert={l.media.invert ? '1' : undefined}
                  />
                </span>
                <span className="logos__meta">
                  <strong>{l.name}</strong>
                  {l.caption ? <span>{l.caption}</span> : null}
                  {l.flag ? (
                    <span className="logos__flag" title={l.country}>
                      {l.flag}
                    </span>
                  ) : null}
                </span>
              </>
            );
            return (
              <div key={i}>
                {l.href ? (
                  <a href={l.href} target="_blank" rel="noreferrer noopener" title={l.name}>
                    {tile}
                  </a>
                ) : (
                  tile
                )}
              </div>
            );
          })}
        </div>
      )}
      {body.more ? (
        <div style={{ marginTop: 30 }}>
          <a className="arrowlink" href={localePath(locale, body.more.href)}>
            {body.more.label} <Arrow />
          </a>
        </div>
      ) : null}
    </>
  );
}

/** Certification plates. The alt text carries the actual accreditation claim. */
function Certs({ body }: { body: CertsBody }) {
  return (
    <ul className="certs reveal">
      {body.items.map((m, i) => (
        <li key={i}>
          <img src={contentAsset(m.src)} alt={m.alt} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Exhaustive body renderer. Adding a kind to `SectionBody` without a case here
 * makes `assertNever` fail to typecheck, so nothing can fall through to text.
 */
export default function BodyRenderer({
  body,
  locale,
  level,
}: {
  body: SectionBody;
  locale: Locale;
  /** 3 when the enclosing section rendered its own <h2>, 2 when it did not. */
  level: HeadingLevel;
}) {
  switch (body.kind) {
    case 'tiles':
      return <Tiles body={body} locale={locale} level={level} />;
    case 'cards':
      return <Cards body={body} locale={locale} level={level} />;
    case 'feature':
      return <Feature body={body} locale={locale} level={level} />;
    case 'figures':
      return <FiguresBodyView body={body} />;
    case 'prose':
      return <Prose body={body} />;
    case 'newsGrid':
      return <NewsGrid limit={body.limit} locale={locale} level={level} />;
    case 'slider':
      return <Slider body={body} level={level} />;
    case 'defs':
      return <Defs body={body} level={level} />;
    case 'specList':
      return <SpecList body={body} />;
    case 'overviewSplit':
      return <OverviewSplit body={body} level={level} />;
    case 'logos':
      return <Logos body={body} locale={locale} />;
    case 'certs':
      return <Certs body={body} />;
    case 'companies':
      return <Companies body={body} locale={locale} level={level} />;
    case 'map':
      return <MapEmbed body={body} />;
    case 'form':
      return <ContactForm body={body} locale={locale} honeypotLabel={ui(locale).honeypot} />;
    default:
      return assertNever(body);
  }
}

function FiguresBodyView({ body }: { body: FiguresBody }) {
  return <Figures items={body.items} style={body.style} />;
}

export { parseStyle };
