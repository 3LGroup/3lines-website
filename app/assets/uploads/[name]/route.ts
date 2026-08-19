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
      // Short, because this route only ever serves the window between upload
      // and the next build. The static asset that replaces it carries the long
      // immutable policy from public/_headers.
      'Cache-Control': 'public, max-age=60',
    },
  });
}
