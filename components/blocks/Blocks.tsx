import React from 'react';
import Arrow from '../Arrow';
import Svg from '../Svg';
import BodyRenderer, { parseStyle } from '../bodies/Bodies';
import { localePath, type Locale } from '@/lib/i18n';
import { getSettings } from '@/lib/content';
import { ui } from '@/lib/ui';
import { assertNever, TONE_CLASS } from '@/lib/blocks';
import type {
  Block,
  CareersBlock,
  HeroBlock,
  PageTitleBlock,
  SectionBlock,
  SocialStripBlock,
} from '@/lib/blocks';

const imgStyle = (imgVar?: string): React.CSSProperties | undefined =>
  imgVar ? ({ ['--img']: imgVar } as React.CSSProperties) : undefined;

function Hero({ block, locale }: { block: HeroBlock; locale: Locale }) {
  return (
    <section className="hero" style={imgStyle(block.imgVar)}>
      <div className="wrap hero__inner">
        <h1>
          {block.headingLines[0]}
          {block.rotate?.length ? (
            <>
              {' '}
              {/* main.js cycles `is-on`; the first word is on so the sentence
                  reads correctly with JavaScript disabled. `--rotw` reserves
                  the widest word's width so the line never reflows. */}
              <span
                className="rotator"
                style={
                  {
                    ['--rotw']: `${Math.max(...block.rotate.map((w) => w.length))}ch`,
                  } as React.CSSProperties
                }
              >
                {block.rotate.map((w, i) => (
                  <span key={i} className={i === 0 ? 'is-on' : undefined}>
                    {w}
                  </span>
                ))}
              </span>{' '}
            </>
          ) : null}
          {block.headingLines.slice(1).map((line, i) => (
            <React.Fragment key={i}>{line}</React.Fragment>
          ))}
        </h1>
        {block.body ? <p>{block.body}</p> : null}
        {block.cta ? (
          <a className="btn btn--onDark" href={localePath(locale, block.cta.href)}>
            {block.cta.label} <Arrow />
          </a>
        ) : null}
      </div>
    </section>
  );
}

function PageTitle({ block, locale }: { block: PageTitleBlock; locale: Locale }) {
  return (
    <section className="pagehead">
      <div className="wrap">
        <nav className="crumbs" aria-label={ui(locale).breadcrumb}>
          {block.crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <span>/</span> : null}
              {c.href ? <a href={localePath(locale, c.href)}>{c.label}</a> : <span>{c.label}</span>}
            </React.Fragment>
          ))}
        </nav>
        <h1>{block.heading}</h1>
      </div>
    </section>
  );
}

function Section({ block, locale }: { block: SectionBlock; locale: Locale }) {
  const head = block.head;
  const split = head?.layout === 'split';

  return (
    <section className={TONE_CLASS[block.tone]} id={block.id}>
      <div className="wrap">
        {head ? (
          split ? (
            <div className="sec-head">
              <div>
                {head.kicker ? <p className="kicker reveal">{head.kicker}</p> : null}
                {head.heading ? (
                  <h2 className="h2 reveal" style={parseStyle(head.headingStyle)}>
                    {head.heading}
                  </h2>
                ) : null}
                {head.lede ? (
                  <p className="lede reveal" style={parseStyle(head.ledeStyle)}>
                    {head.lede}
                  </p>
                ) : null}
              </div>
              {head.link ? (
                <a className="arrowlink reveal" href={localePath(locale, head.link.href)}>
                  {head.link.label} <Arrow />
                </a>
              ) : null}
            </div>
          ) : (
            <>
              {head.kicker ? <p className="kicker reveal">{head.kicker}</p> : null}
              {head.heading ? (
                <h2 className="h2 reveal" style={parseStyle(head.headingStyle)}>
                  {head.heading}
                </h2>
              ) : null}
              {head.lede ? (
                <p className="lede reveal" style={parseStyle(head.ledeStyle)}>
                  {head.lede}
                </p>
              ) : null}
            </>
          )
        ) : null}

        {block.bodies.map((body, i) => (
          <BodyRenderer body={body} locale={locale} key={i} />
        ))}
      </div>
    </section>
  );
}

function Careers({ block, locale }: { block: CareersBlock; locale: Locale }) {
  return (
    <section className="careers" style={imgStyle(block.imgVar)}>
      {/* direct child: `.careers > svg.bg` in the source CSS depends on it */}
      <Svg node={block.art} />
      <div className="wrap">
        <h2 className="reveal">{block.heading}</h2>
        <a className="btn btn--onDark reveal" href={localePath(locale, block.cta.href)}>
          {block.cta.label} <Arrow />
        </a>
      </div>
    </section>
  );
}

