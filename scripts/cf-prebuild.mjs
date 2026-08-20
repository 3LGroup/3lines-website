/**
 * Refresh content/ from the real D1 before a Cloudflare build.
 *
 * This closes the gap that made Publish a no-op. The intended model — stated in
 * open-next.config.ts — is that publishing POSTs a Deploy Hook, Workers Builds
 * re-runs the build, and the build "re-exports from D1 on the way through". The
 * last part was never implemented: `cf:build` went straight to the adapter, and
 * the public pages read content/*.json off disk via lib/content.ts. So a build
 * triggered by Publish rebuilt from the JSON committed in git and shipped the
 * OLD copy while reporting success — an editor's changes silently discarded.
 *
 * Fails loudly rather than falling back. An export that errors and lets the
 * build continue would reproduce exactly the failure this exists to fix, except
 * now with a green build log in front of it.
 *
 * Skipping is possible but must be deliberate: without credentials there is
 * nothing to export FROM, which is the normal case for a local `cf:preview`.
 * That path says so on stdout instead of passing quietly, because "built from
 * committed content" and "built from the database" are not interchangeable and
 * the difference is invisible in the output.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/* Workers Builds authenticates with CLOUDFLARE_API_TOKEN, the same variable
   wrangler reads, so its presence is what decides whether a remote export is
   possible at all. CMS_EXPORT_ON_BUILD forces the question either way for
   anyone who needs to override it. */
const forced = process.env.CMS_EXPORT_ON_BUILD;
const hasToken = Boolean(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY);
const shouldExport = forced === '1' ? true : forced === '0' ? false : hasToken;

if (!shouldExport) {
  console.log(
    '\ncf-prebuild: no Cloudflare credentials — building from the committed content/.\n' +
      '            CMS edits in D1 are NOT in this build. Set CLOUDFLARE_API_TOKEN\n' +
      '            (or CMS_EXPORT_ON_BUILD=1) to export from the database first.\n'
  );
  process.exit(0);
}

console.log('\ncf-prebuild: exporting content/ from remote D1…');

try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'export-content.mjs'), '--remote'], {
    cwd: ROOT,
    stdio: 'inherit',
    maxBuffer: 256 * 1024 * 1024,
  });
} catch (err) {
  console.error(
    '\ncf-prebuild: the export FAILED, so this build would have shipped stale content.\n' +
      '            Stopping instead. Fix the export and rebuild.\n'
  );
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
