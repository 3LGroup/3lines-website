import type { Metadata } from 'next';
import Icon from '@/components/admin/Icon';
import { LOCALES } from '@/lib/i18n';
import { COLLECTIONS } from '@/lib/admin/collections';
import { listAllMedia } from '@/lib/admin/media';
import routes from '@/content/routes.json';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * The first screen after signing in, so it answers "what can I do here".
 *
 * The counts are deliberately the ones an editor recognises — pages, languages,
 * pictures — rather than the ones the codebase finds interesting. An earlier
 * version of this screen reported "Block types: 20", which is a true fact about
 * the renderer and of no use whatever to the person who came here to fix a
 * typo.
 *
 * Route and locale counts come from static imports rather than lib/content.ts:
 * that module reads content/ with fs.readFileSync(process.cwd() + …), which is
 * correct at build time and fails inside a Worker, because content/ ships as
 * part of the deployment rather than as a directory the running isolate can
 * walk. The image count comes from listAllMedia(), which reads that same
 * bundled manifest and adds whatever has been uploaded since.
 */
const staticStats = [
  { value: routes.length, label: 'Pages' },
  { value: COLLECTIONS.length, label: 'Lists' },
];

const START = [
  { href: '/admin/c/companies', icon: 'companies', title: 'Companies', body: 'The group companies on the homepage.' },
  { href: '/admin/c/services', icon: 'services', title: 'Services', body: 'The service cards and their descriptions.' },
  { href: '/admin/c/partners', icon: 'partners', title: 'Partners', body: 'The partner and customer logos.' },
  { href: '/admin/news', icon: 'news', title: 'News', body: 'Headlines, categories and dates.' },
  { href: '/admin/site', icon: 'settings', title: 'Site info', body: 'Address, phone, email, CR and VAT.' },
  { href: '/admin/pages', icon: 'pages', title: 'Pages & SEO', body: 'Every word on every page, and its Google listing.' },
] as const;

export default async function Dashboard() {
  const STATS = [
    staticStats[0]!,
    staticStats[1]!,
    { value: (await listAllMedia()).length, label: 'Images' },
    { value: LOCALES.length, label: 'Languages' },
  ];

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">3Lines Advanced Technologies</h1>
        <p className="adm-page__lede">
          Change the words and pictures on 3lines.com.sa. Every field shows English with Arabic
          beneath it. Nothing reaches the live site until you press <strong>Publish</strong>.
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

      <h2 className="adm-card__title" style={{ marginBlockEnd: 'var(--adm-3)' }}>
        Start here
      </h2>
      {/* Three across rather than auto-fill. There are exactly six of these and
          auto-fill packed them 5 + 1, which reads as a layout that ran out
          rather than as a set of six things. */}
      <div className="adm-linkcards">
        {START.map((s) => (
          <a className="adm-card adm-linkcard" href={s.href} key={s.href}>
            <span className="adm-linkcard__icon">
              <Icon name={s.icon} />
            </span>
            <span>
              <span className="adm-linkcard__title">{s.title}</span>
              <span className="adm-linkcard__body">{s.body}</span>
            </span>
          </a>
        ))}
      </div>

      <section className="adm-card">
        <div className="adm-card__head">
          <h2 className="adm-card__title">What works today</h2>
        </div>
        <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-3)' }}>
          <Row label="Editing text" value="English and Arabic" ok />
          <Row label="Images" value="Upload new ones, or choose any already here" ok />
          <Row label="Preview" value="Beside every editor, updates on save" ok />
          <Row label="Publishing" value="From this browser" ok />
          {/* Stated plainly rather than omitted. A capability list that only
              lists capabilities reads as a complete one. */}
          <Row label="Uploading an SVG logo" value="Needs a developer" />
          <Row label="Undo, and who changed what" value="Not recorded yet" />
          <Row label="Sign-in" value="One shared password" />
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--adm-3)', flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--muted-foreground)', minInlineSize: '14rem' }}>{label}</span>
      <span className={ok ? 'adm-badge adm-badge--ok' : 'adm-badge'}>
        {ok ? <Icon name="check" /> : null}
        {value}
      </span>
    </div>
  );
}
