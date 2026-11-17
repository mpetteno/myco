import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { NumberField } from '../../shared/ui/NumberField';
import { SelectField } from '../../shared/ui/SelectField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { loadReferenceData } from '../catalogue-reference/referenceRepository';
import { referenceSections } from '../catalogue-reference/referenceModel';
import type { ReferenceData, Field } from '../catalogue-reference/referenceModel';
import { referenceText } from '../catalogue-reference/referenceText';
import { loadCatalogue } from './catalogueRepository';
import { catalogueError } from './catalogueErrors';
import { createCropDraft } from './cropEditor';
import type { CropDraft, EditorRow, EditorTable } from './cropEditor';
import { saveCropEditor } from './cropEditorRepository';
import type { Catalogue } from './catalogue';

type Props = { userId: string; cropId: string; cultivarId?: string; name: string; onBack: () => void; onEditingChange?: (editing: boolean) => void };
function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900">
    <div><h4 id={id} className="font-semibold">{title}</h4>{description && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>}</div>
    {children}
  </section>;
}

export function CropGuidancePanel({ userId, cropId, cultivarId, name, onBack, onEditingChange }: Props) {
  const { t } = useI18n();
  const text = (value: string) => referenceText(t, value);
  const [loaded, setLoaded] = useState<{ data: ReferenceData; catalogue: Catalogue; initial: CropDraft }>();
  const [draft, setDraft] = useState<CropDraft>();
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const dirty = !!draft && !!loaded && JSON.stringify(draft) !== JSON.stringify(loaded.initial);
  useEffect(() => { onEditingChange?.(dirty || pending); return () => onEditingChange?.(false); }, [dirty, pending, onEditingChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    let alive = true;
    setError(''); setLoaded(undefined); setDraft(undefined);
    void Promise.all([loadReferenceData(userId), loadCatalogue(userId)]).then(([data, catalogue]) => {
      if (!alive) return;
      const initial = createCropDraft(data, catalogue, cropId, cultivarId);
      setLoaded({ data, catalogue, initial }); setDraft(structuredClone(initial));
    }).catch((e) => { if (alive) setError(catalogueError(e).message); });
    return () => { alive = false; };
  }, [userId, cropId, cultivarId, attempt]);
  if (!loaded || !draft) return <div className="space-y-3"><p role={error ? 'alert' : 'status'}>{error || t('catalogue.loadingReference')}</p>
    <Button variant="secondary" onClick={onBack}>{t('catalogue.cancel')}</Button>{error && <Button onClick={() => setAttempt(attempt + 1)}>{t('catalogue.refresh')}</Button>}</div>;
  const { data, catalogue, initial } = loaded;
  const admin = data.isAdmin && catalogue.isAdmin;
  const crop = data.plant_types.find((row) => row.id === cropId)!;
  const owner = cultivarId ? data.plant_cultivars.find((row) => row.id === cultivarId)! : crop;
  const family = data.plant_families.find((row) => row.id === (draft.details.family_id || crop.family_id));
  const targetChoices = [
    ...catalogue.plants.map((row) => ({ value: `plant:${row.id}`, label: row.name })),
    ...data.plant_cultivars.map((row) => ({ value: `cultivar:${row.id}`, label: `${data.plant_types.find((item) => item.id === row.plant_type_id)?.name} · ${row.name}` })),
    ...catalogue.families.map((row) => ({ value: `family:${row.id}`, label: `${row.name} · ${text('Family')}` })),
  ];
  function changeDetails(key: string, value: string) { setMessage(''); setDraft((current) => current && ({ ...current, details: { ...current.details, [key]: value } })); }
  function changeRow(key: string, values: Partial<EditorRow>) { setMessage(''); setDraft((current) => current && ({ ...current, rows: current.rows.map((row) => row.key === key ? { ...row, ...values } : row) })); }
  function valueChanged(row: EditorRow, key: string, value: string) { changeRow(row.key, { values: { ...row.values, [key]: value } }); }
  function add(table: EditorTable) {
    const values: Record<string, string> = table === 'plant_calendar_entries' ? { calendar_profile_id: data.calendar_profiles[0]?.id ?? '', activity: 'direct_sowing', planting_method: 'seed', notes: '' }
      : { target: '', relationship: table === 'companion_rules' ? 'companion' : 'avoid_after', notes: '' };
    setMessage(''); setDraft((current) => current && ({ ...current, rows: [...current.rows, { key: crypto.randomUUID(), table, values, inherited: false, removed: false, windows: [] }] }));
  }
  function remove(row: EditorRow) {
    if (row.original) changeRow(row.key, { removed: true });
    else setDraft((current) => current && ({ ...current, rows: current.rows.filter((item) => item.key !== row.key) }));
  }
  function field(spec: Field, values: Record<string, string>, change: (key: string, value: string) => void, prefix: string, inherited?: unknown) {
    const props = { id: `${prefix}-${spec.key}`, label: text(spec.label), value: values[spec.key] ?? '', required: spec.required, disabled: !admin || pending };
    const inheritedLabel = inherited == null ? text('Unknown') : typeof inherited === 'boolean' ? text(inherited ? 'Yes' : 'No') : text(String(inherited));
    const emptyLabel = cultivarId ? `${t('catalogue.useCrop')}: ${inheritedLabel}` : text('Unknown');
    let choices = spec.choices?.map((value) => ({ value, label: value === 'companion' ? t('catalogue.companionSuggestion') : value === 'caution' ? t('catalogue.caution') : text(value) }));
    if (spec.reference) choices = data[spec.reference].map((row) => ({ value: row.id, label: String(row.name) }));
    if (spec.type === 'boolean') choices = [{ value: 'true', label: text('Yes') }, { value: 'false', label: text('No') }];
    if (choices) return <SelectField key={spec.key} {...props} onChange={(e) => change(spec.key, e.target.value)}>
      {(!spec.required || spec.reference) && <option value="">{spec.required ? text('Choose') : emptyLabel}</option>}{choices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </SelectField>;
    const placeholder = inherited == null || inherited === '' ? '' : `${t('catalogue.inherited')}: ${inheritedLabel}`;
    if (spec.type === 'number') return <NumberField key={spec.key} {...props} unit="" min={spec.min} step={spec.step ?? 'any'} placeholder={placeholder} onChange={(e) => change(spec.key, e.target.value)} />;
    if (spec.key.includes('notes')) return <label key={spec.key} htmlFor={props.id} className="block space-y-2 text-sm font-medium sm:col-span-2"><span>{props.label}</span>
      <textarea {...props} aria-label={props.label} maxLength={2000} rows={3} placeholder={placeholder} className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-green-600 dark:border-stone-700 dark:bg-stone-950" onChange={(e) => change(spec.key, e.target.value)} />
    </label>;
    return <TextField key={spec.key} {...props} maxLength={spec.key === 'name' ? 100 : 200} placeholder={placeholder} onChange={(e) => change(spec.key, e.target.value)} />;
  }
  const baseCare = data.plant_guidance.find((row) => row.plant_type_id === cropId && !row.cultivar_id);
  const care = draft.rows.find((row) => row.table === 'plant_guidance')!;
  const detailFields: Field[] = [
    { key: 'name', label: 'Name', required: true },
    ...(!cultivarId ? [{ key: 'family_id', label: 'Family', required: true, choices: [] }, { key: 'scientific_name', label: 'Scientific name' }] : []),
    ...referenceSections.plant_cultivars.fields.filter((item) => !['name', 'plant_type_id'].includes(item.key)),
  ];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !admin || !dirty) return;
    busy.current = true; setPending(true); setError(''); setMessage('');
    try {
      await saveCropEditor(cropId, cultivarId, owner.version, crop.version, draft!, initial);
      setMessage(t('catalogue.savedAll')); setAttempt((value) => value + 1);
    } catch (problem) { setError(catalogueError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  function rowHeader(row: EditorRow, label: string) {
    const before = initial.rows.find((item) => item.key === row.key);
    const changed = row.inherited && before && (JSON.stringify(row.values) !== JSON.stringify(before.values) || JSON.stringify(row.windows) !== JSON.stringify(before.windows));
    return <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{label}{row.inherited && <span className="ml-2 rounded-full bg-stone-100 px-2 py-1 text-xs font-normal text-stone-600 dark:bg-stone-800 dark:text-stone-300">{t(changed ? 'catalogue.unsavedOverride' : 'catalogue.inherited')}</span>}</span>
      {admin && !row.inherited && <button type="button" disabled={pending} aria-label={t('catalogue.removeNamed', { name: label })} className="min-h-10 cursor-pointer text-sm text-red-700 underline dark:text-red-400" onClick={() => remove(row)}>{t('catalogue.remove')}</button>}
    </div>;
  }
  function relationships(table: 'companion_rules' | 'rotation_rules') {
    const rows = draft!.rows.filter((row) => row.table === table);
    return <div className="space-y-4">{rows.map((row, index) => row.removed ? <div key={row.key} className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 p-3 text-sm dark:bg-stone-950"><span>{t('catalogue.willRemove')}</span><button type="button" disabled={pending} className="min-h-10 cursor-pointer underline" onClick={() => changeRow(row.key, { removed: false })}>{t('catalogue.undo')}</button></div>
      : <div key={row.key} className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
        {rowHeader(row, `${table === 'companion_rules' ? t('catalogue.companions') : text('Rotation rules')} ${index + 1}`)}
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField id={`${row.key}-target`} label={table === 'companion_rules' ? t('catalogue.companionTarget') : t('catalogue.previousTarget')} value={row.values.target} required disabled={!admin || pending} onChange={(e) => valueChanged(row, 'target', e.target.value)}>
            <option value="">{text('Choose')}</option>{targetChoices.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
          </SelectField>
          {field({ key: 'relationship', label: 'Relationship', required: true, choices: table === 'companion_rules' ? ['companion', 'caution'] : ['favourable_after', 'avoid_after'] }, row.values, (key, value) => valueChanged(row, key, value), row.key)}
          {field({ key: 'notes', label: 'Notes' }, row.values, (key, value) => valueChanged(row, key, value), row.key)}
        </div>
      </div>)}{!rows.length && <p className="text-sm text-stone-500">{t('catalogue.noEntries')}</p>}
      {admin && <Button type="button" variant="secondary" disabled={pending} onClick={() => add(table)}>{table === 'companion_rules' ? t('catalogue.addCompanion') : t('catalogue.addRotation')}</Button>}
    </div>;
  }
  return <form onSubmit={submit} className="space-y-5 pb-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" disabled={dirty || pending} className="min-h-11 cursor-pointer text-sm text-stone-600 underline underline-offset-4 disabled:cursor-default disabled:opacity-40 dark:text-stone-300" onClick={onBack}>← {t('catalogue.cancel')}</button>
      <span className="text-xs text-stone-500">{cultivarId ? `${text('Cultivar')} · ${crop.name}` : `${text('Crop')} · ${family?.name ?? ''}`}</span>
    </div>
    <div><h3 className="text-2xl font-semibold tracking-tight">{String(owner.name ?? name)}</h3><p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{admin ? t('catalogue.editPageHint') : t('catalogue.readPageHint')}</p></div>
    {cultivarId && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">{t('catalogue.inheritPageHint')}</p>}
    <Section id="crop-details-heading" title={t('catalogue.details')}>
      <div className="grid gap-4 sm:grid-cols-2">{detailFields.map((spec) => {
        if (spec.key === 'family_id') return <SelectField key={spec.key} id="details-family_id" label={text('Family')} value={draft.details.family_id} required disabled={!admin || pending} onChange={(e) => changeDetails(spec.key, e.target.value)}><option value="">{text('Choose')}</option>{catalogue.families.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</SelectField>;
        const inheritable = ['plant_spacing_cm', 'row_spacing_cm', 'border_distance_cm', 'living_mulch_enabled'].includes(spec.key);
        const inherited = cultivarId && inheritable ? crop[spec.key] : !cultivarId && spec.key.endsWith('_spacing_cm') ? family?.[spec.key] : undefined;
        return field({ ...spec, ...(spec.key === 'border_distance_cm' ? { required: !cultivarId } : {}), ...(spec.key === 'living_mulch_enabled' ? { required: !cultivarId } : {}) }, draft.details, changeDetails, 'details', inherited);
      })}</div>
    </Section>
    <Section id="crop-care-heading" title={text('Care guidance')}><div className="grid gap-4 sm:grid-cols-2">{referenceSections.plant_guidance.fields.filter((spec) => !spec.reference).map((spec) => field(spec, care.values, (key, value) => valueChanged(care, key, value), 'care', cultivarId ? baseCare?.[spec.key] : undefined))}</div></Section>
    <Section id="crop-depths-heading" title={text('Planting depths')} description={t('catalogue.depthPageHint')}>
      <div className="space-y-3">{draft.rows.filter((row) => row.table === 'plant_depths').map((row) => <div key={row.key} className="grid items-start gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-[8rem_1fr_2fr] dark:bg-stone-950">
        <span className="pt-3 text-sm font-medium">{text(row.values.planting_method)}</span>
        <NumberField id={`${row.key}-depth_cm`} label={text('Depth (cm)')} aria-label={`${text(row.values.planting_method)} ${text('Depth (cm)')}`} unit="" min={0.01} step="any" value={row.values.depth_cm} placeholder={row.source ? `${t('catalogue.inherited')}: ${row.source.depth_cm}` : '—'} disabled={!admin || pending} required={!!row.values.notes && !row.source} onChange={(e) => changeRow(row.key, { values: { ...row.values, depth_cm: e.target.value, ...(e.target.value === '' ? { notes: '' } : {}) } })} />
        <TextField id={`${row.key}-notes`} label={text('Notes')} aria-label={`${text(row.values.planting_method)} ${text('Notes')}`} maxLength={2000} value={row.values.notes} placeholder={String(row.source?.notes ?? '')} disabled={!admin || pending} onChange={(e) => valueChanged(row, 'notes', e.target.value)} />
      </div>)}</div>
    </Section>
    <Section id="crop-companions-heading" title={t('catalogue.companions')}>{relationships('companion_rules')}</Section>
    <Section id="crop-rotation-heading" title={text('Rotation rules')} description={t('catalogue.rotationPageHint')}>{relationships('rotation_rules')}</Section>
    <Section id="crop-calendar-heading" title={text('Growing calendar')}>
      <div className="space-y-4">{draft.rows.filter((row) => row.table === 'plant_calendar_entries').map((row, index) => row.removed ? <div key={row.key} className="flex items-center justify-between text-sm"><span>{t('catalogue.willRemove')}</span><button type="button" disabled={pending} className="min-h-10 cursor-pointer underline" onClick={() => changeRow(row.key, { removed: false })}>{t('catalogue.undo')}</button></div>
        : <div key={row.key} className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">{rowHeader(row, `${text('Activity')} ${index + 1}`)}
          <div className="grid gap-3 sm:grid-cols-2">{referenceSections.plant_calendar_entries.fields.filter((spec) => !['plant_type_id', 'cultivar_id'].includes(spec.key)).map((spec) => field(spec, row.values, (key, value) => valueChanged(row, key, value), row.key))}</div>
          <div className="space-y-2"><p className="text-sm font-medium">{t('catalogue.monthWindows')}</p>{row.windows.map((window, i) => <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            {(['start_month', 'end_month'] as const).map((key) => <NumberField unit="" key={key} id={`${row.key}-window-${i}-${key}`} label={t(key === 'start_month' ? 'catalogue.startMonth' : 'catalogue.endMonth')} min={1} max={12} step={1} required value={window[key]} disabled={!admin || pending} onChange={(e) => changeRow(row.key, { windows: row.windows.map((item, j) => j === i ? { ...item, [key]: Number(e.target.value) } : item) })} />)}
            {admin && <button type="button" className="min-h-12 cursor-pointer px-2 text-sm text-red-700 dark:text-red-400" disabled={pending} aria-label={t('catalogue.removeWindow')} onClick={() => changeRow(row.key, { windows: row.windows.filter((_, j) => j !== i) })}>×</button>}
          </div>)}{admin && <button type="button" className="min-h-10 cursor-pointer text-sm text-green-800 underline dark:text-green-400" disabled={pending || row.windows.length >= 24} onClick={() => changeRow(row.key, { windows: [...row.windows, { start_month: 1, end_month: 1 }] })}>+ {t('catalogue.addWindow')}</button>}</div>
        </div>)}
        {!draft.rows.some((row) => row.table === 'plant_calendar_entries') && <p className="text-sm text-stone-500">{t('catalogue.noEntries')}</p>}
        {admin && <Button type="button" variant="secondary" disabled={pending} onClick={() => add('plant_calendar_entries')}>{t('catalogue.addCalendarActivity')}</Button>}
      </div>
    </Section>
    {admin && <div className="sticky bottom-0 z-10 -mx-1 space-y-2 rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900">
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-stone-600 dark:text-stone-300">{pending ? t('catalogue.savingAll') : message || (dirty ? t('catalogue.unsaved') : t('catalogue.noChanges'))}</p>
        <div className="flex gap-2">{dirty && <button type="button" disabled={pending} className="min-h-11 cursor-pointer px-2 text-sm text-stone-600 underline dark:text-stone-300" onClick={() => { setDraft(structuredClone(initial)); setError(''); setMessage(''); }}>{t('catalogue.discardChanges')}</button>}
          <div className="w-36"><Button type="submit" disabled={!dirty || pending}>{t('catalogue.saveAll')}</Button></div>
        </div>
      </div>
    </div>}
  </form>;
}
