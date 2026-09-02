'use server';

import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import { saveBands, type BandEdit } from '@/lib/admin/bands';
import type { Locale } from '@/lib/admin/content';
import { LOCALES } from '@/lib/blocks';
import type { SiteState } from '../site/actions';

const guard = async () => ((await readSession()) ? null : 'Your session expired. Sign in again.');

/** Shared bands. Keys arrive from SimpleForm as "<kind>:<path>" or with ":<locale>". */
export async function saveBandsAction(_prev: SiteState, form: FormData): Promise<SiteState> {
  const denied = await guard();
  if (denied) return { error: denied };

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(String(form.get('edits') ?? '{}'));
  } catch {
    return { error: 'The edit payload was malformed.' };
  }

  const edits: BandEdit[] = [];
  for (const [k, value] of Object.entries(parsed)) {
    // "<kind>:<path>" with an optional trailing ":<locale>" — split from the end.
    const last = k.lastIndexOf(':');
    const maybeLocale = k.slice(last + 1);
    if ((LOCALES as readonly string[]).includes(maybeLocale)) {
      edits.push({ key: k.slice(0, last), locale: maybeLocale as Locale, value });
    } else {
      edits.push({ key: k, value });
    }
  }
  if (!edits.length) return { ok: true, detail: 'No changes.' };

  try {
    const n = await saveBands(edits);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: `Saved ${n} field${n === 1 ? '' : 's'} across every page.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' };
  }
}
