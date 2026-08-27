import { NextResponse } from 'next/server';

/**
 * Contact proxy.
 *
 * The browser cannot POST to the CMS endpoint directly: it sets
 * `Access-Control-Allow-Origin: *` but no `Allow-Methods`/`Allow-Headers`, and
 * returns 405 for non-POST — so the JSON preflight is rejected. Proxying
 * server-side sidesteps that and keeps the upstream host out of the client
 * bundle.
 *
 * Fails closed: with no endpoint configured this returns 503 rather than
 * pretending a message was delivered.
 */

/* Read per request, not at module scope. Under @opennextjs/cloudflare
   process.env is populated from the Worker env when a request arrives, so a
   value captured at module-init can be undefined — and this route would then
   answer 503 "unconfigured" while the endpoint was configured correctly. That
   is the site's primary conversion path. Trimmed for the same reason the
   publish secrets are: a piped secret carries a newline, and a newline in a
   URL makes fetch throw. */
const endpoint = () => process.env.CONTACT_ENDPOINT?.trim();
const timeoutMs = () => Number(process.env.CONTACT_TIMEOUT_MS ?? 8000);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Payload = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  company?: unknown;
  lang?: unknown;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid' }, { status: 400 });
  }

  // Honeypot. Answer exactly as a success would, so a bot cannot tell the
  // difference, but never forward it.
  if (str(body.company)) return NextResponse.json({ ok: true }, { status: 200 });

  const name = str(body.name);
  const email = str(body.email);
  const message = str(body.message);
  const lang = str(body.lang) === 'ar' ? 'ar' : 'en';

  // Mirror the upstream's own validation so we never forward something it
  // will reject anyway.
  const fields: Record<string, string> = {};
  if (name.length < 1 || name.length > 120) fields.name = 'invalid';
  if (!EMAIL.test(email) || email.length > 254) fields.email = 'invalid';
  if (message.length < 2 || message.length > 4000) fields.message = 'invalid';

  if (Object.keys(fields).length)
    return NextResponse.json({ ok: false, code: 'invalid', fields }, { status: 400 });

  const ENDPOINT = endpoint();
  const TIMEOUT_MS = timeoutMs();

  if (!ENDPOINT) {
    console.error('[contact] CONTACT_ENDPOINT is not configured — refusing to accept the message');
    return NextResponse.json({ ok: false, code: 'unconfigured' }, { status: 503 });
  }

  try {
    // No retry: POST is not idempotent, and a duplicate enquiry is worse than
    // a visible failure the person can act on.
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, email, message, lang }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(`[contact] upstream responded ${res.status}`);
      return NextResponse.json({ ok: false, code: 'upstream' }, { status: 502 });
    }

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: { 'cache-control': 'no-store' } }
    );
  } catch (e) {
    console.error('[contact] upstream request failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, code: 'upstream' }, { status: 502 });
  }
}
