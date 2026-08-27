import type { Metadata } from 'next';
import { listAllMedia, mediaFolders } from '@/lib/admin/media';
import { isUploadPath } from '@/lib/admin/uploads';
import Uploader from '@/components/admin/Uploader';
import DeleteImage from '@/components/admin/DeleteImage';

export const metadata: Metadata = { title: 'Images' };

/**
 * Every image the site holds, grouped by folder, plus the uploader.
 *
 * "uploads" is its own folder in this listing rather than being mixed into the
 * others, because the rest are named after how the original site organised
 * itself — photos, logos, certs — and an editor has no way to know which of
 * those a new picture belongs in.
 */
export default async function MediaPage() {
  const items = await listAllMedia();
  const folders = mediaFolders(items);

  /* Repo images can only be deleted where a filesystem exists. In a Worker,
     public/ ships as immutable Static Assets, so offering the control there
     would mean arming a two-click delete that always ends in a refusal — the
     control has to know what it is running on. Uploads (R2) delete everywhere. */
  const inWorker =
    (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') ||
    'WebSocketPair' in globalThis;

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Images</h1>
        <p className="adm-page__lede">
          {items.length} pictures and logos. Upload more below — then to put one on a card, open
          the section it belongs to and press <strong>Change image</strong> there.
          {inWorker ? (
            <>
              {' '}
              Pictures you upload can be deleted here; the ones that shipped with the site are part
              of the build and need a developer to remove.
            </>
          ) : null}
        </p>
        <p style={{ marginBlockStart: 'var(--adm-3)', display: 'flex', gap: 'var(--adm-2)' }}>
          <a className="adm-btn adm-btn--sm adm-btn--outline" href="/admin/c/companies">
            Companies
          </a>
          <a className="adm-btn adm-btn--sm adm-btn--outline" href="/admin/c/services">
            Services
          </a>
          <a className="adm-btn adm-btn--sm adm-btn--outline" href="/admin/c/partners">
            Partners
          </a>
        </p>
      </div>

      <Uploader />

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
            <div className="adm-card__body adm-tiles">
              {inFolder.map((m) => (
                <figure className="adm-tile" key={m.path}>
                  <span className="adm-thumb">
                    <img src={m.path} alt="" loading="lazy" />
                  </span>
                  <figcaption className="adm-tile__name" title={m.path}>
                    {m.name}
                  </figcaption>
                  {/* Every image the environment can actually remove: the
                      action also refuses, naming the places, while anything
                      still references the file — so offering the button cannot
                      break a page nobody edited. */}
                  {!inWorker || isUploadPath(m.path) ? (
                    <DeleteImage path={m.path} name={m.name} />
                  ) : null}
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
