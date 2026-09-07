# UI refresh — plan

Measured on the live site at 1442×732, fonts loaded, reveal animations settled.
Everything here is grounded in numbers or the rendered page, not taste alone.

---

## What is already right — do not touch these

Two things I assumed were broken and measured as fine. Worth writing down so nobody
"fixes" them later.

**The brand blue is correct.** `--primary: oklch(0.549 0.113 243.962)` sits inside the
range sampled from the logo files themselves:

| source | L | C | H |
|---|---|---|---|
| header mark `3Lines_logo.png` | 0.477 | 0.127 | 247.7 |
| footer lockup `logo.png` | 0.521 | 0.106 | 240.4 |
| **deployed `--primary`** | **0.549** | **0.113** | **244.0** |

Hue is 3.7° off the mark and chroma within 12%. It is the brand colour, properly derived.

**The tonal rhythm exists.** Sections alternate white → mist `#F4F9FB` → navy `#123E5E`.
The navy bands survived the re-skin and are the strongest thing on the page.

---

## The actual problem: pacing and hierarchy, not palette

Section heights down the homepage:

```
745   hero
380   stats
504   How we deliver it        mist
648   Our companies
403   +30 strategic partners   navy
2615  What we do               ← 33% of the page, 3.6 screens, no background change
687   Newsroom                 mist
382   Trusted by
748   Begin a conversation     navy
────
7821  total = 10.7 screens
```

One section is a third of the page. Inside it: a `sec-head` of 84px and a single
`.cards3` grid of 2313px holding **ten identical `.pcard`s**, three per row, leaving a
tenth card orphaned on a row of its own.

That is the whole diagnosis. Every service is presented at exactly the same visual
weight, in one undifferentiated block, for three and a half screens.

---

## Priority 1 — Break up "What we do"

**Problem:** ten equal cards, 2615px, one orphan.

**Proposal:** promote the three services the business leads with into a featured row —
larger card, photograph, one line of copy — then present the remaining seven as a
compact two-column list with a small icon and title only. Same content, roughly half the
height, and the page finally says which services matter.

The block types to build this already exist: `feature` for the promoted three,
`defs` or `specList` for the compact remainder. No new renderer needed.

**Secondary:** ten items in a three-column grid will always orphan one. If the featured
split is not wanted, a four-column grid at ≥1200px makes it 4+4+2, which reads far
better than 3+3+3+1.

---

## Priority 2 — The hero is not doing hero work

At 1442 wide the hero is 745px and consists of a headline on the left, a paragraph of
body copy on the right, and a photograph below. `h1` is 54px.

**Problems:**
- The rotating word ("Extended Reality") renders in light grey — the most kinetic element
  on the page is also the lowest contrast.
- There is no call to action above the fold.
- Body copy competes with the headline for the same optical weight.

**Proposal:**
- Headline to ~72px at ≥1200px. 54px is a section heading size, not a hero size.
- Rotating word in `--primary`, not grey. It is the only motion on first paint; it should
  read as deliberate emphasis.
- Move the paragraph below the headline at ~60% width, and add one primary CTA.
- Consider the photograph as a full-bleed background with the headline overlaid, rather
  than a separate block beneath. The current arrangement reads as "text, then a picture".

---

## Priority 3 — The stats row is invisible

`+7 / 3 / +120 / +30` sits at 380px in plain small text on white. For a defence
contractor these four numbers are the credibility argument, and they are the least
prominent thing on the page.

**Proposal:** numerals at 56–72px in `--primary`, labels in `--font-mono` uppercase at
current size, the whole band on `mist` or `navy`. This is a token and type-scale change,
not new markup — `.figure__num` and `.figure__lab` already exist.

---

## Priority 4 — `--cyan` is the unused brand asset

`--cyan #87EDFF` — L 0.89, C 0.098, H 210 — is declared and barely used. It is the only
bright note in the system and the one colour that could give the design energy without
breaking the sober register a defence contractor needs.

**Proposal:** use it as a single accent on navy bands only — rules, the arrow glyph in
`.arrowlink`, the active tab underline. Never as text on white, where it fails contrast.
Constrained to dark surfaces it lifts the whole palette.

---

## Priority 5 — Card surfaces are undifferentiated

`.pcard` is white on white with a `oklch(0.922 0 0)` border and 10px radius. On a white
section the card boundary is nearly invisible; on mist it reads better.

**Proposal:** give cards on white sections either a mist fill or a slightly stronger
border, and reserve the shadow tokens (`--shadow-sm` upward, already defined and unused)
for hover. Presently `.pcard` has no elevation change on hover, so a grid of ten cards
gives no feedback about what is interactive.

---

## Not proposed, deliberately

- **No palette change.** The blue is right; changing it would be undoing brand work.
- **No new framework, no Tailwind.** `3lines.css` already overrides `style.css` at
  matching specificity with `!important`; adding a third layer would make it worse.
- **No motion beyond what exists.** The reveal animations and the rotator are enough for
  this audience. Reduced-motion handling is already thorough and should not be disturbed.
- **No radius change.** 10px is consistent throughout and is not the problem.

---

## Sequencing

1. **Priority 1** — the biggest visible improvement per unit of work, and it shortens the
   page by roughly a screen and a half.
2. **Priority 3** — smallest change on the list, disproportionate payoff.
3. **Priority 2** — highest impact, but the most design judgement and the most risk of
   regressing the CLS work; do it with the visual audit as a guard.
4. **Priorities 4 and 5** — polish once the structure is settled.

## Constraint that governs all of it

Content lives in D1, not the repo. Section structure and copy change through the CMS;
only the renderers and CSS change in code. Priority 1 in particular is mostly a **content
restructure** — recomposing blocks in the CMS — with a small amount of renderer work,
not a code change that can be made unilaterally.
