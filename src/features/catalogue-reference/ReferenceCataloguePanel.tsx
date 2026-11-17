import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { NumberField } from '../../shared/ui/NumberField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { referenceText } from './referenceText';
import { catalogueError } from '../catalogue/catalogueErrors';
import { CatalogueRemovalDialog } from '../catalogue/CatalogueRemovalDialog';
import { loadReferenceData, saveReference, removeCultivar } from './referenceRepository';
import { referenceSections, referenceTables } from './referenceModel';
import type { Field, ReferenceData, ReferenceRow, ReferenceTable } from './referenceModel';

export function ReferenceCataloguePanel({ userId, section: controlledSection, initialSection = 'plant_cultivars', onEditingChange }: { userId: string; section?: ReferenceTable; initialSection?: ReferenceTable; onEditingChange?: (editing: boolean) => void }) {
  const { t } = useI18n();
  const text = (value: string) => referenceText(t, value);
  const [data, setData] = useState<ReferenceData>();
  const [selectedSection, setSection] = useState<ReferenceTable>(initialSection);
  const section = controlledSection ?? selectedSection;
  const [editing, setEditing] = useState<{ current?: ReferenceRow }>();
  const [removing, setRemoving] = useState<ReferenceRow>();
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    onEditingChange?.(!!editing || !!removing);
    return () => onEditingChange?.(false);
  }, [editing, removing, onEditingChange]);
  useEffect(() => {
    let alive = true;
    setError(''); setData(undefined); setRemoving(undefined);
    void loadReferenceData(userId).then((next) => { if (alive) setData(next); }).catch((e) => { if (alive) setError(catalogueError(e).message); });
    return () => { alive = false; };
  }, [userId, attempt]);
  if (!data) return <div className="space-y-3"><p role={error ? 'alert' : 'status'}>{error || t('catalogue.loadingReference')}</p>{error && <Button onClick={() => setAttempt(attempt + 1)}>{t('catalogue.refresh')}</Button>}</div>;
  if (editing && data.isAdmin) return <ReferenceForm table={section} data={data} current={editing.current} onCancel={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setAttempt(attempt + 1); }} />;
  function fieldValue(field: Field, row: ReferenceRow): string {
    const value = row[field.key];
    if (field.reference) return String(data![field.reference].find((item) => item.id === value)?.name ?? text('Unknown'));
    if (field.key.endsWith('_target')) {
      const prefix = field.key.startsWith('current') ? 'current' : 'previous';
      const family = row[`${prefix}_family_id`];
      return String((family ? data!.plant_families.find((item) => item.id === family) : data!.plant_types.find((item) => item.id === row[`${prefix}_plant_id`]))?.name ?? text('Unknown'));
    }
    if (value === null || value === undefined) return text('Inherit or unknown');
    if (typeof value === 'boolean') return text(value ? 'Yes' : 'No');
    return field.choices ? text(String(value)) : String(value);
  }
  const rows = data[section].filter((row) => referenceSections[section].fields.map((field) => fieldValue(field, row)).join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="space-y-4">
    {data.isAdmin && removing && <CatalogueRemovalDialog key={removing.id} name={String(removing.name)} removesGuidance
      onCancel={() => setRemoving(undefined)} onRemove={() => removeCultivar(removing)} onRemoved={() => {
        setRemoving(undefined); setMessage(t('catalogue.removed')); setAttempt(attempt + 1);
      }} />}
    {!controlledSection && <SelectField id="reference-section" label={t('catalogue.section')} value={section} onChange={(e) => { setSection(e.target.value as ReferenceTable); setSearch(''); setMessage(''); }}>
      {referenceTables.map((table) => <option key={table} value={table}>{text(referenceSections[table].label)}</option>)}
    </SelectField>}
    {['plant_cultivars', 'plant_guidance', 'plant_depths', 'plant_calendar_entries'].includes(section) && <p className="text-sm">{t('catalogue.inheritance')}</p>}
    <TextField id="reference-search" label={t('catalogue.search')} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
    {data.isAdmin && <Button onClick={() => setEditing({})}>{t('catalogue.addEntry')}</Button>}
    <p role="status" className="text-sm text-green-800 empty:hidden dark:text-green-400">{message}</p>
    <ul className="space-y-3">{rows.map((row) => <li key={row.id} className="space-y-2 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
      <dl className="text-sm">{referenceSections[section].fields.filter((field) => data.isAdmin || field.key !== 'code').map((field) => <div key={field.key} className="mb-1"><dt className="inline font-medium">{text(field.label)}: </dt><dd className="inline whitespace-pre-wrap">{fieldValue(field, row)}</dd></div>)}</dl>
      {section === 'plant_calendar_entries' && <p className="text-sm">{t('catalogue.monthWindows')}: {data.calendar_windows.filter((window) => window.calendar_entry_id === row.id).map((window) => `${window.start_month}–${window.end_month}`).join('; ') || t('catalogue.noWindows')}</p>}
      {data.isAdmin && <Button variant="secondary" onClick={() => setEditing({ current: row })}>{t('catalogue.edit')}</Button>}
      {data.isAdmin && section === 'plant_cultivars' && <Button type="button" variant="danger"
        aria-label={t('catalogue.removeNamed', { name: String(row.name) })}
        onClick={() => { setRemoving(row); setMessage(''); }}>{t('catalogue.remove')}</Button>}
    </li>)}</ul>
    {!rows.length && <p>{t('catalogue.noEntries')}</p>}
    <Button variant="secondary" onClick={() => setAttempt(attempt + 1)}>{t('catalogue.refresh')}</Button>
  </div>;
}

