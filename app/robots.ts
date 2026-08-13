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
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
