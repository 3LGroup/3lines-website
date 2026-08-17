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

      /* ---- Cutover from the .html site ------------------------------------
         3lines.com.sa currently serves .html URLs and a different service
         taxonomy. Every one of them 404s here, so without these the cutover
         breaks ~34 live URLs — each an inbound link, a bookmark or an indexed
         result. All 308, so ranking transfers rather than being treated as new
         pages. The full list came from the live /pages-index.html, both
         locales, rather than from memory.
         ------------------------------------------------------------------- */

      // Service sub-pages: 7 old slugs, none matching the 10 new ones. Five map
      // onto a clear successor. The last two describe work the rebuild's
      // taxonomy does not carry as its own page, so they go to the services
      // index rather than to a page that only approximately means the same
      // thing — a wrong specific redirect is worse than an honest general one.
      ...Object.entries({
        'generators-and-ups': 'power-systems-support',
        'supporting-ground-equipment': 'ground-support-equipment-sustainment',
        'supporting-the-simulator-system': 'simulation-systems',
        'provide-spare-parts': 'spare-parts-logistics-and-warehousing',
        'maintaining-and-repairing-of-spare-parts': 'electronics-diagnostic-and-repair-workshops',
        'hydraulic-pneumatic-equipment-and-components': '',
        'structure-and-frame': '',
      }).map(([from, to]) => ({
        source: `/:locale(en|ar)/services/${from}.html`,
        destination: to ? `/:locale/services/${to}` : '/:locale/services',
        permanent: true,
      })),

      // Legal moved up a level: /en/legal/privacy-policy.html -> /en/privacy-policy
      { source: '/:locale(en|ar)/legal/:page.html', destination: '/:locale/:page', permanent: true },

      // Pages with no successor in the rebuild.
      { source: '/:locale(en|ar)/certificates.html', destination: '/:locale/about', permanent: true },
      { source: '/:locale(en|ar)/pages-index.html', destination: '/:locale', permanent: true },

      // partners-and-clients also existed as .html.
      { source: '/:locale(en|ar)/partners-and-clients.html', destination: '/:locale/partners', permanent: true },

      /* Catch-all for the rest — about, services, news, contact. Last, so the
         specific rules above win: Next matches in order, and this would
         otherwise swallow certificates.html and send it to a route that does
         not exist. */
      { source: '/:locale(en|ar)/:page.html', destination: '/:locale/:page', permanent: true },
      { source: '/:locale(en|ar).html', destination: '/:locale', permanent: true },
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
