import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Where an uploaded image goes.
 *
 * Two backends behind one interface, because the correct answer and the
 * available answer are not currently the same one.
 *
 * R2 is correct: a Worker has no writable filesystem, so anything that writes
 * into public/ at runtime works on a developer's machine and fails the moment
 * the site is deployed. When the MEDIA binding exists, that is what is used.
 *
 * Until the bucket is created, the fallback writes into public/assets/uploads/
 * on local disk. That is genuinely useful rather than a stub: the publish model
 * here is already "write files, commit, rebuild", so a locally-uploaded image
 * ships exactly like the 131 that came with the repo — hashed into the asset
 * manifest at prebuild and served with a cache-busting URL. It simply cannot
 * run inside a Worker, which is why it is the fallback and not the design.
 *
 * Swapping between them is a binding, not a rewrite: the rest of the CMS only
 * ever sees a public path like /assets/uploads/radar-bay.webp.
 */

/** Public URL prefix. Also the on-disk location under public/ for the fallback. */
export const UPLOAD_PREFIX = '/assets/uploads';

export interface UploadedItem {
  /** Public path, e.g. /assets/uploads/radar-bay.webp */
  path: string;
  name: string;
  bytes: number;
}

async function bucket(): Promise<R2Bucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as { MEDIA?: R2Bucket }).MEDIA ?? null;
  } catch {
    // No Cloudflare context at all (plain `next dev`/`next start`). Treat that
    // exactly like an unbound bucket rather than letting it become a 500 —
    // uploading locally is the whole point of the fallback.
    return null;
  }
}

/** Absolute path to public/assets/uploads, created on demand. */
async function localDir(): Promise<string> {
  const { join } = await import('node:path');
  const fs = await import('node:fs/promises');
  const dir = join(process.cwd(), 'public', 'assets', 'uploads');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * A filename that is safe as a URL, as a filesystem path and as an R2 key.
 *
 * Deliberately strict: anything outside [a-z0-9-] becomes a hyphen. Arabic
 * filenames are common here and percent-encode into unreadable URLs, and a
 * stray `../` in a name reaching a filesystem write is a directory traversal.
 * The human-readable name is not lost — it lives in the alt text, which is
 * where a person actually reads it.
 */
export function safeName(original: string, ext: string): string {
  const base = original.replace(/\.[^.]+$/, '');
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image';
  return `${slug}.${ext}`;
}

/** Everything uploaded so far, newest first is not guaranteed — sorted by name. */
export async function listUploads(): Promise<UploadedItem[]> {
  const b = await bucket();

  if (b) {
    /* Paged to exhaustion. A single list() caps at 1000 objects and reports the
       truncation rather than erroring, so ignoring it would silently hide the
       rest of the library — and worse, putUpload's collision check would stop
       seeing existing names and start overwriting files. */
    const objects: { key: string; size: number }[] = [];
    let cursor: string | undefined;
    do {
      const listed = await b.list({ limit: 1000, cursor });
      objects.push(...listed.objects);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    return objects
      .map((o) => ({ path: `${UPLOAD_PREFIX}/${o.key}`, name: o.key, bytes: o.size }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }

  try {
    const fs = await import('node:fs/promises');
    const dir = await localDir();
    const names = await fs.readdir(dir);
    const out: UploadedItem[] = [];
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const stat = await fs.stat(`${dir}/${name}`);
      if (!stat.isFile()) continue;
      out.push({ path: `${UPLOAD_PREFIX}/${name}`, name, bytes: stat.size });
    }
    return out.sort((x, y) => x.name.localeCompare(y.name));
  } catch {
    // The directory not existing is the normal state before the first upload.
    return [];
  }
}

export interface PutResult {
  path: string;
  /** True when the name collided and was suffixed rather than overwritten. */
  renamed: boolean;
}

/**
 * Store the bytes and return the public path.
 *
 * Never overwrites. Two people uploading "logo.png" a month apart should not
 * silently replace each other's work, and there is no revision history here to
 * recover it from — so a collision gets a numeric suffix instead.
 */
export async function putUpload(
  fileName: string,
  ext: string,
  data: ArrayBuffer
): Promise<PutResult> {
  const wanted = safeName(fileName, ext);
  const existing = new Set((await listUploads()).map((u) => u.name));

  let name = wanted;
  let n = 2;
  while (existing.has(name)) {
    name = wanted.replace(/\.([^.]+)$/, `-${n}.$1`);
    n++;
  }

  const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/webp';
  const b = await bucket();

  if (b) {
    await b.put(name, data, { httpMetadata: { contentType } });
  } else {
    const fs = await import('node:fs/promises');
    const dir = await localDir();
    await fs.writeFile(`${dir}/${name}`, Buffer.from(data));
  }

  const path = `${UPLOAD_PREFIX}/${name}`;
  if (!b) await recordInManifest(path, data);

  return { path, renamed: name !== wanted };
}

/**
 * Add a locally-stored upload to lib/asset-manifest.json.
 *
 * scripts/audit-manifest.mjs fails on any file that is in public/ but not in
 * the manifest, and rightly so — that is how a stale manifest ships and a
 * visitor keeps a cached stylesheet forever. But it means an upload would break
 * the build audit until somebody remembered to run `npm run assets:manifest`,
 * which is not a thing to ask of the person this CMS was built for.
 *
 * So the upload records itself, with the same sha1-truncated-to-8 that
 * scripts/build-asset-manifest.mjs uses. asset() can then cache-bust it like
 * any other asset, and the next prebuild recomputes the whole file anyway.
 *
 * Local backend only: an R2 object never enters public/, so there is nothing
 * for the manifest to describe.
 */
async function recordInManifest(publicPath: string, data: ArrayBuffer): Promise<void> {
  try {
    const fs = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { createHash } = await import('node:crypto');

    const file = join(process.cwd(), 'lib', 'asset-manifest.json');
    const manifest = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, string>;
    manifest[publicPath] = createHash('sha1').update(Buffer.from(data)).digest('hex').slice(0, 8);

    // Sorted, so the committed diff is one added line rather than a reshuffle.
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [c]) => a.localeCompare(c)));
    await fs.writeFile(file, JSON.stringify(sorted, null, 2) + '\n');
  } catch {
    // Not fatal: the image is stored and works. The next `npm run build`
    // regenerates the manifest from public/ regardless, so the worst case is
    // that the offline audit complains until then.
  }
}

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
};

