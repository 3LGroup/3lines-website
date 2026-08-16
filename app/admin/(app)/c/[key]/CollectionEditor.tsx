'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/admin/Icon';
import type { Collection } from '@/lib/admin/collections';
import { saveItems, structural, type CollectionState } from './actions';

/**
 * A grid of cards; click one to edit it.
 *
 * Modelled on the CMS already running at 3lines.com.sa/cms, which shows four
 * things and lets you click a card. The block structure underneath is not
 * mentioned anywhere on screen, because nobody sits down wanting to edit "the
 * cards body of the section on /services" — they want to change a service.
 */
export default function CollectionEditor({ collection }: { collection: Collection }) {
  const { def, items } = collection;

  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const [saveState, saveAction, saving] = useActionState<CollectionState, FormData>(saveItems, {});
  const [structState, structAction, working] = useActionState<CollectionState, FormData>(
    structural,
    {}
  );

  const dirty = useMemo(
    () => Object.values(edits).reduce((n, e) => n + Object.keys(e).length, 0),
    [edits]
  );

  const handled = useRef<CollectionState | null>(null);
  useEffect(() => {
    if (saveState.ok && saveState !== handled.current) {
      handled.current = saveState;
      setEdits({});
    }
  }, [saveState]);

  const setField = (index: number, locale: string, path: string, value: string, original: string) =>
    setEdits((prev) => {
      const key = `${index}:${locale}`;
      const next = { ...(prev[key] ?? {}) };
      if (value === original) delete next[path];
      else next[path] = value;
      const out = { ...prev, [key]: next };
      if (!Object.keys(next).length) delete out[key];
      return out;
    });

  const valueOf = (index: number, locale: string, path: string, original: string) =>
    edits[`${index}:${locale}`]?.[path] ?? original;

  const overRecommended = def.recommended !== undefined && items.length > def.recommended;
  const message = structState.error || saveState.error || structState.detail || saveState.detail;
  const isError = Boolean(structState.error || saveState.error);

  return (
    <>
      {/* Structural operations post separately from copy edits, because they
          rewrite the shared row as well and must not be half-applied. */}
      <form action={structAction} id="struct">
        <input type="hidden" name="key" value={def.key} />
      </form>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--adm-3)',
          marginBlockEnd: 'var(--adm-4)',
        }}
      >
        <span className={dirty ? 'adm-badge adm-badge--warn' : 'adm-badge'}>
          {dirty ? `${dirty} unsaved change${dirty === 1 ? '' : 's'}` : `${items.length} items`}
        </span>

        {message ? (
          <span
            className={isError ? 'adm-error' : 'adm-badge adm-badge--ok'}
            role={isError ? 'alert' : 'status'}
            style={{ margin: 0 }}
          >
            <Icon name={isError ? 'alert' : 'check'} size={13} />
            {message}
          </span>
        ) : null}

        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--adm-2)' }}>
          <button
            className="adm-btn adm-btn--sm adm-btn--outline"
            type="submit"
            form="struct"
            name="op"
            value="add"
            disabled={working}
          >
            + Add {def.label.replace(/ies$/, 'y').replace(/s$/, '').toLowerCase()}
          </button>
          <button
            className="adm-btn adm-btn--primary adm-btn--sm"
            type="submit"
            form="copy"
            disabled={!dirty || saving}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {overRecommended ? (
        // Advice, not a block. The old ingest hard-failed at a fifth company;
        // the real constraint is that the grid is four-up, which is a layout
        // fact an editor can weigh rather than a build error.
        <div className="adm-alert adm-alert--warn" style={{ marginBlockEnd: 'var(--adm-4)' }}>
          <Icon name="alert" />
          <span>{def.recommendedNote}</span>
        </div>
      ) : null}

      <form action={saveAction} id="copy">
        <input type="hidden" name="key" value={def.key} />
        <input type="hidden" name="edits" value={JSON.stringify(edits)} />

        <div
          style={{
            display: 'grid',
            gap: 'var(--adm-3)',
            gridTemplateColumns: open === null ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr',
          }}
        >
          {items.map((item) => {
            const isOpen = open === item.index;
            const arByPath = new Map(item.fields.ar.map((f) => [f.path, f.value]));
            const itemDirty =
              Object.keys(edits[`${item.index}:en`] ?? {}).length +
              Object.keys(edits[`${item.index}:ar`] ?? {}).length;

            if (!isOpen && open !== null) return null;

            return (
              <article className="adm-card" key={item.index}>
                <button
                  type="button"
                  className="adm-card__head"
                  onClick={() => setOpen(isOpen ? null : item.index)}
                  aria-expanded={isOpen}
                  style={{
                    inlineSize: '100%',
                    background: 'none',
                    border: 0,
                    borderBlockEnd: isOpen ? '1px solid var(--border)' : 0,
                    cursor: 'pointer',
                    textAlign: 'start',
                    display: 'block',
                    padding: 'var(--adm-4) var(--adm-5)',
                  }}
                >
                  <span className="adm-card__title" style={{ display: 'block' }}>
                    {item.title || <em style={{ color: 'var(--muted-foreground)' }}>Untitled</em>}
                  </span>
                  {item.sub ? (
                    <span
                      style={{
                        display: 'block',
                        marginBlockStart: 4,
                        color: 'var(--muted-foreground)',
                        fontSize: 'var(--adm-text-sm)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.sub}
                    </span>
                  ) : null}
                  {itemDirty ? (
                    <span className="adm-badge adm-badge--warn" style={{ marginBlockStart: 8 }}>
                      {itemDirty} edited
                    </span>
                  ) : null}
                </button>

                {isOpen ? (
                  <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
                    {item.fields.en.map((f) => {
                      const ar = arByPath.get(f.path) ?? '';
                      const Input = f.multiline ? 'textarea' : 'input';
                      return (
                        <div className="adm-field" key={f.path}>
                          <label className="adm-label" htmlFor={`i${item.index}-${f.path}`}>
                            {f.label}
                          </label>
                          <Input
                            className={f.multiline ? 'adm-textarea' : 'adm-input'}
                            id={`i${item.index}-${f.path}`}
                            lang="en"
                            dir="ltr"
                            value={valueOf(item.index, 'en', f.path, f.value)}
                            onChange={(e) =>
                              setField(item.index, 'en', f.path, e.target.value, f.value)
                            }
                          />
                          <Input
                            className={f.multiline ? 'adm-textarea' : 'adm-input'}
                            aria-label={`${f.label} (Arabic)`}
                            lang="ar"
                            dir="rtl"
                            style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
                            value={valueOf(item.index, 'ar', f.path, ar)}
                            onChange={(e) => setField(item.index, 'ar', f.path, e.target.value, ar)}
                          />
                        </div>
                      );
                    })}

                    <div
                      style={{
                        display: 'flex',
                        gap: 'var(--adm-2)',
                        paddingBlockStart: 'var(--adm-3)',
                        borderBlockStart: '1px solid var(--border)',
                      }}
                    >
                      <button
                        className="adm-btn adm-btn--sm adm-btn--ghost"
                        type="button"
                        onClick={() => setOpen(null)}
                      >
                        Back to all
                      </button>

                      <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--adm-2)' }}>
                        <button
                          className="adm-btn adm-btn--sm adm-btn--outline"
                          type="submit"
                          form="struct"
                          name="op"
                          value="move"
                          onClick={(e) => {
                            const f = e.currentTarget.form!;
                            (f.elements.namedItem('index') as HTMLInputElement).value = String(item.index);
                            (f.elements.namedItem('to') as HTMLInputElement).value = String(item.index - 1);
                          }}
                          disabled={item.index === 0 || working}
                        >
                          ↑ Earlier
                        </button>
                        <button
                          className="adm-btn adm-btn--sm adm-btn--outline"
                          type="submit"
                          form="struct"
                          name="op"
                          value="move"
                          onClick={(e) => {
                            const f = e.currentTarget.form!;
                            (f.elements.namedItem('index') as HTMLInputElement).value = String(item.index);
                            (f.elements.namedItem('to') as HTMLInputElement).value = String(item.index + 1);
                          }}
                          disabled={item.index === items.length - 1 || working}
                        >
                          ↓ Later
                        </button>

                        {/* Delete arms first. It rewrites three arrays and there
                            is no undo yet, so a single stray click must not do it. */}
                        {confirmRemove === item.index ? (
                          <button
                            className="adm-btn adm-btn--sm adm-btn--danger"
                            type="submit"
                            form="struct"
                            name="op"
                            value="remove"
                            onClick={(e) => {
                              const f = e.currentTarget.form!;
                              (f.elements.namedItem('index') as HTMLInputElement).value = String(item.index);
                            }}
                            disabled={working}
                          >
                            Confirm delete
                          </button>
                        ) : (
                          <button
                            className="adm-btn adm-btn--sm adm-btn--outline"
                            type="button"
                            onClick={() => setConfirmRemove(item.index)}
                          >
                            Delete
                          </button>
                        )}
                      </span>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </form>

      {/* Hidden inputs the structural form needs; kept outside the visible grid
          so the buttons above can set them by name. */}
      <input type="hidden" name="index" form="struct" defaultValue="-1" />
      <input type="hidden" name="to" form="struct" defaultValue="-1" />
    </>
  );
}
