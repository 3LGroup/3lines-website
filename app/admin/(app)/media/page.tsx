import type { Metadata } from 'next';
import { listAllMedia, mediaFolders } from '@/lib/admin/media';
import Uploader from '@/components/admin/Uploader';

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

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Images</h1>
        <p className="adm-page__lede">
          {items.length} pictures and logos. Upload more below — then to put one on a card, open
          the section it belongs to and press <strong>Change image</strong> there.
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
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
