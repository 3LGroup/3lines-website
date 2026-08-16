import type { Json } from '@/lib/localization';

/**
 * Turn a block's localized props into a flat list of editable fields, and back.
 *
 * This is why the editor is one screen rather than twenty. A probe over all 25
 * pages found 1,735 editable leaves and every single one is a plain string —
 * nothing needs a date picker, a number input or a media widget. So there is no
 * per-kind form to write: walk the tree, emit a labelled text input per leaf,
 * and every one of the 20 block kinds is covered.
 *
 * Only the LOCALIZED half is ever walked. Structure — tone, columns, hrefs,
 * image paths, the block discriminator — lives on a separate locale-free row
 * this module never touches, which is what guarantees that fixing a typo cannot
 * break a layout.
 */

export interface Field {
  /** Dotted path into the localized tree, e.g. `items[0].link.label`. */
  path: string;
  value: string;
  /** Human label for the input, e.g. "Item 1 · Link label". */
  label: string;
  /** True for values long enough to want a textarea rather than an input. */
  multiline: boolean;
}

const isObj = (v: unknown): v is Record<string, Json> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/* ------------------------------------------------------------------ labels -- */

/** `headingLines` -> `Heading lines`, `glanceTitle` -> `Glance title`. */
function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * A readable label from a machine path.
 *
 * `items[0].link.label` -> `Item 1 · Link label`. Array indices become 1-based
 * because the person editing is looking at the first card on the page, not at
 * element zero of an array. Generic container names (`items`, `paragraphs`) are
 * dropped when they are followed by an index, since "Item 1 · Title" reads
 * better than "Items · Item 1 · Title".
 */
export function labelForPath(path: string): string {
  const parts: string[] = [];
  // Split on dots, keeping bracket indices attached to their key.
  for (const seg of path.split('.')) {
    const m = /^([A-Za-z0-9_]+)((\[\d+\])*)$/.exec(seg);
    if (!m) {
      parts.push(humanizeKey(seg));
      continue;
    }
    const [, key, idx] = m;
    const indices = idx ? [...idx.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]) + 1) : [];
    if (indices.length) {
      // "items[0]" -> "Item 1": singularize the container, then number it.
      const singular = key!.replace(/ies$/, 'y').replace(/s$/, '');
      parts.push(`${humanizeKey(singular)} ${indices.join('.')}`);
    } else {
      parts.push(humanizeKey(key!));
    }
  }
  return parts.join(' · ');
}

/* ------------------------------------------------------------------ walking -- */

/** Wrap at roughly a tweet — beyond that a single-line input is unusable. */
const MULTILINE_AT = 90;

/** Every string leaf of a localized tree, in document order. */
export function flatten(node: Json, trail = '', out: Field[] = []): Field[] {
  if (node === null || node === undefined) return out;

  if (Array.isArray(node)) {
    node.forEach((child, i) => flatten(child, `${trail}[${i}]`, out));
    return out;
  }

  if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) {
      flatten(v, trail ? `${trail}.${k}` : k, out);
    }
    return out;
  }

  // Numbers and booleans are structural and live in the shared half, so a leaf
  // reaching here should always be a string. Coerce rather than drop: silently
  // omitting a field would mean the editor could not see content that exists.
  const value = String(node);
  out.push({
    path: trail,
    value,
    label: labelForPath(trail),
    multiline: value.length > MULTILINE_AT,
  });
  return out;
}

/* ------------------------------------------------------------------ writing -- */

/** `items[0].link.label` -> `['items', 0, 'link', 'label']`. */
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
 * Immutably set one leaf, returning a new tree.
 *
 * Immutable because the editor keeps the original around to diff against — a
 * save should write only what actually changed, so an untouched block is not
 * rewritten and does not appear in the publish diff.
 *
 * Refuses to create missing containers: every path handed to this comes from
 * `flatten` walking the same tree, so a missing parent means the path is stale
 * and writing a fresh object there would invent structure the renderers never
 * declared.
 */
export function setAtPath(tree: Json, path: string, value: string): Json {
  const keys = parsePath(path);

  const walk = (node: Json, depth: number): Json => {
    const key = keys[depth]!;
    const last = depth === keys.length - 1;

    if (typeof key === 'number') {
      if (!Array.isArray(node)) throw new Error(`setAtPath: expected an array at ${path}[${depth}]`);
      const copy = [...node];
      copy[key] = last ? value : walk(node[key] as Json, depth + 1);
      return copy;
    }

    if (!isObj(node)) throw new Error(`setAtPath: expected an object at ${path}[${depth}]`);
    return { ...node, [key]: last ? value : walk(node[key] as Json, depth + 1) };
  };

  return walk(tree, 0);
}

/** Apply many edits at once. */
export function applyEdits(tree: Json, edits: Record<string, string>): Json {
  let out = tree;
  for (const [path, value] of Object.entries(edits)) out = setAtPath(out, path, value);
  return out;
}
