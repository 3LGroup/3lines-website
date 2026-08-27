'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/admin/Icon';
import ImagePicker from '@/components/admin/ImagePicker';
import PreviewPane from '@/components/admin/PreviewPane';
import type { EditableBlock } from '@/lib/admin/content';
import { saveEdits, setPageImage, structural, type SaveState } from './actions';

/**
 * The editing surface.
 *
 * Every field appears as English with Arabic directly beneath it — never behind
 * a tab. Tabs are exactly the mechanism by which two language trees drift: edit
 * the English, forget the Arabic, and nothing on screen ever says so. Stacked,
 * the gap is visible while you are typing.
 *
 * Three forms, three kinds of change:
 *   - the main form saves copy, metadata, shared fields and the visibility
 *     toggle in one Save;
 *   - the struct form applies add / remove / reorder instantly, because those
 *     rewrite rows the text save must never touch half-way;
 *   - the img form carries library picks, for the same reason.
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

/** Editor-facing names for the block kinds. */
const KIND_LABELS: Record<string, string> = {
  hero: 'Hero',
  pageTitle: 'Page title',
  section: 'Section',
  careers: 'Careers band',
  socialStrip: 'Contact icons',
  tiles: 'Tiles',
  cards: 'Cards',
  feature: 'Feature',
  figures: 'Statistics',
  prose: 'Paragraphs',
  newsGrid: 'News grid',
  slider: 'Slider',
  defs: 'Titled blurbs',
  specList: 'Fact strip',
  overviewSplit: 'Overview',
  logos: 'Logos',
  certs: 'Certifications',
  companies: 'Companies',
  map: 'Map',
  form: 'Contact form',
};

