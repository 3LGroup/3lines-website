'use server';

import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import { saveNavigation, setChromeImage, type NavChrome } from '@/lib/admin/chrome';

export interface NavState {
  ok?: boolean;
  error?: string;
  detail?: string;
}

async function guard(): Promise<string | null> {
  return (await readSession()) ? null : 'Your session expired. Sign in again.';
}

export async function saveNav(_prev: NavState, form: FormData): Promise<NavState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const raw = form.get('doc');
  if (typeof raw !== 'string') return { error: 'Nothing to save.' };

  let nav: NavChrome;
  try {
    nav = JSON.parse(raw);
  } catch {
    return { error: 'The edit payload was malformed.' };
  }

  try {
    await saveNavigation(nav);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: 'Saved. Publish to update the live site.' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Save failed.' };
  }
}

/** The logo pickers post here — same one-button contract as the collections. */
export async function setNavImage(_prev: NavState, form: FormData): Promise<NavState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const raw = String(form.get('pick') ?? '');
  const sep1 = raw.indexOf('|');
  const sep2 = raw.indexOf('|', sep1 + 1);
  if (sep1 < 1 || sep2 < 0) return { error: 'Nothing to change.' };

  const path = raw.slice(sep1 + 1, sep2);
  const src = raw.slice(sep2 + 1);
  if (path !== 'logoImg' && path !== 'footerLogoImg') {
    return { error: `Unknown image slot "${path}".` };
  }

  try {
    await setChromeImage(path, src);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: 'Logo changed. Publish to put it live.' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not change the image.' };
  }
}
