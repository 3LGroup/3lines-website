'use client';

import { useActionState } from 'react';
import Icon from '@/components/admin/Icon';
import { loginAction, type LoginState } from '../actions';
import { guarded } from '@/components/admin/guard';

/**
 * The only client component in the admin so far.
 *
 * `useActionState` is what makes this progressively enhanced rather than
 * JS-dependent: the <form> posts to the server action with or without
 * hydration, and the hook only adds the inline error and the pending state on
 * top. The login page is the request most likely to arrive before JS has
 * settled, so that matters more here than anywhere else in the app.
 */
export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(guarded(loginAction), {});

  return (
    <form action={formAction}>
      <div className="adm-field" data-invalid={state.error ? 'true' : undefined}>
        <label className="adm-label" htmlFor="password">
          Password
        </label>
        <input
          className="adm-input"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          // The error is announced by the alert below; pointing at it here means
          // a screen reader reaches the reason rather than just "invalid".
          aria-describedby={state.error ? 'login-error' : undefined}
          aria-invalid={state.error ? true : undefined}
        />
      </div>

      {state.error ? (
        <p className="adm-error" id="login-error" role="alert">
          <Icon name="alert" />
          {state.error}
        </p>
      ) : null}

      <button className="adm-btn adm-btn--primary" type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
