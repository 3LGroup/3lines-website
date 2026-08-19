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

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--adm-4)' }}>
        <span className="adm-thumb" style={{ inlineSize: 132, blockSize: 88, flex: 'none' }}>
          {current ? <img src={current} alt="" /> : <Icon name="media" size={24} />}
        </span>

        <span style={{ minInlineSize: 0 }}>
          {/* The button first and the path second. The path is for confirming
              which file this is once you already care; the button is what
              someone arrives at this row wanting, so it should not be the thing
              they have to look past. */}
          <button
            className={`adm-btn adm-btn--sm ${open ? 'adm-btn--outline' : 'adm-btn--primary'}`}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? 'Cancel' : 'Change image'}
          </button>
          <code
            style={{
              display: 'block',
              marginBlockStart: 'var(--adm-2)',
              fontSize: 'var(--adm-text-xs)',
              color: 'var(--muted-foreground)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              direction: 'ltr',
            }}
          >
            {current || 'none'}
          </code>
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

          {/* Says how much the filter removed. Without it a search that matches
              three of a hundred and thirty-one looks like a library that only
              ever had three in it. */}
          <p className="adm-hint" style={{ marginBlockEnd: 'var(--adm-3)' }}>
            Showing {shown.length} of {library.length}. Click one to use it.
          </p>

          {shown.length ? (
            <div
              className="adm-tiles"
              style={{ maxBlockSize: 420, overflowY: 'auto', padding: 2 }}
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
                  className="adm-tile adm-tile--pick"
                >
                  <span className="adm-thumb">
                    <img src={m.path} alt="" loading="lazy" />
                  </span>
                  <span className="adm-tile__name">{m.name}</span>
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
