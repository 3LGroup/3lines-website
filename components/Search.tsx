'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchDoc {
  /** Page title in the current locale. */
  title: string;
  /** Locale-prefixed href, already resolved server-side. */
  href: string;
}

/**
 * Site search — the button in the header and the overlay it opens.
 *
 * Both halves live in one component on purpose. The overlay is
 * `position:fixed; inset:0`, so where it sits in the DOM has no bearing on where
 * it paints, and keeping the trigger beside the thing it triggers means the open
 * state is ordinary React state rather than a class toggled from main.js across
 * a component boundary.
 *
 * ## Why this exists at all
 *
 * The design system already carried a search overlay: `.searchlayer` in
 * style.css is fully specified — fixed backdrop, a 40px input over a 3px brand
 * underline, a close affordance — and the reference build renders a
 * `.hdr__search` button wired to it. This project shipped neither, because the
 * reference's submit handler called `alert()`. A control that looks like search
 * and does nothing is worse than no control, so it was correctly removed.
 *
 * What was missing was never the design, only something real behind it. This is
 * that: a genuine filter over the site's own pages.
 *
 * ## Why the index is titles only
 *
 * `docs` is built by the server from `getRouteTitles()`, which lib/content.ts
 * lists in `BUNDLED` — statically imported, so esbuild inlines it. That matters
 * more than it looks: the per-page documents are NOT bundled, and reading them
 * would work at build time and then fail inside the Worker, where
 * `process.cwd()` is `/bundle` and `content/` was never uploaded. That is the
 * exact asymmetry that once killed the preview iframe while the public site
 * looked fine. Titles cover all 25 routes in both locales — including every news
 * article, which is a route like any other — and they cost no filesystem.
 *
 * No fetch, no index to build, no third-party search service, and it works with
 * the network off. The one thing it deliberately does not do is match body copy.
 */
export default function Search({
  docs,
  labels,
}: {
  docs: SearchDoc[];
  labels: { open: string; placeholder: string; noResults: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    /* Every whitespace-separated term must appear somewhere in the title, so
       "spare parts" and "parts spare" find the same page. Substring rather than
       word-prefix matching because Arabic attaches the definite article and
       common prepositions directly to the noun — "الخدمات" contains "خدمات" —
       and a prefix match would miss the word a reader actually typed. */
    const terms = needle.split(/\s+/);
    return docs
      .filter((d) => {
        const hay = d.title.toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 8);
  }, [docs, q]);

  /* Escape closes, and focus goes back to the button that opened it rather than
     to the top of the document — otherwise a keyboard user who dismisses the
     overlay is dropped back at the start of the page they were already on. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  /* The overlay covers the page, so the page behind it must not scroll. Restores
     the previous value instead of clearing it, so this cannot fight the mega
     menu's own lock if both ever run. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        className="hdr__search"
        type="button"
        aria-expanded={open}
        aria-controls="searchlayer"
        aria-label={labels.open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.5-4.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className={open ? 'searchlayer is-open' : 'searchlayer'} id="searchlayer">
        {/* Rendered but inert while closed — `.searchlayer` is visibility:hidden,
            which takes its subtree out of the accessibility tree and out of the
            tab order, so there is no focus trap to build around a closed panel. */}
        <button className="close" type="button" onClick={() => setOpen(false)}>
          {labels.close}
        </button>

        <div className="searchlayer__inner">
          {/* No form element and no submit path: there is no results PAGE to
              submit to, and a form that reloads onto nothing is how the
              reference's alert() got there. Filtering as you type IS the
              interaction. */}
          <div className="searchlayer__field">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4.5-4.5" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={labels.placeholder}
              aria-label={labels.open}
              autoComplete="off"
            />
          </div>

          {/* aria-live so a screen reader hears the count change as the list
              filters; the list itself is not focus-managed, it is just links. */}
          <div className="searchlayer__results" aria-live="polite">
            {q.trim() && results.length === 0 ? (
              <p className="searchlayer__empty">{labels.noResults}</p>
            ) : (
              results.map((r) => (
                <a key={r.href} href={r.href} onClick={() => setOpen(false)}>
                  {r.title}
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
