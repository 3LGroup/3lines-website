import type { Metadata } from 'next';
import { listNewsCards } from '@/lib/admin/news';
import { listAllMedia } from '@/lib/admin/media';
import SimpleForm, { type SimpleField } from '../site/SimpleForm';
import { saveNewsAction } from '../site/actions';
import NewsManager from './NewsManager';

export const metadata: Metadata = { title: 'News' };

/**
 * The newsroom index.
 *
 * Two surfaces: the manager on top handles the card lifecycle — create, delete,
 * reorder, the card image — and the form below edits each card's words. The
 * article's own text lives on its page under Pages & SEO, because the two are
 * separate records: the article carries no date at all, which is why the
 * newsroom can sort but an article cannot show when it ran.
 */
export default async function NewsPage() {
  const [posts, library] = await Promise.all([listNewsCards(), listAllMedia()]);

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
      key: `${p.id}:type`,
      label: 'Kind label',
      value: p.type.en,
      ar: p.type.ar,
      hint: 'The small word above the date on the card, e.g. "News".',
      group: p.title.en || p.slug,
    },
    {
      key: `${p.id}:mediaAlt`,
      label: 'Image description',
      value: p.mediaAlt.en,
      ar: p.mediaAlt.ar,
      hint: 'Read by screen readers. Leave empty if the image is purely decorative.',
      group: p.title.en || p.slug,
    },
    {
      key: `${p.id}:date`,
      label: 'Date',
      value: p.date,
      hint: 'YYYY-MM-DD, shown on the card.',
      group: p.title.en || p.slug,
    },
  ]);

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">News</h1>
        <p className="adm-page__lede">
          {posts.length} posts. The cards here appear on the homepage and the newsroom — each
          article&rsquo;s own text is under Pages &amp; SEO.
        </p>
      </div>

      <NewsManager posts={posts} library={library} />

      <SimpleForm fields={fields} action={saveNewsAction} title="News" />
    </div>
  );
}
