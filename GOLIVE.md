# Go-live: replacing the current 3Lines website

This is the plan for putting this branch in front of the public. It covers what
was built, how it works, what each safety net actually caught, and the parts
only you can do.

`README.md` explains the system. `docs/CMS-GUIDE.md` is the editor's manual.
This file is the handover for the switch-over itself.

---

## 1. What you are deploying

One Next.js app that contains both the website and its CMS.

```
content/*.json  ──build──▶  50 prerendered pages (25 routes × EN/AR)
      ▲
      │ cf-prebuild.mjs exports from D1 at build time
      │
   D1 database  ◀──edits──  /admin
```

- **Public pages are static.** They are generated at build time from
  `content/*.json` and served from Cloudflare's edge. Nothing queries a database
  when a visitor loads a page.
- **`/admin` writes to D1**, not to files. It is behind a password and a signed
  session cookie.
- **Publish rebuilds the site.** It fires a `repository_dispatch` at GitHub
  Actions, which re-runs the build; the build exports the current D1 contents
  into `content/` and deploys. So an editor's Save is durable immediately, and
  Publish is what makes it public.

That last point is the important one, because it is the thing that was broken on
the old Worker: a filesystem-backed CMS cannot persist on a serverless host.
Moving the store to D1 and making Publish trigger a rebuild is what fixed it.

**Everything on the deployment side is already built.** The GitHub Actions
workflow, the D1 export step, the R2 media bucket and the Publish wiring all
exist and are committed. Going live is now about secrets and DNS, not code.

---

## 2. What was built, and how

**Content pipeline — and which half of it is live.** `scripts/ingest-3lines.mjs`
built the original 50 documents from source material, refusing to emit anything
it could not fully account for: a missing image file or a blank required title
fails the run rather than shipping a hole. That was the bootstrap. **It is no
longer the source of truth** — editors author in the CMS, and
`scripts/cf-prebuild.mjs` exports `content/` from D1 at build time. Both write
to the same directory, which is a trap; see §6 before running ingest.
`scripts/extract-non-cms.mjs` recovers the copy
that existed only inside the old site's compiled JavaScript (the hero's rotating
words, the "Why 3Lines" slider, the About pillars and stats, the certification
plates) in both languages.

**One typed schema for every page.** `lib/blocks.ts` defines five block types and
a set of body kinds as a discriminated union. Both renderers end in
`assertNever`, so adding a block type without teaching the renderer to draw it
is a compile error rather than a blank space on a live page.

**Bilingual, properly.** Routes are stored without a locale and prefixed at
render time, so the two trees cannot drift apart. Arabic is RTL with self-hosted
Tajawal, and `audit:localization` proves the split is lossless.

**Cache-busting is content-hashed.** `lib/assets.ts` appends a hash of each
file's real bytes. This replaced hand-maintained `?v=3` strings, which had
already shipped a bug where the server was correct and returning visitors kept
getting the previous stylesheet — invisible to every audit, because audits use
cold browsers. `audit:assets` now guards it.

**The CMS.** Pages, news, navigation, shared bands, media library, site settings
and interface microcopy are all editable. Images upload to R2. Deleting an image
is blocked if anything still references it.

---

## 3. What the safety nets actually caught

The point of listing these is that a green pipeline is only worth what it has
caught. Every one of these shipped, or nearly did.

| Gate | What it caught |
|---|---|
| `audit:rtl` | **Arabic was letter-spaced on all 50 Arabic route/viewport combinations.** Arabic is cursive, so tracking breaks the letterforms' joins. The reset existed but was written at a specificity that lost — nothing errored, nothing 404'd, and the page measured fine. Fixed. |
| `audit:a11y` | Heading order skips on every page, and the audit's own over-reporting: it applied WCAG 2.5.8's 24px minimum without the exceptions attached to it and flagged 780 conforming links. |
| `audit:assets` | Stale cache-busting — the failure where cold-browser audits report green while returning visitors get old CSS. |
| `audit:visual` | Geometry drift across 50 routes × 7 viewports. It caught the branch failing its own gate — `b4621db` changed the hero DOM and re-stamped provenance from a capture taken beforehand — and then caught the verification pipeline reverting CMS content mid-run. See §6. |
| `audit:visual --selftest` | The harness once reported a perfect score while measuring **nothing** — a function had been passed to the browser as a string, silently dropping its argument. There is now a negative control that deliberately breaks a page and fails if the audit does not notice. |
| `audit:content` | Content that the schema or the renderer cannot handle, in both locales, before a build is attempted. |
| `audit:links` | Broken and orphaned internal links across both locales. |
| `audit:admin` | That `/admin` genuinely redirects when logged out, checked against the built output rather than the source. |

