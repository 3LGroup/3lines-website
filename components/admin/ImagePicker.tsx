'use client';

import { useMemo, useState } from 'react';
import Icon from './Icon';
import type { MediaItem } from '@/lib/admin/media';

/**
 * Current image, and a library to swap it for another.
 *
 * Choosing from a fixed set rather than typing a path: every option is a file
 * the site actually ships, so a broken image is unreachable through this control
 * — which matters more than convenience, since the person using it cannot check
 * whether `/assets/photos/hero-mro.jpg` exists.
 *
 * Plain <img>, not next/image. The marketing tree deliberately excludes
 * next/image because it rewrites the DOM and would fail the visual audit; using
 * it only in the admin would mean two image pipelines to reason about for
 * thumbnails nobody's Core Web Vitals depend on.
 */
export default function ImagePicker({
  label,
  current,
  library,
  name,
  formId,
}: {
  label: string;
  current: string;
  library: MediaItem[];
  /** Rendered into the form so the server knows which field to write. */
  name: { path: string; shape: string };
  /**
   * The id of the image form to submit into.
   *
   * Required, and load-bearing: this component renders INSIDE the copy-editing
   * form, so without an explicit association its submit buttons would post the
   * copy form instead — saving text and never changing the image, with no error
   * to explain why.
   */
  formId: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<string>('all');

  const folders = useMemo(() => ['all', ...new Set(library.map((i) => i.folder))], [library]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.filter(
      (i) => (folder === 'all' || i.folder === folder) && (!q || i.name.toLowerCase().includes(q))
    );
  }, [library, query, folder]);

  return (
    <div className="adm-field">
      <span className="adm-label">{label}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--adm-3)' }}>
        {/* Checkerboard behind the thumbnail: many partner marks are transparent
            PNGs, and on a flat surface a white logo looks like an empty box. */}
        <span
          style={{
            inlineSize: 92,
            blockSize: 62,
            display: 'grid',
            placeItems: 'center',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: 6,
            flex: 'none',
            backgroundImage:
              'linear-gradient(45deg,var(--muted) 25%,transparent 25%,transparent 75%,var(--muted) 75%),linear-gradient(45deg,var(--muted) 25%,transparent 25%,transparent 75%,var(--muted) 75%)',
            backgroundSize: '12px 12px',
            backgroundPosition: '0 0, 6px 6px',
          }}
        >
          {current ? (
            <img
              src={current}
              alt=""
              style={{ maxInlineSize: '100%', maxBlockSize: '100%', objectFit: 'contain' }}
            />
          ) : (
            <Icon name="media" />
          )}
        </span>

        <span style={{ minInlineSize: 0 }}>
          <code
            style={{
              display: 'block',
              fontSize: 'var(--adm-text-sm)',
              color: 'var(--muted-foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {current || 'none'}
          </code>
          <button
            className="adm-btn adm-btn--sm adm-btn--outline"
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ marginBlockStart: 6 }}
            aria-expanded={open}
          >
            {open ? 'Cancel' : 'Change image'}
          </button>
        </span>
      </div>

      {open ? (
        <div
          className="adm-card"
          style={{ marginBlockStart: 'var(--adm-3)', padding: 'var(--adm-4)' }}
        >
          <div style={{ display: 'flex', gap: 'var(--adm-2)', marginBlockEnd: 'var(--adm-3)' }}>
            <input
              className="adm-input"
              placeholder="Search by file name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search images"
            />
            <select
              className="adm-select"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              aria-label="Filter by folder"
              style={{ inlineSize: 'auto' }}
            >
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f === 'all' ? `All (${library.length})` : f}
                </option>
              ))}
            </select>
          </div>

          {shown.length ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))',
                gap: 'var(--adm-2)',
                maxBlockSize: 320,
                overflowY: 'auto',
              }}
            >
              {shown.map((m) => (
                <button
                  key={m.path}
                  type="submit"
                  form={formId}
                  /* All three values ride on the ONE button rather than in
                     hidden inputs. Several pickers can be open at once and they
                     all target the same form, so hidden `path`/`shape` fields
                     would collide and the server would act on whichever won.
                     A submit button contributes only its own name/value, so
                     this is unambiguous by construction. `|` is safe: asset
                     paths come from the manifest and contain none. */
                  name="pick"
                  value={`${name.shape}|${name.path}|${m.path}`}
                  title={m.path}
                  aria-current={m.path === current ? 'true' : undefined}
                  style={{
                    display: 'grid',
                    gap: 4,
                    padding: 6,
                    border:
                      m.path === current
                        ? '2px solid var(--primary)'
                        : '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--background)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      blockSize: 54,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'var(--muted)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <img
                      src={m.path}
                      alt=""
                      loading="lazy"
                      style={{ maxInlineSize: '90%', maxBlockSize: '90%', objectFit: 'contain' }}
                    />
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--muted-foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="adm-hint">No images match “{query}”.</p>
          )}

        </div>
      ) : null}
    </div>
  );
}
