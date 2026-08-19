'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

const WIDTHS = [
  { label: 'Phone', px: 390 },
  { label: 'Tablet', px: 768 },
  { label: 'Desktop', px: 1440 },
] as const;

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'AR' },
] as const;

/**
 * The page as it currently stands, beside the thing editing it.
 *
 * An iframe rather than an inline render, and that is not laziness. The preview
 * needs the public stylesheets, and 3lines.css re-skins global element selectors
 * with !important — including `html,body{background:…!important}`. Rendered
 * inline it would eat the admin around it. A separate document is the only way
 * both can dress correctly at once.
 *
 * It shows what has been SAVED, not what is published, because the alternative
 * cannot show an editor their own work. The label says so, since "preview" is
 * otherwise ambiguous about which of the two it means.
 */
export default function PreviewPane({
  locale,
  slug,
  /** Changes whenever a save succeeds; that is what triggers the reload. */
  refreshKey,
}: {
  /** Which language the pane opens on. Switchable once it is on screen. */
  locale: string;
  slug: string;
  refreshKey: number;
}) {
  const [width, setWidth] = useState<number>(1440);
  const [loading, setLoading] = useState(true);
  // The editor shows English and Arabic together, so a preview that could only
  // ever show English would leave half of every edit unverifiable — and Arabic
  // is the half where the layout actually changes, because the whole page
  // mirrors.
  const [lang, setLang] = useState<string>(locale);
  const frame = useRef<HTMLIFrameElement>(null);

  const src = `/preview/${lang}/${slug}`;

  // Reload on save. Assigning src re-fetches even when the URL is unchanged,
  // whereas a React key change would remount and flash white.
  useEffect(() => {
    if (refreshKey === 0 || !frame.current) return;
    setLoading(true);
    frame.current.src = src;
  }, [refreshKey, src]);

  /**
   * Clear the loading badge.
   *
   * Not an `onLoad` prop, because the iframe's src is in the server-rendered
   * HTML: the frame can finish loading before React hydrates and attaches that
   * handler, in which case the event is never seen and the badge reads
   * "Loading…" over a fully rendered page indefinitely. Observed exactly that.
   * So ask the frame what state it is in as well as listening for the change.
   */
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const done = () => setLoading(false);
    el.addEventListener('load', done);
    // about:blank is excluded: a fresh iframe reports it complete before its
    // real src has landed, which would clear the badge a beat too early.
    const doc = el.contentDocument;
    if (doc?.readyState === 'complete' && doc.URL !== 'about:blank') done();
    return () => el.removeEventListener('load', done);
  }, []);

  /**
   * Scale rather than shrink. The frame is laid out at the chosen width and then
   * transformed down to fit the pane, so the site inside sees a real 1440px
   * viewport and picks the same breakpoint it would on a desktop. Setting the
   * iframe to the pane's actual width would trigger the mobile layout and
   * preview something the visitor will never see.
   */
  const paneWidth = 520;
  const scale = Math.min(1, paneWidth / width);

  return (
    // Layout lives in admin.css rather than inline, because the stacked
    // breakpoint has to switch `position` back to static — and an inline style
    // wins over any stylesheet rule, media query or not.
    <aside className="adm-preview">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--adm-2)' }}>
        <span className="adm-badge">
          <Icon name="check" size={11} />
          Saved version
        </span>

        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            className={`adm-btn adm-btn--sm ${lang === l.code ? 'adm-btn--primary' : 'adm-btn--ghost'}`}
            onClick={() => {
              if (l.code === lang) return;
              setLoading(true);
              setLang(l.code);
            }}
            aria-pressed={lang === l.code}
          >
            {l.label}
          </button>
        ))}

        <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>
          {WIDTHS.map((w) => (
            <button
              key={w.px}
              type="button"
              className={`adm-btn adm-btn--sm ${width === w.px ? 'adm-btn--primary' : 'adm-btn--ghost'}`}
              onClick={() => setWidth(w.px)}
              aria-pressed={width === w.px}
            >
              {w.label}
            </button>
          ))}
          <a
            className="adm-btn adm-btn--sm adm-btn--ghost"
            href={src}
            target="_blank"
            rel="noopener"
            title="Open the preview in a new tab"
          >
            ↗
          </a>
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--muted)',
          blockSize: '100%',
          minBlockSize: 420,
        }}
      >
        {loading ? (
          <span
            className="adm-badge"
            style={{ position: 'absolute', insetBlockStart: 8, insetInlineStart: 8, zIndex: 2 }}
          >
            Loading…
          </span>
        ) : null}
        <iframe
          ref={frame}
          src={src}
          title="Preview of the saved page"
          style={{
            inlineSize: width,
            blockSize: `calc((100vh - var(--adm-topbar-h) - var(--adm-8)) / ${scale})`,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            background: '#fff',
          }}
        />
      </div>

      <p className="adm-hint">
        Shows what you have <strong>saved</strong>. Publish to put it on the live site.
      </p>
    </aside>
  );
}
