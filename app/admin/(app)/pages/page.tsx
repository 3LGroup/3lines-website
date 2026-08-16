import type { Metadata } from 'next';
import Icon from '@/components/admin/Icon';
import { listPages } from '@/lib/admin/content';

export const metadata: Metadata = { title: 'Pages' };

/**
 * Every page of the site, with how much of it is still English.
 *
 * "Untranslated" counts Arabic strings byte-identical to their English. That
 * over-reports — SAMI and XR are the same word in both languages — but it is the
 * only cheap signal for copy nobody has translated, and over-reporting is the
 * safe direction: it shows you somewhere to look rather than hiding a gap.
 */
export default async function PagesList() {
  const pages = await listPages();

  const totals = pages.reduce(
    (a, p) => ({
      fields: a.fields + p.fields,
      untranslated: a.untranslated + p.untranslated,
    }),
    { fields: 0, untranslated: 0 }
  );

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Pages</h1>
        <p className="adm-page__lede">
          Every page on 3lines.com.sa. Editing here changes the words only — layout, images and
          links are left exactly as they are.
        </p>
      </div>

      <div className="adm-stats" style={{ marginBlockEnd: 'var(--adm-6)' }}>
        <div className="adm-stat">
          <p className="adm-stat__value">{pages.length}</p>
          <p className="adm-stat__label">Pages</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat__value">{totals.fields.toLocaleString()}</p>
          <p className="adm-stat__label">Editable fields</p>
        </div>
        <div className="adm-stat">
          <p className="adm-stat__value">{totals.untranslated.toLocaleString()}</p>
          <p className="adm-stat__label">Arabic still in English</p>
        </div>
      </div>

      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Page</th>
              <th>Route</th>
              <th>Status</th>
              <th className="adm-table__num">Sections</th>
              <th className="adm-table__num">Fields</th>
              <th className="adm-table__num">Untranslated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.slug}>
                <td style={{ fontWeight: 500 }}>{p.title}</td>
                <td>
                  <code style={{ color: 'var(--muted-foreground)' }}>{p.route}</code>
                </td>
                <td>
                  {/* `placeholder` is not cosmetic — it drives noindex and drops
                      the page from the sitemap, so it is surfaced as a warning
                      rather than a neutral label. */}
                  <span
                    className={
                      p.status === 'published'
                        ? 'adm-badge adm-badge--ok'
                        : p.status === 'placeholder'
                          ? 'adm-badge adm-badge--warn'
                          : 'adm-badge'
                    }
                  >
                    {p.status === 'placeholder' ? 'Placeholder · noindex' : p.status}
                  </span>
                </td>
                <td className="adm-table__num">{p.blocks}</td>
                <td className="adm-table__num">{p.fields}</td>
                <td className="adm-table__num">
                  {p.untranslated > 0 ? (
                    <span className="adm-badge adm-badge--warn">{p.untranslated}</span>
                  ) : (
                    <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                  )}
                </td>
                <td>
                  <a className="adm-btn adm-btn--sm adm-btn--outline" href={`/admin/pages/${p.slug}`}>
                    Edit
                    <Icon name="pages" size={13} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
