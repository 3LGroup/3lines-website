'use client';

import { useState } from 'react';
import type { FormBody } from '@/lib/blocks';

type State = 'idle' | 'sending' | 'ok' | 'bad' | 'err';

/**
 * Contact form.
 *
 * Posts to a same-origin Next route handler rather than to the CMS endpoint
 * directly: the upstream sets `Access-Control-Allow-Origin: *` but no
 * `Allow-Methods`/`Allow-Headers`, so a JSON POST's preflight is rejected and a
 * direct browser call cannot work. The proxy also keeps the upstream host out
 * of the client bundle.
 *
 * All user-facing strings arrive as data so the component carries no English.
 */
export default function ContactForm({ body }: { body: FormBody }) {
  const [state, setState] = useState<State>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'sending') return;

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    setState('sending');
    try {
      const res = await fetch(body.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setState('ok');
        form.reset();
      } else {
        setState(res.status === 400 ? 'bad' : 'err');
      }
    } catch {
      setState('err');
    }
  }

  const message =
    state === 'sending' ? body.status.sending
    : state === 'ok' ? body.status.ok
    : state === 'bad' ? body.status.bad
    : state === 'err' ? body.status.err
    : '';

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <div className="form__row">
        {body.fields.map((f) => {
          const id = `f-${f.name}`;
          return (
            <div className="field" key={f.name}>
              <label htmlFor={id}>{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea id={id} name={f.name} required={f.required} placeholder={f.placeholder} />
              ) : (
                <input
                  id={id}
                  name={f.name}
                  type={f.type}
                  required={f.required}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          );
        })}

        {/* Honeypot: hidden from people, tempting to bots. Not display:none — a
            focusable element hidden that way is a screen-reader trap. */}
        <div className="field field--hp" aria-hidden="true">
          <label htmlFor={`f-${body.honeypot}`}>Leave this field empty</label>
          <input id={`f-${body.honeypot}`} name={body.honeypot} tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      <button className="btn btn--blue" type="submit" disabled={state === 'sending'}>
        {body.submit}
      </button>

      <p
        className="form__status"
        role="status"
        aria-live="polite"
        data-state={state === 'idle' ? undefined : state}
      >
        {message}
      </p>
    </form>
  );
}
