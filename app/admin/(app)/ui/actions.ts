'use server';

import { LOCALES } from '@/lib/blocks';
import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import { saveUiStrings, type UiEdit } from '@/lib/admin/ui';
import type { Locale } from '@/lib/admin/content';
import type { SiteState } from '../site/actions';

const guard = async () => ((await readSession()) ? null : 'Your session expired. Sign in again.');

/** Interface text. Keys arrive from SimpleForm as "<key>:<locale>". */
export async function saveUi(_prev: SiteState, form: FormData): Promise<SiteState> {
  const denied = await guard();
  if (denied) return { error: denied };

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(String(form.get('edits') ?? '{}'));
  } catch {
    return { error: 'The edit payload was malformed.' };
  }

  const edits: UiEdit[] = [];
  for (const [k, value] of Object.entries(parsed)) {
    const [key, locale] = k.split(':');
    if (!(LOCALES as readonly string[]).includes(locale)) return { error: `Unknown locale "${locale}".` };
    edits.push({ key: key!, locale: locale as Locale, value });
  }
  if (!edits.length) return { ok: true, detail: 'No changes.' };

  try {
    const n = await saveUiStrings(edits);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: `Saved ${n} field${n === 1 ? '' : 's'}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' };
  }
}