Run them all with `npm run verify`. It is a hard gate chain: the first real
failure stops the run, so no stage can report a pass on top of an earlier
failure, and the last stage re-opens the report from disk and validates it as an
artifact rather than trusting an exit code.

---

## 4. Runbook

Do these in order. Nothing here touches the live site until step 6.

### Step 1 — Rotate the credentials (do this first, see §5)

```bash
node scripts/admin-credentials.mjs secret            # new SESSION_SECRET
node scripts/admin-credentials.mjs password "<pw>"   # new CMS_PASSWORD_HASH
```

### Step 2 — Confirm the Cloudflare resources

`wrangler.jsonc` already names them, on the **threelines.com@gmail.com** account:

| Resource | Name |
|---|---|
| Worker | `3lines-website` |
| D1 database | `3lines-cms` (id `24730e9b-…`) |
| R2 bucket | `3lines-media` |

If either is missing on the account you deploy from:

```bash
npx wrangler login
npx wrangler d1 create 3lines-cms      # paste the new id into wrangler.jsonc
npx wrangler r2 bucket create 3lines-media
```

### Step 3 — Load the database

```bash
npm run db:migrate:remote
npm run db:import:remote
```

### Step 4 — Set the secrets

Worker secrets (`npx wrangler secret put NAME`):

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | signs the admin session cookie |
| `CMS_PASSWORD_HASH` | the admin password, hashed |
| `GITHUB_DISPATCH_REPO` | e.g. `Abdul-Rafay-ASE/3lines-website` |
| `GITHUB_DISPATCH_TOKEN` | lets Publish trigger the workflow |

GitHub repository secrets (Settings → Secrets → Actions):

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | both steps |
| `CLOUDFLARE_D1_TOKEN` | build step — reads content out of D1 |
| `CLOUDFLARE_API_TOKEN` | deploy step — publishes the Worker |

Two separate Cloudflare tokens, deliberately: the "Edit Workers" template grants
no D1 access and a D1 token grants no script access. Each step gets only the
scope it needs.

> **`.github/workflows/deploy.yml` must exist on `main`.** GitHub only delivers
> `repository_dispatch` to workflow files on the default branch, and `main` is
> the default here. Until the file is on `main`, a push to this branch deploys
> fine but **an editor clicking Publish gets silence** — no error, no build,
> nothing. The file pins `ref: location-map-and-fixes`, so the copy on `main`
> still builds this branch rather than main itself.
>
> **Confirmed present on `main`** and byte-identical to this branch's copy
> (commit `9d50866`). If you ever rename the production branch, both the
> `push:` trigger and that `ref:` have to change, in both copies.

### Step 5 — Deploy

**The deploy runs in GitHub Actions.** You do not need wrangler authenticated on
any machine. Once the six secrets above are set, a push to
`location-map-and-fixes` builds and deploys automatically — watch it in the
Actions tab.

To deploy without pushing, use **Actions → Deploy → Run workflow**.

The local equivalent, `npm run cf:deploy`, still works and is the fallback if
Actions is unavailable. It needs `npx wrangler login` first.

Then run every check in §7 **against the `*.workers.dev` URL**. Do not skip to
DNS because it looks right in a browser.

### Step 6 — Cut the domain over

Only after §7 passes. Point DNS at the Worker.

**Leave the current pm2 instance running.** It is the rollback, and nothing in
this process modifies it.

---

## 5. Your tasks

Things I cannot do, in the order they matter.

### Security — before anything else

**1. Rotate the CMS password and `SESSION_SECRET`.**

The current password was shared in plaintext during development and used for
testing, including by me in this session. Treat it as compromised. It protects a
CMS that can rewrite the public website of a defence-sector company.

Note that the Workers runtime caps PBKDF2 at 100,000 iterations, so the security
of this rests almost entirely on password entropy. Generate a random one — do
not choose a memorable phrase.

### Access I do not have

**2. Cloudflare account access** for the threelines.com@gmail.com account, or you
run steps 2–5 yourself.

**3. DNS control** for the cutover.

**4. GitHub repository secrets** — I cannot set them.

### Content only you can write

**5. The three legal pages are placeholder text.** The Arabic privacy page's
entire body is currently `محتوى سياسة الخصوصية` — literally "privacy policy
content". Publishing a defence-sector site with empty privacy, terms and cookie
pages is worse than not publishing those pages at all. This is a lawyer's job,
not a code fix.

**6. News articles have no body.** The data carries title, description, cover
image, date and tags — there is no article text. Four news items currently link
to pages with nothing to read.

