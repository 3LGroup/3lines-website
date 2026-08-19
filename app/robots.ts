import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Same flag as the X-Robots-Tag header in next.config.mjs. That header is what
  // actually keeps these pages out of the index; this stops crawlers spending any
  // budget here in the first place. Advertising a sitemap while disallowing
  // everything would contradict itself, so it goes too.
  if (process.env.NOINDEX === '1') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    // /admin is also noindexed by its own metadata and by an X-Robots-Tag in
    // public/_headers. This entry is the cheapest of the three and the only one
    // a crawler reads before requesting anything, so it saves the request rather
    // than just the indexing.
    //
    // /preview matters more than /admin here: it renders unpublished content
    // through the real public renderer, so an indexed preview URL would be a
    // draft of the live site sitting in search results.
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/preview'] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
