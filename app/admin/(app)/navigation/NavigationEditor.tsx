'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/admin/Icon';
import ImagePicker from '@/components/admin/ImagePicker';
import type { MediaItem } from '@/lib/admin/media';
import type { L10nText, NavChrome, NavLink } from '@/lib/admin/chrome';
import { saveNav, setNavImage, type NavState } from './actions';

/* Sub-editors at MODULE scope, deliberately. Defined inside the component they
   get a fresh function identity every render, React treats the element type as
   changed, and the whole subtree remounts — which destroyed the focused input
   after every single keystroke. */

function TextPair({
  value,
  label,
  onChange,
}: {
  value: L10nText;
  label: string;
  onChange: (v: L10nText) => void;
}) {
  return (
    <div className="adm-field">
      <label className="adm-label">{label}</label>
      <input
        className="adm-input"
        lang="en"
        dir="ltr"
        value={value.en}
        onChange={(e) => onChange({ ...value, en: e.target.value })}
      />
      <input
        className="adm-input"
        aria-label={`${label} (Arabic)`}
        lang="ar"
        dir="rtl"
        style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
        value={value.ar}
        onChange={(e) => onChange({ ...value, ar: e.target.value })}
      />
    </div>
  );
}

function LinkList({
  links,
  onChange,
  addLabel,
}: {
  links: NavLink[];
  onChange: (links: NavLink[]) => void;
  addLabel: string;
}) {
  const [arm, setArm] = useState<number | null>(null);
  const move = (i: number, to: number) => {
    if (to < 0 || to >= links.length) return;
    const next = [...links];
    const [row] = next.splice(i, 1);
    next.splice(to, 0, row);
    onChange(next);
  };
  return (
    <div style={{ display: 'grid', gap: 'var(--adm-3)' }}>
      {links.map((l, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gap: 'var(--adm-2)',
            gridTemplateColumns: '1fr 1fr minmax(140px, 0.9fr) auto',
            alignItems: 'center',
          }}
        >
          <input
            className="adm-input"
            lang="en"
            dir="ltr"
            aria-label={`Link ${i + 1} (English)`}
            value={l.label.en}
            onChange={(e) =>
              onChange(links.map((x, j) => (j === i ? { ...x, label: { ...x.label, en: e.target.value } } : x)))
            }
          />
          <input
            className="adm-input"
            lang="ar"
            dir="rtl"
            aria-label={`Link ${i + 1} (Arabic)`}
            style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
            value={l.label.ar}
            onChange={(e) =>
              onChange(links.map((x, j) => (j === i ? { ...x, label: { ...x.label, ar: e.target.value } } : x)))
            }
          />
          <input
            className="adm-input"
            dir="ltr"
            aria-label={`Link ${i + 1} destination`}
            list="nav-routes"
            value={l.href}
            onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))}
          />
          <span style={{ display: 'flex', gap: 'var(--adm-1)' }}>
            <button
              className="adm-btn adm-btn--sm adm-btn--ghost"
              type="button"
              aria-label={`Move link ${i + 1} earlier`}
              disabled={i === 0}
              onClick={() => move(i, i - 1)}
            >
              ↑
            </button>
            <button
              className="adm-btn adm-btn--sm adm-btn--ghost"
              type="button"
              aria-label={`Move link ${i + 1} later`}
              disabled={i === links.length - 1}
              onClick={() => move(i, i + 1)}
            >
              ↓
            </button>
            {arm === i ? (
              <button
                className="adm-btn adm-btn--sm adm-btn--danger"
                type="button"
                onClick={() => {
                  setArm(null);
                  onChange(links.filter((_, j) => j !== i));
                }}
              >
                Confirm
              </button>
            ) : (
              <button
                className="adm-btn adm-btn--sm adm-btn--ghost"
                type="button"
                aria-label={`Remove link ${i + 1}`}
                onClick={() => setArm(i)}
              >
                ✕
              </button>
            )}
          </span>
        </div>
      ))}
      <div>
        <button
          className="adm-btn adm-btn--sm adm-btn--outline"
          type="button"
          onClick={() => onChange([...links, { label: { en: '', ar: '' }, href: '/' }])}
        >
          + {addLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * One editor over the whole chrome document.
 *
 * Unlike the per-field diff model the page editor uses, this posts the entire
 * edited structure: the chrome is one small tree whose edits (reordering,
 * adding links) are structural more often than textual, and a whole-document
 * save is the shape that cannot leave the two halves misaligned.
 */
export default function NavigationEditor({
  nav,
  library,
  routes,
}: {
  nav: NavChrome;
  library: MediaItem[];
  routes: string[];
}) {
  const [doc, setDoc] = useState<NavChrome>(nav);
  const [baseline, setBaseline] = useState(() => JSON.stringify(nav));
  const dirty = useMemo(() => JSON.stringify(doc) !== baseline, [doc, baseline]);

  const [saveState, saveAction, saving] = useActionState<NavState, FormData>(saveNav, {});
  const [imgState, imgAction, imgWorking] = useActionState<NavState, FormData>(setNavImage, {});

  /* The baseline moves to what was SUBMITTED, not to the current doc: an edit
     typed while the save round-trip was in flight must stay marked unsaved
     rather than being silently absorbed into "No changes". */
  const submitted = useRef<string>('');
  const handled = useRef<NavState | null>(null);
  useEffect(() => {
    if (saveState.ok && saveState !== handled.current) {
      handled.current = saveState;
      if (submitted.current) setBaseline(submitted.current);
    }
  }, [saveState]);

  /* Image picks write the database directly; the stored src arrives on the next
     server render. Mirror it into local state so the thumbnails update without
     losing unsaved text edits. */
  useEffect(() => {
    setDoc((d) => ({
      ...d,
      logoImg: { ...d.logoImg, src: nav.logoImg.src },
      footerLogoImg: { ...d.footerLogoImg, src: nav.footerLogoImg.src },
    }));
    setBaseline((b) => {
      const parsed = JSON.parse(b) as NavChrome;
      parsed.logoImg.src = nav.logoImg.src;
      parsed.footerLogoImg.src = nav.footerLogoImg.src;
      return JSON.stringify(parsed);
    });
  }, [nav.logoImg.src, nav.footerLogoImg.src]);

  const update = (fn: (draft: NavChrome) => void) =>
    setDoc((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as NavChrome;
      fn(next);
      return next;
    });

  const message = imgState.error || saveState.error || imgState.detail || saveState.detail;
  const isError = Boolean(imgState.error || saveState.error);

  /* ---------------------------------------------------------------- render -- */

  return (
    <>
      {/* Every internal route, offered as suggestions on all destination inputs. */}
      <datalist id="nav-routes">
        {routes.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <form action={imgAction} id="navimg" />

      <form
        action={saveAction}
        id="navsave"
        onSubmit={() => {
          submitted.current = JSON.stringify(doc);
        }}
      >
        <input type="hidden" name="doc" value={JSON.stringify(doc)} />
      </form>

      <div
        style={{
          position: 'sticky',
          top: 'var(--adm-topbar-h)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--adm-3)',
          padding: 'var(--adm-3) 0',
          marginBlockEnd: 'var(--adm-4)',
          background: 'var(--background)',
          borderBlockEnd: '1px solid var(--border)',
        }}
      >
        <span className={dirty ? 'adm-badge adm-badge--warn' : 'adm-badge'}>
          {dirty ? 'Unsaved changes' : 'No changes'}
        </span>
        {message ? (
          <span
            className={isError ? 'adm-error' : 'adm-badge adm-badge--ok'}
            role={isError ? 'alert' : 'status'}
            style={{ margin: 0 }}
          >
            <Icon name={isError ? 'alert' : 'check'} size={13} />
            {message}
          </span>
        ) : null}
        <button
          className="adm-btn adm-btn--primary adm-btn--sm"
          type="submit"
          form="navsave"
          disabled={!dirty || saving || imgWorking}
          style={{ marginInlineStart: 'auto' }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 'var(--adm-4)' }}>
        {/* ------------------------------------------------------- logos -- */}
        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Logos</h2>
          </div>
          <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
            <ImagePicker
              label="Header mark"
              current={doc.logoImg.src}
              library={library}
              name={{ path: 'logoImg', shape: 'src' }}
              formId="navimg"
            />
            <TextPair
              label="Header logo description"
              value={doc.logoImg.alt}
              onChange={(v) => update((d) => (d.logoImg.alt = v))}
            />
            <ImagePicker
              label="Footer lockup"
              current={doc.footerLogoImg.src}
              library={library}
              name={{ path: 'footerLogoImg', shape: 'src' }}
              formId="navimg"
            />
            <TextPair
              label="Footer logo description"
              value={doc.footerLogoImg.alt}
              onChange={(v) => update((d) => (d.footerLogoImg.alt = v))}
            />
          </div>
        </section>

        {/* ------------------------------------------------ header links -- */}
        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Header links</h2>
            <p className="adm-hint">The row of links across the top of every page.</p>
          </div>
          <div className="adm-card__body">
            <LinkList
              links={doc.utility.links}
              onChange={(links) => update((d) => (d.utility.links = links))}
              addLabel="Add header link"
            />
          </div>
        </section>

        {/* ---------------------------------------------------- menu tabs -- */}
        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Menu tabs</h2>
            <p className="adm-hint">
              The big menu&rsquo;s left rail. A tab with a destination is a plain link; one without
              opens its panel below.
            </p>
          </div>
          <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-4)' }}>
            {doc.mega.tabs.map((tab, i) => (
              <div
                key={tab.key}
                style={{
                  display: 'grid',
                  gap: 'var(--adm-2)',
                  gridTemplateColumns: '1fr 1fr minmax(140px, 0.9fr)',
                  alignItems: 'center',
                }}
              >
                <input
                  className="adm-input"
                  lang="en"
                  dir="ltr"
                  aria-label={`Tab ${i + 1} (English)`}
                  value={tab.label.en}
                  onChange={(e) => update((d) => (d.mega.tabs[i].label.en = e.target.value))}
                />
                <input
                  className="adm-input"
                  lang="ar"
                  dir="rtl"
                  aria-label={`Tab ${i + 1} (Arabic)`}
                  style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
                  value={tab.label.ar}
                  onChange={(e) => update((d) => (d.mega.tabs[i].label.ar = e.target.value))}
                />
                {tab.href !== undefined ? (
                  <input
                    className="adm-input"
                    dir="ltr"
                    aria-label={`Tab ${i + 1} destination`}
                    list="nav-routes"
                    value={tab.href}
                    onChange={(e) => update((d) => (d.mega.tabs[i].href = e.target.value))}
                  />
                ) : (
                  <span className="adm-hint" style={{ margin: 0 }}>
                    Opens the &ldquo;{tab.label.en}&rdquo; panel
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------- menu panels -- */}
        {doc.mega.panels.map((panel, pi) => (
          <section className="adm-card" key={panel.key}>
            <div className="adm-card__head">
              <h2 className="adm-card__title">Menu panel: {panel.title.en || panel.key}</h2>
            </div>
            <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
              <TextPair
                label="Panel title"
                value={panel.title}
                onChange={(v) => update((d) => (d.mega.panels[pi].title = v))}
              />
              <LinkList
                links={panel.links}
                onChange={(links) => update((d) => (d.mega.panels[pi].links = links))}
                addLabel="Add panel link"
              />
              <div
                style={{
                  display: 'grid',
                  gap: 'var(--adm-2)',
                  gridTemplateColumns: '1fr 1fr minmax(140px, 0.9fr)',
                  alignItems: 'end',
                }}
              >
                <div className="adm-field" style={{ margin: 0 }}>
                  <label className="adm-label">Panel button</label>
                  <input
                    className="adm-input"
                    lang="en"
                    dir="ltr"
                    value={panel.cta.label.en}
                    onChange={(e) => update((d) => (d.mega.panels[pi].cta.label.en = e.target.value))}
                  />
                </div>
                <input
                  className="adm-input"
                  lang="ar"
                  dir="rtl"
                  aria-label="Panel button (Arabic)"
                  style={{ fontFamily: "'Tajawal', var(--font-sans)" }}
                  value={panel.cta.label.ar}
                  onChange={(e) => update((d) => (d.mega.panels[pi].cta.label.ar = e.target.value))}
                />
                <input
                  className="adm-input"
                  dir="ltr"
                  aria-label="Panel button destination"
                  list="nav-routes"
                  value={panel.cta.href}
                  onChange={(e) => update((d) => (d.mega.panels[pi].cta.href = e.target.value))}
                />
              </div>
            </div>
          </section>
        ))}

        {/* ------------------------------------------------ footer columns -- */}
        {doc.footer.columns.map((col, ci) => (
          <section className="adm-card" key={ci}>
            <div className="adm-card__head">
              <h2 className="adm-card__title">Footer column {ci + 1}</h2>
              {col.logo ? <p className="adm-hint">This column also carries the footer logo.</p> : null}
            </div>
            <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
              <TextPair
                label="Column title"
                value={col.title}
                onChange={(v) => update((d) => (d.footer.columns[ci].title = v))}
              />
              <LinkList
                links={col.links}
                onChange={(links) => update((d) => (d.footer.columns[ci].links = links))}
                addLabel="Add footer link"
              />
            </div>
          </section>
        ))}

        {/* ----------------------------------------------------- the rest -- */}
        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Accessibility &amp; language</h2>
          </div>
          <div className="adm-card__body" style={{ display: 'grid', gap: 'var(--adm-5)' }}>
            <TextPair
              label="Skip link"
              value={doc.skip.label}
              onChange={(v) => update((d) => (d.skip.label = v))}
            />
            {doc.utility.lang.map((l, i) => (
              <TextPair
                key={l.locale}
                label={`Language switch label (${l.locale.toUpperCase()})`}
                value={l.label}
                onChange={(v) => update((d) => (d.utility.lang[i].label = v))}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
