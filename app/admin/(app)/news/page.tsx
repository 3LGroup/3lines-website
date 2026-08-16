import type { Metadata } from 'next';
import { listNews } from '@/lib/admin/site';
import SimpleForm, { type SimpleField } from '../site/SimpleForm';
import { saveNewsAction } from '../site/actions';

export const metadata: Metadata = { title: 'News' };

/**
 * The newsroom index.
 *
 * Edits the card — headline, category, date — which is what appears on the
 * homepage teaser and on /news. The article's own body lives on its page and is
 * edited under Pages, because the two are separate records: the article carries
 * no date at all, which is why the newsroom can sort but an article cannot show
 * when it ran.
 */
export default async function NewsPage() {
  const posts = await listNews();

  // Keys carry no locale — SimpleForm appends `:en` / `:ar` for localized
  // fields. Putting a locale here is what produced `<id>:title:en:ar`, which the
  // action parsed as English and used to overwrite the English headline.
  const fields: SimpleField[] = posts.flatMap((p) => [
    {
      key: `${p.id}:title`,
      label: 'Headline',
      value: p.title.en,
      ar: p.title.ar,
      group: p.title.en || p.slug,
    },
    {
      key: `${p.id}:tag`,
      label: 'Category',
      value: p.tag.en,
      ar: p.tag.ar,
      group: p.title.en || p.slug,
    },
    {
      key: `${p.id}:date`,
      label: 'Date',
      value: p.date,
      hint: 'YYYY-MM-DD. Orders the newsroom, newest first.',
      group: p.title.en || p.slug,
    },
  ]);

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">News</h1>
        <p className="adm-page__lede">
          {posts.length} posts. This is the card shown on the homepage and the newsroom — the
          article’s own text is under Pages &amp; SEO.
        </p>
      </div>

      <SimpleForm fields={fields} action={saveNewsAction} title="News" />
    </div>
  );
}