function ReferenceForm({ table, data, current, onCancel, onSaved }: { table: ReferenceTable; data: ReferenceData; current?: ReferenceRow; onCancel: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const text = (value: string) => referenceText(t, value);
  const spec = referenceSections[table];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(spec.fields.map((field) => {
    let value = current?.[field.key];
    if (field.key.endsWith('_target') && current) {
      const prefix = field.key.startsWith('current') ? 'current' : 'previous';
      value = current[`${prefix}_family_id`] ? `family:${current[`${prefix}_family_id`]}` : `plant:${current[`${prefix}_plant_id`]}`;
    }
    return [field.key, value == null ? (field.required && field.choices?.length === 1 ? field.choices[0] : '') : String(value)];
  })));
  const [windows, setWindows] = useState(() => data.calendar_windows.filter((row) => row.calendar_entry_id === current?.id).map((row) => ({ start_month: Number(row.start_month), end_month: Number(row.end_month) })));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
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
        } else payload[field.key] = value === '' ? (['notes', 'name'].includes(field.key) ? '' : null)
          : field.type === 'number' ? Number(value) : field.type === 'boolean' ? value === 'true' : value;
      }
      await saveReference(table, payload, current, windows);
      onSaved();
    } catch (e) { setError(catalogueError(e).message); }
    finally { setPending(false); }
  }
  function change(field: Field, value: string) {
    setValues((previous) => ({ ...previous, [field.key]: value, ...(field.key === 'plant_type_id' && 'cultivar_id' in previous ? { cultivar_id: '' } : {}) }));
  }
  return <form className="space-y-3" onSubmit={submit}>
    <h3 className="font-semibold">{text(spec.label)}</h3>
    <p className="text-sm">{t('catalogue.inheritance')}</p>
    {spec.fields.map((field) => {
      const props = { id: `reference-${field.key}`, label: text(field.label), value: values[field.key], required: field.required, disabled: pending };
      let choices = field.choices?.map((value) => ({ value, label: text(value) }));
      if (field.reference) choices = data[field.reference].filter((row) => field.reference !== 'plant_cultivars' || row.plant_type_id === values.plant_type_id).map((row) => ({ value: row.id, label: String(row.name) }));
      if (field.type === 'boolean') choices = [{ value: 'true', label: text('Yes') }, { value: 'false', label: text('No') }];
      if (field.key.endsWith('_target')) choices = [...data.plant_families.map((row) => ({ value: `family:${row.id}`, label: `${row.name} · ${text('Family')}` })), ...data.plant_types.map((row) => ({ value: `plant:${row.id}`, label: `${row.name} · ${text('Crop')}` }))];
      if (choices) return <SelectField key={field.key} {...props} onChange={(e) => change(field, e.target.value)}><option value="">{text(field.required ? 'Choose' : 'Inherit or unknown')}</option>{choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</SelectField>;
      if (field.type === 'number') return <NumberField unit="" key={field.key} {...props} min={field.min} step={field.step ?? 'any'} onChange={(e) => change(field, e.target.value)} />;
      return <TextField key={field.key} {...props} maxLength={field.key === 'name' ? 100 : 2000} onChange={(e) => change(field, e.target.value)} />;
    })}
    {table === 'plant_calendar_entries' && <fieldset className="space-y-2"><legend>{t('catalogue.monthWindows')}</legend>
      {windows.map((window, index) => <div key={index} className="flex items-end gap-2">
        {(['start_month', 'end_month'] as const).map((key) => <NumberField unit="" key={key} id={`window-${index}-${key}`} label={t(key === 'start_month' ? 'catalogue.startMonth' : 'catalogue.endMonth')} min={1} max={12} step={1} required disabled={pending} value={String(window[key])} onChange={(e) => setWindows(windows.map((item, i) => i === index ? { ...item, [key]: Number(e.target.value) } : item))} />)}
        <Button variant="secondary" disabled={pending} onClick={() => setWindows(windows.filter((_, i) => i !== index))}>{t('catalogue.removeWindow')}</Button>
      </div>)}
      <Button variant="secondary" disabled={pending || windows.length >= 24} onClick={() => setWindows([...windows, { start_month: 1, end_month: 1 }])}>{t('catalogue.addWindow')}</Button>
      <p className="text-sm">{t('catalogue.noWindows')}</p>
    </fieldset>}
    <p role="alert">{error}</p>
    <Button type="submit" disabled={pending}>{t('catalogue.save')}</Button>
    <Button variant="secondary" disabled={pending} onClick={onCancel}>{t('catalogue.cancel')}</Button>
  </form>;
}
