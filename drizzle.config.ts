import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config for Cloudflare D1.
 *
 * `driver: 'd1-http'` is how drizzle-kit talks to a REMOTE D1 for
 * `drizzle-kit push` / `studio`. Generating migrations does not need
 * credentials, so `npm run db:generate` works offline and before the database
 * exists — which is the whole reason the schema can be built and reviewed
 * before anyone runs `wrangler login`.
 *
 * Applying them is done with wrangler, not drizzle-kit, because wrangler owns
 * the local D1 state that `next dev` binds to:
 *
 *   npm run db:generate                    # schema.ts -> drizzle/*.sql
 *   npm run db:migrate:local               # apply to .wrangler/state (offline)
 *   npm run db:migrate:remote              # apply to the real D1 (needs login)
 */
export default defineConfig({
  out: './drizzle',
  schema: './lib/db/schema.ts',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
  // Emitted SQL is reviewed and committed, so keep it readable.
  verbose: true,
  strict: true,
});
