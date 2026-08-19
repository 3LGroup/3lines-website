import { notFound, redirect } from 'next/navigation';
import BlockRenderer from '@/components/blocks/Blocks';
import { isLocale, type Locale } from '@/lib/i18n';
import { readSession } from '@/lib/admin/session';
import { previewBlocks } from '@/lib/admin/preview';

type Params = { params: Promise<{ locale: string; slug: string }> };

/**
 * The page as it currently stands in the database.
 *
 * Rendered by components/blocks/Blocks.tsx — the same component the public site
 * uses — so what an editor sees here is produced by the code that will produce
 * the real page, not by an approximation of it.
 *
 * Checked for a session independently of the layout: a route handler or page can
 * be reached directly, and this one serves unpublished content.
 */
export default async function PreviewPage({ params }: Params) {
  if (!(await readSession())) redirect('/admin/login');

  const { locale: raw, slug } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw as Locale;

  const blocks = await previewBlocks(locale, slug);
  if (!blocks) notFound();

  return (
    <>
      {blocks.map((block, i) => (
        <BlockRenderer block={block} locale={locale} key={i} />
      ))}
    </>
  );
}
