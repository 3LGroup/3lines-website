'use server';

import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import { saveNews, saveSiteInfo, type NewsEdit, type SiteEdit } from '@/lib/admin/site';
import type { Locale } from '@/lib/admin/content';

export interface SiteState {
  ok?: boolean;
  error?: string;
  detail?: string;
}

const guard = async () => ((await readSession()) ? null : 'Your session expired. Sign in again.');

/** Site info. Keys arrive as "<key>" or "<key>:<locale>". */
export async function saveSite(_prev: SiteState, form: FormData): Promise<SiteState> {
  const denied = await guard();
  if (denied) return { error: denied };

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(String(form.get('edits') ?? '{}'));
  } catch {
    return { error: 'The edit payload was malformed.' };
  }

  const edits: SiteEdit[] = Object.entries(parsed).map(([k, value]) => {
    const [key, locale] = k.split(':');
    return { key: key!, locale: locale as Locale | undefined, value };
  });
  if (!edits.length) return { ok: true, detail: 'No changes.' };

  try {
    const n = await saveSiteInfo(edits);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: `Saved ${n} field${n === 1 ? '' : 's'}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' };
  }
}

/** News. Keys arrive as "<id>:date" or "<id>:<field>:<locale>". */
export async function saveNewsAction(_prev: SiteState, form: FormData): Promise<SiteState> {
  const denied = await guard();
  if (denied) return { error: denied };

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(String(form.get('edits') ?? '{}'));
  } catch {
    return { error: 'The edit payload was malformed.' };
  }

  const edits: NewsEdit[] = [];
  for (const [k, value] of Object.entries(parsed)) {
    const [id, field, locale] = k.split(':');
    if (
      field !== 'date' &&
      field !== 'title' &&
      field !== 'tag' &&
      field !== 'type' &&
      field !== 'mediaAlt'
    ) {
      return { error: `Unknown field "${field}".` };
    }
    edits.push({ id: id!, field, locale: locale as Locale | undefined, value });
  }
  if (!edits.length) return { ok: true, detail: 'No changes.' };

  try {
    const n = await saveNews(edits);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: `Saved ${n} field${n === 1 ? '' : 's'}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' };
  }
}
