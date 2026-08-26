'use server';

import { revalidatePath } from 'next/cache';
import { readSession } from '@/lib/admin/session';
import { createNewsItem, deleteNewsItem, moveNewsItem, setNewsImage } from '@/lib/admin/news';

export interface NewsState {
  ok?: boolean;
  error?: string;
  detail?: string;
}

const guard = async () => ((await readSession()) ? null : 'Your session expired. Sign in again.');

export async function newsStructural(_prev: NewsState, form: FormData): Promise<NewsState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const op = String(form.get('op') ?? '');
  const id = String(form.get('id') ?? '');

  try {
    if (op === 'create') {
      await createNewsItem({
        titleEn: String(form.get('titleEn') ?? ''),
        titleAr: String(form.get('titleAr') ?? ''),
        date: String(form.get('date') ?? ''),
      });
      revalidatePath('/admin', 'layout');
      return {
        ok: true,
        detail: 'Post created. Its article page is under Pages & SEO, hidden until you switch it on.',
      };
    }
    if (op === 'delete') {
      await deleteNewsItem(id);
      revalidatePath('/admin', 'layout');
      return { ok: true, detail: 'Post and its article page deleted.' };
    }
    if (op === 'moveUp' || op === 'moveDown') {
      await moveNewsItem(id, op === 'moveUp' ? 'up' : 'down');
      revalidatePath('/admin', 'layout');
      return { ok: true };
    }
    return { error: `Unknown operation "${op}".` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not apply that change.' };
  }
}

/** Card image picks — the picker's one button carries "src|<id>|<path>". */
export async function setNewsImageAction(_prev: NewsState, form: FormData): Promise<NewsState> {
  const denied = await guard();
  if (denied) return { error: denied };

  const raw = String(form.get('pick') ?? '');
  const sep1 = raw.indexOf('|');
  const sep2 = raw.indexOf('|', sep1 + 1);
  if (sep1 < 1 || sep2 < 0) return { error: 'Nothing to change.' };

  const id = raw.slice(sep1 + 1, sep2);
  const src = raw.slice(sep2 + 1);

  try {
    await setNewsImage(id, src);
    revalidatePath('/admin', 'layout');
    return { ok: true, detail: 'Image changed. Publish to put it live.' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not change the image.' };
  }
}
