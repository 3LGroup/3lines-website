# 3Lines — bilingual production site

A data-driven Next.js site for **3Lines Advanced Technologies**, in English and
Arabic, built on the design system originally reproduced from
`thales-group-3lines.vercel.app` (the "3Lines · design-system build" theme).

The design is kept; the demo content is gone. Every page is generated from the
real content in the sibling `3lines-website/` project.

## Run it

```bash
npm install
npm run extract    # lift the copy that has no CMS home
npm run ingest     # sources -> content/{en,ar}/*.json
npm run dev        # http://localhost:3200/en
```

Production:

```bash
npm run build && npm start
```

Port 3200 is deliberate — 3000 and 3100 are taken on this machine.

Copy `.env.example` to `.env.local` and set `SITE_ORIGIN` (canonical/sitemap/hreflang
origin) and `CONTENT_ENDPOINT`-style values before deploying.

## Content pipeline

```
3lines-website/content/*.json        the CMS-editable records
3lines-website/assets/…              service details, fonts, 139 media files
        │
        │  scripts/extract-non-cms.mjs   copy that lives only in code
        ▼
source-content/*.json                 staged inputs, committed
        │  scripts/ingest-3lines.mjs    strict; aborts on anything unclassified
        ▼
content/routes.json                   23 route ids
content/{en,ar}/<slug>.json           46 block documents
content/{en,ar}/chrome.json           navigation, generated from real data
content/{en,ar}/news-items.json       the news dataset
        │  lib/blocks.ts                 the schema (discriminated unions)
        ▼
components/blocks/Blocks.tsx          exhaustive top-level renderer
components/bodies/Bodies.tsx          exhaustive body renderer (12 kinds)
```

### The copy that has no CMS home

This is the part a naive migration loses. `docs/CONTENT.md` in the sibling project
lists it, and `content/slides.json` there is **empty** — the homepage slider is
hardcoded. `scripts/extract-non-cms.mjs` lifts all of it, in both locales, and
fails loudly if any piece goes missing:

| Copy | Source |
|---|---|
| hero frame + 4 rotating words | `build/assets/hero-*.js` (content-hashed bundle) |
| "Why 3Lines" slider (4 slides) | `assets/enhance.js` → `SLIDES` |
| About: 3 pillars, 2 vision paragraphs, 6 core values | `docs/content-inventory.json` |
| About stat row (+7 / 3 / +120 / +30) | `{lang}/about.html` — **not** in the inventory |
| Certifications & Licences (2 facts, 3 plates) | `assets/enhance.js` → `certsSection` |
| UI labels, section eyebrows, form strings, nav | `assets/enhance.js` label tables |

Only one UI string in the whole migration is authored rather than lifted: the
"Home" breadcrumb (`الرئيسية`). Everything else carries the source's own Arabic.

### Block types

Top level: `hero`, `pageTitle`, `section`, `careers` (CTA band), `socialStrip`.
Bodies: `tiles`, `cards`, `feature`, `figures`, `prose`, `newsGrid`, `slider`,
`defs`, `specList`, `logos`, `certs`, `form`.

The six new kinds use class names `3lines.css` already themes
(`.heroslides`, `.speclist`, `.logos`, `.certs`, `.field`), so only layout was new.

## Internationalisation

- `app/[locale]/…` with `generateStaticParams` over `en`/`ar` and
  `dynamicParams = false`. `/` 307s to `/en`; unprefixed paths 308 to the English tree.
- Content stores **locale-less route ids**; `lib/i18n.ts:localePath()` applies the
  prefix at render time, so the Arabic tree structurally cannot link into the English one.
- `public/assets/css/rtl.css` is scoped entirely to `[dir="rtl"]` / `:lang(ar)`, so
  the English rendering — and therefore the committed visual baseline — is
  untouched by construction.
- Arabic uses self-hosted **Tajawal**, loaded only on `/ar`. Latin families are
  listed first in the font stack, so Latin runs keep their original face and only
  Arabic codepoints fall through to Tajawal.
- Arabic is never letter-spaced (`:lang(ar){letter-spacing:normal}`), and Tajawal
  has no 600 weight so headings are pinned to 700 with `font-synthesis-weight:none`.

## Verification

```bash
npm run verify           # the full gated pipeline
npm run audit:content    # data <-> schema <-> renderer <-> both locales
npm run audit:console    # console, hydration, 4xx
npm run audit:links      # broken links, reachability, orphans
npm run audit:visual     # structural + geometric diff
npm run baseline:update  # deliberate, reviewed baseline reset
```

### The visual reference

The audit used to diff against the live Thales deployment. That reference stopped
being meaningful the moment the content was replaced — every selector would report
a count mismatch, the audit would go permanently red, and it would get switched
off. So the **reference** changed and the **method** did not:

`AUDIT_MODE=baseline` diffs against `baseline/`, a committed snapshot of this
site's own geometry. Everything that made the harness trustworthy is unchanged —
counts compared before geometry, count mismatches never laundered into geometry
diffs, font-set differences as their own class, determinism pinned before
measuring, and `AUDIT_SELFTEST=1` still required to produce findings.

`baseline/provenance.json` records when and from what the snapshot was taken.
Regenerating it is an explicit act, never a side effect of a run.

### The nothing-was-dropped gate

`scripts/audit-content.mjs` walks every string of non-CMS copy and asserts it
appears in a document **of its own locale**. Add a fifth slide or a seventh core
value and forgetting to place it becomes a build failure. It also asserts every
source record is placed, every media reference resolves on disk, and that EN and
AR have identical block structure.

## Known limitations

- **The three legal pages are placeholders.** Their source bodies are one-line
  strings ("Privacy Policy Content"). The ingest flags them and the audit prints
  them on every run. **They must not go live without real copy.**
- **News posts have no article body.** `posts.json` carries only title,
  description, cover, date and tags, so detail pages are a heading plus one
  paragraph. That is what the data holds, not a rendering bug.
- **DM Sans and JetBrains Mono still come from Google Fonts** and intermittently
  404. Recorded by the console audit as third-party failures rather than gated.
  Self-hosting them the way Tajawal is self-hosted would remove the last source
  of audit flakiness.
- The contact form posts to a same-origin proxy because the upstream sets
  `Access-Control-Allow-Origin: *` but no `Allow-Methods`, so a direct browser
  POST's preflight is rejected. The proxy **fails closed** with 503 when
  `CONTACT_ENDPOINT` is unset — it never pretends a message was delivered.
