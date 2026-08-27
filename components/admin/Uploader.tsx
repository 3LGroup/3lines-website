'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { uploadImage, type UploadState } from '@/app/admin/(app)/media/actions';
import { invalidateLibraryCache } from './ImagePicker';

/** Longest edge after downscaling. Wider than any slot the site actually has. */
const MAX_EDGE = 2000;

/**
 * Add an image to the library.
 *
 * The file is downscaled and converted to WebP in the browser before it is
 * sent. That is not an optimisation detail — a photograph off a phone is 4-6MB
 * and several thousand pixels wide, and the site has no image pipeline behind
 * it: whatever is uploaded is what every visitor downloads, at full size,
 * forever. Doing it here rather than on the server also avoids adding `sharp`,
 * which does not run in a Worker anyway.
 *
 * Alt text is deliberately NOT asked for here. It belongs to the place an image
 * is used, not to the file — the same logo is "SAMI" on the partners grid and
 * "Our client SAMI" in a caption — and every card in this CMS already has its
 * own English and Arabic description field. Asking twice would guarantee the
 * two disagree.
 */
export default function Uploader() {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadImage, {});
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) {
      // The pickers cache the library for the page's lifetime; without this a
      // just-uploaded image would be missing from every picker until reload.
      invalidateLibraryCache();
      setName(null);
      setNote(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [state]);

  /** Draw the file into a canvas at a sane size and re-encode as WebP. */
  async function shrink(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/webp', 0.86)
    );
    if (!blob) return file;

    // Keep the original if re-encoding made it bigger — true for small PNGs of
    // flat-colour logos, where WebP's photographic bias is a loss.
    if (blob.size >= file.size && scale === 1) return file;

    const renamed = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], renamed, { type: 'image/webp' });
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setName(file.name);
    setNote(null);

    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setNote(/svg/i.test(file.type) ? 'SVG cannot be uploaded — it needs a developer.' : 'That is not a JPG, PNG or WebP.');
      return;
    }

    setBusy(true);
    try {
      const out = await shrink(file);
      const dt = new DataTransfer();
      dt.items.add(out);
      if (hiddenRef.current) hiddenRef.current.files = dt.files;
      const before = (file.size / 1024).toFixed(0);
      const after = (out.size / 1024).toFixed(0);
      setNote(out === file ? `${before} KB` : `${before} KB → ${after} KB, converted to WebP`);
    } catch {
      // createImageBitmap refuses corrupt files; let the server say so plainly.
      if (hiddenRef.current && fileRef.current?.files) hiddenRef.current.files = fileRef.current.files;
      setNote('Could not read that image here — trying it as-is.');
    } finally {
      setBusy(false);
    }
  }

  const message = state.error || state.detail || note;
  const isError = Boolean(state.error) || /cannot|not a|Could not/.test(note ?? '');

  return (
    <form action={action} ref={formRef} className="adm-card" style={{ marginBlockEnd: 'var(--adm-5)' }}>
      <div className="adm-card__head">
        <h2 className="adm-card__title">Upload an image</h2>
      </div>
      <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-3)' }}>
        <p className="adm-hint" style={{ margin: 0 }}>
          JPG, PNG or WebP. Large photographs are shrunk here before uploading, so a picture
          straight from a phone is fine.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--adm-3)', flexWrap: 'wrap' }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onPick}
            aria-label="Choose an image to upload"
            className="adm-input"
            style={{ inlineSize: 'auto', paddingBlock: 'var(--adm-2)' }}
          />
          {/* The downscaled file rides on this input; the visible one keeps the
              original so the browser still shows the name the person chose. */}
          <input ref={hiddenRef} type="file" name="file" hidden />

          <button
            className="adm-btn adm-btn--primary adm-btn--sm"
            type="submit"
            disabled={!name || busy || pending}
          >
            {busy ? 'Preparing…' : pending ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        {message ? (
          <span
            className={isError ? 'adm-error' : 'adm-badge adm-badge--ok'}
            role={isError ? 'alert' : 'status'}
            style={{ margin: 0, justifySelf: 'start' }}
          >
            <Icon name={isError ? 'alert' : 'check'} size={13} />
            {message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
