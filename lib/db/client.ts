import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema>;

/**
 * A Drizzle client for THIS request.
 *
 * Never hoist this to module scope. Workers bind I/O objects to the request that
 * created them, so a cached client throws `Cannot perform I/O on behalf of a
 * different request` on the second request — which passes every local test that
 * only makes one request, then fails in production under any real traffic.
 * Constructing per call is the documented pattern and costs nothing: `drizzle()`
 * is a thin wrapper over the binding, not a connection.
 */
export async function getDb(): Promise<Db> {
  // `async: true` is required anywhere this might run during static generation —
  // which includes the exporter and generateStaticParams. The synchronous form
  // throws there.
  const { env } = await getCloudflareContext({ async: true });

  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) {
    throw new Error(
      'D1 binding "DB" is not available. Uncomment d1_databases in wrangler.jsonc ' +
        'and run `npx wrangler d1 create 3lines-cms` if the database does not exist yet.'
    );
  }

  return drizzle(binding, { schema });
}

export { schema };
