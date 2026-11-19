import { MonthField } from './MonthField';
import { useFormLeave, useGuardedBack } from '../../shared/navigation/WorkspaceNavigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { NumberField } from '../../shared/ui/NumberField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { referenceText } from './referenceText';
import { catalogueError } from '../catalogue/catalogueErrors';
import { saveReference } from './referenceRepository';
import { referenceSections } from './referenceModel';
import type { Field, ReferenceData, ReferenceRow, ReferenceTable } from './referenceModel';

export function ReferenceForm({ table, data, current, initial, fixedValues = {}, cancelLabel, onCancel, onSaved }: { table: ReferenceTable; data: ReferenceData; current?: ReferenceRow; initial?: ReferenceRow; fixedValues?: Record<string, string>; cancelLabel?: string; onCancel: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const text = (value: string) => referenceText(t, value);
  const spec = referenceSections[table];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(spec.fields.map((field) => {
    let value = fixedValues[field.key] ?? (current ?? initial)?.[field.key];
    if (field.key.endsWith('_target') && (current || initial) && !(field.key in fixedValues)) {
      const prefix = field.key.startsWith('current') ? 'current' : 'previous';
      const source = (current ?? initial)!;
      value = source[`${prefix}_cultivar_id`] ? `cultivar:${source[`${prefix}_cultivar_id`]}` : source[`${prefix}_family_id`] ? `family:${source[`${prefix}_family_id`]}` : `plant:${source[`${prefix}_plant_id`]}`;
    }
    return [field.key, value == null ? (field.required && field.choices?.length === 1 ? field.choices[0] : '') : String(value)];
  })));
  const [windows, setWindows] = useState(() => data.calendar_windows.filter((row) => row.calendar_entry_id === (current ?? initial)?.id).map((row) => ({ start_month: Number(row.start_month), end_month: Number(row.end_month) })));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const guardedBack = useGuardedBack(onCancel);
  const [originalFields] = useState(() => JSON.stringify([values,windows]));
  const formRef = useFormLeave(JSON.stringify([values,windows]) !== originalFields, pending, submit, onCancel);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    try {
      const payload: Record<string, unknown> = {};
      for (const field of spec.fields) {
        const value = values[field.key].trim();
        if (field.key.endsWith('_target')) {
          const prefix = field.key.startsWith('current') ? 'current' : 'previous';
          const [kind, id] = value.split(':');
          payload[`${prefix}_family_id`] = kind === 'family' ? id : null;
          payload[`${prefix}_plant_id`] = kind === 'plant' ? id : null;
          payload[`${prefix}_cultivar_id`] = kind === 'cultivar' ? id : null;
        } else payload[field.key] = value === '' ? (['notes', 'name'].includes(field.key) ? '' : null)
          : field.type === 'number' ? Number(value) : field.type === 'boolean' ? value === 'true' : value;
      }
      await saveReference(table, payload, current, windows);
      onSaved(); return true;
    } catch (e) { setError(catalogueError(e).message); }
    finally { setPending(false); }
  }
  function change(field: Field, value: string) {
    setValues((previous) => ({ ...previous, [field.key]: value, ...(field.key === 'plant_type_id' && 'cultivar_id' in previous ? { cultivar_id: '' } : {}) }));
  }
  return <form ref={formRef} className="space-y-3" onSubmit={submit}>
    <h3 className="font-semibold">{text(spec.label)}</h3>
    <p className="text-sm">{t('catalogue.inheritance')}</p>
    {spec.fields.filter((field) => !(field.key in fixedValues)).map((field) => {
      const props = { id: `reference-${field.key}`, label: text(field.label), value: values[field.key], required: field.required, disabled: pending };
      let choices = field.choices?.map((value) => ({ value, label: text(value) }));
      if (field.reference) choices = data[field.reference].filter((row) => field.reference !== 'plant_cultivars' || row.plant_type_id === values.plant_type_id).map((row) => ({ value: row.id, label: String(row.name) }));
      if (field.type === 'boolean') choices = [{ value: 'true', label: text('Yes') }, { value: 'false', label: text('No') }];
      if (field.key.endsWith('_target')) choices = [...data.plant_families.map((row) => ({ value: `family:${row.id}`, label: `${row.name} · ${text('Family')}` })), ...data.plant_cultivars.map((row) => ({ value: `cultivar:${row.id}`, label: `${row.name} · ${text('Cultivar')}` })), ...data.plant_types.map((row) => ({ value: `plant:${row.id}`, label: `${row.name} · ${text('Crop')}` }))];
      if (choices) return <SelectField key={field.key} {...props} onChange={(e) => change(field, e.target.value)}><option value="">{text(field.required ? 'Choose' : 'Inherit or unknown')}</option>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</SelectField>;
      if (field.type === 'number') return <NumberField unit="" key={field.key} {...props} min={field.min} step={field.step ?? 'any'} onChange={(e) => change(field, e.target.value)} />;
      return <TextField key={field.key} {...props} maxLength={field.key === 'name' ? 100 : 2000} onChange={(e) => change(field, e.target.value)} />;
    })}
    {table === 'plant_calendar_entries' && <fieldset className="space-y-2"><legend>{t('catalogue.monthWindows')}</legend>
      {windows.map((window, index) => <div key={index} className="grid grid-cols-2 items-end gap-2">
        {(['start_month', 'end_month'] as const).map((key) => <MonthField key={key} id={`window-${index}-${key}`} label={t(key === 'start_month' ? 'catalogue.startMonth' : 'catalogue.endMonth')} required disabled={pending} value={String(window[key])} onChange={(e) => setWindows(windows.map((item, i) => i === index ? { ...item, [key]: Number(e.target.value) } : item))} />)}
        <Button type="button" variant="secondary" disabled={pending} onClick={() => setWindows(windows.filter((_, i) => i !== index))}>{t('catalogue.removeWindow')}</Button>
      </div>)}
      <Button type="button" variant="secondary" disabled={pending || windows.length >= 24} onClick={() => setWindows([...windows, { start_month: 1, end_month: 1 }])}>{t('catalogue.addWindow')}</Button>
      <p className="text-sm">{t('catalogue.noWindows')}</p>
    </fieldset>}
    <p role="alert">{error}</p>
    <Button type="submit" disabled={pending}>{t('catalogue.save')}</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={guardedBack}>{cancelLabel ?? t('catalogue.cancel')}</Button>
  </form>;
}
