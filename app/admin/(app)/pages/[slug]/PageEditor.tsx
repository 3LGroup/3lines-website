'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/admin/Icon';
import type { EditableBlock } from '@/lib/admin/content';
import { saveEdits, type SaveState } from './actions';

/**
 * The editing surface.
 *
 * Every field appears as English with Arabic directly beneath it — never behind
 * a tab. Tabs are exactly the mechanism by which two language trees drift: edit
 * the English, forget the Arabic, and nothing on screen ever says so. Stacked,
 * the gap is visible while you are typing.
 */
const META_FIELDS = [
  { key: 'title', label: 'Search engine title', hint: 'Shown as the headline of a Google result.' },
  {
    key: 'description',
    label: 'Search engine description',
    hint: 'The grey text under the headline. Around 150 characters reads best.',
  },
  {
    key: 'keywords',
    label: 'Keywords',
    hint: 'Comma separated. Leave empty to omit the tag entirely.',
  },
] as const;

export default function PageEditor({
  slug,
  route,
  meta,
  blocks,
}: {
  slug: string;
  route: string;
  meta: Record<string, { title: string; description: string; keywords: string }>;
  blocks: EditableBlock[];
}) {
  // Keyed "<slug>:<locale>:<field>". Separate from block edits because it lands
  // in a different table, but submitted together so one Save covers the screen.
  const [metaEdits, setMetaEdits] = useState<Record<string, string>>({});
  // Keyed "<blockId>:<locale>" -> { path: value }. Only touched paths land here,
  // so an untouched block is never rewritten and never shows up in the publish
  // diff.
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveEdits, {});
  const [open, setOpen] = useState<string | null>(blocks[0]?.id ?? null);

  const dirtyCount = useMemo(
    () =>
      Object.values(edits).reduce((n, e) => n + Object.keys(e).length, 0) +
      Object.keys(metaEdits).length,
    [edits, metaEdits]
  );

  /**
   * Clear the pending edits once the server confirms they landed.
   *
   * Without this the save succeeds, the database is updated, and the editor
   * still reads "1 unsaved change" with no confirmation anywhere — so the
   * obvious next move is to press Save again. The values on screen are already
   * the saved ones (the server re-renders with them), so dropping the patch set
   * is what makes the UI agree with reality.
   *
   * Keyed on the identity of the returned state rather than on `ok`, because two
   * consecutive successful saves both report ok and the second must still clear.
   */
  const lastHandled = useRef<SaveState | null>(null);
  useEffect(() => {
    if (state.ok && state !== lastHandled.current) {
      lastHandled.current = state;
      setEdits({});
      setMetaEdits({});
    }
  }, [state]);

  const setMeta = (locale: string, field: string, value: string, original: string) =>
    setMetaEdits((prev) => {
      const key = `${slug}:${locale}:${field}`;
      const next = { ...prev };
      if (value === original) delete next[key];
      else next[key] = value;
      return next;
    });

  const metaValue = (locale: string, field: string, original: string) =>
    metaEdits[`${slug}:${locale}:${field}`] ?? original;

  const setField = (blockId: string, locale: string, path: string, value: string, original: string) =>
    setEdits((prev) => {
      const key = `${blockId}:${locale}`;
      const next = { ...(prev[key] ?? {}) };
      // Typing back to the original value un-marks the field, so "3 unsaved
      // changes" always means three real differences.
      if (value === original) delete next[path];
      else next[path] = value;
      const out = { ...prev, [key]: next };
      if (!Object.keys(next).length) delete out[key];
      return out;
    });

  const valueOf = (blockId: string, locale: string, path: string, original: string) =>
    edits[`${blockId}:${locale}`]?.[path] ?? original;

  return (
    <form action={formAction}>
      <input type="hidden" name="edits" value={JSON.stringify(edits)} />
      <input type="hidden" name="meta" value={JSON.stringify(metaEdits)} />

      <div
        style={{
          position: 'sticky',
          top: 'var(--adm-topbar-h)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--adm-3)',
          padding: 'var(--adm-3) 0',
          marginBlockEnd: 'var(--adm-4)',
          background: 'var(--background)',
          borderBlockEnd: '1px solid var(--border)',
        }}
      >
        <span className={dirtyCount ? 'adm-badge adm-badge--warn' : 'adm-badge'}>
          {dirtyCount ? `${dirtyCount} unsaved change${dirtyCount === 1 ? '' : 's'}` : 'No changes'}
        </span>

        {state.error ? (
          <span className="adm-error" role="alert" style={{ margin: 0 }}>
            <Icon name="alert" size={14} />
            {state.error}
          </span>
        ) : null}
        {state.ok && !dirtyCount ? (
          <span className="adm-badge adm-badge--ok">
            <Icon name="check" size={12} />
            {state.written ? `Saved ${state.written} block${state.written === 1 ? '' : 's'}` : 'Saved'}
          </span>
        ) : null}

        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--adm-2)' }}>
          <a
            className="adm-btn adm-btn--sm adm-btn--outline"
            href={`/en${route === '/' ? '' : route}`}
            target="_blank"
            rel="noopener"
          >
            View page
          </a>
          <button className="adm-btn adm-btn--primary adm-btn--sm" type="submit" disabled={!dirtyCount || pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Page metadata first: it is not part of any block, so a block-only
          editor would hide the two strings that decide what a Google result
          looks like. */}
      <section className="adm-card" style={{ marginBlockEnd: 'var(--adm-5)' }}>
        <div className="adm-card__head">
          <h2 className="adm-card__title">Search &amp; sharing</h2>
          <span className="adm-badge" style={{ marginInlineStart: 'auto' }}>
            page metadata
          </span>
        </div>
        <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
          {META_FIELDS.map((f) => (
            <div className="adm-field" key={f.key}>
              <label className="adm-label" htmlFor={`meta-${f.key}`}>
                {f.label}
              </label>
              <p className="adm-hint">{f.hint}</p>
              <input
                className="adm-input"
                id={`meta-${f.key}`}
                lang="en"
                dir="ltr"
                value={metaValue('en', f.key, meta.en?.[f.key] ?? '')}
                onChange={(e) => setMeta('en', f.key, e.target.value, meta.en?.[f.key] ?? '')}
              />
              <input
                className="adm-input"
                aria-label={`${f.label} (Arabic)`}
                lang="ar"
                dir="rtl"
                style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
                value={metaValue('ar', f.key, meta.ar?.[f.key] ?? '')}
                onChange={(e) => setMeta('ar', f.key, e.target.value, meta.ar?.[f.key] ?? '')}
              />
            </div>
          ))}
        </div>
      </section>

      {blocks.map((block) => {
        const isOpen = open === block.id;
        const arByPath = new Map(block.fields.ar.map((f) => [f.path, f.value]));
        const dirty = Object.keys(edits[`${block.id}:en`] ?? {}).length +
          Object.keys(edits[`${block.id}:ar`] ?? {}).length;

        return (
          <section
            className="adm-card"
            key={block.id}
            style={{
              marginBlockEnd: 'var(--adm-3)',
              // Bodies are indented under the section they belong to, so the
              // page's shape is legible without a separate outline pane.
              marginInlineStart: block.depth ? 'var(--adm-5)' : 0,
            }}
          >
            <button
              type="button"
              className="adm-card__head"
              onClick={() => setOpen(isOpen ? null : block.id)}
              aria-expanded={isOpen}
              style={{
                inlineSize: '100%',
                background: 'none',
                border: 0,
                borderBlockEnd: isOpen ? '1px solid var(--border)' : 0,
                cursor: 'pointer',
                textAlign: 'start',
              }}
            >
              <span className="adm-card__title">{block.kind}</span>
              {block.anchor ? <code className="adm-badge">#{block.anchor}</code> : null}
              <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--adm-2)' }}>
                {dirty ? <span className="adm-badge adm-badge--warn">{dirty} edited</span> : null}
                <span className="adm-badge">{block.fields.en.length} fields</span>
              </span>
            </button>

            {isOpen ? (
              <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
                {block.fields.en.map((f) => {
                  const ar = arByPath.get(f.path) ?? '';
                  const same = ar === f.value && f.value !== '';
                  const Input = f.multiline ? 'textarea' : 'input';
                  return (
                    <div className="adm-field" key={f.path}>
                      <label className="adm-label" htmlFor={`${block.id}-${f.path}`}>
                        {f.label}
                      </label>

                      <Input
                        className={f.multiline ? 'adm-textarea' : 'adm-input'}
                        id={`${block.id}-${f.path}`}
                        lang="en"
                        dir="ltr"
                        value={valueOf(block.id, 'en', f.path, f.value)}
                        onChange={(e) => setField(block.id, 'en', f.path, e.target.value, f.value)}
                      />

                      <Input
                        className={f.multiline ? 'adm-textarea' : 'adm-input'}
                        aria-label={`${f.label} (Arabic)`}
                        lang="ar"
                        dir="rtl"
                        style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
                        value={valueOf(block.id, 'ar', f.path, ar)}
                        onChange={(e) => setField(block.id, 'ar', f.path, e.target.value, ar)}
                      />

                      {same ? (
                        <p className="adm-hint">
                          <Icon name="alert" size={13} />
                          Arabic is identical to English — either untranslated, or a name that is
                          the same in both.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        );
      })}

      {!blocks.length ? (
        <div className="adm-card">
          <div className="adm-empty">
            <span className="adm-empty__icon">
              <Icon name="pages" />
            </span>
            <p className="adm-empty__title">Nothing editable here</p>
            <p className="adm-empty__body">
              This page has no text of its own — {slug} is assembled from shared bands and
              collections.
            </p>
          </div>
        </div>
      ) : null}
    </form>
  );
}
