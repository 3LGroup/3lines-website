import manifest from '@/lib/asset-manifest.json';
import type { Json } from '@/lib/localization';

/**
 * Images: listing what exists, and reading/writing the references to them.
 *
 * The library is derived from lib/asset-manifest.json rather than by walking
 * public/ at runtime. That file already lists all 171 assets, it is bundled into
 * the Worker, and it is regenerated and audited on every build — whereas
 * readdir() on public/ works in dev and returns nothing in production, because
 * public/ ships as Workers Static Assets rather than inside the bundle. This is
 * the same trap lib/assets.ts already had to be rescued from.
 */

const IMAGE_EXT = /\.(png|jpe?g|webp|avif|svg|gif)$/i;

export interface MediaItem {
  /** Site-root path, e.g. "/assets/photos/hero-mro.jpg". */
  path: string;
  /** File name without the folder. */
  name: string;
  /** Immediate folder under assets/, e.g. "photos" — the library's grouping. */
  folder: string;
  ext: string;
}

export function listMedia(): MediaItem[] {
  return Object.keys(manifest as Record<string, string>)
    .filter((p) => IMAGE_EXT.test(p))
    .map((path) => {
      const parts = path.split('/');
      return {
        path,
        name: parts[parts.length - 1]!,
        folder: parts.length > 2 ? parts[parts.length - 2]! : 'assets',
        ext: (path.match(IMAGE_EXT)?.[1] ?? '').toLowerCase(),
      };
    })
    .sort((a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name));
}

/**
 * The library as an editor sees it: what shipped with the repo, plus anything
 * uploaded since.
 *
 * Async and separate from listMedia() because the uploads live outside the
 * bundled manifest — in R2, or on local disk — and neither can be read
 * synchronously. listMedia() stays sync for the callers that only need a count.
 */
export async function listAllMedia(): Promise<MediaItem[]> {
  const { listUploads } = await import('./uploads');
  const uploaded: MediaItem[] = (await listUploads()).map((u) => ({
    path: u.path,
    name: u.name,
    // Its own group, so uploads are findable rather than scattered through
    // folders named after how the original site happened to organise itself.
    folder: 'uploads',
    ext: (u.name.match(IMAGE_EXT)?.[1] ?? '').toLowerCase(),
  }));

  return [...listMedia(), ...uploaded].sort(
    (a, b) => a.folder.localeCompare(b.folder) || a.name.localeCompare(b.name)
  );
}

export function mediaFolders(items: MediaItem[]): string[] {
  return [...new Set(items.map((i) => i.folder))].sort();
}

/* -------------------------------------------------- reading image fields -- */

/**
 * How a given field stores its image. The two are NOT interchangeable — writing
 * a bare path into `imgVar` produces `background-image: /assets/x.jpg`, which is
 * invalid and renders nothing, and wrapping `media.src` in url() puts that
 * string into an <img src>.
 */
export type ImageShape = 'imgVar' | 'src';

export interface ImageField {
  /** Dotted path within the block's shared props, e.g. `items[2].imgVar`. */
  path: string;
  shape: ImageShape;
  /** The resolved site-root path, with any url('…') wrapper removed. */
  value: string;
  /** Human label, e.g. "Background image" or "Logo". */
  label: string;
}

const isObj = (v: unknown): v is Record<string, Json> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** `url('/assets/x.jpg')` -> `/assets/x.jpg`. Tolerates single, double or no quotes. */
export function unwrapImgVar(value: string): string {
  const m = /^\s*url\(\s*(['"]?)(.*?)\1\s*\)\s*$/.exec(value);
  return m ? m[2]! : value;
}

/**
 * CSS `url()` with the value escaped.
 *
 * Quoted and escaped rather than interpolated raw: this string is written
 * straight into an inline `style` attribute by the renderers, so an unescaped
 * quote or parenthesis in a filename would end the declaration early and let
 * arbitrary CSS follow. Filenames are picked from a fixed library today, but the
 * escaping is what makes that a convenience rather than the only thing
 * preventing an injection.
 */
export function wrapImgVar(path: string): string {
  const escaped = path.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '');
  return `url('${escaped}')`;
}

/** Every image reference inside one block's shared props, in document order. */
export function findImageFields(props: Json, trail = '', out: ImageField[] = []): ImageField[] {
  if (props === null || typeof props !== 'object') return out;

  if (Array.isArray(props)) {
    props.forEach((v, i) => findImageFields(v, `${trail}[${i}]`, out));
    return out;
  }

  for (const [k, v] of Object.entries(props)) {
    const path = trail ? `${trail}.${k}` : k;

    if (k === 'imgVar' && typeof v === 'string' && v) {
      out.push({ path, shape: 'imgVar', value: unwrapImgVar(v), label: 'Background image' });
      continue;
    }
    // `media` and `logo` are objects; their `src` is the reference. `alt` sits
    // beside it but is copy, so it is edited on the text side, not here.
    if ((k === 'media' || k === 'logo') && isObj(v) && typeof v.src === 'string') {
      out.push({
        path: `${path}.src`,
        shape: 'src',
        value: v.src,
        label: k === 'logo' ? 'Logo' : 'Image',
      });
      continue;
    }
    findImageFields(v, path, out);
  }
  return out;
}

/* -------------------------------------------------- writing image fields -- */

function parsePath(path: string): (string | number)[] {
  const keys: (string | number)[] = [];
  for (const seg of path.split('.')) {
    const m = /^([A-Za-z0-9_]+)((\[\d+\])*)$/.exec(seg);
    if (!m) {
      keys.push(seg);
      continue;
    }
    keys.push(m[1]!);
    if (m[2]) for (const i of m[2].matchAll(/\[(\d+)\]/g)) keys.push(Number(i[1]));
  }
  return keys;
}

/**
 * Immutably point one image field at a new file, in that field's own shape.
 *
 * Refuses to create missing containers: every path handed here comes from
 * findImageFields walking the same object, so an absent parent means the path is
 * stale and writing one would invent structure no renderer declared.
 */
export function setImage(props: Json, path: string, newPath: string, shape: ImageShape): Json {
  const keys = parsePath(path);
  const stored: Json = shape === 'imgVar' ? wrapImgVar(newPath) : newPath;

  const walk = (node: Json, depth: number): Json => {
    const key = keys[depth]!;
    const last = depth === keys.length - 1;

    if (typeof key === 'number') {
      if (!Array.isArray(node)) throw new Error(`setImage: expected an array at ${path}`);
      const copy = [...node];
      copy[key] = last ? stored : walk(node[key] as Json, depth + 1);
      return copy;
    }
    if (!isObj(node)) throw new Error(`setImage: expected an object at ${path}`);
    return { ...node, [key]: last ? stored : walk(node[key] as Json, depth + 1) };
  };

  return walk(props, 0);
}

/** Is this path one the manifest knows about? Guards against typos and traversal. */
export function isKnownAsset(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(manifest, path) && IMAGE_EXT.test(path);
}

/**
 * The allow-list, extended to cover uploads.
 *
 * isKnownAsset() alone would reject every uploaded image, because the manifest
 * is generated from public/ at build time and an upload arrives after it. This
 * is the check a write must use: an upload is admissible only if it is under
 * the uploads prefix AND the store actually holds it, so a crafted path cannot
 * point the site at something that was never uploaded.
 */
export async function isAdmissibleAsset(path: string): Promise<boolean> {
  if (isKnownAsset(path)) return true;

  const { isUploadPath, listUploads } = await import('./uploads');
  if (!isUploadPath(path) || !IMAGE_EXT.test(path)) return false;

  return (await listUploads()).some((u) => u.path === path);
}
