import { NextResponse } from 'next/server';
import { readUpload } from '@/lib/admin/uploads';

export const dynamic = 'force-dynamic';

/**
 * Serve an uploaded image.
 *
 * Needed because uploads arrive after the build. Next resolves public/ into a
 * static file list when it builds, so a file written into public/assets/uploads
 * at runtime is genuinely on disk and still 404s until the next build — which
 * would mean an editor uploads a picture and cannot see it in the picker they
 * just uploaded it for.
 *
 * This route fills exactly that gap, and disappears on its own: once the site
 * is rebuilt, the same URL is a real static asset and Next serves it from the
 * static list without ever reaching here. In production it is the R2 path,
 * where there is no public/ at all.
 *
 * Deliberately NOT behind the admin session. These images end up on public
 * pages, so gating them would break the live site the moment one was used; the
 * only thing reachable through here is a file somebody already published to
 * the world.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // The name comes from the URL. Anything with a separator in it is an attempt
  // to read outside the upload directory, not a filename.
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  const file = await readUpload(name);
  if (!file) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(file.body as BodyInit, {
    headers: {
      'Content-Type': file.contentType,
      /* Long, because in production nothing ever replaces this response.
         The old 60s assumed the file lands in public/ and is superseded by a
         static asset at the next build — true on disk, false on R2, where the
         object never enters public/ at all. That made every uploaded image on
         the live site a Worker invocation plus an R2 GET per visitor per
         minute, forever: exactly the cost open-next.config.ts is written to
         avoid. Safe to cache hard because uploads are immutable — putUpload
         suffixes a colliding name rather than overwriting. */
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
