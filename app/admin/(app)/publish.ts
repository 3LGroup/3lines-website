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
 * Two very different mechanisms behind one button, because the two environments
 * genuinely differ and pretending otherwise would break one of them:
 *
 *   Deployed — a Worker cannot write to a filesystem. Publishing POSTs a
 *   Cloudflare Deploy Hook; Workers Builds re-runs the build, which re-exports
 *   from D1 on the way through. Live in a minute or two.
 *
 *   Local — there is no build service, but there IS a filesystem, so the
 *   exporter runs directly and content/ is rewritten in place. `next dev` picks
 *   the change up on the next request.
 *
 * Detected by the presence of the hook rather than by NODE_ENV: NODE_ENV is
 * "production" under `next start` too, and choosing the wrong branch there means
 * either shelling out inside a Worker or silently not publishing at all.
 */
export async function publish(): Promise<PublishState> {
  if (!(await readSession())) return { error: 'Your session expired. Sign in again.' };

  const hook = process.env.CF_DEPLOY_HOOK_URL;

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

  // Local. Guarded so this can never be attempted in a Worker, where
  // node:child_process does not exist and the failure would be cryptic.
  if (process.env.NEXT_RUNTIME === 'edge' || typeof process.versions?.node !== 'string') {
    return {
      error:
        'CF_DEPLOY_HOOK_URL is not set, so there is nothing to publish to. ' +
        'Create a Deploy Hook in the Cloudflare dashboard and set it as a secret.',
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
