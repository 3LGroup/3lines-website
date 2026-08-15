import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

/**
 * Cache strategy: read-only, backed by Workers Static Assets.
 *
 * This site is prerendered in full — 25 routes x 2 locales, `generateStaticParams`
 * with `dynamicParams = false`. The adapter's own guidance for that shape is to
 * use the static-assets cache: it is the fastest option available and needs no
 * Queue, no Tag Cache and no R2 cache bucket.
 *
 * The tradeoff is deliberate and worth stating plainly, because it decides how
 * publishing works: this cache CANNOT be revalidated. `revalidatePath` and
 * `revalidateTag` have nothing to write to. Publishing from the CMS therefore
 * means rebuilding — the admin POSTs a Cloudflare Deploy Hook, Workers Builds
 * re-runs `next build`, and `generateStaticParams` re-reads D1 on the way
 * through. Content is live in a minute or two rather than instantly.
 *
 * That is the model this project already chose. Swapping to in-place ISR would
 * mean r2IncrementalCache plus a Durable Object queue plus a tag cache, and
 * would put a mutable cache in front of a site whose correctness is currently
 * verified by diffing static output against a committed baseline.
 */
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,

  /**
   * Serve a prerendered page straight from the cache without booting Next's
   * full request pipeline. Only sound because every public route is static;
   * it must be revisited if any of them ever becomes dynamic.
   */
  enableCacheInterception: true,
});
