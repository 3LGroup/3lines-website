import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageForEdit } from '@/lib/admin/content';
import { ADDABLE_BODY_KINDS } from '@/lib/admin/structure';
import { listAllMedia } from '@/lib/admin/media';
import { getDb, schema } from '@/lib/db/client';
import PageEditor from './PageEditor';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageForEdit(slug);
  return { title: page ? page.titles.en : 'Page' };
}

export default async function EditPage({ params }: Params) {
  const { slug } = await params;
  const [page, library, routeRows] = await Promise.all([
    getPageForEdit(slug),
    listAllMedia(),
    (async () => {
      const db = await getDb();
      return db.select({ route: schema.pages.route }).from(schema.pages);
    })(),
  ]);
  if (!page) notFound();

  const fields = page.blocks.reduce((n, b) => n + b.fields.en.length, 0);

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <p className="adm-hint" style={{ marginBlockEnd: 'var(--adm-2)' }}>
          <a href="/admin/pages" style={{ color: 'var(--primary)' }}>
            Pages
          </a>
          <span style={{ color: 'var(--muted-foreground)' }}>/</span>
          <code>{page.route}</code>
        </p>
        <h1 className="adm-page__title">{page.titles.en}</h1>
        <p className="adm-page__lede">
          {fields} editable fields across {page.blocks.length} bands. English on top, Arabic below.
          Open a band to edit its words, links and images, rearrange it, or delete it — and add new
          sections at the bottom.
        </p>
      </div>

      <PageEditor
        slug={page.slug}
        route={page.route}
        status={page.status}
        meta={page.meta}
        blocks={page.blocks}
        library={library}
        routes={routeRows.map((r) => r.route)}
        addableBodyKinds={ADDABLE_BODY_KINDS}
      />
    </div>
  );
}
