import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Icon from '@/components/admin/Icon';
import { readSession } from '@/lib/admin/session';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Outside the (app) route group, so it renders without the shell and without the
 * auth gate — the gate lives in app/admin/(app)/layout.tsx and would otherwise
 * redirect this page to itself.
 */
export default async function LoginPage() {
  // Reaching the login form with a valid cookie means a stale bookmark, not a
  // request to sign in again.
  if (await readSession()) redirect('/admin');

  return (
    <main className="adm-login">
      <div className="adm-login__card">
        <div className="adm-login__brand">
          <span className="adm-brand__mark" aria-hidden="true">
            3L
          </span>
          <span className="adm-brand">
            3Lines
            <span className="adm-brand__sub">CMS</span>
          </span>
        </div>

        <h1 className="adm-page__title" style={{ fontSize: 'var(--adm-text-xl)' }}>
          Sign in
        </h1>
        <p className="adm-page__lede" style={{ marginBlockEnd: 'var(--adm-5)' }}>
          Manage the content of 3lines.com.sa.
        </p>

        <LoginForm />

        <p className="adm-hint" style={{ marginBlockStart: 'var(--adm-5)' }}>
          <Icon name="lock" /> This area is not indexed and is rate limited.
        </p>
      </div>
    </main>
  );
}
