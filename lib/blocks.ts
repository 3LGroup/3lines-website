/**
 * Block schema for the ingested site content.
 *
 * The source is a hand-authored static site. Every type here maps 1:1 onto a
 * structure that actually exists in the source DOM — nothing is invented and
 * nothing is flattened. Bespoke inline SVG artwork is carried verbatim in `art`
 * fields so that per-section illustration is never lost to a generic renderer.
 *
 * Contract enforced by scripts/audit-blocks.mjs:
 *   DATA -> SCHEMA -> RENDERER, with no silent fallthrough.
 */

/**
 * Inline SVG artwork, captured as an element tree rather than a raw string.
 *
 * This matters structurally: the source CSS hides decorative artwork with child
 * combinators (`.careers > svg.bg`, `.tile > svg`). Injecting the SVG through a
 * wrapper element would break that relationship and let hidden artwork render in
 * flow, so the artwork must be emitted as a genuine direct child.
 */
export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
}

/** Background treatment of a <section>. Maps to the source class list. */
export type Tone = 'plain' | 'mist' | 'navy';

export const TONE_CLASS: Record<Tone, string> = {
  plain: 'section',
  mist: 'section section--mist',
  navy: 'section section--navy',
};

export interface Link {
  label: string;
  href: string;
}

export interface Crumb {
  label: string;
  href?: string;
}

/** A count-up statistic. `count`/`suffix` mirror the source data-* attributes. */
export interface Figure {
  count: number;
  /** Leading glyph, e.g. the "+" in "+120". Distinct from `suffix`. */
  prefix?: string;
  suffix?: string;
  label: string;
}

/** Heading area of a section. `split` renders the .sec-head two-column variant. */
export interface SectionHead {
  layout: 'stacked' | 'split';
  kicker?: string;
  heading?: string;
  headingStyle?: string;
  lede?: string;
  ledeStyle?: string;
  /** Trailing .arrowlink, only present in the `split` layout. */
  link?: Link;
}

export interface Tile {
  title: string;
  href: string;
  /** Value of the --img custom property on the source element. */
  imgVar?: string;
  /** Inline SVG artwork, as an element tree. */
  art: SvgNode | null;
}

export interface PCard {
  id?: string;
  title: string;
  text?: string;
  link?: Link;
  imgVar?: string;
  art: SvgNode | null;
}

export interface ProseParagraph {
  text: string;
  style?: string;
}

/* ---------------------------------------------------------------- bodies -- */

export interface TilesBody {
  kind: 'tiles';
  items: Tile[];
}

export interface CardsBody {
  kind: 'cards';
  items: PCard[];
  /** Optional button rendered after the grid (e.g. the Cyber section). */
  cta?: Link;
  ctaVariant?: 'wire' | 'blue' | 'onDark';
  /**
   * Inline style of the wrapper div around the CTA. The source sets a different
   * clamp() per instance, so this must be carried, never assumed.
   */
  ctaWrapStyle?: string;
}

export interface FeatureBody {
  kind: 'feature';
  media: { imgVar?: string; art: SvgNode | null };
  heading?: string;
  headingStyle?: string;
  lede?: string;
  ledeStyle?: string;
  link?: Link;
  figures?: Figure[];
  /** Ticked list beside the media, as the reference's photo-split band uses. */
  checklist?: { title: string; text?: string }[];
  cta?: Link;
  ctaVariant?: 'wire' | 'blue' | 'onDark';
  ctaWrapStyle?: string;
}

export interface FiguresBody {
  kind: 'figures';
  items: Figure[];
  style?: string;
}

export interface ProseBody {
  kind: 'prose';
  paragraphs: ProseParagraph[];
}

/** News card grid. `limit` mirrors the source data-limit. */
export interface NewsGridBody {
  kind: 'newsGrid';
  limit?: number;
}

/* ------------------------------------------------- 3Lines content bodies -- *
 * Class names below deliberately match selectors that 3lines.css already themes
 * (.heroslides / .speclist / .logos / .certs / .field). Matching them means the
 * theme layer re-skins these components for free and only layout is new.
 */

/** A referenced asset. `src` is always root-absolute and verified at ingest. */
export interface Media {
  src: string;
  alt: string;
  /**
   * Some partner marks are drawn fill="white" for the source's dark theme and
   * are invisible on this clone's light surfaces. Recorded by reading the file
   * at ingest rather than guessed in CSS.
   */
  invert?: boolean;
}

/** The "Why 3Lines" carousel. Not CMS-backed — see scripts/extract-non-cms.mjs. */
export interface SliderBody {
  kind: 'slider';
  /** The eyebrow shown once for the whole slider, not per slide. */
  label?: string;
  items: { heading: string; sub: string }[];
}

/**
 * Title + body card with no media slot. Distinct from PCard, which always paints
 * a .pcard__media plate: service capabilities, About pillars, core values,
 * certification facts and contact details have no imagery, and rendering them as
 * PCards would emit empty photo plates.
 */
export interface DefCard {
  title: string;
  text?: string;
  /** Parsed from the source's inline <b>label</b> value pairs. */
  meta?: { label: string; value: string }[];
}

export interface DefsBody {
  kind: 'defs';
  /** Source grid width: pillars and capabilities are 3-up, cert facts are 2-up. */
  columns: 2 | 3;
  items: DefCard[];
}

/** The service "at a glance" strip: four bare facts, no number, no body copy. */
export interface SpecListBody {
  kind: 'specList';
  items: string[];
}

/**
 * Service overview: a wide prose column beside a narrow "at a glance" card.
 *
 * These are one band in the reference, not two stacked sections — rendering
 * them full-width one after the other is what made the detail pages feel
 * stretched and empty.
 */
