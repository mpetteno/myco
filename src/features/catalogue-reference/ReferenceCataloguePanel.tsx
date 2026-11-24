import { CatalogueDescription } from '../catalogue/CatalogueDescription';
import { removeCatalogueEntry } from '../catalogue/catalogueRemoval';
import { CatalogueEntryRow } from '../catalogue/CatalogueEntryRow';
import { useDetailScroll } from '../../shared/hooks/useDetailScroll';
import { ReferenceForm } from './ReferenceForm';
import { PlantDetailNavigator } from '../catalogue/PlantDetailNavigator';
import type { PlantDetailTarget } from '../catalogue/PlantDetailNavigator';
import { useEffect, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { referenceText } from './referenceText';
import { catalogueError } from '../catalogue/catalogueErrors';
import { CatalogueRemovalDialog } from '../catalogue/CatalogueRemovalDialog';
import { loadReferenceData, removeCultivar } from './referenceRepository';
import { referenceSections, referenceTables } from './referenceModel';
import type { Field, ReferenceData, ReferenceRow, ReferenceTable } from './referenceModel';

export function ReferenceCataloguePanel({ userId, section: controlledSection, initialSection = 'plant_cultivars', onEditingChange }: { userId: string; section?: ReferenceTable; initialSection?: ReferenceTable; onEditingChange?: (editing: boolean) => void }) {
  const { t } = useI18n();
  const text = (value: string) => referenceText(t, value);
  const [data, setData] = useState<ReferenceData>();
  const [selectedSection, setSection] = useState<ReferenceTable>(initialSection);
  const section = controlledSection ?? selectedSection;
  const [editing, setEditing] = useState<{ current?: ReferenceRow }>();
  const [guidance, setGuidance] = useState<{ target: PlantDetailTarget; siblings: PlantDetailTarget[] }>();
  const [guidanceEditing, setGuidanceEditing] = useState(false);
  const [removing, setRemoving] = useState<ReferenceRow>();
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const detailScroll = useDetailScroll(!guidance && !!data);
  useEffect(() => {
    onEditingChange?.(!!editing || !!removing || guidanceEditing);
    return () => onEditingChange?.(false);
  }, [editing, removing, guidanceEditing, onEditingChange]);
  useEffect(() => {
    let alive = true;
    setError(''); setData(undefined); setRemoving(undefined);
    void loadReferenceData(userId).then((next) => { if (alive) setData(next); }).catch((e) => { if (alive) setError(catalogueError(e).message); });
    return () => { alive = false; };
  }, [userId, attempt]);
  if (!data) return <div className="space-y-3"><p role={error ? 'alert' : 'status'}>{error || t('catalogue.loadingReference')}</p>{error && <Button onClick={() => setAttempt(attempt + 1)}>{t('catalogue.refresh')}</Button>}</div>;
  if (guidance) return <PlantDetailNavigator userId={userId} initial={guidance.target} siblings={guidance.siblings} onEditingChange={setGuidanceEditing}
    onBack={() => { setData(undefined); detailScroll.restore(); setGuidance(undefined); setEditing(undefined); setAttempt(attempt + 1); }} />;
  if (editing && data.isAdmin) return <ReferenceForm table={section} data={data} current={editing.current} onCancel={() => setEditing(undefined)} onSaved={(row) => { setEditing({ current: row }); setData((current) => current && ({ ...current, [section]: [...current[section].filter((item) => item.id !== row.id), row] })); }} />;
  function fieldValue(field: Field, row: ReferenceRow): string {
    const value = row[field.key];
    if (field.reference) return String(data![field.reference].find((item) => item.id === value)?.name ?? text('Unknown'));
    if (field.key.endsWith('_target')) {
      const prefix = field.key.startsWith('current') ? 'current' : 'previous';
      const family = row[`${prefix}_family_id`];
      return String((row[`${prefix}_cultivar_id`] ? data!.plant_cultivars.find((item) => item.id === row[`${prefix}_cultivar_id`]) : family ? data!.plant_families.find((item) => item.id === family) : data!.plant_types.find((item) => item.id === row[`${prefix}_plant_id`]))?.name ?? text('Unknown'));
    }
    if (value === null || value === undefined) return text('Inherit or unknown');
    if (typeof value === 'boolean') return text(value ? 'Yes' : 'No');
    return field.choices ? text(String(value)) : String(value);
  }
  const rows = data[section].filter((row) => referenceSections[section].fields.map((field) => fieldValue(field, row)).join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="space-y-4">
    {data.isAdmin && removing && <CatalogueRemovalDialog key={removing.id} name={String(removing.name)} removesGuidance={section === 'plant_cultivars'}
      onCancel={() => setRemoving(undefined)} onRemove={() => section === 'mulch_categories' ? removeCatalogueEntry('mulch_category', removing) : removeCultivar(removing)} onRemoved={() => {
        setRemoving(undefined); setMessage(t('catalogue.removed'));
        if (section === 'mulch_categories') setData((current) => current && ({ ...current, mulch_categories: current.mulch_categories.filter((item) => item.id !== removing.id) }));
        else setAttempt(attempt + 1);
      }} />}
    <CatalogueDescription isAdmin={data.isAdmin} />
    {!controlledSection && <SelectField id="reference-section" label={t('catalogue.section')} value={section} onChange={(e) => { setSection(e.target.value as ReferenceTable); setSearch(''); setMessage(''); }}>
      {referenceTables.map((table) => <option key={table} value={table}>{text(referenceSections[table].label)}</option>)}
    </SelectField>}
    {['plant_cultivars', 'plant_guidance', 'plant_depths', 'plant_calendar_entries'].includes(section) && <p className="text-sm">{t('catalogue.inheritance')}</p>}
    <TextField id="reference-search" label={t('catalogue.search')} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
    {data.isAdmin && <Button onClick={() => setEditing({})}>{t('catalogue.addEntry')}</Button>}
    <p role="status" className="text-sm text-green-800 empty:hidden dark:text-green-400">{message}</p>
    <ul className="space-y-3">{rows.map((row) => <CatalogueEntryRow key={row.id} title={String(row.name ?? referenceSections[section].fields.filter((field) => field.key !== 'notes').slice(0, 2).map((field) => fieldValue(field, row)).join(' · '))} actions={<>
      {section === 'plant_cultivars' ? <Button variant="secondary" data-detail-entry={row.id} onClick={() => {
        const target = (item: ReferenceRow): PlantDetailTarget => ({ kind: 'cultivar', id: item.id, cropId: String(item.plant_type_id), name: String(item.name) });
        detailScroll.remember(); setGuidance({ target: target(row), siblings: rows.map(target) });
      }}>{data.isAdmin ? 'Edit' : 'View'}</Button>
        : data.isAdmin && <Button variant="secondary" onClick={() => setEditing({ current: row })}>{t('catalogue.edit')}</Button>}
      {data.isAdmin && ['plant_cultivars', 'mulch_categories'].includes(section) && <Button type="button" variant="danger"
        aria-label={t('catalogue.removeNamed', { name: String(row.name) })}
        onClick={() => { setRemoving(row); setMessage(''); }}>{t('catalogue.remove')}</Button>}
    </>} />)}</ul>
    {!rows.length && <p>{t('catalogue.noEntries')}</p>}
    <Button variant="secondary" onClick={() => setAttempt(attempt + 1)}>{t('catalogue.refresh')}</Button>
  </div>;
}
