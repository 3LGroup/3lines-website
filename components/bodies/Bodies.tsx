import Arrow from '../Arrow';
import Svg from '../Svg';
import NewsGrid from '../NewsGrid';
import ContactForm from '../ContactForm';
import { localePath, type Locale } from '@/lib/i18n';
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

/** `--img` is a real custom property in the source; pass it through untouched. */
const imgStyle = (imgVar?: string, extra?: React.CSSProperties): React.CSSProperties | undefined => {
  if (!imgVar && !extra) return undefined;
  return { ...(imgVar ? ({ ['--img']: imgVar } as React.CSSProperties) : null), ...extra };
};

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
            <span data-count={f.count} data-suffix={f.suffix}>
              0
            </span>
          </div>
          <div className="figure__lab">{f.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- renderers -- */

function Tiles({ body, locale }: { body: TilesBody; locale: Locale }) {
  return (
    <div className="tiles3">
      {body.items.map((t, i) => (
        <a className="tile reveal" key={i} style={imgStyle(t.imgVar)} href={localePath(locale, t.href)}>
          {/* direct child: `.tile > svg` in the source CSS depends on it */}
          <Svg node={t.art} />
          <div className="tile__body">
            <h3>{t.title}</h3>
            <span className="go">
              Discover <Arrow />
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}

function Cards({ body, locale }: { body: CardsBody; locale: Locale }) {
  return (
    <>
      <div className="cards3">
        {body.items.map((c, i) => (
          <div className="pcard reveal" key={i} id={c.id}>
            <div className="pcard__media" style={imgStyle(c.imgVar)}>
              <Svg node={c.art} />
            </div>
            <h3>{c.title}</h3>
            {c.text ? <p>{c.text}</p> : null}
            {c.link ? (
              <a className="arrowlink" href={localePath(locale, c.link.href)}>
                {c.link.label} <Arrow />
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

function Feature({ body, locale }: { body: FeatureBody; locale: Locale }) {
  return (
    <div className="feature">
      <div className="feature__media reveal" style={imgStyle(body.media.imgVar)}>
        <Svg node={body.media.art} />
      </div>
      <div className="reveal">
        {body.heading ? (
          <h3 className="h3" style={parseStyle(body.headingStyle)}>
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
function Slider({ body }: { body: SliderBody }) {
  return (
    <div className="heroslides" data-slider>
      {body.items.map((s, i) => (
        <div className={i === 0 ? 'heroslide is-on' : 'heroslide'} key={i} data-slide={i}>
          <h3>{s.heading}</h3>
          <p>{s.sub}</p>
        </div>
      ))}
      <div className="dots" role="tablist">
        {body.items.map((s, i) => (
          <button
            className="dot"
            key={i}
            type="button"
            role="tab"
            data-goto={i}
            aria-current={i === 0 ? 'true' : 'false'}
            aria-label={s.heading}
          />
        ))}
      </div>
    </div>
  );
}

/** Title + body cards with no media plate. */
function Defs({ body }: { body: DefsBody }) {
  return (
    <div className="defs" data-cols={body.columns}>
      {body.items.map((d, i) => (
        <div className="defcard reveal" key={i}>
          <h3>{d.title}</h3>
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
function OverviewSplit({ body }: { body: OverviewSplitBody }) {
  return (
    <div className="ovsplit reveal">
      <div className="ovsplit__main">
        {body.heading ? <h3 className="h3">{body.heading}</h3> : null}
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
function Companies({ body, locale }: { body: CompaniesBody; locale: Locale }) {
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
                src={c.logo.src}
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
            <h3>
              {c.name}
              {c.status ? <span className="sr-only"> — {c.status}</span> : null}
            </h3>
            <p>{c.tagline}</p>
            {c.link ? (
              c.external ? (
                <a className="arrowlink" href={c.link.href} target="_blank" rel="noreferrer noopener">
                  {c.link.label} <Arrow />
                </a>
              ) : (
                <a className="arrowlink" href={localePath(locale, c.link.href)}>
                  {c.link.label} <Arrow />
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
function MapEmbed({ body }: { body: MapBody }) {
  return (
    <div
      className="mapembed reveal"
      data-lat={body.lat}
      data-lng={body.lng}
      data-zoom={body.zoom ?? 16}
      data-title={body.placeName}
    >
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
}

function Logos({ body, locale }: { body: LogosBody; locale: Locale }) {
  const marquee = body.variant === 'marquee';

  const cell = (l: LogosBody['items'][number], key: string, ariaHidden?: boolean) => {
    const img = (
      <img
        src={l.media.src}
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
                  <img
                    src={l.media.src}
                    alt={l.media.alt}
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
          <img src={m.src} alt={m.alt} loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
}

/**
 * Exhaustive body renderer. Adding a kind to `SectionBody` without a case here
 * makes `assertNever` fail to typecheck, so nothing can fall through to text.
 */
export default function BodyRenderer({ body, locale }: { body: SectionBody; locale: Locale }) {
  switch (body.kind) {
    case 'tiles':
      return <Tiles body={body} locale={locale} />;
    case 'cards':
      return <Cards body={body} locale={locale} />;
    case 'feature':
      return <Feature body={body} locale={locale} />;
    case 'figures':
      return <FiguresBodyView body={body} />;
    case 'prose':
      return <Prose body={body} />;
    case 'newsGrid':
      return <NewsGrid limit={body.limit} locale={locale} />;
    case 'slider':
      return <Slider body={body} />;
    case 'defs':
      return <Defs body={body} />;
    case 'specList':
      return <SpecList body={body} />;
    case 'overviewSplit':
      return <OverviewSplit body={body} />;
    case 'logos':
      return <Logos body={body} locale={locale} />;
    case 'certs':
      return <Certs body={body} />;
    case 'companies':
      return <Companies body={body} locale={locale} />;
    case 'map':
      return <MapEmbed body={body} />;
    case 'form':
      return <ContactForm body={body} locale={locale} />;
    default:
      return assertNever(body);
  }
}

function FiguresBodyView({ body }: { body: FiguresBody }) {
  return <Figures items={body.items} style={body.style} />;
}

export { parseStyle };
