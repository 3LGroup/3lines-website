import { asc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import type { Json } from '@/lib/localization';
import { isAdmissibleAsset } from './media';
import { addBody, deletePage, insertBlock } from './structure';
import type { Locale } from './content';

const LOCALES: Locale[] = ['en', 'ar'];
const now = () => Math.floor(Date.now() / 1000);

/**
 * News lifecycle: create, delete, reorder, and the card image — everything the
 * card-copy form (title/tag/date, in lib/admin/site.ts) cannot reach.
 *
 * A news item is two records: the index row this file manages, and the article
 * page it links to. Creating one creates both; deleting one deletes both.
 */

export interface NewsCard {
  id: string;
  slug: string;
  route: string;
  date: string;
  position: number;
  mediaSrc: string | null;
  title: Record<Locale, string>;
  tag: Record<Locale, string>;
  type: Record<Locale, string>;
  mediaAlt: Record<Locale, string>;
  /** Whether the article page behind the card exists. */
  hasPage: boolean;
}

export async function listNewsCards(): Promise<NewsCard[]> {
  const db = await getDb();
  const [items, tr, pages] = await Promise.all([
    db.select().from(schema.newsItems).orderBy(asc(schema.newsItems.position)),
    db.select().from(schema.newsItemTranslations),
    db.select({ route: schema.pages.route }).from(schema.pages),
  ]);
  const routes = new Set(pages.map((p) => p.route));
  const of = new Map(tr.map((t) => [`${t.itemId}:${t.locale}`, t]));
  const l10n = (id: string, pick: (t: (typeof tr)[number]) => string | null) =>
    Object.fromEntries(
      LOCALES.map((l) => {
        const t = of.get(`${id}:${l}`);
        return [l, (t ? pick(t) : '') ?? ''];
      })
    ) as Record<Locale, string>;

  return items.map((i) => ({
    id: i.id,
    slug: i.slug,
    route: i.route,
    date: i.date,
    position: i.position,
    mediaSrc: i.mediaSrc,
    title: l10n(i.id, (t) => t.title),
    tag: l10n(i.id, (t) => t.tag),
    type: l10n(i.id, (t) => t.type),
    mediaAlt: l10n(i.id, (t) => t.mediaAlt),
    hasPage: routes.has(i.route),
  }));
}

const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export async function createNewsItem({
  titleEn,
  titleAr,
  date,
}: {
  titleEn: string;
  titleAr: string;
  date: string;
}): Promise<void> {
  if (!titleEn.trim() || !titleAr.trim()) {
    throw new Error('Both the English and Arabic headline are required.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('The date must be YYYY-MM-DD.');

  const slug = slugify(titleEn);
  if (!slug) throw new Error('The English headline must contain some letters or numbers.');
  const route = `/news/${slug}`;

  const db = await getDb();
  const existingItem = await db.select().from(schema.newsItems).where(eq(schema.newsItems.slug, slug));
  if (existingItem.length) throw new Error(`A news item already exists at ${route}.`);
  const existingPage = await db.select().from(schema.pages).where(eq(schema.pages.route, route));
  if (existingPage.length) throw new Error(`A page already exists at ${route}.`);

  /* The index row. Position at the top: news lists lead with the newest. */
  const itemId = crypto.randomUUID();
  const items = await db.select().from(schema.newsItems);
  for (const i of items) {
    await db
      .update(schema.newsItems)
      .set({ position: i.position + 1, updatedAt: now() })
      .where(eq(schema.newsItems.id, i.id));
  }
  await db.insert(schema.newsItems).values({
    id: itemId,
    slug,
    route,
    date,
    mediaSrc: null,
    position: 0,
  });
  for (const [locale, title, tag, type] of [
    ['en', titleEn.trim(), 'News', 'News'],
    ['ar', titleAr.trim(), 'أخبار', 'خبر'],
  ] as const) {
    await db.insert(schema.newsItemTranslations).values({
      itemId,
      locale,
      title,
      tag,
      type,
      mediaAlt: null,
    });
  }

  /* The article page. Hidden from search engines until its copy is real —
     the card still links to it, which is how an editor previews it. */
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${schema.pages.position}), -1)` })
    .from(schema.pages);
  const pageId = crypto.randomUUID();
  await db.insert(schema.pages).values({
    id: pageId,
    route,
    slug: `news--${slug}`,
    status: 'placeholder',
    sourceRefs: [],
    position: maxPos + 1,
  });
  for (const [locale, title] of [
    ['en', titleEn.trim()],
    ['ar', titleAr.trim()],
  ] as const) {
    await db.insert(schema.pageTranslations).values({
      pageId,
      locale,
      title,
      description: title,
      keywords: null,
      translationState: 'translated',
    });
  }

  await insertBlock({
    pageId,
    parentId: null,
    kind: 'pageTitle',
    merged: {
      en: {
        type: 'pageTitle',
        crumbs: [
          { label: 'Home', href: '/' },
          { label: 'Newsroom', href: '/news' },
          { label: titleEn.trim() },
        ],
        heading: titleEn.trim(),
      },
      ar: {
        type: 'pageTitle',
        crumbs: [
          { label: 'الرئيسية', href: '/' },
          { label: 'الأخبار', href: '/news' },
          { label: titleAr.trim() },
        ],
        heading: titleAr.trim(),
      },
    } as unknown as Record<Locale, Json>,
    position: 0,
  });
  const sectionId = await insertBlock({
    pageId,
    parentId: null,
    kind: 'section',
    merged: {
      en: { type: 'section', tone: 'plain' },
      ar: { type: 'section', tone: 'plain' },
    } as unknown as Record<Locale, Json>,
    position: 1,
  });
  await addBody(sectionId, 'prose');
}

export async function deleteNewsItem(id: string): Promise<void> {
  const db = await getDb();
  const [item] = await db.select().from(schema.newsItems).where(eq(schema.newsItems.id, id)).limit(1);
  if (!item) throw new Error('That news item no longer exists.');

  // The index row first — deletePage refuses while an item still points there.
  await db.delete(schema.newsItems).where(eq(schema.newsItems.id, id));

  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.route, item.route)).limit(1);
  if (page) await deletePage(page.slug);
}

export async function moveNewsItem(id: string, direction: 'up' | 'down'): Promise<void> {
  const db = await getDb();
  const items = await db.select().from(schema.newsItems).orderBy(asc(schema.newsItems.position));
  const i = items.findIndex((x) => x.id === id);
  if (i === -1) throw new Error('That news item no longer exists.');
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= items.length) return;

  await db
    .update(schema.newsItems)
    .set({ position: items[j].position, updatedAt: now() })
    .where(eq(schema.newsItems.id, items[i].id));
  await db
    .update(schema.newsItems)
    .set({ position: items[i].position, updatedAt: now() })
    .where(eq(schema.newsItems.id, items[j].id));
}

export async function setNewsImage(id: string, src: string): Promise<void> {
  if (!(await isAdmissibleAsset(src))) {
    throw new Error(`"${src}" is not an image this site holds.`);
  }
  const db = await getDb();
  await db
    .update(schema.newsItems)
    .set({ mediaSrc: src, updatedAt: now() })
    .where(eq(schema.newsItems.id, id));
}
