import type { Metadata } from 'next';
import { listMedia, mediaFolders } from '@/lib/admin/media';

export const metadata: Metadata = { title: 'Images' };

/**
 * Every image the site ships, grouped by folder.
 *
 * Read-only on purpose. Uploading needs somewhere to put the file, and a Worker
 * has no writable filesystem — that is R2, which is not connected yet. Showing a
 * disabled "Upload" button would imply the capability exists; the page says
 * plainly that it does not, and remains useful in the meantime because the
 * pictures a person needs to choose between are all here.
 */
export default function MediaPage() {
  const items = listMedia();
  const folders = mediaFolders(items);

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Images</h1>
        <p className="adm-page__lede">
          The {items.length} images already on the site. To use one, open Companies, Services or
          Partners, click a card, then <strong>Change image</strong>.
        </p>
      </div>

      <div className="adm-alert adm-alert--warn" style={{ marginBlockEnd: 'var(--adm-5)' }}>
        <span>
          <strong>Adding new images needs a developer for now.</strong> Uploading requires cloud
          storage that is not connected yet, so this page shows what exists rather than letting you
          add to it. Everything here can be applied to any card today.
        </span>
      </div>

      {folders.map((folder) => {
        const inFolder = items.filter((i) => i.folder === folder);
        return (
          <section className="adm-card" key={folder} style={{ marginBlockEnd: 'var(--adm-4)' }}>
            <div className="adm-card__head">
              <h2 className="adm-card__title">{folder}</h2>
              <span className="adm-badge" style={{ marginInlineStart: 'auto' }}>
                {inFolder.length}
              </span>
            </div>
            <div
              className="adm-card__body"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(128px,1fr))',
                gap: 'var(--adm-3)',
              }}
            >
              {inFolder.map((m) => (
                <figure key={m.path} style={{ margin: 0, display: 'grid', gap: 6 }}>
                  {/* Checkerboard: a lot of these are transparent PNGs, and a
                      white mark on a flat surface looks like a missing file. */}
                  <span
                    style={{
                      blockSize: 82,
                      display: 'grid',
                      placeItems: 'center',
                      padding: 8,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      backgroundImage:
                        'linear-gradient(45deg,var(--muted) 25%,transparent 25%,transparent 75%,var(--muted) 75%),linear-gradient(45deg,var(--muted) 25%,transparent 25%,transparent 75%,var(--muted) 75%)',
                      backgroundSize: '14px 14px',
                      backgroundPosition: '0 0, 7px 7px',
                    }}
                  >
                    <img
                      src={m.path}
                      alt=""
                      loading="lazy"
                      style={{ maxInlineSize: '100%', maxBlockSize: '100%', objectFit: 'contain' }}
                    />
                  </span>
                  <figcaption
                    style={{
                      fontSize: 'var(--adm-text-xs)',
                      color: 'var(--muted-foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={m.path}
                  >
                    {m.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