export interface OverviewSplitBody {
  kind: 'overviewSplit';
  heading?: string;
  lede?: string;
  glanceTitle?: string;
  glance: string[];
}

export interface LogoItem {
  name: string;
  media: Media;
  /** Many partners have no website in the source; those items are not links. */
  href?: string;
  caption?: string;
  /** Relationship type — Agreement / Client / Partner, localized. */
  type?: string;
  /** Country name, localized, plus its flag as an emoji. */
  country?: string;
  flag?: string;
}

export interface LogosBody {
  kind: 'logos';
  items: LogoItem[];
  /**
   * `marquee` is the reference site's horizontally scrolling strip with edge
   * fades; `grid` is the full wall used on the partners page.
   */
  variant?: 'grid' | 'marquee';
  /** Present when this is a capped teaser rather than the full set. */
  more?: Link;
  /** Total available, when `items` is a teaser — so the cap is never silent. */
  total?: number;
}

/** Certification plates. The alt text *is* the certification claim. */
export interface CertsBody {
  kind: 'certs';
  items: Media[];
}

/**
 * One of the group's operating companies.
 *
 * Deliberately not a PCard: a company carries a brand mark, an off-site
 * destination and a pre-launch status that PCard has no slot for, and PCard
 * always paints a `.pcard__media` plate — the same reason DefCard exists
 * separately above.
 */
export interface CompanyCard {
  id?: string;
  name: string;
  tagline: string;
  /** Brand mark, shown in place of photography when the company has one. */
  logo?: Media;
  /**
   * Representative photography, as the `--img` custom property. Painted as a
   * background and left undescribed on purpose: the company name sits in the
   * heading beside it, so the image is decorative.
   */
  imgVar?: string;
  link?: Link;
  /** Off-site destination: rendered target=_blank with a noopener rel. */
  external?: boolean;
  /** Pre-launch marker, e.g. "Soon!". Such a company has no link. */
  status?: string;
}

export interface CompaniesBody {
  kind: 'companies';
  items: CompanyCard[];
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'tel' | 'textarea';
  label: string;
  placeholder?: string;
  required: boolean;
}

export interface FormBody {
  kind: 'form';
  action: string;
  fields: FormField[];
  submit: string;
  /** Localized status strings, carried as data rather than invented in the UI. */
  status: { sending: string; ok: string; bad: string; err: string };
  /** Honeypot field name; the submit handler rejects when it is filled. */
  honeypot: string;
}

export type SectionBody =
  | TilesBody
  | CardsBody
  | FeatureBody
  | FiguresBody
  | ProseBody
  | NewsGridBody
  | SliderBody
  | DefsBody
  | SpecListBody
  | OverviewSplitBody
  | LogosBody
  | CertsBody
  | CompaniesBody
  | FormBody;

export type SectionBodyKind = SectionBody['kind'];

export const SECTION_BODY_KINDS: SectionBodyKind[] = [
  'tiles',
  'cards',
  'feature',
  'figures',
  'prose',
  'newsGrid',
  'slider',
  'defs',
  'specList',
  'overviewSplit',
  'logos',
  'certs',
  'companies',
  'form',
];

/* ----------------------------------------------------------- top-level -- */

export interface HeroBlock {
  type: 'hero';
  imgVar?: string;
  /** Heading split on <br>, preserved so the source line breaks survive. */
  headingLines: string[];
  body?: string;
  /**
   * Words cycled between the heading lines. Carried as data because the Arabic
   * set is materially wider than the English one, so the space reserved for it
   * has to be derived per locale rather than hardcoded.
   */
  rotate?: string[];
  cta?: Link;
}

export interface PageTitleBlock {
  type: 'pageTitle';
  crumbs: Crumb[];
  heading: string;
}

export interface SectionBlock {
  type: 'section';
  tone: Tone;
  id?: string;
  head?: SectionHead;
  /** Ordered list — a section may hold e.g. prose followed by figures. */
  bodies: SectionBody[];
}

export interface CareersBlock {
  type: 'careers';
  imgVar?: string;
  art: SvgNode | null;
  heading: string;
  cta: Link;
}

/** Trailing social row. Sits inside <main> on every source page. */
export interface SocialStripBlock {
  type: 'socialStrip';
  label: string;
  items: { label: string; href: string; icon: SvgNode | null }[];
}

export type Block =
  | HeroBlock
  | PageTitleBlock
  | SectionBlock
  | CareersBlock
  | SocialStripBlock;

export type BlockType = Block['type'];

export const BLOCK_TYPES: BlockType[] = [
  'hero',
  'pageTitle',
  'section',
  'careers',
  'socialStrip',
];

/* ------------------------------------------------------------- document -- */

/** English and Arabic. The source also has ja/ko; those are out of scope. */
export type Locale = 'en' | 'ar';

export const LOCALES: Locale[] = ['en', 'ar'];

export const DIR: Record<Locale, 'ltr' | 'rtl'> = { en: 'ltr', ar: 'rtl' };

export interface PageDoc {
  /**
   * Locale-less route id, e.g. "/" or "/services/simulation-systems".
   * The locale prefix is applied at render time, which makes it structurally
   * impossible for the Arabic tree to link into the English one.
   */
  route: string;
  locale: Locale;
  /** Filesystem-safe key, e.g. "services--simulation-systems". */
  slug: string;
  /** Source records this document was built from, so the audit can trace back. */
  source: string[];
  title: string;
  description: string;
  keywords?: string;
  /**
   * True when the source body is placeholder text rather than real copy.
   * Surfaced by the audit so an empty page cannot reach production unnoticed.
   */
  placeholder?: boolean;
  blocks: Block[];
}

/**
 * Compile-time exhaustiveness guard. Adding a block or body kind without a
 * renderer makes the corresponding `switch` fail to typecheck here.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
