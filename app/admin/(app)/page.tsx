import type { Metadata } from 'next';
import Icon from '@/components/admin/Icon';
import { BLOCK_TYPES, SECTION_BODY_KINDS } from '@/lib/blocks';
import { LOCALES } from '@/lib/i18n';
import routes from '@/content/routes.json';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * Counts come from static imports, not from lib/content.ts.
 *
 * That module reads content/ with fs.readFileSync(process.cwd() + …), which is
 * correct at build time and fails inside a Worker for the same reason
 * lib/assets.ts had to change: content/ ships as part of the deployment, not as
 * a directory the running isolate can walk. A static import is bundled, so it
 * resolves in both places.
 *
 * This is temporary either way. From M2 these numbers come from D1 and become
 * live — pages, drafts, media, recent activity — rather than a census of what
 * the last build contained.
 */
const pageCount = routes.length * LOCALES.length;

const STATS = [
  { value: routes.length, label: 'Routes' },
  { value: pageCount, label: 'Documents' },
  { value: LOCALES.length, label: 'Locales' },
  { value: BLOCK_TYPES.length + SECTION_BODY_KINDS.length, label: 'Block types' },
];

export default function Dashboard() {
  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Dashboard</h1>
        <p className="adm-page__lede">
          The shell is in place and authenticated. Content is still served from the committed JSON
          tree — connecting it to the database is the next milestone.
        </p>
      </div>

      <div className="adm-stats" style={{ marginBlockEnd: 'var(--adm-6)' }}>
        {STATS.map((s) => (
          <div className="adm-stat" key={s.label}>
            <p className="adm-stat__value">{s.value}</p>
            <p className="adm-stat__label">{s.label}</p>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 'var(--adm-4)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        }}
      >
        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Status</h2>
          </div>
          <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-3)' }}>
            <Row label="Deployment" value="Cloudflare Workers" ok />
            <Row label="Authentication" value="PBKDF2 + signed cookie" ok />
            <Row label="Content store" value="Committed JSON (read-only)" />
            <Row label="Database" value="Not connected" />
            <Row label="Media" value="Not connected" />
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Recent activity</h2>
          </div>
          {/* A real empty state rather than a blank panel. Nothing has been
              edited because nothing is editable yet, and saying so is more
              useful than an empty list that looks like a failed fetch. */}
          <div className="adm-empty">
            <span className="adm-empty__icon">
              <Icon name="news" />
            </span>
            <p className="adm-empty__title">No activity yet</p>
            <p className="adm-empty__body">
              Edits, publishes and sign-ins will appear here once the audit log is recording.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--adm-3)' }}>
      <span style={{ color: 'var(--muted-foreground)', minInlineSize: '9rem' }}>{label}</span>
      <span className={ok ? 'adm-badge adm-badge--ok' : 'adm-badge'}>
        {ok ? <Icon name="check" /> : null}
        {value}
      </span>
    </div>
  );
}
