import React from 'react';
import Arrow from '../Arrow';
import Svg from '../Svg';
import BodyRenderer, { parseStyle } from '../bodies/Bodies';
import { localePath, type Locale } from '@/lib/i18n';
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
  linkedin: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.44-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zm1.78 13.02H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  ),
};

const socialGlyph = (label: string) => SOCIAL_GLYPHS[label.trim().toLowerCase()] ?? null;

function SocialStrip({ block, locale }: { block: SocialStripBlock; locale: Locale }) {
  return (
    <div className="wrap">
      <div className="socialstrip">
        <span>{block.label}</span>
        {block.items.map((s, i) => (
          <a key={i} href={localePath(locale, s.href)} aria-label={s.label}>
            {s.icon ? <Svg node={s.icon} /> : socialGlyph(s.label)}
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
