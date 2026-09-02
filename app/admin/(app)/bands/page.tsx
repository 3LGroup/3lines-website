import type { Metadata } from 'next';
import Icon from '@/components/admin/Icon';
import { listBands } from '@/lib/admin/bands';
import SimpleForm, { type SimpleField } from '../site/SimpleForm';
import { saveBandsAction } from './actions';

export const metadata: Metadata = { title: 'Shared bands' };

export default async function BandsPage() {
  const bands = await listBands();

  const fields: SimpleField[] = bands.map((b) => ({
    key: b.key,
    label: b.label,
    value: b.localized ? ((b.value as Record<string, string>).en ?? '') : (b.value as string),
    ar: b.localized ? ((b.value as Record<string, string>).ar ?? '') : undefined,
    ja: b.localized ? ((b.value as Record<string, string>).ja ?? '') : undefined,
    ko: b.localized ? ((b.value as Record<string, string>).ko ?? '') : undefined,
    hint: `${b.hint ? `${b.hint} ` : ''}Appears on ${b.copies} page${b.copies === 1 ? '' : 's'} — saving updates all of them.`,
  }));

  const mixed = bands.filter((b) => b.mixed);

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Shared bands</h1>
        <p className="adm-page__lede">
          The careers call-to-action and the contact icon strip repeat at the foot of nearly every
          page. Edit them once here; the change lands on every copy.
        </p>
      </div>

      {mixed.length ? (
        <div className="adm-alert adm-alert--warn" style={{ marginBlockEnd: 'var(--adm-4)' }}>
          <Icon name="alert" />
          <span>
            {mixed.map((b) => b.label).join(', ')}: the pages currently disagree — the value shown
            is the most common one, and saving will align every page to what you enter.
          </span>
        </div>
      ) : null}

      <SimpleForm fields={fields} action={saveBandsAction} title="Shared bands" />
    </div>
  );
}