export default function PageEditor({
  slug,
  route,
  status,
  meta,
  blocks,
  routes,
  addableBodyKinds,
}: {
  slug: string;
  route: string;
  status: string;
  meta: Record<string, { title: string; description: string; keywords: string }>;
  blocks: EditableBlock[];
  routes: string[];
  addableBodyKinds: { kind: string; label: string }[];
}) {
  // Keyed "<slug>:<locale>:<field>". Separate from block edits because it lands
  // in a different table, but submitted together so one Save covers the screen.
  const [metaEdits, setMetaEdits] = useState<Record<string, string>>({});
  // Keyed "<blockId>:<locale>" -> { path: value }. Only touched paths land here,
  // so an untouched block is never rewritten and never shows up in the publish
  // diff.
  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  // Keyed "<blockId>:<path>" -> value, for the shared half (links, numbers).
  const [sharedEdits, setSharedEdits] = useState<Record<string, string>>({});
  // '' = untouched; otherwise the status the toggle now asks for.
  const [statusEdit, setStatusEdit] = useState('');

  const [state, formAction, pending] = useActionState<SaveState, FormData>(saveEdits, {});
  const [structState, structAction, structPending] = useActionState<SaveState, FormData>(
    structural,
    {}
  );
  const [imgState, imgAction] = useActionState<SaveState, FormData>(setPageImage, {});
  const [open, setOpen] = useState<string | null>(blocks[0]?.id ?? null);
  const [armRemove, setArmRemove] = useState<string | null>(null);

  const dirtyCount = useMemo(
    () =>
      Object.values(edits).reduce((n, e) => n + Object.keys(e).length, 0) +
      Object.keys(metaEdits).length +
      Object.keys(sharedEdits).length +
      (statusEdit ? 1 : 0),
    [edits, metaEdits, sharedEdits, statusEdit]
  );

  /**
   * Clear the pending edits once the server confirms they landed — but only the
   * edits that were actually SUBMITTED. Anything typed while the round trip was
   * in flight stays marked unsaved instead of being silently absorbed into
   * "No changes". Keyed on the identity of the returned state rather than on
   * `ok`, because two consecutive successful saves both report ok and the
   * second must still clear.
   */
  const submitted = useRef<{
    edits: Record<string, Record<string, string>>;
    meta: Record<string, string>;
    shared: Record<string, string>;
    status: string;
  } | null>(null);
  const lastHandled = useRef<SaveState | null>(null);
  useEffect(() => {
    if (state.ok && state !== lastHandled.current) {
      lastHandled.current = state;
      const sub = submitted.current;
      const pruneFlat = (cur: Record<string, string>, sent: Record<string, string>) =>
        Object.fromEntries(Object.entries(cur).filter(([k, v]) => sent[k] !== v));
      setEdits((cur) => {
        if (!sub) return {};
        const next: Record<string, Record<string, string>> = {};
        for (const [key, paths] of Object.entries(cur)) {
          const kept = pruneFlat(paths, sub.edits[key] ?? {});
          if (Object.keys(kept).length) next[key] = kept;
        }
        return next;
      });
      setMetaEdits((cur) => (sub ? pruneFlat(cur, sub.meta) : {}));
      setSharedEdits((cur) => (sub ? pruneFlat(cur, sub.shared) : {}));
      setStatusEdit((cur) => (sub && sub.status === cur ? '' : cur));
    }
  }, [state]);

  /**
   * A structural change shifts item indices, so pending text edits keyed on
   * positional paths (`items[2].title`) may now point at a DIFFERENT item.
   * They are dropped when a structural op succeeds; the buttons below are also
   * disabled while anything is unsaved, so this only fires as a backstop.
   */
  const lastStruct = useRef<SaveState | null>(null);
  useEffect(() => {
    if (structState.ok && structState !== lastStruct.current) {
      lastStruct.current = structState;
      setEdits({});
      setSharedEdits({});
    }
  }, [structState]);

  /** Bumped on any successful change; that is what reloads the preview frame. */
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (state.ok || structState.ok || imgState.ok) setRefreshKey((n) => n + 1);
  }, [state, structState, imgState]);

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

  const setShared = (blockId: string, path: string, value: string, original: string) =>
    setSharedEdits((prev) => {
      const key = `${blockId}:${path}`;
      const next = { ...prev };
      if (value === original) delete next[key];
      else next[key] = value;
      return next;
    });

  const sharedValue = (blockId: string, path: string, original: string) =>
    sharedEdits[`${blockId}:${path}`] ?? original;

  const message = structState.error || imgState.error || state.error;
  const effectiveStatus = statusEdit || status;

  /* Structural ops are blocked while text edits are pending: they shift the
     positional paths those edits are keyed on, which would land saved text on
     the wrong item. Save first, then rearrange. */
  const structDisabled = structPending || dirtyCount > 0;

  /** Submit a structural op by filling the struct form's hidden fields. */
  const fillStruct = (
    e: React.MouseEvent<HTMLButtonElement>,
    fields: Record<string, string | number>
  ) => {
    const f = e.currentTarget.form!;
    for (const [name, value] of Object.entries(fields)) {
      (f.elements.namedItem(name) as HTMLInputElement).value = String(value);
    }
  };

  const editor = (
    <>
      {/* Structural ops and image picks post outside the main form — see the
          header note. Hidden fields are set by the submitting button. */}
      <form action={structAction} id="struct">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="op" defaultValue="" />
        <input type="hidden" name="blockId" defaultValue="" />
        <input type="hidden" name="kind" defaultValue="" />
        <input type="hidden" name="path" defaultValue="" />
        <input type="hidden" name="index" defaultValue="-1" />
        <input type="hidden" name="to" defaultValue="-1" />
      </form>
      <form action={imgAction} id="pimg" />

      <datalist id="page-routes">
        {routes.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <form
        action={formAction}
        onSubmit={() => {
          submitted.current = { edits, meta: metaEdits, shared: sharedEdits, status: statusEdit };
        }}
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="edits" value={JSON.stringify(edits)} />
        <input type="hidden" name="meta" value={JSON.stringify(metaEdits)} />
        <input type="hidden" name="shared" value={JSON.stringify(sharedEdits)} />
        <input type="hidden" name="status" value={statusEdit} />

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

          {message ? (
            <span className="adm-error" role="alert" style={{ margin: 0 }}>
              <Icon name="alert" size={14} />
              {message}
            </span>
          ) : null}
          {state.ok && !dirtyCount && !message ? (
            <span className="adm-badge adm-badge--ok">
              <Icon name="check" size={12} />
              {state.written ? `Saved ${state.written} change${state.written === 1 ? '' : 's'}` : 'Saved'}
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

            <div className="adm-field">
              <label className="adm-label" htmlFor="page-visible" style={{ display: 'flex', gap: 'var(--adm-2)', alignItems: 'center' }}>
                <input
                  id="page-visible"
                  type="checkbox"
                  checked={effectiveStatus === 'published'}
                  onChange={(e) => {
                    const next = e.target.checked ? 'published' : 'placeholder';
                    setStatusEdit(next === status ? '' : next);
                  }}
                />
                Visible to search engines
              </label>
              <p className="adm-hint">
                Off, the page still loads at its address but carries a noindex tag and stays out of
                the sitemap — for pages whose copy is not ready.
              </p>
            </div>
          </div>
        </section>

        {blocks.map((block) => {
          const isOpen = open === block.id;
          const arByPath = new Map(block.fields.ar.map((f) => [f.path, f.value]));
          const dirty =
            Object.keys(edits[`${block.id}:en`] ?? {}).length +
            Object.keys(edits[`${block.id}:ar`] ?? {}).length +
            Object.keys(sharedEdits).filter((k) => k.startsWith(`${block.id}:`)).length;

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
                onClick={() => {
                  setOpen(isOpen ? null : block.id);
                  setArmRemove(null);
                }}
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
                <span className="adm-card__title">{KIND_LABELS[block.kind] ?? block.kind}</span>
                {block.anchor ? <code className="adm-badge">#{block.anchor}</code> : null}
                <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--adm-2)' }}>
                  {dirty ? <span className="adm-badge adm-badge--warn">{dirty} edited</span> : null}
                  {block.fields.en.length ? (
                    <span className="adm-badge">{block.fields.en.length} fields</span>
                  ) : null}
                </span>
              </button>

              {isOpen ? (
                <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
                  {/* Arrange / remove — instant, not part of Save. */}
                  {dirtyCount ? (
                    <p className="adm-hint" style={{ margin: 0 }}>
                      Save your text changes first — rearranging is paused while edits are pending.
                    </p>
                  ) : null}
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--adm-2)',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      className="adm-btn adm-btn--sm adm-btn--outline"
                      type="submit"
                      form="struct"
                      disabled={structDisabled}
                      onClick={(e) => fillStruct(e, { op: 'moveUp', blockId: block.id })}
                    >
                      ↑ Earlier
                    </button>
                    <button
                      className="adm-btn adm-btn--sm adm-btn--outline"
                      type="submit"
                      form="struct"
                      disabled={structDisabled}
                      onClick={(e) => fillStruct(e, { op: 'moveDown', blockId: block.id })}
                    >
                      ↓ Later
                    </button>

                    {block.isSection ? (
                      <span style={{ display: 'flex', gap: 'var(--adm-1)', alignItems: 'center' }}>
                        <select
                          className="adm-select"
                          id={`add-${block.id}`}
                          aria-label="Kind of content to add"
                          defaultValue="prose"
                          style={{ inlineSize: 'auto' }}
                        >
                          {addableBodyKinds.map((k) => (
                            <option key={k.kind} value={k.kind}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                        <button
                          className="adm-btn adm-btn--sm adm-btn--outline"
                          type="submit"
                          form="struct"
                          disabled={structDisabled}
                          onClick={(e) =>
                            fillStruct(e, {
                              op: 'addBody',
                              blockId: block.id,
                              kind:
                                (document.getElementById(`add-${block.id}`) as HTMLSelectElement | null)
                                  ?.value ?? 'prose',
                            })
                          }
                        >
                          + Add content
                        </button>
                      </span>
                    ) : null}

                    <span style={{ marginInlineStart: 'auto' }}>
                      {armRemove === block.id ? (
                        <button
                          className="adm-btn adm-btn--sm adm-btn--danger"
                          type="submit"
                          form="struct"
                          disabled={structDisabled}
                          onClick={(e) => fillStruct(e, { op: 'remove', blockId: block.id })}
                        >
                          Confirm delete
                        </button>
                      ) : (
                        <button
                          className="adm-btn adm-btn--sm adm-btn--outline"
                          type="button"
                          onClick={() => setArmRemove(block.id)}
                        >
                          Delete {block.isSection ? 'section' : 'this'}
                        </button>
                      )}
                    </span>
                  </div>

                  {/* Images, from the shared half, via the library picker. */}
                  {block.images.map((img) => (
                    <ImagePicker
                      key={img.path}
                      label={img.label}
                      current={img.value}
                      name={{ path: `${block.id};${img.path}`, shape: img.shape }}
                      formId="pimg"
                    />
                  ))}

                  {/* Item lists: add, remove, reorder. The text of each item is
                      edited in the fields below; these buttons change how many
                      there are and in what order. */}
                  {block.arrays.map((arr) => (
                    <div className="adm-field" key={arr.path}>
                      <span className="adm-label">{arr.label} — {arr.count}</span>
                      <div style={{ display: 'flex', gap: 'var(--adm-1)', flexWrap: 'wrap' }}>
                        {Array.from({ length: arr.count }, (_, i) => (
                          <span
                            key={i}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 2,
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              padding: '2px 4px',
                            }}
                          >
                            <span className="adm-hint" style={{ margin: 0 }}>
                              {i + 1}
                            </span>
                            <button
                              className="adm-btn adm-btn--sm adm-btn--ghost"
                              type="submit"
                              form="struct"
                              aria-label={`Move ${arr.label} ${i + 1} earlier`}
                              disabled={i === 0 || structDisabled}
                              onClick={(e) =>
                                fillStruct(e, {
                                  op: 'moveItem',
                                  blockId: block.id,
                                  path: arr.path,
                                  index: i,
                                  to: i - 1,
                                })
                              }
                            >
                              ↑
                            </button>
                            <button
                              className="adm-btn adm-btn--sm adm-btn--ghost"
                              type="submit"
                              form="struct"
                              aria-label={`Move ${arr.label} ${i + 1} later`}
                              disabled={i === arr.count - 1 || structDisabled}
                              onClick={(e) =>
                                fillStruct(e, {
                                  op: 'moveItem',
                                  blockId: block.id,
                                  path: arr.path,
                                  index: i,
                                  to: i + 1,
                                })
                              }
                            >
                              ↓
                            </button>
                            <button
                              className="adm-btn adm-btn--sm adm-btn--ghost"
                              type="submit"
                              form="struct"
                              aria-label={`Remove ${arr.label} ${i + 1}`}
                              disabled={arr.count <= arr.min || structDisabled}
                              onClick={(e) =>
                                fillStruct(e, {
                                  op: 'removeItem',
                                  blockId: block.id,
                                  path: arr.path,
                                  index: i,
                                })
                              }
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                        <button
                          className="adm-btn adm-btn--sm adm-btn--outline"
                          type="submit"
                          form="struct"
                          disabled={structDisabled}
                          onClick={(e) =>
                            fillStruct(e, { op: 'addItem', blockId: block.id, path: arr.path })
                          }
                        >
                          + Add
                        </button>
                      </div>
                      <p className="adm-hint">
                        A new item starts as a copy of the last one — edit its text below, then Save.
                      </p>
                    </div>
                  ))}

                  {/* Shared-half fields: links and layout numbers. */}
                  {block.shared.map((f) => (
                    <div className="adm-field" key={f.path}>
                      <label className="adm-label" htmlFor={`${block.id}-s-${f.path}`}>
                        {f.label}
                      </label>
                      {f.control === 'select' ? (
                        <select
                          className="adm-select"
                          id={`${block.id}-s-${f.path}`}
                          value={sharedValue(block.id, f.path, f.value)}
                          onChange={(e) => setShared(block.id, f.path, e.target.value, f.value)}
                        >
                          {f.options!.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="adm-input"
                          id={`${block.id}-s-${f.path}`}
                          dir="ltr"
                          inputMode={f.control === 'number' ? 'decimal' : undefined}
                          list={f.control === 'href' ? 'page-routes' : undefined}
                          value={sharedValue(block.id, f.path, f.value)}
                          onChange={(e) => setShared(block.id, f.path, e.target.value, f.value)}
                        />
                      )}
                    </div>
                  ))}

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

                  {!block.fields.en.length && !block.shared.length && !block.images.length ? (
                    <p className="adm-hint">
                      This band has no text of its own — it renders from{' '}
                      {block.kind === 'newsGrid' ? 'the News screen' : 'shared data'}.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}

        <div style={{ marginBlockStart: 'var(--adm-4)' }}>
          <button
            className="adm-btn adm-btn--outline"
            type="submit"
            form="struct"
            disabled={structDisabled}
            onClick={(e) => fillStruct(e, { op: 'addSection' })}
          >
            + Add section
          </button>
        </div>
      </form>
    </>
  );

  return (
    <div className="adm-split">
      {/* minInlineSize:0 or the editor column refuses to shrink below its
          widest input and pushes the preview off screen. */}
      <div style={{ minInlineSize: 0 }}>{editor}</div>
      <PreviewPane locale="en" slug={slug} refreshKey={refreshKey} />
    </div>
  );
}
