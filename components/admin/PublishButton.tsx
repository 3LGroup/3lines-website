'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { publish, type PublishState } from '@/app/admin/(app)/publish';

/**
 * Publish, with the outcome stated rather than implied.
 *
 * A spinner that stops is not confirmation. Publishing either rewrote files on
 * disk or triggered a remote build, and those have very different timelines —
 * one is done when the button re-enables, the other is a minute or two away — so
 * the result says which happened instead of showing a generic tick.
 */
export default function PublishButton() {
  const [state, formAction, pending] = useActionState<PublishState, FormData>(
    async () => publish(),
    {}
  );

  /**
   * Publish takes two clicks.
   *
   * Not ceremony. Save and Publish were both primary buttons, and Publish sits
   * earlier in the DOM because it lives in the topbar — my own test aimed at
   * "the primary submit button", hit Publish, and pushed unsaved work at the
   * live site. A real editor reaching for Save would do the same.
   *
   * So Publish is now visually secondary (Save is the frequent, reversible
   * action and keeps the accent) and it arms before it fires. A two-step button
   * rather than a modal: it stays in the tab order, needs no focus trap, and
   * Escape is not the only way out.
   */
  const [armed, setArmed] = useState(false);

  // Disarm on its own so a button left mid-confirm does not stay live behind a
  // tab someone comes back to an hour later.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (state.ok || state.error) setArmed(false);
  }, [state]);

  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action={formAction}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--adm-2)' }}
    >
      {state.error ? (
        <span className="adm-error" role="alert" style={{ margin: 0 }}>
          <Icon name="alert" size={13} />
          {state.error}
        </span>
      ) : null}
      {state.ok && state.detail ? (
        <span className="adm-badge adm-badge--ok" role="status">
          <Icon name="check" size={12} />
          {state.detail}
        </span>
      ) : null}

      <button
        className={`adm-btn adm-btn--sm ${armed ? 'adm-btn--danger' : 'adm-btn--outline'}`}
        /* Always `button`, with the submit issued programmatically on the
           second click. The previous version switched `type` to "submit" once
           armed — but React flushes that re-render synchronously inside the
           click handler, so the SAME click's default action then submitted the
           just-armed button. One physical click armed and published. */
        type="button"
        onClick={() => {
          if (armed) form.current?.requestSubmit();
          else setArmed(true);
        }}
        disabled={pending}
        aria-label={armed ? 'Confirm publish to the live site' : 'Publish'}
      >
        {pending ? 'Publishing…' : armed ? 'Confirm — publish live' : 'Publish'}
      </button>
    </form>
  );
}
