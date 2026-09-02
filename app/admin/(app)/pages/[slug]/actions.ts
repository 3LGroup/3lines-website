'use server';

import { LOCALES } from '@/lib/blocks';
import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import {
  saveBlockEdits,
  savePageMeta,
  type BlockEdit,
  type Locale,
  type MetaEdit,
} from '@/lib/admin/content';
import {
  addBody,
  addSection,
  applyItemOp,
  moveBlock,
  removeBlock,
  setBlockImage,
  setPageStatus,
  setSharedField,
} from '@/lib/admin/structure';
import type { ImageShape } from '@/lib/admin/media';

export interface SaveState {
  ok?: boolean;
  error?: string;
  written?: number;
}

/**
 * Persist edited copy.
 *
 * Checks the session itself rather than relying on having been reached through
 * the admin layout. A server action is a POST endpoint with a generated URL —
 * it can be invoked directly, without ever rendering the layout that redirects.
 * Every write path re-checks; none of them trust the caller.
 */
export async function saveEdits(_prev: SaveState, form: FormData): Promise<SaveState> {
  if (!(await readSession())) return { error: 'Your session expired. Sign in again.' };

  const raw = form.get('edits');
  if (typeof raw !== 'string') return { error: 'Nothing to save.' };

  let parsed: Record<string, Record<string, string>>;
  try {
    // Shape: { "<blockId>:<locale>": { "<path>": "<value>" } }
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'The edit payload was malformed.' };
  }

  const patches: BlockEdit[] = [];
  for (const [key, edits] of Object.entries(parsed)) {
    if (!edits || !Object.keys(edits).length) continue;
    const sep = key.lastIndexOf(':');
    const blockId = key.slice(0, sep);
    const locale = key.slice(sep + 1) as Locale;
    if (!(LOCALES as readonly string[]).includes(locale)) return { error: `Unknown locale "${locale}".` };
    patches.push({ blockId, locale, edits });
  }

  // Page metadata rides in the same submit so one Save does everything the
  // screen shows. Shape: { "<slug>:<locale>:<field>": "<value>" }.
  const metaRaw = form.get('meta');
  const metaEdits: MetaEdit[] = [];
  if (typeof metaRaw === 'string' && metaRaw !== '{}') {
    try {
      for (const [key, value] of Object.entries(JSON.parse(metaRaw) as Record<string, string>)) {
        const [slug, locale, field] = key.split(':');
        if (!(LOCALES as readonly string[]).includes(locale)) return { error: `Unknown locale "${locale}".` };
        if (field !== 'title' && field !== 'description' && field !== 'keywords') {
          return { error: `Unknown metadata field "${field}".` };
        }
        metaEdits.push({ slug: slug!, locale: locale as Locale, field, value });
      }
    } catch {
      return { error: 'The metadata payload was malformed.' };
    }
  }

  // Shared-half edits (links, numbers, tones) ride in the same submit.
  // Shape: { "<blockId>:<path>": "<value>" } — split on the FIRST colon only,
  // since paths carry dots and brackets of their own.
  const sharedRaw = form.get('shared');
  const sharedEdits: { blockId: string; path: string; value: string }[] = [];
  if (typeof sharedRaw === 'string' && sharedRaw !== '{}') {
    try {
      for (const [key, value] of Object.entries(JSON.parse(sharedRaw) as Record<string, string>)) {
        const sep = key.indexOf(':');
        if (sep < 1) return { error: 'The shared-field payload was malformed.' };
        sharedEdits.push({ blockId: key.slice(0, sep), path: key.slice(sep + 1), value });
      }
    } catch {
      return { error: 'The shared-field payload was malformed.' };
    }
  }

  // Page visibility, when the toggle changed. "" means untouched.
  const status = String(form.get('status') ?? '');
  const slug = String(form.get('slug') ?? '');

  if (!patches.length && !metaEdits.length && !sharedEdits.length && !status) {
    return { ok: true, written: 0 };
  }

  try {
    let written = (await saveBlockEdits(patches)) + (await savePageMeta(metaEdits));
    for (const e of sharedEdits) {
      await setSharedField(e.blockId, e.path, e.value);
      written++;
    }
    if (status) {
      if (status !== 'published' && status !== 'placeholder') {
        return { error: `Unknown status "${status}".` };
      }
      if (!slug) return { error: 'Missing page slug for the status change.' };
      await setPageStatus(slug, status);
      written++;
    }
    // The admin reads through the same request cache; without this a save looks
    // like it did nothing until a hard reload.
    revalidatePath('/admin/pages', 'layout');
    return { ok: true, written };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' };
  }
}

/**
 * Add, remove and reorder — blocks, bodies and the items inside them.
 *
 * Separate from the copy save for the same reason the collections split theirs:
 * these rewrite the structural row (and both translation rows) in lockstep and
 * must never be half-applied alongside a text edit.
 */
export async function structural(_prev: SaveState, form: FormData): Promise<SaveState> {
  if (!(await readSession())) return { error: 'Your session expired. Sign in again.' };

  const op = String(form.get('op') ?? '');
  const blockId = String(form.get('blockId') ?? '');
  const slug = String(form.get('slug') ?? '');
  const kind = String(form.get('kind') ?? '');
  const path = String(form.get('path') ?? '');
  const index = Number(form.get('index') ?? -1);
  const to = Number(form.get('to') ?? -1);

  try {
    if (op === 'moveUp' || op === 'moveDown') {
      await moveBlock(blockId, op === 'moveUp' ? 'up' : 'down');
    } else if (op === 'remove') {
      await removeBlock(blockId);
    } else if (op === 'addBody') {
      await addBody(blockId, kind);
    } else if (op === 'addSection') {
      await addSection(slug);
    } else if (op === 'addItem') {
      await applyItemOp(blockId, { op: 'addItem', path });
    } else if (op === 'removeItem') {
      await applyItemOp(blockId, { op: 'removeItem', path, index });
    } else if (op === 'moveItem') {
      await applyItemOp(blockId, { op: 'moveItem', path, index, to });
    } else {
      return { error: `Unknown operation "${op}".` };
    }
    revalidatePath('/admin/pages', 'layout');
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not apply that change.' };
  }
}

/**
 * Swap one image in a block's shared props for another from the library.
 * The picker's single button carries "<shape>|<blockId>;<path>|<src>" — the
 * blockId and path share a slot because ImagePicker only has one.
 */
export async function setPageImage(_prev: SaveState, form: FormData): Promise<SaveState> {
  if (!(await readSession())) return { error: 'Your session expired. Sign in again.' };

  const raw = String(form.get('pick') ?? '');
  const sep1 = raw.indexOf('|');
  const sep2 = raw.indexOf('|', sep1 + 1);
  if (sep1 < 1 || sep2 < 0) return { error: 'Nothing to change.' };

  const shape = raw.slice(0, sep1) as ImageShape;
  const composite = raw.slice(sep1 + 1, sep2);
  const src = raw.slice(sep2 + 1);
  const semi = composite.indexOf(';');
  if (semi < 1) return { error: 'The image payload was malformed.' };
  const blockId = composite.slice(0, semi);
  const path = composite.slice(semi + 1);

  if (shape !== 'imgVar' && shape !== 'src') return { error: `Unknown image shape "${shape}".` };

  try {
    await setBlockImage(blockId, path, src, shape);
    revalidatePath('/admin/pages', 'layout');
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not change the image.' };
  }
}
