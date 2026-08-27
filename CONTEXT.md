# Context & handover — location-map-and-fixes

State of this branch, what is verified, and what is still open. `README.md` covers how
the system works; `docs/CMS-GUIDE.md` is for the editor. This file is for the next
developer.

Last updated at commit `e976aae` (2026-08-27).

> The `CONTEXT.md` on the `next-site` branch says the CMS source is unreachable and its
> publish is broken. **Both statements are obsolete** — the CMS was rebuilt into this
> repository on this branch, as `/admin` inside the same Next.js app.

## Current state

The site and CMS are one app. Public pages prerender from `content/*.json`; the admin
edits local D1 (via `initOpenNextCloudflareForDev` in dev); Publish exports D1 back to
`content/` (local) or POSTs `CF_DEPLOY_HOOK_URL` to trigger a rebuild (deployed). The
byte-exact contract holds: `npm run db:import:local` then `node scripts/export-content.mjs`
leaves `git diff content/` empty — every schema or exporter change must keep it so.

**Everything an editor needs is CMS-managed**: page copy, links, images, statistics,
section order, add/delete of sections and pages, page visibility (noindex), navigation
and footer, interface microcopy, shared bands (careers CTA + contact strip, edited once
for every copy), news lifecycle (card + article page created and deleted together),
collections (services edits mirror to the homepage grid), site info (feeds footer,
contact strip, JSON-LD, titles, share cards, favicon), and a fully deletable image
library guarded by a database reference check.

## Verified, not assumed

- **Automated end-to-end**: ~95 scripted scenarios through the real `lib/admin` write
  layer — mutate → persist → export → rendered HTML asserted in EN and AR — then
  reverted to a byte-identical tree.
- **Manual UI click-through** (real browser, real session): every screen, save states,
  validation messages, structural operations, news create/delete, publish. Two real bugs
  were found only this way and are fixed: Publish firing on a single click (`fff4601`)
  and referenced-image deletion breaking pages (`e976aae`).
- **Gates all green** at HEAD: typecheck · build (54 pages) · content · localization
  (368 lossless round-trips) · links · console/hydration (0) · assets · manifest · admin
  isolation · visual regression (self-test detected 552 planted findings; real sweep
  350/350 clean against the baseline committed in `96f3bb8`).

## Deliberately not CMS-editable

Single shared password (entropy-carried; PBKDF2 capped at 100k by the Workers runtime —
see `lib/admin/crypto.ts`) · no undo/revisions · no SVG upload (`components/Svg.tsx`
trusts its tree) · contact-form field names (wired to the API) · ja/ko locales (seeded,
disabled) · repo-asset deletion on the HOSTED CMS (public/ ships as immutable Static
Assets; works locally/self-hosted).

## Open decisions (need a human, not code)

1. Per-user logins and an audit trail (schema anticipates it: `session.sub`).
2. Revisions/undo.
3. The homepage partner marquee shows 18 of 39 with no "see all" — `logos.total` exists
   in the schema, waiting on a design call.
4. Header wordmark and title suffix are global across locales (brand call).
5. Article pages carry no publish date (the index row holds the only date).

## Before this goes live

- **Rotate the CMS password and `SESSION_SECRET`.** Both current values were exposed
  during development. `node scripts/admin-credentials.mjs secret` and
  `… password "<strong-random>"` — the hash and secret go in `.env.local` locally and
  `wrangler secret put` when hosted. Security rests on password entropy; do not pair the
  100k-iteration hash with a human-chosen password.
- Cloudflare path: create the D1 database and R2 bucket named in `wrangler.jsonc`, run
  `npm run db:migrate:remote` and `db:import:remote`, set `CF_DEPLOY_HOOK_URL` so
  Publish triggers Workers Builds (`scripts/cf-prebuild.mjs` exports remote D1 at build).
  Self-hosted path: `deploy/` (pm2 + nginx; publish.sh gates and rolls back).
- The three legal pages are still placeholder copy, `status: placeholder` (noindexed).
  They need real text before being switched visible — an editorial task, in the CMS.

## Things that will bite you

- **Never run `npm run build` while `next dev` is serving** — they share `.next` and the
  dev server starts 500ing until restarted.
- The local D1 sqlite file is keyed off `database_id` in `wrangler.jsonc`; changing that
  id silently points dev at a fresh empty database.
- The importer is a seeding tool: pages/blocks upsert by deterministic id, but settings,
  chrome and ui_strings are `ON CONFLICT DO NOTHING` — a re-import never reverts editor
  work, and re-running it against a structurally edited database is not supported.
- Shared bands "aligns every page" on save — by design. A page that should differ (the
  careers page's own band says "Careers", not "Begin a conversation") is re-diverged
  afterwards through Pages & SEO.
- `audit-content.mjs` reads every quoted `case` label in the two renderer files as a
  declared block kind; don't add unrelated switches there.
- `audit:visual` defaults to `live` mode against the original Vercel source, which this
  project has outgrown; regression testing is `AUDIT_MODE=baseline npm run audit:visual`.
