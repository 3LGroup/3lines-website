'use server';

import { LOCALES } from '@/lib/blocks';
import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import {
  applyStructural,
  saveCollectionEdits,
  setCollectionImage,
  type ItemEdit,
  type StructuralOp,
} from '@/lib/admin/collections';
import type { ImageShape } from '@/lib/admin/media';
import type { Locale } from '@/lib/admin/content';

export interface CollectionState {
  ok?: boolean;
  error?: string;
  detail?: string;
}

/** Every write re-checks the session; none trusts having been rendered inside the shell. */
async function guard(): Promise<string | null> {
  return (await readSession()) ? null : 'Your session expired. Sign in again.';
}

export async function saveItems(_prev: CollectionState, form: FormData): Promise<CollectionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const key = String(form.get('key') ?? '');
  const raw = form.get('edits');
  if (typeof raw !== 'string') return { error: 'Nothing to save.' };

  let parsed: Record<string, Record<string, string>>;
  try {
    // Shape: { "<index>:<locale>": { "<path>": "<value>" } }
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'The edit payload was malformed.' };
  }

  const patches: ItemEdit[] = [];
  for (const [k, edits] of Object.entries(parsed)) {
    if (!edits || !Object.keys(edits).length) continue;
    const [idx, locale] = k.split(':');
    if (!(LOCALES as readonly string[]).includes(locale)) return { error: `Unknown locale "${locale}".` };
    patches.push({ index: Number(idx), locale: locale as Locale, edits });
  }

  if (!patches.length) return { ok: true, detail: 'No changes.' };

  try {
    await saveCollectionEdits(key, patches);
    revalidatePath('/admin', 'layout');
    const n = new Set(patches.map((p) => p.index)).size;
    return { ok: true, detail: `Saved ${n} item${n === 1 ? '' : 's'}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' };
  }
}

/**
 * Change which image a card uses.
 *
 * Its own action rather than part of the copy save, because it writes the
 * structural row. Keeping them separate is what makes "editing text cannot
 * break the layout" true of the save button rather than merely likely.
 */
export async function setImageAction(
  _prev: CollectionState,
  form: FormData
): Promise<CollectionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const key = String(form.get('key') ?? '');

  // One field carrying "<shape>|<path>|<src>", set by the clicked button. See
  // the note in ImagePicker: hidden inputs would collide across open pickers.
  const raw = String(form.get('pick') ?? '');
  const sep1 = raw.indexOf('|');
  const sep2 = raw.indexOf('|', sep1 + 1);
  if (sep1 < 1 || sep2 < 0) return { error: 'Nothing to change.' };

  const shape = raw.slice(0, sep1) as ImageShape;
  const path = raw.slice(sep1 + 1, sep2);
  const src = raw.slice(sep2 + 1);

  if (shape !== 'imgVar' && shape !== 'src') return { error: `Unknown image shape "${shape}".` };
  if (!path || !src) return { error: 'Nothing to change.' };

  try {
    await setCollectionImage(key, path, src, shape);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: 'Image changed. Publish to put it live.' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not change the image.' };
  }
}

/**
 * Add, remove and reorder.
 *
 * Separate from saving copy because it rewrites the structural row too, and a
 * failure part-way would leave the shared array and the two locale arrays at
 * different lengths — which pairs one company's name with another's photo.
 */
export async function structural(_prev: CollectionState, form: FormData): Promise<CollectionState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const key = String(form.get('key') ?? '');
  const op = String(form.get('op') ?? '');
  const index = Number(form.get('index') ?? -1);
  const to = Number(form.get('to') ?? -1);

  let action: StructuralOp;
  if (op === 'add') action = { op: 'add' };
  else if (op === 'remove') action = { op: 'remove', index };
  else if (op === 'move') action = { op: 'move', index, to };
  else return { error: `Unknown operation "${op}".` };

  try {
    await applyStructural(key, action);
    revalidatePath('/admin', 'layout');
    return {
      ok: true,
      detail:
        op === 'add' ? 'Added. Fill it in, then Save.' : op === 'remove' ? 'Removed.' : 'Reordered.',
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not apply that change.' };
  }
}
