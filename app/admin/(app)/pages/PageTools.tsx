'use client';

import { useActionState, useState } from 'react';
import Icon from '@/components/admin/Icon';
import { createPageAction, deletePageAction, type PagesState } from './actions';
import { guarded } from '@/components/admin/guard';

/**
 * New-page form and per-page delete, kept client-side so delete can arm first.
 * Creation redirects into the editor; deletion needs two clicks because there
 * is no undo yet.
 */
export function NewPageForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<PagesState, FormData>(guarded(createPageAction), {});

  return (
    <div style={{ marginBlockEnd: 'var(--adm-5)' }}>
      {open ? (
        <form action={action} className="adm-card" style={{ padding: 'var(--adm-5)', display: 'grid', gap: 'var(--adm-4)', maxInlineSize: 560 }}>
          <div className="adm-field">
            <label className="adm-label" htmlFor="np-route">
              Address
            </label>
            <p className="adm-hint">
              Lowercase letters, numbers and hyphens, e.g. <code>/capabilities</code>. The page
              starts hidden from search engines until you switch it on in its editor.
            </p>
            <input className="adm-input" id="np-route" name="route" dir="ltr" placeholder="/example" required />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="np-title-en">
              Title
            </label>
            <input className="adm-input" id="np-title-en" name="titleEn" lang="en" dir="ltr" placeholder="Page title" required />
            <input
              className="adm-input"
              name="titleAr"
              aria-label="Title (Arabic)"
              lang="ar"
              dir="rtl"
              style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
              placeholder="عنوان الصفحة"
              required
            />
          </div>
          {state.error ? (
            <span className="adm-error" role="alert" style={{ margin: 0 }}>
              <Icon name="alert" size={13} />
              {state.error}
            </span>
          ) : null}
          <div style={{ display: 'flex', gap: 'var(--adm-2)' }}>
            <button className="adm-btn adm-btn--primary adm-btn--sm" type="submit" disabled={pending}>
              {pending ? 'Creating…' : 'Create page'}
            </button>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="adm-btn adm-btn--outline adm-btn--sm" type="button" onClick={() => setOpen(true)}>
          + New page
        </button>
      )}
    </div>
  );
}

export function DeletePageButton({ slug }: { slug: string }) {
  const [armed, setArmed] = useState(false);
  const [state, action, pending] = useActionState<PagesState, FormData>(guarded(deletePageAction), {});

  return (
    <form action={action} style={{ display: 'inline-flex', gap: 'var(--adm-1)', alignItems: 'center' }}>
      <input type="hidden" name="slug" value={slug} />
      {state.error ? (
        <span className="adm-error" role="alert" style={{ margin: 0, maxInlineSize: 260 }}>
          <Icon name="alert" size={12} />
          {state.error}
        </span>
      ) : null}
      {armed ? (
        <button className="adm-btn adm-btn--sm adm-btn--danger" type="submit" disabled={pending}>
          {pending ? 'Deleting…' : 'Confirm'}
        </button>
      ) : (
        <button
          className="adm-btn adm-btn--sm adm-btn--ghost"
          type="button"
          aria-label={`Delete ${slug}`}
          onClick={() => setArmed(true)}
        >
          <Icon name="trash" size={13} />
        </button>
      )}
    </form>
  );
}
