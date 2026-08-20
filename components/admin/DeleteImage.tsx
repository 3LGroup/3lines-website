'use client';

import { useActionState, useEffect, useState } from 'react';
import Icon from './Icon';
import { deleteImage, type DeleteState } from '@/app/admin/(app)/media/actions';

/**
 * Remove one uploaded image.
 *
 * Only rendered for files in the uploads folder. The ~130 images that shipped
 * with the repo live in git and are referenced by the committed content, so a
 * delete button on those would either fail or quietly break a page that nobody
 * edited — it is not offered rather than offered and refused.
 *
 * Confirmation is a two-press toggle rather than window.confirm(). The native
 * dialog is blocked in some embedded contexts and cannot be styled, and this
 * keeps the "are you sure" attached to the tile it belongs to, so it is obvious
 * WHICH image is about to go.
 */
export default function DeleteImage({ name }: { name: string }) {
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
      <input type="hidden" name="name" value={name} />

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
