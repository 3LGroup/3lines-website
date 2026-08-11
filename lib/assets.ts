import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

/**
 * Content-hashed URL for a file in public/.
 *
 * Hand-maintained `?v=3` query strings go stale the moment someone edits the
 * asset and forgets to bump the number — and the failure is invisible, because
 * the server is serving correct CSS that returning browsers never fetch. That
 * happened here: four consecutive fixes to style.css all shipped under `?v=3`,
 * so the marquee stayed broken for anyone with a warm cache while measuring
 * correct in a fresh one.
 *
 * Deriving the query from the file's own bytes makes that impossible: change
 * the file, the URL changes, caches invalidate.
 */
const cache = new Map<string, string>();

export function asset(publicPath: string): string {
  const cached = cache.get(publicPath);
  if (cached) return cached;

  const file = path.join(process.cwd(), 'public', publicPath.replace(/^\//, ''));
  let version = 'missing';
  try {
    version = createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  } catch {
    // A missing asset is a real problem, but it is the console/content audits'
    // job to fail on it — not the layout's. Render a traceable marker instead.
    console.error(`[asset] not found in public/: ${publicPath}`);
  }

  const url = `${publicPath}?v=${version}`;
  cache.set(publicPath, url);
  return url;
}