/**
 * Network glyphs for social links the source carries as a bare href.
 *
 * The ingest records `icon: null` for these because the reference markup has no
 * inline SVG to lift — which left `.socialstrip a` as an empty 44px circle
 * above every footer. Authored chrome, like the theme toggle and the mega
 * menu's close button, so it belongs here; carried data still wins when a
 * document actually has an icon.
 */
const SOCIAL_GLYPHS: Record<string, React.ReactElement> = {
  email: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 2v.5l-8 5-8-5V6h16zM4 18V8.9l7.47 4.67a1 1 0 0 0 1.06 0L20 8.9V18H4z" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.03-.24c1.12.37 2.33.57 3.56.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.4 21 3 13.6 3 4.5a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.44.57 3.56a1 1 0 0 1-.25 1.03l-2.2 2.2z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.69 8.23-8.23 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.14.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.17 1.71 2.6 4.14 3.65.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.05.14-1.16-.06-.11-.22-.17-.47-.29z" />
    </svg>
  ),
  /* The bare "in", not the boxed mark. The boxed version fills its whole 24x24
     as a solid tile, so beside the open envelope and handset it read as a heavy
     block and broke the row's rhythm. LinkedIn's brand guidance prefers the
     enclosed logo when it stands alone; in a monochrome utility row like this
     one, a matched-weight glyph is the normal treatment. */
  linkedin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.94 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 8.48H3V21h4V8.48zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-3.96 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91V8.48z" />
    </svg>
  ),
  maps: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
    </svg>
  ),
};

/* Keyed on `network` where present, falling back to the label so anything that
   predates that field keeps its glyph. Lower-cased because the fallback label
   is human copy. */
const socialGlyph = (network: string | undefined, label: string) =>
  SOCIAL_GLYPHS[(network ?? label).trim().toLowerCase()] ?? null;

/**
 * Resolve a social item's destination from Site info.
 *
 * The strip's hrefs used to be frozen into every page document at ingest — the
 * same mailto:/tel:/maps URL duplicated across ~15 pages, none of them editable.
 * Deriving them from settings at render makes "change the phone number once in
 * Site info" true everywhere at once. The stored href stays as the fallback for
 * an item whose network has no setting to derive from.
 *
 * A lookup map, not a switch: audit-content reads every quoted case label in
 * this file as a block kind the renderer claims to handle.
 */
type Settings = ReturnType<typeof getSettings>;

const SOCIAL_HREFS: Record<string, (s: Settings) => string | null> = {
  email: (s) => (s.email ? `mailto:${s.email}` : null),
  phone: (s) => (s.phone ? `tel:${s.phone}` : null),
  whatsapp: (s) => (s.whatsapp ? `https://wa.me/${s.whatsapp.replace(/\D/g, '')}` : null),
  linkedin: (s) => s.linkedIn ?? null,
  maps: (s) =>
    s.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`
      : null,
};

const socialHref = (settings: Settings, network: string | undefined, fallback: string): string =>
  (network ? SOCIAL_HREFS[network]?.(settings) : null) ?? fallback;

function SocialStrip({ block, locale }: { block: SocialStripBlock; locale: Locale }) {
  const settings = getSettings();

  /* Filling in the WhatsApp number under Site info makes the icon appear with
     no content change — the gating rule the importer preserves by migrating the
     null. The item is appended beside the phone because the shipped documents
     predate the setting and cannot carry it themselves. */
  const items = [...block.items];
  if (settings.whatsapp && !items.some((s) => s.network === 'whatsapp')) {
    const at = items.findIndex((s) => s.network === 'phone');
    items.splice(at === -1 ? items.length : at + 1, 0, {
      network: 'whatsapp',
      label: ui(locale).whatsapp,
      href: `https://wa.me/${settings.whatsapp.replace(/\D/g, '')}`,
      icon: null,
    });
  }

  return (
    <div className="wrap">
      <div className="socialstrip">
        <span>{block.label}</span>
        {items.map((s, i) => (
          <a key={i} href={localePath(locale, socialHref(settings, s.network, s.href))} aria-label={s.label}>
            {s.icon ? <Svg node={s.icon} /> : socialGlyph(s.network, s.label)}
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Exhaustive top-level renderer. A new `Block` variant without a case here is a
 * typecheck failure at `assertNever`, not a silent degradation at runtime.
 */
export default function BlockRenderer({ block, locale }: { block: Block; locale: Locale }) {
  switch (block.type) {
    case 'hero':
      return <Hero block={block} locale={locale} />;
    case 'pageTitle':
      return <PageTitle block={block} locale={locale} />;
    case 'section':
      return <Section block={block} locale={locale} />;
    case 'careers':
      return <Careers block={block} locale={locale} />;
    case 'socialStrip':
      return <SocialStrip block={block} locale={locale} />;
    default:
      return assertNever(block);
  }
}