/** Read one stored upload back, for the route that serves it before a rebuild. */
export async function readUpload(
  name: string
): Promise<{ body: ArrayBuffer | ReadableStream; contentType: string } | null> {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return null;

  const b = await bucket();
  if (b) {
    const obj = await b.get(name);
    return obj ? { body: obj.body, contentType } : null;
  }

  try {
    const fs = await import('node:fs/promises');
    const { join } = await import('node:path');
    // join() rather than string concatenation, and the caller has already
    // rejected separators, so this cannot climb out of the directory.
    const buf = await fs.readFile(join(await localDir(), name));
    return { body: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), contentType };
  } catch {
    return null;
  }
}

/** True when a path looks like something this module stored. */
export function isUploadPath(path: string): boolean {
  return path.startsWith(`${UPLOAD_PREFIX}/`) && !path.includes('..');
}

/**
 * Remove one stored upload.
 *
 * Uploading was one-way before this: a wrong file, a bad crop or something that
 * should never have left the office stayed in the bucket and in the picker with
 * no way to take it back, and R2 bills for it either way.
 *
 * No content-safety check HERE — the delete action runs findAssetReferences()
 * before calling this and refuses while anything still points at the image, so
 * this layer stays a plain storage operation. A concurrent edit can still race
 * the check; the renderer treats a missing image as a missing image, so the
 * worst case is a broken picture, not a broken page.
 *
 * Returns false when the object was not there, so the caller can tell "deleted"
 * from "nothing to delete" instead of reporting success either way.
 */
export async function deleteUpload(name: string): Promise<boolean> {
  // The caller passes a bare filename. Anything with a separator would let a
  // crafted request reach outside the uploads directory, so it is rejected
  // here as well as at the action, rather than trusted from one layer up.
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return false;

  const b = await bucket();

  if (b) {
    // R2 delete() resolves whether or not the key existed, so existence has to
    // be established first for the return value to mean anything.
    const head = await b.head(name);
    if (!head) return false;
    await b.delete(name);
    return true;
  }

  try {
    const fs = await import('node:fs/promises');
    const { join } = await import('node:path');
    await fs.unlink(join(await localDir(), name));
  } catch {
    return false;
  }

  // Local only: the manifest describes files in public/, so the entry has to go
  // with the file or audit:manifest fails on an entry with nothing behind it —
  // the mirror image of the staleness recordInManifest() exists to prevent.
  await removeFromManifestFile(`${UPLOAD_PREFIX}/${name}`);
  return true;
}

/**
 * Drop a deleted file from lib/asset-manifest.json. Exported because repo-asset
 * deletion (lib/admin/media.ts) has exactly the same bookkeeping to do.
 */
export async function removeFromManifestFile(publicPath: string): Promise<void> {
  try {
    const fs = await import('node:fs/promises');
    const { join } = await import('node:path');

    const file = join(process.cwd(), 'lib', 'asset-manifest.json');
    const manifest = JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, string>;
    if (!(publicPath in manifest)) return;
    delete manifest[publicPath];

    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [c]) => a.localeCompare(c)));
    await fs.writeFile(file, JSON.stringify(sorted, null, 2) + '\n');
  } catch {
    // Same reasoning as recordInManifest: not fatal, and the next build
    // regenerates the manifest from public/ anyway.
  }
}
