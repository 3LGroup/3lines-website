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
};

export default nextConfig;
