import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCollection, collectionByKey } from '@/lib/admin/collections';
import CollectionEditor from './CollectionEditor';

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { key } = await params;
  return { title: collectionByKey(key)?.label ?? 'Collection' };
}

export default async function CollectionPage({ params }: Params) {
  const { key } = await params;
  const collection = await getCollection(key);
  if (!collection) notFound();

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">{collection.def.label}</h1>
        <p className="adm-page__lede">{collection.def.blurb}</p>
      </div>

      <CollectionEditor
        collection={collection}
        // The collection lives inside a page; the preview shows that page.
        preview={{ locale: 'en', slug: collection.slug }}
      />
    </div>
  );
}
