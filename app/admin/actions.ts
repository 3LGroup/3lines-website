'use server';

import { redirect } from 'next/navigation';
import { login, logout, readSession } from '@/lib/admin/session';

/**
 * Server actions rather than route handlers.
 *
 * Two reasons. Next applies an Origin/Host check to every action invocation, so
 * CSRF protection is the framework's job rather than a header comparison this
 * code has to remember to write. And an action is reachable from a plain <form>,
 * so login and logout work with JavaScript disabled or still loading — which is
 * the state the login page is in most often, being the first request of a
 * session.
 */

export interface LoginState {
  error?: string;
}

/** Rejected logins are throttled in-process. See the note on `attempts`. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

/**
 * Per-instance, in-memory, and therefore only a speed bump.
 *
 * On Workers each isolate has its own copy and they are recycled freely, so an
 * attacker with patience or luck gets more than MAX_ATTEMPTS. Stating that
 * plainly rather than implying real rate limiting: the actual defences are a
 * 600k-iteration PBKDF2 verify, which caps throughput at roughly seven guesses a
 * second per isolate, and a password this code refuses to generate below 12
 * characters. Durable per-IP limiting arrives with D1 in M2; Cloudflare's own
 * Rate Limiting Rules can cover it at the edge before then.
 */
const attempts = new Map<string, { n: number; first: number }>();

function throttled(key: string): boolean {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { n: 1, first: now });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_ATTEMPTS;
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get('password') ?? '');
  if (!password) return { error: 'Enter your password.' };

  if (throttled('login')) {
    return { error: 'Too many attempts. Wait a few minutes and try again.' };
  }

  let ok = false;
  try {
    ok = await login(password);
  } catch (err) {
    // A missing CMS_PASSWORD_HASH or SESSION_SECRET is a deployment fault, not a
    // failed login. Say so, because "incorrect password" would send someone
    // hunting for the wrong problem.
    return { error: err instanceof Error ? err.message : 'Sign-in is not configured.' };
  }

  if (!ok) return { error: 'Incorrect password.' };

  attempts.delete('login');
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/admin/login');
}

/** For handlers that need the session but are not rendered inside the shell. */
export async function requireSession() {
  const session = await readSession();
  if (!session) redirect('/admin/login');
  return session;
}
