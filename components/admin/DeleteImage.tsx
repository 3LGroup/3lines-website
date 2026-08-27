'use client';

import { useActionState, useEffect, useState } from 'react';
import Icon from './Icon';
import { deleteImage, type DeleteState } from '@/app/admin/(app)/media/actions';

/**
 * Remove one image — uploaded or shipped with the repo.
 *
 * Rendered on every tile in the library. What makes that safe to offer is the
 * server side: the delete action scans the database first and refuses, naming
 * the places, while any page, the navigation, a news card or Site info still
 * points at the image. The refusal message renders under this tile.
 *
 * Confirmation is a two-press toggle rather than window.confirm(). The native
 * dialog is blocked in some embedded contexts and cannot be styled, and this
 * keeps the "are you sure" attached to the tile it belongs to, so it is obvious
 * WHICH image is about to go.
 */
export default function DeleteImage({ path, name }: { path: string; name: string }) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteImage, {});
  const [armed, setArmed] = useState(false);

  // Disarm once the delete has been attempted, so a failed delete does not
  // leave a primed button sitting over an image that is still there.
  useEffect(() => {
    if (state.ok || state.error) setArmed(false);
  }, [state]);

  // Nothing to disarm back to: the tile is gone on the next render.
  if (state.ok) return null;

  return (
    <form action={action} className="adm-tile__del">
      <input type="hidden" name="path" value={path} />

      {armed ? (
        <>
          <button
            type="submit"
            className="adm-btn adm-btn--sm adm-btn--danger"
            disabled={pending}
            /* Names the file, so a screen reader user gets the same "which
               one" that sighted users get from the button's position. */
            aria-label={`Confirm deleting ${name}`}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--sm adm-btn--outline"
            onClick={() => setArmed(false)}
            disabled={pending}
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          className="adm-tile__delbtn"
          onClick={() => setArmed(true)}
          aria-label={`Delete ${name}`}
          title={`Delete ${name}`}
        >
          <Icon name="trash" />
        </button>
      )}

      {state.error ? (
        <p className="adm-tile__delerr" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
