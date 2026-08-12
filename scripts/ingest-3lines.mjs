/**
 * Build the bilingual block documents from the 3Lines content sources.
 *
 * Strict by design, in the same spirit as the HTML ingest it replaces: unknown
 * shapes abort the run rather than degrading into a text blob, media that does
 * not exist on disk aborts, and hard counts are asserted before anything is
 * written. Placeholder bodies are flagged, not hidden.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'source-content');
const OUT = path.join(ROOT, 'content');
const PUBLIC = path.join(ROOT, 'public');

const LOCALES = ['en', 'ar'];

const problems = [];
const fail = (m) => problems.push(m);

const read = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

const services = read('services.json');
const pages = read('pages.json').data;
const posts = read('posts.json').data;
const partners = read('partners.json').data;
const siteInfo = read('siteInfo.json');
const constants = read('constants.json').data;
const details = read('service-details.json');
const nonCms = read('non-cms.json');
const companiesSrc = read('companies.json');

/* ------------------------------------------------------------- helpers -- */

/** Localized pick with an explicit English fallback (the source's own rule). */
function L(obj, locale, where) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  const v = obj[locale];
  if (v != null && String(v).trim()) return String(v);
  if (locale !== 'en' && obj.en) return String(obj.en);
  if (where) fail(`${where}: no value for locale "${locale}"`);
  return '';
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * One rule for both media path shapes in the source: some fields carry a
 * leading slash, some do not, and enhance.js adds a cache-busting query.
 * File existence is part of ingestion, so a broken image can never render.
 */
