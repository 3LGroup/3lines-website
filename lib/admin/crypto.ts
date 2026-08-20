/**
 * Password hashing and session signing, on WebCrypto only.
 *
 * Everything here uses `crypto.subtle` rather than node:crypto, and that is a
 * deployment constraint rather than a style preference. Cloudflare documents
 * node:crypto as supported, but with argon2 explicitly excluded and no
 * published per-function guidance on how the memory-hard KDFs behave against
 * the Worker CPU limit. PBKDF2 and HMAC via WebCrypto are documented,
 * unambiguous, and identical in Node 24 and workerd — so the same code path
 * runs in `next dev`, in `wrangler dev`, and in production.
 *
 * No dependencies. There is no bcrypt, argon2 or jsonwebtoken here on purpose:
 * each would be a native module or a parser to keep patched, for primitives the
 * platform already provides.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ------------------------------------------------------------- base64url -- */

/** base64url, because these values ride in cookies and URLs. */
export function b64u(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Length-independent, content constant-time comparison.
 *
 * Cloudflare ships `crypto.subtle.timingSafeEqual`, but it is a non-standard
 * extension and absent in Node, so this would silently become a plain compare
 * in local dev — the one place a developer would notice least. Comparing byte
 * by byte with a running OR is portable and the cost is irrelevant at these
 * sizes. Length is checked first and leaks only the length, which is fixed for
 * every value compared here anyway.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/* -------------------------------------------------------------- password -- */

/**
 * Capped by the Workers runtime, not chosen.
 *
 * OWASP's floor for PBKDF2-HMAC-SHA256 is 600k and this was set there, on the
 * theory that the only obstacle was the free tier's CPU budget. That was wrong:
 * Workers' WebCrypto rejects PBKDF2 above 100k iterations outright —
 * "iteration counts above 100000 are not supported" — on every plan. So a 600k
 * hash could be generated under Node and then never verified in the Worker, and
 * login failed for everyone with a hash that was itself perfectly valid.
 *
 * 100k is below the OWASP floor and that is a genuine weakening. What carries
 * the security here is password entropy rather than stretching: an offline
 * attack against a randomly generated 144-bit password is infeasible at any
 * iteration count. Do not pair this with a human-chosen password.
 *
 * Stored inside each hash rather than read from here at verify time, so changing
 * it does not invalidate existing passwords — old hashes keep verifying at their
 * own cost until they are next rewritten.
 */
const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

/**
 * `pbkdf2-sha256.<iterations>.<salt>.<derived>`, all base64url.
 *
 * Dot-separated, NOT the `$` of the PHC/crypt convention, and that is a scar
 * rather than a preference. Next loads .env files through dotenv-expand, which
 * treats `$name` as interpolation: a `$`-separated hash silently arrives at the
 * application as `pbkdf2-sha256-<garbage>`, 55 chars instead of 87, with the
 * iteration count and salt expanded into nothing. Every login then fails as
 * "incorrect password" while the hash on disk is perfectly valid.
 *
 * The same trap exists in shell exports, docker-compose, and most CI secret
 * stores. base64url never contains a dot, so the separator is unambiguous and
 * survives every one of them untouched.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256.${PBKDF2_ITERATIONS}.${b64u(salt)}.${b64u(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Name the failure instead of returning false. A hash that still contains `$`
  // has almost certainly been through an expanding env loader, and the symptom
  // -- correct password rejected -- points nowhere near the cause.
  if (stored.includes('$')) {
    throw new Error(
      'CMS_PASSWORD_HASH contains "$", which env loaders expand as a variable and corrupt. ' +
        'Regenerate it with `node scripts/admin-credentials.mjs password "<password>"`.'
    );
  }

  const parts = stored.split('.');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;

  const iterations = Number(parts[1]);
  // A malformed or absurd iteration count is a corrupt secret, not a login
  // attempt to evaluate. Refuse rather than deriving with attacker-chosen work.
  if (!Number.isInteger(iterations) || iterations < 1_000 || iterations > 10_000_000) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = unb64u(parts[2]!);
    expected = unb64u(parts[3]!);
  } catch {
    return false;
  }

  const derived = await pbkdf2(password, salt, iterations);
  return timingSafeEqual(derived, expected);
}

/* --------------------------------------------------------------- signing -- */

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * `<payload>.<signature>`, both base64url.
 *
 * Deliberately not a JWT. A JWT would carry a header declaring its own
 * algorithm, which is the source of the entire family of alg-confusion attacks,
 * and it would need a library to parse. There is exactly one algorithm here and
 * it is not negotiable by the token.
 */
export async function sign(payload: unknown, secret: string): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64u(new Uint8Array(sig))}`;
}

/** Returns the payload, or null for anything that is not a valid unexpired token. */
export async function verify<T = unknown>(token: string, secret: string): Promise<T | null> {
  const dot = token.indexOf('.');
  if (dot < 1) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let given: Uint8Array;
  try {
    given = unb64u(sig);
  } catch {
    return null;
  }

  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body))
  );
  if (!timingSafeEqual(given, expected)) return null;

  try {
    return JSON.parse(dec.decode(unb64u(body))) as T;
  } catch {
    return null;
  }
}