### Decisions to make

**7.** The partner marquee shows 18 of 39 partners with no "see all" link. The
count is in the data (`logos.total`) and unused. Show all, or add the link?

**8.** The header wordmark and page-title suffix are global — the same string in
both languages. Should Arabic have its own?

**9.** Article pages do not display a publish date, though the data has one.

**10.** There is one shared admin login, not per-user accounts. The session
schema anticipates per-user (`session.sub`) but it is not built. For an audit
trail of who changed what, this needs doing.

**11. There is no revision history or undo.** A bad edit is recoverable only by
editing it back. Worth knowing before handing the CMS to someone.

---

## 6. Known state, honestly

**The visual baseline was stale when I picked this branch up.** Commit `b4621db`
removed the hero rotator's `--rotw` property — a real DOM change — and re-stamped
`baseline/provenance.json` from a capture taken before that change. The result
was that HEAD failed its own visual gate on `.rotator` before I touched
anything. The baseline has now been re-captured, which also folds in the Arabic
letter-spacing fix (the Arabic headline is narrower without tracking, so the
hero is ~53px shorter and everything below it shifts).

**A correction to an earlier handover.** The `CONTEXT.md` on the `next-site`
branch states that the CMS source is unreachable and that its Publish is broken.
Both statements are wrong and should not be relied on. I wrote them after
checking four of the seven branches in this repository and never looking at this
one, which is where the CMS actually lives. That file needs deleting or fixing.

**Six accessibility warnings remain.** The floating theme button overlaps two
footer links on the three Arabic legal pages at 390px wide — and only because
those pages are each a single placeholder paragraph, so the footer lands under
the button. Real legal copy (task 5) resolves it. Verified not to occur at the
bottom of any full-length page.

**Heading order is imperfect and deliberately left alone.** Sections without
their own `h2` jump from the page `h1` to an `h3`, and the footer's column
titles are `h4`. It is a warning, not a failure, and the site passes its
accessibility gate as it stands. I attempted the fix and reverted it: the type
scale in the theme layer is pinned to tag names behind `!important` rules, so
correcting the levels silently resized cards across the site. It is a real
improvement worth making — as its own change, with the baseline re-captured
after it, not in the same week as a domain cutover.

**Do not run `npm run ingest` on this branch.** There are two writers for
`content/` and only one is authoritative here. `ingest-3lines.mjs` regenerates
it from `source-content/` — the bootstrap path from before the CMS existed —
while `cf-prebuild.mjs` exports it from D1, which is where editors actually
author. Running ingest reverts CMS work: it strips the location page's info
rail, directions link and map facade out of both locales and rewrites
`chrome.json` and `news-items.json`.

This was live in the verification pipeline until `ecfa760` — `npm run verify`
was corrupting the content it was verifying, reporting the damage as geometry
findings, and leaving the tree dirty for whoever committed next. The pipeline
now skips ingest and fails if a run modifies `content/`, `source-content/` or
`baseline/`. That guard does not protect you from running the script directly.
Use it only when deliberately re-bootstrapping from source, and expect to
discard the result rather than commit it.

**`deploy/` is not the deployment path.** It holds a pm2 + nginx kit for
self-hosting. The chosen path is Cloudflare. It is kept as the fallback and
because it documents how the currently-live site is served; ignore it otherwise.

---

## 7. Verify before touching DNS

Against the deployed `*.workers.dev` URL, not localhost.

1. `npm run verify` — the full gate chain, green.
2. `npm run audit:links` — 0 broken, 0 orphaned, both locales.
3. `npm run audit:console` — 0 errors, 0 hydration warnings, 0 same-origin 4xx.
4. `npm run audit:a11y` and `npm run audit:rtl`.
5. `npm run audit:visual` against the baseline, **and** a run with
   `AUDIT_SELFTEST=1`. A clean diff proves nothing without the negative control —
   this harness has reported a perfect score while measuring nothing before.
6. **The CMS round trip, on the deployed instance**: log in → change something
   visible → Save → Publish → confirm the change is live. This is precisely what
   was broken on the old Worker. Prove it here; do not assume it.
7. `/admin` redirects when logged out. `content/` and `.env*` return 404.
8. Load `/ar` and check: right-to-left, Tajawal rendering, and Arabic that is not
   letter-spaced.

---

## 8. Rollback

The current pm2 site keeps serving throughout this process and is not modified
by any step here. If the cutover misbehaves, revert the DNS record — that is the
whole rollback.

Do not decommission the current host until the new one has served real traffic
for long enough that you would have heard about problems.