function media(uri, alt, where) {
  if (!uri) return fail(`${where}: missing media path`), null;
  if (/^[a-z]+:/i.test(uri)) return fail(`${where}: unexpected absolute URL "${uri}"`), null;

  const rel = String(uri).trim().split('?')[0].replace(/^\.?\//, '');
  if (!rel.startsWith('assets/')) return fail(`${where}: unexpected media path "${uri}"`), null;

  const src = '/' + rel;
  if (!fs.existsSync(path.join(PUBLIC, rel))) return fail(`${where}: media not on disk — ${src}`), null;

  const out = { src, alt: clean(alt) || '' };
  // Some marks are drawn fill="white" for a dark theme and vanish on this
  // clone's light surfaces. Detected by reading the file, not guessed in CSS.
  if (rel.endsWith('.svg')) {
    const svg = fs.readFileSync(path.join(PUBLIC, rel), 'utf8');
    if (/fill="(white|#fff|#ffffff)"/i.test(svg) && !/fill="(?!white|#fff)/i.test(svg)) out.invert = true;
  }
  return out;
}

const imgVar = (m) => (m ? `url('${m.src}')` : undefined);

/** Plain-text bodies use \n\n paragraph breaks; they are not HTML. */
function paragraphs(text) {
  return String(text ?? '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => clean(p))
    .filter(Boolean);
}

/** "+120" -> { count: 120, prefix: "+" } */
function figure(value, label) {
  const m = String(value).match(/^([^\d]*)(\d[\d,.]*)(.*)$/);
  if (!m) return fail(`stat "${value}" is not a number`), null;
  return {
    count: Number(m[2].replace(/,/g, '')),
    prefix: m[1] || undefined,
    suffix: m[3] || undefined,
    label: clean(label),
  };
}

const LBL = nonCms.labelTables?.LBL ?? {};
const lbl = (key, locale) => L(LBL[key], locale) || '';

/**
 * Breadcrumb root label.
 *
 * The source has no "Home" string to lift — this is the only UI string in the
 * whole migration that is authored here rather than taken from the source.
 * "الرئيسية" is the standard, unambiguous Arabic term for a site's home page.
 */
const home = (locale) => L({ en: 'Home', ar: 'الرئيسية' }, locale);

/**
 * Navigation label for the services area.
 *
 * The source's own label table only has "Capabilities" (LBL.caps), which is the
 * right word for the capability cards *inside* a service page but wrong as a
 * top-level nav item — the reference site's nav says "Services". Authored here,
 * like the "Home" breadcrumb; "الخدمات" is the standard Arabic term.
 */
const servicesLabel = (locale) => L({ en: 'Services', ar: 'الخدمات' }, locale);

/**
 * Navigation label for the partners area.
 *
 * `SECTIONS.partners` is "Trusted by" — an eyebrow, not a nav label. It reads
 * wrong in the header and footer, where a destination name is expected. Keep
 * "Trusted by" for the section eyebrow and use this for navigation and the page
 * title; "الشركاء" is the standard Arabic term.
 */
const partnersLabel = (locale) => L({ en: 'Partners', ar: 'الشركاء' }, locale);

/** ISO-3166 alpha-2 -> flag emoji, via regional indicator code points. */
function flagOf(code) {
  if (!code || code.length !== 2) return undefined;
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/* ---------------------------------------------------- shared components -- */

const ctaBand = (locale) => ({
  type: 'careers',
  imgVar: imgVar({ src: '/assets/photos/hero-mro.jpg' }),
  art: null,
  heading: L(nonCms.labelTables?.CTA, locale) || '',
  cta: { label: lbl('cta', locale), href: '/contact' },
});

const socialStrip = (locale) => ({
  type: 'socialStrip',
  label: L(constants.name_en ? { en: constants.name_en, ar: constants.name_ar } : null, locale),
  items: [
    {
      label: 'LinkedIn',
      href: siteInfo.linkedIn || constants.linkedin || '#',
      icon: null,
    },
  ],
});

/* ------------------------------------------------------------- builders -- */

function serviceCards(locale, limit) {
  const list = limit ? services.slice(0, limit) : services;
  return {
    kind: 'cards',
    items: list.map((s) => {
      const d = details[s.slug];
      if (!d) fail(`service "${s.slug}" has no entry in service-details.json`);
      return {
        title: L(s.title, locale, `service ${s.slug} title`),
        text: L(s.description, locale, `service ${s.slug} description`),
        link: { label: lbl('over', locale), href: `/services/${s.slug}` },
        imgVar: imgVar(d?.img ? media(d.img.src, d.img.alt, `service ${s.slug} img`) : null),
        art: null,
      };
    }),
  };
}

/**
 * The group's four operating companies.
 *
 * Asserted at four rather than mapped blindly: this is a fixed corporate fact,
 * so a source file that silently gains or loses one should stop the build the
 * same way a missing service detail does.
 */
function companiesBody(locale) {
  const items = companiesSrc.items ?? [];
  if (items.length !== 4) fail(`companies.json: expected 4 companies, found ${items.length}`);

  const learnMore = L(companiesSrc.learnMore, locale, 'companies.learnMore');

  return {
    kind: 'companies',
    items: items.map((c) => {
      const name = L(c.name, locale, `company ${c.id} name`);
      // A pre-launch company has no destination; every other one must have one.
      const linked = Boolean(c.href);
      if (!linked && !c.status) fail(`company ${c.id}: no href and no status`);

      return {
        id: c.id,
        name,
        tagline: L(c.tagline, locale, `company ${c.id} tagline`),
        logo: c.logo ? media(c.logo, L(c.alt, locale) || name, `company ${c.id} logo`) : undefined,
        imgVar: imgVar(c.photo ? media(c.photo, name, `company ${c.id} photo`) : null),
        link: linked ? { label: learnMore, href: c.href } : undefined,
        external: c.external || undefined,
        status: c.status ? L(c.status, locale, `company ${c.id} status`) : undefined,
      };
    }),
  };
}

function buildHome(locale) {
  const frame = nonCms.heroFrame?.copy?.[locale] ?? {};
  const rotate = nonCms.heroRotatingWords?.[locale] ?? [];

  return {
    route: '/',
    locale,
    slug: 'index',
    source: ['constants.json', 'siteInfo.json', 'services.json', 'posts.json', 'non-cms.json', 'companies.json'],
    title: L({ en: constants.name_en, ar: constants.name_ar }, locale),
    description: L(siteInfo.companyDescription, locale, 'siteInfo.companyDescription'),
    keywords: constants.keywords,
    blocks: [
      {
        type: 'hero',
        imgVar: imgVar({ src: '/assets/photos/hero-mro.jpg' }),
        headingLines: [frame.we_provide, frame.globally].filter(Boolean),
        rotate,
        body: L(siteInfo.companyDescription, locale),
        cta: { label: frame.who_we_are || '', href: '/about' },
      },
      // "At a glance" band — the reference opens with a figures strip under the
      // hero before any prose. Same four figures the About page uses.
      {
        type: 'section',
        tone: 'plain',
        bodies: [
          {
            kind: 'figures',
            items: (nonCms.aboutStats?.[locale] ?? []).map((s) => figure(s.value, s.label)).filter(Boolean),
          },
        ],
      },
      // "About info" band — the three core pillars, which the reference shows on
      // the landing page before the slider. Previously this only existed on /about.
      {
        type: 'section',
        tone: 'mist',
        head: {
          layout: 'split',
          kicker: lbl('eye', locale),
          heading: L(nonCms.labelTables?.HEAD, locale),
          link: { label: L(nonCms.labelTables?.NAV?.about, locale), href: '/about' },
        },
        bodies: [
          {
            kind: 'defs',
            columns: 3,
            items: (nonCms.about?.[locale]?.pillars ?? []).map((p) => ({ title: p.title, text: p.body })),
          },
        ],
      },
      // The group's companies, directly below the About band — the position the
      // source site gives them. `plain` because the band above is mist and the
      // slider below is navy; anything else puts two like tones side by side.
      {
        type: 'section',
        tone: 'plain',
        id: 'companies',
        head: {
          layout: 'split',
          kicker: L(companiesSrc.head?.kicker, locale, 'companies.head.kicker'),
          heading: L(companiesSrc.head?.heading, locale, 'companies.head.heading'),
        },
        bodies: [companiesBody(locale)],
      },
      {
        type: 'section',
        tone: 'navy',
        head: { layout: 'stacked', kicker: L(nonCms.labelTables?.EYE, locale) },
        bodies: [{ kind: 'slider', items: nonCms.whyThreeLinesSlider.map((s) => ({
          heading: L(s.heading, locale),
          sub: L(s.sub, locale),
        })) }],
      },
      {
        type: 'section',
        tone: 'plain',
        id: 'services',
        head: {
          layout: 'split',
          kicker: lbl('eye', locale),
          heading: lbl('wwd', locale),
          link: { label: servicesLabel(locale), href: '/services' },
        },
        bodies: [serviceCards(locale)],
      },
      {
        type: 'section',
        tone: 'mist',
        head: {
          layout: 'split',
          kicker: L(nonCms.labelTables?.SECTIONS?.news, locale),
          heading: '',
          link: { label: L(nonCms.labelTables?.SECTIONS?.news, locale), href: '/news' },
        },
        bodies: [{ kind: 'newsGrid', limit: 3 }],
      },
      {
        type: 'section',
        tone: 'plain',
        head: {
          layout: 'split',
          kicker: L(nonCms.labelTables?.SECTIONS?.partners, locale),
          heading: '',
          link: { label: L(nonCms.labelTables?.SECTIONS?.partners, locale), href: '/partners' },
        },
        // Marquee, matching the reference's scrolling partner strip. No `more`
        // link: the section head already links to /partners, and carrying both
        // printed "Trusted by" three times in one band.
        bodies: [logosBody(locale, 18, undefined, 'marquee')],
      },
      ctaBand(locale),
      socialStrip(locale),
    ],
  };
}

function buildAbout(locale) {
  const a = nonCms.about[locale];
  const page = pages.find((p) => p.slug === 'about');
  const certs = nonCms.certifications;

  return {
    route: '/about',
    locale,
    slug: 'about',
    source: ['pages.json#about', 'non-cms.json'],
    title: L(page.title, locale),
    description: L(siteInfo.companyDescription, locale),
    keywords: page.keywords,
    blocks: [
      {
        type: 'pageTitle',
        crumbs: [{ label: home(locale), href: '/' }, { label: L(page.title, locale) }],
        heading: L(page.title, locale),
      },
      {
        type: 'section',
        tone: 'plain',
        bodies: [
          { kind: 'prose', paragraphs: paragraphs(L(page.body, locale)).map((text) => ({ text })) },
          {
            kind: 'figures',
            items: (nonCms.aboutStats?.[locale] ?? []).map((s) => figure(s.value, s.label)).filter(Boolean),
          },
        ],
      },
      // HQ photograph — the reference places an image between the intro and the
      // pillars. Without it the page is an unbroken wall of text.
      {
        type: 'section',
        tone: 'mist',
        head: { layout: 'stacked', kicker: lbl('eye', locale), heading: L(nonCms.labelTables?.HEAD, locale) },
        bodies: [
          {
            kind: 'feature',
            media: {
              imgVar: imgVar(media('/assets/photos/3l-hq-building.jpg', L(page.title, locale), 'about HQ photo')),
              art: null,
            },
            lede: a.pillars[0] ? a.pillars[0].body : undefined,
          },
          { kind: 'defs', columns: 3, items: a.pillars.map((p) => ({ title: p.title, text: p.body })) },
        ],
      },
      // Our Vision, on a dark band — it is the emotional centre of the page and
      // was previously indistinguishable from the surrounding body copy.
      {
        type: 'section',
        tone: 'navy',
        head: { layout: 'stacked', kicker: L({ en: 'Our Vision', ar: 'رؤيتنا' }, locale) },
        bodies: [{ kind: 'prose', paragraphs: a.vision.map((text) => ({ text })) }],
      },
      {
        type: 'section',
        tone: 'plain',
        bodies: [{ kind: 'defs', columns: 3, items: a.values.map((v) => ({ title: v.title, text: v.body })) }],
      },
      {
        type: 'section',
        tone: 'mist',
        id: 'certifications',
        head: {
          layout: 'stacked',
          kicker: certs.copy[locale].eyebrow,
          heading: certs.copy[locale].heading,
          lede: certs.copy[locale].lede,
        },
        bodies: [
          { kind: 'certs', items: certs.plates.map((p) => media(p.src, p.alt, 'certification plate')).filter(Boolean) },
          { kind: 'defs', columns: 2, items: certs.copy[locale].items },
        ],
      },
      ctaBand(locale),
      socialStrip(locale),
    ],
  };
}

function buildServicesIndex(locale) {
  const title = servicesLabel(locale);
  return {
    route: '/services',
    locale,
    slug: 'services',
    source: ['services.json'],
    title,
    description: L(siteInfo.companyDescription, locale),
    blocks: [
      {
        type: 'pageTitle',
        crumbs: [{ label: home(locale), href: '/' }, { label: title }],
        heading: title,
      },
      { type: 'section', tone: 'plain', bodies: [serviceCards(locale)] },
      ctaBand(locale),
      socialStrip(locale),
    ],
  };
}

function buildServiceDetail(service, locale) {
  const d = details[service.slug];
  const copy = d?.[locale] ?? d?.en;
  if (!copy) return fail(`service-details missing copy for ${service.slug}/${locale}`), null;

  const img = d.img ? media(d.img.src, d.img.alt, `service ${service.slug} img`) : null;

  return {
    route: `/services/${service.slug}`,
    locale,
    slug: `services--${service.slug}`,
    source: ['services.json', 'service-details.json'],
    title: L(service.title, locale),
    description: L(service.description, locale),
    blocks: [
      {
        type: 'pageTitle',
        crumbs: [
          { label: home(locale), href: '/' },
          { label: servicesLabel(locale), href: '/services' },
          { label: L(service.title, locale) },
        ],
        heading: L(service.title, locale),
      },
      // Overview and "at a glance" are ONE band in the reference: a wide prose
      // column beside a narrow card. Stacking them full-width made the page
      // feel stretched and empty.
      {
        type: 'section',
        tone: 'plain',
        head: { layout: 'stacked', kicker: lbl('over', locale) },
        bodies: [
          {
            kind: 'overviewSplit',
            heading: copy.oh,
            lede: copy.op,
            glanceTitle: lbl('glance', locale),
            glance: copy.glance,
          },
        ],
      },
      // Photo split — "How we deliver it": the service photograph beside a
      // ticked list of its first four capabilities.
      {
        type: 'section',
        tone: 'mist',
        bodies: [
          {
            kind: 'feature',
            media: { imgVar: imgVar(img), art: null },
            heading: L(nonCms.labelTables?.HEAD, locale),
            checklist: copy.caps.slice(0, 4).map((c) => ({ title: c.t, text: c.d })),
          },
        ],
      },
      {
        type: 'section',
        tone: 'plain',
        head: { layout: 'stacked', kicker: lbl('caps', locale) },
        bodies: [{ kind: 'defs', columns: 3, items: copy.caps.map((c) => ({ title: c.t, text: c.d })) }],
      },
      ctaBand(locale),
      socialStrip(locale),
    ],
  };
}

function buildNewsIndex(locale) {
  const title = L(nonCms.labelTables?.SECTIONS?.news, locale);
  return {
    route: '/news',
    locale,
    slug: 'news',
    source: ['posts.json'],
    title,
    description: L(siteInfo.companyDescription, locale),
    blocks: [
      { type: 'pageTitle', crumbs: [{ label: home(locale), href: '/' }, { label: title }], heading: title },
      { type: 'section', tone: 'plain', bodies: [{ kind: 'newsGrid' }] },
      ctaBand(locale),
      socialStrip(locale),
    ],
  };
}

function buildPost(post, locale) {
  const cover = media(post.cover?.uri, L(post.title, locale), `post ${post.slug} cover`);
  const date = String(post.publish_date).slice(0, 10);

  return {
    route: `/news/${post.slug}`,
    locale,
    slug: `news--${post.slug}`,
    source: ['posts.json'],
    title: L(post.title, locale),
    description: L(post.description, locale),
    blocks: [
      {
        type: 'pageTitle',
        crumbs: [
          { label: home(locale), href: '/' },
          { label: L(nonCms.labelTables?.SECTIONS?.news, locale), href: '/news' },
          { label: L(post.title, locale) },
        ],
        heading: L(post.title, locale),
      },
      {
        type: 'section',
        tone: 'plain',
        head: {
          layout: 'stacked',
          kicker: (post.tags ?? []).map((t) => L(t.name, locale)).filter(Boolean).join(' · ') || date,
        },
        bodies: [
          {
            kind: 'feature',
            media: { imgVar: imgVar(cover), art: null },
            lede: L(post.description, locale),
          },
        ],
      },
      ctaBand(locale),
      socialStrip(locale),
    ],
  };
}

function logosBody(locale, limit, more, variant) {
  const items = partners
    .map((p) => {
      const m = media(p.logo?.uri, L(p.name, locale) || p.logo?.original_name, `partner ${L(p.name, 'en')}`);
      if (!m) return null;
      return {
        name: L(p.name, locale),
        media: m,
        href: p.link || undefined,
        caption: L(p.description, locale) || undefined,
        type: L(p.type?.name, locale) || undefined,
        country: L(p.country?.name, locale) || undefined,
        flag: flagOf(p.country?.code),
      };
    })
    .filter(Boolean);

  const shown = limit ? items.slice(0, limit) : items;
  if (limit && items.length > limit)
    console.log(`  note: partners teaser capped at ${limit} of ${items.length} (full set on /partners)`);
  return {
    kind: 'logos',
    items: shown,
    variant: variant ?? 'grid',
    total: items.length,
    ...(more ? { more } : {}),
  };
}

function buildPartners(locale) {
  // The page is titled with the destination name, not the homepage eyebrow.
  const title = partnersLabel(locale);
  return {
    route: '/partners',
    locale,
    slug: 'partners',
    source: ['partners.json'],
    title,
    description: L(siteInfo.companyDescription, locale),
    blocks: [
      {
        type: 'pageTitle',
        crumbs: [{ label: home(locale), href: '/' }, { label: title }],
        heading: title,
      },
      { type: 'section', tone: 'plain', bodies: [logosBody(locale)] },
      ctaBand(locale),
      socialStrip(locale),
    ],
  };
}

function buildContact(locale) {
  const F = nonCms.labelTables?.F ?? {};
  const page = pages.find((p) => p.slug === 'contact');

  return {
    route: '/contact',
    locale,
    slug: 'contact',
    source: ['pages.json#contact', 'siteInfo.json', 'constants.json', 'non-cms.json'],
    title: L(page.title, locale),
    description: L(siteInfo.companyDescription, locale),
    keywords: page.keywords,
    blocks: [
      {
        type: 'pageTitle',
        crumbs: [{ label: home(locale), href: '/' }, { label: L(page.title, locale) }],
        heading: L(page.title, locale),
      },
      {
        type: 'section',
        tone: 'plain',
        bodies: [
          {
            kind: 'defs',
            columns: 2,
            items: [
              { title: L({ en: 'Email', ar: 'البريد الإلكتروني' }, locale), text: constants.email },
              { title: L({ en: 'Phone', ar: 'الهاتف' }, locale), text: constants.phone },
              { title: L({ en: 'Address', ar: 'العنوان' }, locale), text: siteInfo.address },
              {
                title: L({ en: 'Registration', ar: 'السجل التجاري' }, locale),
                text: '',
                meta: [
                  { label: 'CR', value: siteInfo.commercialRegNo },
                  { label: 'VAT', value: siteInfo.vatRegNo },
                ],
              },
            ],
          },
          {
            kind: 'form',
            action: '/api/contact',
            honeypot: 'company',
            submit: L(F.send, locale),
            fields: [
              { name: 'name', type: 'text', label: L(F.name, locale), required: true },
              { name: 'email', type: 'email', label: L(F.email, locale), required: true },
              { name: 'message', type: 'textarea', label: L(F.msg, locale), required: true },
            ],
            status: {
              sending: L(F.sending, locale),
              ok: L(F.ok, locale),
              bad: L(F.bad, locale),
              err: L(F.err, locale),
            },
          },
        ],
      },
      socialStrip(locale),
    ],
  };
}

/** Legal pages. Their source bodies are placeholders — flagged, not hidden. */
function buildLegal(page, locale) {
  const body = L(page.body, locale);
  const paras = paragraphs(body);

  // Locale-agnostic on purpose. Matching known English strings missed the
  // Arabic bodies and the one whose source contains an HTML entity — and a
  // guard that under-reports is worse than no guard. A legal document that
  // fits in a tweet is a placeholder in any language.
  const isPlaceholder = clean(body).length < 200;

  return {
    route: `/${page.slug}`,
    locale,
    slug: page.slug,
    source: [`pages.json#${page.slug}`],
    title: L(page.title, locale),
    description: clean(body).slice(0, 160),
    keywords: page.keywords,
    placeholder: isPlaceholder || undefined,
    blocks: [
      {
        type: 'pageTitle',
        crumbs: [{ label: home(locale), href: '/' }, { label: L(page.title, locale) }],
        heading: L(page.title, locale),
      },
      {
        type: 'section',
        tone: 'plain',
        bodies: [{ kind: 'prose', paragraphs: paras.map((text) => ({ text })) }],
      },
      socialStrip(locale),
    ],
  };
}

/* -------------------------------------------------------------- chrome -- */

/**
 * Header, mega menu and footer, generated per locale from real data.
 *
 * Every label here comes from the source (pages.json titles, the enhance.js
 * label tables, services.json) rather than being hand-authored — inventing
 * Arabic UI copy would be guesswork, and the source already has translations.
 */
function buildChrome(locale) {
  const NAV = nonCms.labelTables?.NAV ?? {};
  const SECTIONS = nonCms.labelTables?.SECTIONS ?? {};
  const pageTitle = (slug) => {
    const p = pages.find((x) => x.slug === slug);
    if (!p) return fail(`chrome: page "${slug}" not found`), '';
    return L(p.title, locale);
  };

  const servicesNav = servicesLabel(locale);
  const newsLabel = L(SECTIONS.news, locale);
  // Two different words on purpose: "Partners" is the destination name used in
  // navigation, "Trusted by" is the eyebrow above the section on the homepage.
  const partnersNav = partnersLabel(locale);
  const aboutLabel = L(NAV.about, locale);
  const contactLabel = L(NAV.contact, locale);

  const serviceLinks = services.map((s) => ({
    label: L(s.title, locale),
    href: `/services/${s.slug}`,
  }));

  const companyLinks = [
    { label: aboutLabel, href: '/about' },
    { label: newsLabel, href: '/news' },
    { label: partnersNav, href: '/partners' },
    { label: contactLabel, href: '/contact' },
  ];

  const legalLinks = LEGAL_SLUGS.map((slug) => ({ label: pageTitle(slug), href: `/${slug}` }));

  return {
    note: L({ en: '3Lines Advanced Technologies', ar: constants.name_ar }, locale),
    skip: { label: L({ en: 'Skip to main content', ar: 'تخطَّ إلى المحتوى' }, locale), href: '#main' },
    /**
     * The reference uses the compact circular mark in the header and the full
     * lockup only in the footer. Using the composite lockup in both is what made
     * the header show the monogram twice.
     */
    logoImg: {
      src: '/assets/logos/3Lines_logo.png',
      alt: L({ en: constants.name_en, ar: constants.name_ar }, locale),
    },
    footerLogoImg: {
      src: '/assets/logos/logo.png',
      alt: L({ en: constants.name_en, ar: constants.name_ar }, locale),
    },
    utility: {
      /**
       * The design's five utility slots, mapped onto the real 3Lines pages:
       *   Investors -> Home · Suppliers -> About · Journalists -> Services
       *   Candidates -> News · Worldwide -> Contact
       * Labels are the destination page names, taken from the source's own
       * label tables so the Arabic is not invented.
       */
      links: [
        { label: home(locale), href: '/' },
        { label: aboutLabel, href: '/about' },
        { label: servicesNav, href: '/services' },
        { label: newsLabel, href: '/news' },
        { label: contactLabel, href: '/contact' },
      ],
      // The source's EN/FR switch becomes the real EN/AR pair.
      lang: [
        { label: 'EN', locale: 'en', current: locale === 'en' || undefined },
        { label: 'AR', locale: 'ar', current: locale === 'ar' || undefined },
      ],
    },
    mega: {
      tabs: [
        { key: 'services', label: servicesNav },
        { key: 'company', label: L({ en: 'Company', ar: 'الشركة' }, locale) },
      ],
      panels: [
        {
          key: 'services',
          title: servicesNav,
          links: serviceLinks,
          cta: { label: servicesNav, href: '/services' },
        },
        {
          key: 'company',
          title: L({ en: 'Company', ar: 'الشركة' }, locale),
          links: companyLinks,
          cta: { label: aboutLabel, href: '/about' },
        },
      ],
    },
    footer: {
      columns: [
        { logo: true, title: L({ en: constants.name_en, ar: constants.name_ar }, locale), links: companyLinks },
        { title: servicesNav, links: serviceLinks },
        { title: L({ en: 'Legal', ar: 'قانوني' }, locale), links: legalLinks },
      ],
      bar: {
        // Deliberately empty: the Legal column above already carries these, and
        // rendering both printed every legal link twice in the footer.
        links: [],
        a11yLabel: `${siteInfo.address}`,
        a11yPill: `CR ${siteInfo.commercialRegNo} · VAT ${siteInfo.vatRegNo}`,
        copyright: `© ${siteInfo.copyrightYear} ${L({ en: constants.name_en, ar: constants.name_ar }, locale)}`,
      },
    },
  };
}

/* ------------------------------------------------------------------ run -- */

// Guard: the flattened pages.json service bodies must be a SUBSET of the
// structured service-details.json, otherwise preferring the structured source
// would drop copy.
for (const p of pages.filter((x) => x.type === 'services')) {
  const d = details[p.slug];
  if (!d) {
    fail(`pages.json service "${p.slug}" has no service-details entry`);
    continue;
  }
  for (const locale of LOCALES) {
    const body = clean(L(p.body, locale)).replace(/\s/g, '');
    const c = d[locale] ?? d.en;
    for (const [field, value] of [['oh', c.oh], ['op', c.op]]) {
      if (value && !body.includes(clean(value).replace(/\s/g, '')))
        fail(`${p.slug}/${locale}: pages.json body holds copy missing from service-details (${field})`);
    }
  }
}

const LEGAL_SLUGS = ['privacy-policy', 'terms-and-conditions', 'cookie-policy'];

const docs = [];
for (const locale of LOCALES) {
  docs.push(buildHome(locale));
  docs.push(buildAbout(locale));
  docs.push(buildServicesIndex(locale));
  for (const s of services) {
    const d = buildServiceDetail(s, locale);
    if (d) docs.push(d);
  }
  docs.push(buildNewsIndex(locale));
  for (const p of posts) docs.push(buildPost(p, locale));
  docs.push(buildPartners(locale));
  docs.push(buildContact(locale));
  for (const slug of LEGAL_SLUGS) {
    const page = pages.find((p) => p.slug === slug);
    if (!page) fail(`legal page "${slug}" not found in pages.json`);
    else docs.push(buildLegal(page, locale));
  }
}

/* ------------------------------------------------------------ validate -- */

const EXPECTED_ROUTES = 3 + services.length + 1 + posts.length + 1 + 1 + LEGAL_SLUGS.length;
const perLocale = LOCALES.map((l) => docs.filter((d) => d.locale === l).length);

if (services.length !== 10) fail(`expected 10 services, got ${services.length}`);
if (posts.length !== 4) fail(`expected 4 posts, got ${posts.length}`);
if (partners.length !== 39) fail(`expected 39 partners, got ${partners.length}`);
if (pages.length !== 15) fail(`expected 15 pages, got ${pages.length}`);
for (const [i, n] of perLocale.entries())
  if (n !== EXPECTED_ROUTES) fail(`locale "${LOCALES[i]}": expected ${EXPECTED_ROUTES} routes, got ${n}`);

// Every route must exist in both locales.
const byRoute = new Map();
for (const d of docs) {
  if (!byRoute.has(d.route)) byRoute.set(d.route, new Set());
  byRoute.get(d.route).add(d.locale);
}
for (const [route, locs] of byRoute)
  if (locs.size !== LOCALES.length) fail(`route ${route} exists only in: ${[...locs].join(', ')}`);

if (problems.length) {
  console.error('INGEST FAILED:\n' + problems.map((p) => '  ' + p).join('\n'));
  process.exit(1);
}

/* --------------------------------------------------------------- write -- */

for (const locale of LOCALES) fs.mkdirSync(path.join(OUT, locale), { recursive: true });

const kinds = new Map();
for (const d of docs) {
  fs.writeFileSync(path.join(OUT, d.locale, `${d.slug}.json`), JSON.stringify(d, null, 2) + '\n');
  for (const b of d.blocks) {
    kinds.set(b.type, (kinds.get(b.type) || 0) + 1);
    for (const body of b.bodies ?? []) kinds.set(body.kind, (kinds.get(body.kind) || 0) + 1);
  }
}

// News dataset, per locale, for the newsGrid renderer.
for (const locale of LOCALES) {
  const items = posts.map((p) => ({
    slug: p.slug,
    route: `/news/${p.slug}`,
    tag: (p.tags ?? []).map((t) => L(t.name, locale)).filter(Boolean)[0] ?? '',
    type: 'News',
    date: String(p.publish_date).slice(0, 10),
    title: L(p.title, locale),
    media: media(p.cover?.uri, L(p.title, locale), `post ${p.slug} cover`),
    art: null,
  }));
  fs.writeFileSync(path.join(OUT, locale, 'news-items.json'), JSON.stringify(items, null, 2) + '\n');
}

for (const locale of LOCALES) {
  fs.writeFileSync(
    path.join(OUT, locale, 'chrome.json'),
    JSON.stringify(buildChrome(locale), null, 2) + '\n'
  );
}

fs.writeFileSync(
  path.join(OUT, 'routes.json'),
  JSON.stringify(
    docs
      .filter((d) => d.locale === 'en')
      .map((d) => ({ route: d.route, slug: d.slug })),
    null,
    2
  ) + '\n'
);

const placeholders = docs.filter((d) => d.placeholder);

console.log(`INGEST OK — ${docs.length} documents (${EXPECTED_ROUTES} routes x ${LOCALES.length} locales)`);
console.log('  ' + [...kinds.entries()].sort().map(([k, v]) => `${k}=${v}`).join('  '));
if (placeholders.length) {
  console.log(`\n  ${placeholders.length} document(s) carry PLACEHOLDER source copy and must not go live as-is:`);
  for (const d of placeholders) console.log(`    ${d.locale}${d.route}`);
}

