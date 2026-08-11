import { getRoutes } from '@/lib/content';

/**
 * 404 for the locale tree.
 *
 * Without this, an unmatched path under the optional catch-all throws
 * `NoFallbackError` in the server log instead of rendering a page.
 */
export default function NotFound() {
  const routes = getRoutes().slice(0, 6);

  return (
    <section className="section">
      <div className="wrap">
        <p className="kicker">404</p>
        <h1 className="h2">This page could not be found.</h1>
        <p className="lede" style={{ marginBottom: 30 }}>
          The address may be out of date, or the page may have moved.
        </p>
        <ul className="prose">
          {routes.map((r) => (
            <li key={r.slug}>
              <a href={`/en${r.route === '/' ? '' : r.route}`}>{r.route}</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
