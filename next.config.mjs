/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The source site ships hand-authored CSS/JS from /assets; we serve those verbatim
  // out of /public so geometry is identical by construction rather than re-derived.
  async redirects() {
    return [
      // 307, not 308: language negotiation may be added later, and a permanent
      // redirect would already be cached in every visitor's browser.
      { source: '/', destination: '/en', permanent: false },

      // Unprefixed paths land in English rather than 404ing.
      ...[
        'about',
        'services',
        'news',
        'partners',
        'contact',
        'location',
        'careers',
        'privacy-policy',
        'terms-and-conditions',
        'cookie-policy',
      ].flatMap((p) => [
        { source: `/${p}`, destination: `/en/${p}`, permanent: true },
        { source: `/${p}/:rest*`, destination: `/en/${p}/:rest*`, permanent: true },
      ]),

      // The live site's URLs, preserved so existing links and SEO equity survive.
      { source: '/:locale(en|ar)/partners-and-clients', destination: '/:locale/partners', permanent: true },
      { source: '/:locale(en|ar)/legal', destination: '/:locale/privacy-policy', permanent: true },
    ];
  },

  /**
   * Keep preview hosts out of the search index.
   *
   * The Vercel deployment serves a complete copy of the live 3lines.com.sa. Left
   * crawlable it would compete with the real site, and /location and /careers do
   * not exist there at all, so their canonicals point at 404s and there is nothing
   * for Google to consolidate them into.
   *
   * The header is the part that does the work. robots.txt only asks a crawler not
   * to FETCH a page; a URL discovered from a link elsewhere can still be indexed,
   * bare and snippetless. X-Robots-Tag covers every response, assets included.
   *
   * Gated on an explicit flag rather than VERCEL_ENV, because this project's
   * "production" IS the preview — VERCEL_ENV cannot tell the two apart. Unset
   * locally, so dev and the audits are unaffected. Deleting the env var and
   * redeploying is the whole of undoing it.
   */
  async headers() {
    if (process.env.NOINDEX !== '1') return [];
    return [
      { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
