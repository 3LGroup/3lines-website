import { NextResponse } from 'next/server';
import { readSession } from '@/lib/admin/session';
import { listAllMedia } from '@/lib/admin/media';

/**
 * The image library, fetched by ImagePicker the first time someone opens it.
 *
 * It used to be a prop. Every picker on a screen received the whole library, so
 * the partners editor serialised 39 items x 131 images — five thousand objects
 * into one RSC payload — and the services editor ten times over. On a Worker
 * that is not merely wasteful: it is CPU spent inside a hard per-request limit,
 * and it was enough to take the admin from slow to "Worker exceeded resource
 * limits" (Cloudflare 1102) with no server error to read.
 *
 * Fetching it once, on demand, removes that cost from every page render and
 * from the payload entirely — the pickers that are never opened now cost
 * nothing at all.
 */
export async function GET(): Promise<Response> {
  if (!(await readSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ items: await listAllMedia() });
}
