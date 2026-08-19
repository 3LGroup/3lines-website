'use server';

import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import { putUpload } from '@/lib/admin/uploads';

export interface UploadState {
  ok?: boolean;
  error?: string;
  detail?: string;
}

/** Formats accepted from the browser. */
const ALLOWED: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

/**
 * 8MB. The browser downscales to WebP before sending, so anything arriving
 * larger than this either skipped that step or is not really a photograph.
 * A Worker will accept ~100MB, which is not a reason to.
 */
const MAX_BYTES = 8 * 1024 * 1024;

export async function uploadImage(_prev: UploadState, form: FormData): Promise<UploadState> {
  if (!(await readSession())) return { error: 'Your session expired. Sign in again.' };

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image first.' };

  /*
   * SVG is refused, and not for tidiness.
   *
   * components/Svg.tsx builds elements with createElement(node.tag, node.attrs)
   * and trusts the tree completely. Accepting an SVG upload would therefore
   * hand anyone with CMS access a way to run script on the public site. The
   * file would also have to be sanitised server-side before it could ever be
   * allowed, which is a real piece of work rather than a flag.
   *
   * Checked on the declared type AND the extension: the type comes from the
   * browser and is not evidence of anything on its own.
   */
  const ext = ALLOWED[file.type];
  if (!ext || /\.svgz?$/i.test(file.name)) {
    return {
      error: 'Only JPG, PNG and WebP images can be uploaded. SVG needs a developer.',
    };
  }

  if (file.size > MAX_BYTES) {
    return { error: `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 8MB.` };
  }

  const data = await file.arrayBuffer();

  // Sniff the actual bytes. A .png that starts with "<svg" is the whole attack,
  // and the declared MIME type is attacker-controlled.
  if (!looksLikeImage(new Uint8Array(data))) {
    return { error: 'That file is not a JPG, PNG or WebP, whatever it is named.' };
  }

  let result;
  try {
    result = await putUpload(file.name, ext, data);
  } catch (e) {
    return { error: `Could not save the image: ${e instanceof Error ? e.message : String(e)}` };
  }

  revalidatePath('/admin/media');
  revalidatePath('/admin/c/[key]', 'page');

  return {
    ok: true,
    detail: result.renamed
      ? `Uploaded as ${result.path.split('/').pop()} — that name was already taken.`
      : `Uploaded ${result.path.split('/').pop()}.`,
  };
}

/** Magic-number check for the three formats we accept. */
function looksLikeImage(b: Uint8Array): boolean {
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true;
  // WebP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return true;
  return false;
}
