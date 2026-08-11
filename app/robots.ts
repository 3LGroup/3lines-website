import type { MetadataRoute } from 'next';

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? 'https://www.3lines.com.sa';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
