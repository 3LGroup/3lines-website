import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import Icon, { type IconName } from '@/components/admin/Icon';
import NavItem from '@/components/admin/NavItem';
import PublishButton from '@/components/admin/PublishButton';
import { readSession, refreshIfStale } from '@/lib/admin/session';
import { logoutAction } from '../actions';

/**
 * The authenticated shell.
 *
 * A route group rather than a path segment, so /admin renders the dashboard
 * while /admin/login sits outside this layout entirely. Putting the gate in
 * app/admin/layout.tsx would have caught the login page too and produced a
 * redirect loop — the classic version of this bug.
 *
 * This redirect is the convenience, not the security boundary. Route handlers
 * and server actions each call readSession() themselves; nothing trusts having
 * been rendered inside this layout. That split is deliberate — a request can
 * reach a handler without passing through any layout.
 */

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Sections whose screens land in a later milestone. Shown, but not linked. */
  pending?: string;
}

/**
 * Entities first, structure second.
 *
 * Matches the CMS already running at 3lines.com.sa/cms, which offers four things
 * you can point at — and is far easier to use than a tree of pages and sections
 * even though it can do less. Companies, Services and Partners are what someone
 * actually sits down to change; Pages is kept below them for the copy that lives
 * nowhere else, like the About page's prose or a page's search description.
 */
const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Content',
    items: [
      { href: '/admin/c/companies', label: 'Companies', icon: 'companies' },
      { href: '/admin/c/services', label: 'Services', icon: 'services' },
      { href: '/admin/c/partners', label: 'Partners', icon: 'partners' },
      { href: '/admin/news', label: 'News', icon: 'news' },
      { href: '/admin/bands', label: 'Shared bands', icon: 'dashboard' },
    ],
  },
  {
    group: 'Everything else',
    items: [
      { href: '/admin/media', label: 'Images', icon: 'media' },
      { href: '/admin/navigation', label: 'Navigation', icon: 'menu' },
      { href: '/admin/ui', label: 'Interface text', icon: 'settings' },
      { href: '/admin/site', label: 'Site info', icon: 'settings' },
      { href: '/admin/pages', label: 'Pages & SEO', icon: 'pages' },
      { href: '/admin', label: 'Dashboard', icon: 'dashboard' },
    ],
  },
];

export default async function AdminShell({ children }: { children: ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/admin/login');

  // Keeps an active editor logged in without extending a stale cookie forever.
  await refreshIfStale(session);

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <div className="adm-brand">
          <span className="adm-brand__mark" aria-hidden="true">
            3L
          </span>
          <span>
            3Lines
            <span className="adm-brand__sub">CMS</span>
          </span>
        </div>

        <nav aria-label="Sections">
          {NAV.map((section) => (
            <div className="adm-nav" key={section.group}>
              <p className="adm-nav__label">{section.group}</p>
              {section.items.map((item) =>
                item.pending ? (
                  /* Rendered but inert. Linking to a route that does not exist
                     yet would 404; hiding it entirely would make the CMS look
                     smaller than it is going to be. This says which milestone. */
                  <span
                    className="adm-nav__item"
                    key={item.href}
                    aria-disabled="true"
                    style={{ opacity: 0.45, cursor: 'not-allowed' }}
                    title={`Arrives in ${item.pending}`}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                    <span className="adm-badge" style={{ marginInlineStart: 'auto' }}>
                      {item.pending}
                    </span>
                  </span>
                ) : (
                  <NavItem key={item.href} href={item.href} label={item.label} icon={item.icon} />
                )
              )}
            </div>
          ))}
        </nav>

        <div className="adm-sidebar__foot">
          <button className="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-adm-theme>
            <Icon name="theme" />
            Theme
          </button>
          <form action={logoutAction}>
            <button className="adm-btn adm-btn--ghost adm-btn--sm" type="submit">
              <Icon name="logout" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <span className="adm-topbar__title">3Lines Advanced Technologies</span>
          <div className="adm-topbar__actions">
            <PublishButton />
            <span className="adm-badge">{session.sub}</span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
