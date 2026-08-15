import { cookies, headers } from 'next/headers';
import { sign, verify, verifyPassword } from './crypto';

/**
 * Session handling for /admin.
 *
 * There is no middleware in this design. @opennextjs/cloudflare does not support
 * Next's Node.js middleware, and Next 16 renames middleware.ts to proxy.ts which
 * the adapter does not support either — so an auth gate built on middleware would
 * be standing on the one part of the stack with a known migration cliff.
 *
 * That turns out to be the better architecture anyway. Next's own guidance is
 * that middleware is an optimistic redirect and never the security boundary,
 * because a request that reaches a route handler directly has not passed through
 * it. So the check lives where the data is: `requireSession()` is called by the
 * admin layout AND independently by every route handler and server action. There
 * is one enforcement point, not a fast one and a real one that can disagree.
 */

const COOKIE = 'cms_session';

/** Seven days. Long enough not to nag, short enough that a stolen cookie expires. */
const MAX_AGE_S = 7 * 24 * 60 * 60;

/** Refresh the cookie once it is within a day of expiring, so active use never logs you out. */
const REFRESH_WITHIN_S = 24 * 60 * 60;

export interface Session {
  /** Who. A single operator today; becomes a users row in M7. */
  sub: string;
  /** Expiry, epoch seconds. */
  exp: number;
  /**
   * Token version. Bumping SESSION_VERSION invalidates every issued cookie at
   * once — the revoke-all that a stateless session otherwise cannot do.
   */
  v: number;
}

const VERSION = Number(process.env.SESSION_VERSION ?? '1');

/**
 * Fail closed, and fail loudly at the point of use.
 *
 * An unset secret must never degrade to a default value: signing with a known
 * constant is indistinguishable from not signing at all, and it would only be
 * noticed once someone forged a cookie.
 */
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'SESSION_SECRET is unset or shorter than 32 chars. Generate one with `npm run admin:secret`.'
    );
  }
  return s;
}

const now = () => Math.floor(Date.now() / 1000);

/* ----------------------------------------------------------------- read -- */

/** The current session, or null. Never throws for an absent or bad cookie. */
export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const payload = await verify<Session>(token, secret());
  if (!payload) return null;

  if (typeof payload.exp !== 'number' || payload.exp <= now()) return null;
  // A version bump invalidates outstanding cookies without server-side state.
  if (payload.v !== VERSION) return null;

  return payload;
}

/* ---------------------------------------------------------------- write -- */

/**
 * `Secure` has to follow the actual scheme, not the build mode.
 *
 * Keying it off NODE_ENV looks right and fails in a way that wastes an
 * afternoon: `next start` is NODE_ENV=production, so a local production build
 * served over http://127.0.0.1 issues a Secure cookie, the browser silently
 * discards it, and every login appears to succeed and then bounce back to the
 * login page with no error anywhere. Nothing logs, because nothing failed.
 *
 * The host header is the honest signal. Production is always HTTPS on Workers,
 * so this evaluates to true there; only a loopback origin opts out.
 */
async function isSecureRequest(): Promise<boolean> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto');
  if (proto) return proto.split(',')[0]!.trim() === 'https';
  const host = h.get('host') ?? '';
  return !/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
}

const BASE_COOKIE = {
  httpOnly: true,
  // Lax rather than Strict: the admin is reached by following a link often
  // enough that Strict would present a logged-out page on first navigation.
  sameSite: 'lax' as const,
  path: '/',
};

async function issue(sub: string): Promise<void> {
  const payload: Session = { sub, exp: now() + MAX_AGE_S, v: VERSION };
  const token = await sign(payload, secret());
  (await cookies()).set(COOKIE, token, {
    ...BASE_COOKIE,
    secure: await isSecureRequest(),
    maxAge: MAX_AGE_S,
  });
}

/**
 * Verify a password and start a session.
 *
 * Returns false rather than throwing on a bad password: a failed login is an
 * expected outcome, not an exceptional one, and throwing would make it harder to
 * keep the failure path constant-time.
 */
export async function login(password: string): Promise<boolean> {
  const stored = process.env.CMS_PASSWORD_HASH;
  if (!stored) {
    throw new Error('CMS_PASSWORD_HASH is unset. Generate one with `npm run admin:password`.');
  }

  const ok = await verifyPassword(password, stored);
  if (!ok) return false;

  await issue(process.env.CMS_USER ?? 'admin');
  return true;
}

export async function logout(): Promise<void> {
  // Same attributes as when it was issued: a browser will not overwrite a
  // cookie whose path or secure flag differs, so a mismatch here silently
  // leaves the session in place.
  (await cookies()).set(COOKIE, '', {
    ...BASE_COOKIE,
    secure: await isSecureRequest(),
    maxAge: 0,
  });
}

/** Extend a session that is close to expiring. No-op otherwise. */
export async function refreshIfStale(session: Session): Promise<void> {
  if (session.exp - now() < REFRESH_WITHIN_S) await issue(session.sub);
}
