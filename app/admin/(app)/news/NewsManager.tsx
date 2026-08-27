'use client';

import { useActionState, useState } from 'react';
import Icon from '@/components/admin/Icon';
import ImagePicker from '@/components/admin/ImagePicker';
import type { NewsCard } from '@/lib/admin/news';
import { newsStructural, setNewsImageAction, type NewsState } from './actions';

/**
 * The card lifecycle — image, order, create, delete. The card's words are the
 * SimpleForm below this component; these are the operations that touch more
 * than one record and post instantly rather than riding the text Save.
 */
export default function NewsManager({
  posts,
}: {
  posts: NewsCard[];
}) {
  const [structState, structAction, structPending] = useActionState<NewsState, FormData>(
    newsStructural,
    {}
  );
  const [imgState, imgAction] = useActionState<NewsState, FormData>(setNewsImageAction, {});
  const [creating, setCreating] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);

  const message = structState.error || imgState.error || structState.detail || imgState.detail;
  const isError = Boolean(structState.error || imgState.error);

  const fill = (e: React.MouseEvent<HTMLButtonElement>, fields: Record<string, string>) => {
    const f = e.currentTarget.form!;
    for (const [name, value] of Object.entries(fields)) {
      (f.elements.namedItem(name) as HTMLInputElement).value = value;
    }
  };

  return (
    <div style={{ display: 'grid', gap: 'var(--adm-4)', marginBlockEnd: 'var(--adm-6)' }}>
      <form action={imgAction} id="newsimg" />

      <div style={{ display: 'flex', gap: 'var(--adm-3)', alignItems: 'center' }}>
        {!creating ? (
          <button
            className="adm-btn adm-btn--outline adm-btn--sm"
            type="button"
            onClick={() => setCreating(true)}
          >
            + New post
          </button>
        ) : null}
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
      </div>

      {creating ? (
        <form
          action={structAction}
          className="adm-card"
          style={{ padding: 'var(--adm-5)', display: 'grid', gap: 'var(--adm-4)', maxInlineSize: 560 }}
        >
          <input type="hidden" name="op" value="create" />
          <div className="adm-field">
            <label className="adm-label" htmlFor="nn-title-en">
              Headline
            </label>
            <p className="adm-hint">
              The address is derived from the English headline. A hidden article page is created
              with it — write the article under Pages &amp; SEO, then switch it on.
            </p>
            <input className="adm-input" id="nn-title-en" name="titleEn" lang="en" dir="ltr" required />
            <input
              className="adm-input"
              name="titleAr"
              aria-label="Headline (Arabic)"
              lang="ar"
              dir="rtl"
              style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
              required
            />
          </div>
          <div className="adm-field">
            <label className="adm-label" htmlFor="nn-date">
              Date
            </label>
            <input
              className="adm-input"
              id="nn-date"
              name="date"
              dir="ltr"
              placeholder="YYYY-MM-DD"
              pattern="\d{4}-\d{2}-\d{2}"
              required
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--adm-2)' }}>
            <button className="adm-btn adm-btn--primary adm-btn--sm" type="submit" disabled={structPending}>
              {structPending ? 'Creating…' : 'Create post'}
            </button>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" type="button" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <form action={structAction} id="newsstruct">
        <input type="hidden" name="op" defaultValue="" />
        <input type="hidden" name="id" defaultValue="" />
      </form>

      {posts.map((p, i) => (
        <section className="adm-card" key={p.id}>
          <div className="adm-card__head">
            <h2 className="adm-card__title">{p.title.en || p.slug}</h2>
            <code className="adm-badge">{p.route}</code>
            <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 'var(--adm-1)' }}>
              <button
                className="adm-btn adm-btn--sm adm-btn--ghost"
                type="submit"
                form="newsstruct"
                aria-label={`Move ${p.title.en} earlier`}
                disabled={i === 0 || structPending}
                onClick={(e) => fill(e, { op: 'moveUp', id: p.id })}
              >
                ↑
              </button>
              <button
                className="adm-btn adm-btn--sm adm-btn--ghost"
                type="submit"
                form="newsstruct"
                aria-label={`Move ${p.title.en} later`}
                disabled={i === posts.length - 1 || structPending}
                onClick={(e) => fill(e, { op: 'moveDown', id: p.id })}
              >
                ↓
              </button>
              {armed === p.id ? (
                <button
                  className="adm-btn adm-btn--sm adm-btn--danger"
                  type="submit"
                  form="newsstruct"
                  disabled={structPending}
                  onClick={(e) => fill(e, { op: 'delete', id: p.id })}
                >
                  Confirm delete
                </button>
              ) : (
                <button
                  className="adm-btn adm-btn--sm adm-btn--ghost"
                  type="button"
                  aria-label={`Delete ${p.title.en}`}
                  onClick={() => setArmed(p.id)}
                >
                  <Icon name="trash" size={13} />
                </button>
              )}
            </span>
          </div>
          <div className="adm-card__body">
            <ImagePicker
              label="Card image"
              current={p.mediaSrc ?? ''}
              name={{ path: p.id, shape: 'src' }}
              formId="newsimg"
            />
          </div>
        </section>
      ))}
    </div>
  );
}
