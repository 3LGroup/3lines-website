import type { Metadata } from 'next';
import { getSiteInfo, SITE_FIELDS } from '@/lib/admin/site';
import SimpleForm, { type SimpleField } from './SimpleForm';
import { saveSite } from './actions';

export const metadata: Metadata = { title: 'Site info' };

export default async function SiteInfoPage() {
  const values = await getSiteInfo();

  const fields: SimpleField[] = SITE_FIELDS.map((f) => {
    const raw = values[f.key];
    const localized = typeof raw === 'object' && raw !== null;
    return {
      // No locale suffix here — SimpleForm adds it. See the note on SimpleField.
      key: f.key,
      label: f.label,
      value: localized ? ((raw as Record<string, string>).en ?? '') : ((raw as string) ?? ''),
      ar: f.localized ? ((raw as Record<string, string>)?.ar ?? '') : undefined,
      hint: 'hint' in f ? f.hint : undefined,
      multiline: 'multiline' in f ? f.multiline : undefined,
      group: 'group' in f ? f.group : undefined,
    };
  });

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Site info</h1>
        <p className="adm-page__lede">
          Company details used across the site and in its structured data. Most of these have one
          value regardless of language; the description has both.
        </p>
      </div>

      <SimpleForm fields={fields} action={saveSite} title="Site info" />
    </div>
  );
}
