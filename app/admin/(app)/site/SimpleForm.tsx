'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/admin/Icon';
import type { SiteState } from './actions';

export interface SimpleField {
  /**
   * Logical key WITHOUT a locale — this component appends one.
   *
   * It has to own that, and the first version did not: callers passed a key
   * already ending in `:en`, the Arabic input appended another suffix to make
   * `<id>:title:en:ar`, and the action's split(':') read the first three
   * segments and discarded the `:ar`. Every Arabic edit was written to the
   * English column. It looked like it saved, said "Saved 1 field", and quietly
   * destroyed the English headline.
   */
  key: string;
  label: string;
  value: string;
  /** Present for localized fields; absent for shared ones like a VAT number. */
  ar?: string;
  hint?: string;
  multiline?: boolean;
  /** Groups fields under a heading. */
  group?: string;
}

/**
 * A plain form over a flat list of fields.
 *
 * Deliberately not the generic tree editor used for page copy. Site info and the
 * newsroom index are a fixed handful of named values, and a fixed form reads
 * better than a walker that has to infer labels — the previous CMS showed
 * exactly this and it is why its Site Info screen is legible at a glance.
 */
export default function SimpleForm({
  fields,
  action,
  title,
}: {
  fields: SimpleField[];
  action: (prev: SiteState, form: FormData) => Promise<SiteState>;
  title: string;
}) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState<SiteState, FormData>(action, {});

  const dirty = useMemo(() => Object.keys(edits).length, [edits]);

  /* Only the SUBMITTED edits clear on success — anything typed while the save
     round trip was in flight stays marked unsaved instead of being silently
     absorbed into "No changes". */
  const submitted = useRef<Record<string, string>>({});
  const handled = useRef<SiteState | null>(null);
  useEffect(() => {
    if (state.ok && state !== handled.current) {
      handled.current = state;
      const sent = submitted.current;
      setEdits((cur) =>
        Object.fromEntries(Object.entries(cur).filter(([k, v]) => sent[k] !== v))
      );
    }
  }, [state]);

  const set = (key: string, value: string, original: string) =>
    setEdits((prev) => {
      const next = { ...prev };
      if (value === original) delete next[key];
      else next[key] = value;
      return next;
    });

  const val = (key: string, original: string) => edits[key] ?? original;

  const groups = useMemo(() => {
    const m = new Map<string, SimpleField[]>();
    for (const f of fields) {
      const g = f.group ?? '';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(f);
    }
    return [...m];
  }, [fields]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submitted.current = edits;
      }}
    >
      <input type="hidden" name="edits" value={JSON.stringify(edits)} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--adm-3)',
          marginBlockEnd: 'var(--adm-4)',
        }}
      >
        <span className={dirty ? 'adm-badge adm-badge--warn' : 'adm-badge'}>
          {dirty ? `${dirty} unsaved change${dirty === 1 ? '' : 's'}` : 'No changes'}
        </span>
        {state.error ? (
          <span className="adm-error" role="alert" style={{ margin: 0 }}>
            <Icon name="alert" size={13} />
            {state.error}
          </span>
        ) : null}
        {state.ok && state.detail ? (
          <span className="adm-badge adm-badge--ok" role="status">
            <Icon name="check" size={12} />
            {state.detail}
          </span>
        ) : null}
        <button
          className="adm-btn adm-btn--primary adm-btn--sm"
          type="submit"
          disabled={!dirty || pending}
          style={{ marginInlineStart: 'auto' }}
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {groups.map(([group, list]) => (
        <section className="adm-card" key={group || title} style={{ marginBlockEnd: 'var(--adm-3)' }}>
          {group ? (
            <div className="adm-card__head">
              <h2 className="adm-card__title">{group}</h2>
            </div>
          ) : null}
          <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
            {list.map((f) => {
              const Input = f.multiline ? 'textarea' : 'input';
              // Localized fields are addressed `key:en` / `key:ar`; shared ones
              // stay bare. The suffix is added here and nowhere else.
              const enKey = f.ar !== undefined ? `${f.key}:en` : f.key;
              return (
                <div className="adm-field" key={f.key}>
                  <label className="adm-label" htmlFor={f.key}>
                    {f.label}
                  </label>
                  {f.hint ? <p className="adm-hint">{f.hint}</p> : null}
                  <Input
                    className={f.multiline ? 'adm-textarea' : 'adm-input'}
                    id={f.key}
                    lang="en"
                    dir="ltr"
                    value={val(enKey, f.value)}
                    onChange={(e) => set(enKey, e.target.value, f.value)}
                  />
                  {/* Only localized fields get an Arabic twin. A VAT number has
                      no language, and offering one would invite two answers to a
                      question with a single correct value. */}
                  {f.ar !== undefined ? (
                    <Input
                      className={f.multiline ? 'adm-textarea' : 'adm-input'}
                      aria-label={`${f.label} (Arabic)`}
                      lang="ar"
                      dir="rtl"
                      style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
                      value={val(`${f.key}:ar`, f.ar)}
                      onChange={(e) => set(`${f.key}:ar`, e.target.value, f.ar!)}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </form>
  );
}
