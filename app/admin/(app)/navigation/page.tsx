import type { Metadata } from 'next';
import { getNavigation } from '@/lib/admin/chrome';
import { listAllMedia } from '@/lib/admin/media';
import { getDb, schema } from '@/lib/db/client';
import NavigationEditor from './NavigationEditor';

export const metadata: Metadata = { title: 'Navigation & footer' };

export default async function NavigationPage() {
  const [nav, library, pages] = await Promise.all([
    getNavigation(),
    listAllMedia(),
    (async () => {
      const db = await getDb();
      return db.select({ route: schema.pages.route }).from(schema.pages);
    })(),
  ]);

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Navigation &amp; footer</h1>
        <p className="adm-page__lede">
          The header links, the big menu, the footer columns and the two logo marks. One structure
          serves both languages — adding or reordering a link changes English and Arabic together;
          only the wording differs per language.
        </p>
      </div>

      <NavigationEditor nav={nav} library={library} routes={pages.map((p) => p.route)} />
    </div>
  );
}
