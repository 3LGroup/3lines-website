'use client';

/**
 * Wrap a server action so a transport failure surfaces as an ordinary error
 * state instead of vanishing.
 *
 * When the network drops, the server action never runs — the rejection happens
 * inside React's own dispatch, underneath useActionState. Nothing updates the
 * hook's state, so no error renders, and the aftermath measured in the browser
 * was the worst state a save UI can be in: the editor's text sitting in the
 * field under a "No changes" badge, with the server never having heard of it.
 * Walk away at that moment and the edit is silently gone.
 *
 * The wrapper runs on the client (its callers are client components), awaits
 * the real server action, and turns a rejection into `{ error }` — which every
 * admin form already renders through its existing role="alert" path, keeping
 * the unsaved edits and the enabled button exactly as they were.
 *
 * Every result shape in the admin carries an optional `error: string`, which is
 * the entire contract this relies on.
 */
export function guarded<S extends { error?: string }, A extends unknown[]>(
  action: (...args: A) => Promise<S>
): (...args: A) => Promise<S> {
  return async (...args: A) => {
    try {
      return await action(...args);
    } catch (e) {
      /* Next steers redirect()/notFound() through a thrown control-flow error.
         Swallowing one here would leave login and create-page sitting still
         after a successful action — those must keep propagating. */
      if (
        e &&
        typeof e === 'object' &&
        'digest' in e &&
        typeof (e as { digest: unknown }).digest === 'string' &&
        ((e as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
          (e as { digest: string }).digest.startsWith('NEXT_NOT_FOUND'))
      ) {
        throw e;
      }
      return {
        error: 'Could not reach the server. Your changes are still here — try again.',
      } as S;
    }
  };
}
