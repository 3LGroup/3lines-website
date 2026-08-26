import type { Metadata } from 'next';
import { getUiValues, UI_FIELDS } from '@/lib/admin/ui';
import SimpleForm, { type SimpleField } from '../site/SimpleForm';
import { saveUi } from './actions';

export const metadata: Metadata = { title: 'Interface text' };

export default async function InterfaceTextPage() {
  const values = await getUiValues();

  const fields: SimpleField[] = UI_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    value: values[f.key]?.en ?? '',
    ar: values[f.key]?.ar ?? '',
    hint: f.hint,
  }));

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <h1 className="adm-page__title">Interface text</h1>
        <p className="adm-page__lede">
          The design&rsquo;s own words — menu buttons, screen-reader labels, the theme toggle and
          the 404 page. Page copy lives under Pages &amp; SEO; these are the strings that belong to
          no page in particular.
        </p>
      </div>

      <SimpleForm fields={fields} action={saveUi} title="Interface text" />
    </div>
  );
}
