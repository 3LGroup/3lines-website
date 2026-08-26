'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/admin/session';
import { createPage, deletePage } from '@/lib/admin/structure';

export interface PagesState {
  ok?: boolean;
  error?: string;
  detail?: string;
}

const guard = async () => ((await readSession()) ? null : 'Your session expired. Sign in again.');

export async function createPageAction(_prev: PagesState, form: FormData): Promise<PagesState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const route = String(form.get('route') ?? '').trim();
  const titleEn = String(form.get('titleEn') ?? '');
  const titleAr = String(form.get('titleAr') ?? '');

  let slug: string;
  try {
    slug = await createPage({ route, titleEn, titleAr });
    revalidatePath('/admin', 'layout');
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create the page.' };
  }
  // Straight into the editor — the new page is a skeleton waiting for its copy.
  redirect(`/admin/pages/${slug}`);
}

export async function deletePageAction(_prev: PagesState, form: FormData): Promise<PagesState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const slug = String(form.get('slug') ?? '');
  try {
    await deletePage(slug);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: 'Page deleted. Publish to remove it from the live site.' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not delete the page.' };
  }
}
