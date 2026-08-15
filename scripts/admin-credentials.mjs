/**
 * Generate the two secrets the admin needs.
 *
 *   node scripts/admin-credentials.mjs secret
 *   node scripts/admin-credentials.mjs password "the password"
 *
 * The hash format here is a contract with lib/admin/crypto.ts and the two must
 * agree exactly: `pbkdf2-sha256.<iterations>.<salt>.<derived>`, base64url. Dots
 * rather than the conventional `$`, because Next loads .env through
 * dotenv-expand and `$600000$<salt>` gets interpolated into nothing -- the hash
 * arrives 32 characters shorter and every login fails as "incorrect password"
 * with a perfectly valid hash sitting on disk. Shells and CI secret stores do
 * the same. base64url has no dot, so this survives all of them. The
 * algorithm is duplicated rather than imported because this is a .mjs script and
 * that is a .ts module compiled by Next — importing across that boundary would
 * mean a build step for a tool whose whole job is to run once, before anything
 * is built. If you change the format, change both.
 *
 * Neither value is ever written to a file by this script. Printing them and
 * letting a human paste them into .env.local or `wrangler secret put` means
 * there is no moment where a secret sits in a temp file nobody remembers.
 */
import { webcrypto as crypto } from 'node:crypto';

const enc = new TextEncoder();

const b64u = (bytes) => Buffer.from(bytes).toString('base64url');

const PBKDF2_ITERATIONS = 600_000; // must match lib/admin/crypto.ts
const SALT_BYTES = 16;
const KEY_BITS = 256;

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BITS
  );
  return `pbkdf2-sha256.${PBKDF2_ITERATIONS}.${b64u(salt)}.${b64u(new Uint8Array(bits))}`;
}

const [, , cmd, ...rest] = process.argv;

if (cmd === 'secret') {
  // 48 bytes -> 64 base64url chars, comfortably past the 32-char floor
  // lib/admin/session.ts enforces.
  console.log(b64u(crypto.getRandomValues(new Uint8Array(48))));
} else if (cmd === 'password') {
  // ADMIN_PASSWORD takes precedence over argv. Arguments are visible in the
  // process list to any other user on the machine; an environment variable of a
  // short-lived child process is not.
  const password = process.env.ADMIN_PASSWORD ?? rest.join(' ');
  if (!password) {
    console.error(
      [
        'Usage:',
        '  node scripts/admin-credentials.mjs password "<password>"',
        '  ADMIN_PASSWORD="<password>" node scripts/admin-credentials.mjs password',
      ].join('\n')
    );
    process.exit(1);
  }
  if (password.length < 12) {
    // A single shared credential guards the whole CMS until per-user accounts
    // land. A short one is not a tradeoff worth offering.
    console.error(`Refusing: password is ${password.length} chars, minimum is 12.`);
    process.exit(1);
  }
  const started = Date.now();
  const hash = await hashPassword(password);
  console.log(hash);
  console.error(`\n(derived in ${Date.now() - started}ms at ${PBKDF2_ITERATIONS} iterations)`);
} else {
  console.error(
    [
      'Usage:',
      '  node scripts/admin-credentials.mjs secret               -> SESSION_SECRET',
      '  node scripts/admin-credentials.mjs password "<pw>"      -> CMS_PASSWORD_HASH',
    ].join('\n')
  );
  process.exit(1);
}
