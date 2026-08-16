'use server';

import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import { saveBlockEdits, type BlockEdit, type Locale } from '@/lib/admin/content';

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
    if (locale !== 'en' && locale !== 'ar') return { error: `Unknown locale "${locale}".` };
    patches.push({ blockId, locale, edits });
  }

  if (!patches.length) return { ok: true, written: 0 };

  try {
    const written = await saveBlockEdits(patches);
    // The admin reads through the same request cache; without this a save looks
    // like it did nothing until a hard reload.
    revalidatePath('/admin/pages', 'layout');
    return { ok: true, written };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' };
  }
}
