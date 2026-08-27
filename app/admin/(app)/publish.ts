'use server';

import { readSession } from '@/lib/admin/session';

export interface PublishState {
  ok?: boolean;
  error?: string;
  detail?: string;
}

/**
 * Push what is in the database out to the live site.
 *
 * Three mechanisms behind one button, because the environments genuinely differ
 * and pretending otherwise would break one of them:
 *
 *   Deployed, via GitHub Actions — the preferred remote path. Publishing sends a
 *   repository_dispatch; .github/workflows/deploy.yml re-runs the build, which
 *   re-exports from D1 on the way through, and deploys. Live in a minute or two.
 *
 *   Deployed, via a Cloudflare Deploy Hook — the original path, kept for any
 *   account where Workers Builds works. It does NOT work on this one: the build
 *   configuration is bound to a build token owned by a departed user, and every
 *   build fails during initialisation regardless of how many fresh tokens are
 *   created. GitHub is checked first for that reason.
 *
 *   Local — no build service, but there IS a filesystem, so the exporter runs
 *   directly and content/ is rewritten in place. `next dev` picks the change up
 *   on the next request.
 *
 * Detected by which secret is present rather than by NODE_ENV: NODE_ENV is
 * "production" under `next start` too, and choosing the wrong branch there means
 * either shelling out inside a Worker or silently not publishing at all.
 */
export async function publish(): Promise<PublishState> {
  if (!(await readSession())) return { error: 'Your session expired. Sign in again.' };

  /* GitHub Actions. `repository_dispatch` needs a token, an Accept header and a
     User-Agent — GitHub rejects the request outright without the last one, with
     a message that says nothing about the cause. */
  /* Trimmed, because a secret set by piping a value into `wrangler secret put`
     carries the shell's trailing newline — and an invisible \n in the repo name
     turns the URL into `.../3lines-website%0A/dispatches`, which GitHub answers
     with a 404 that names nothing. The same newline in the token would read as
     a bad credential. Both cost real time to find; trimming here means the
     failure cannot come back through however the secret was set. */
  const ghRepo = process.env.GITHUB_DISPATCH_REPO?.trim();
  const ghToken = process.env.GITHUB_DISPATCH_TOKEN?.trim();

  if (ghRepo && ghToken) {
    try {
      const res = await fetch(`https://api.github.com/repos/${ghRepo}/dispatches`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${ghToken}`,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          'user-agent': '3lines-cms',
        },
        body: JSON.stringify({ event_type: 'cms-publish' }),
      });
      // 204 No Content is the success case for this endpoint.
      if (res.status !== 204) {
        const body = await res.text();
        return { error: `GitHub returned ${res.status}: ${body.slice(0, 160)}` };
      }
      return { ok: true, detail: 'Build triggered. The site updates in a minute or two.' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Could not reach GitHub.' };
    }
  }

  // Trimmed for the same reason as the GitHub values above.
  const hook = process.env.CF_DEPLOY_HOOK_URL?.trim();

  if (hook) {
    try {
      const res = await fetch(hook, { method: 'POST' });
      if (!res.ok) return { error: `Cloudflare returned ${res.status} for the deploy hook.` };
      return {
        ok: true,
        detail: 'Build triggered. The site updates in a minute or two.',
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Could not reach the deploy hook.' };
    }
  }

  /* Local. Guarded so this is never attempted in a Worker, where
     node:child_process does not exist.

     The guard used to test `NEXT_RUNTIME === 'edge'` and `process.versions.node`,
     and neither holds here: the adapter runs Next's *Node* runtime, not the edge
     one, and nodejs_compat is precisely what supplies `process.versions.node`.
     So both checks passed inside the deployed Worker, execution fell through to
     execFile, and Publish failed with "The child_process.execFile method is not
     implemented" — the cryptic failure this guard exists to prevent.

     navigator.userAgent is Cloudflare's own documented runtime marker, and
     WebSocketPair is a Workers global with no Node equivalent. Either one being
     present means there is no filesystem and no subprocess to run. */
  const g = globalThis as { navigator?: { userAgent?: string }; WebSocketPair?: unknown };
  const inWorker =
    g.navigator?.userAgent === 'Cloudflare-Workers' || typeof g.WebSocketPair !== 'undefined';

  if (inWorker || process.env.NEXT_RUNTIME === 'edge' || typeof process.versions?.node !== 'string') {
    return {
      error:
        'Publishing is not configured on this deployment. Set GITHUB_DISPATCH_REPO and ' +
        'GITHUB_DISPATCH_TOKEN as Worker secrets so Publish can trigger the deploy workflow.',
    };
  }

  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const run = promisify(execFile);

    const { stdout } = await run(process.execPath, ['scripts/export-content.mjs'], {
      cwd: process.cwd(),
      maxBuffer: 64 * 1024 * 1024,
    });

    const line = stdout.split('\n').find((l) => l.startsWith('EXPORT OK')) ?? 'Exported.';
    return { ok: true, detail: `${line.trim()} — content/ rewritten on disk.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message.slice(0, 300) : 'Export failed.' };
  }
}
