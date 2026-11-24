import { CatalogueDescription } from './CatalogueDescription';
import { removeCatalogueEntry } from './catalogueRemoval';
import { CatalogueRemovalDialog } from './CatalogueRemovalDialog';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { useDetailScroll } from '../../shared/hooks/useDetailScroll';
import { PlantDetailNavigator } from './PlantDetailNavigator';
import type { PlantDetailTarget } from './PlantDetailNavigator';
import { useEffect, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { loadCatalogue, saveFamily, savePlant, saveRule } from './catalogueRepository';
import { catalogueError } from './catalogueErrors';
import { CatalogueEntries } from './CatalogueEntries';
import type { CatalogueSection, CatalogueSelection } from './CatalogueEntries';
import type { Catalogue, CompanionRule, PlantDetails, PlantFamily, PlantType } from './catalogue';
import { PlantEntryForm } from './PlantEntryForm';
import { CompanionRuleForm } from './CompanionRuleForm';

export function PlantCataloguePanel({ userId, section, onEditingChange }: { userId: string; section: CatalogueSection; onEditingChange?: (editing: boolean) => void }) {
  const { t } = useI18n();
  const [removing, setRemoving] = useState<CatalogueSelection>();
  const [data, setData] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ current?: CatalogueSelection } | null>(null);
  const [detail, setDetail] = useState<{ target: PlantDetailTarget; siblings: PlantDetailTarget[] }>();
  const [guidanceEditing, setGuidanceEditing] = useState(false);
  const [message, setMessage] = useState('');
  const detailScroll = useDetailScroll(!detail && !editing && !loading);
  useEffect(() => {
    onEditingChange?.(!!editing || !!removing || guidanceEditing);
    return () => onEditingChange?.(false);
  }, [editing, removing, guidanceEditing, onEditingChange]);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setEditing(null); setRemoving(undefined);
    void loadCatalogue(userId).then((next) => { if (alive) setData(next); })
      .catch((problem) => { if (alive) setError(catalogueError(problem).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, attempt]);
  if (loading) return <p role="status" className="text-sm">Loading plant catalogue…</p>;
  if (error || !data) return <div className="space-y-3">
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>
    <Button onClick={() => setAttempt((value) => value + 1)}>Try again</Button>
  </div>;

  if (detail) return <PlantDetailNavigator userId={userId} initial={detail.target} siblings={detail.siblings} catalogue={data}
    onEditingChange={setGuidanceEditing} onBack={() => { setLoading(true); detailScroll.restore(); setDetail(undefined); setEditing(null); setAttempt((value) => value + 1); }} />;

  function saved(key: 'families' | 'plants' | 'rules', entry: CatalogueSelection) {
    setData((current) => {
      if (!current) return current;
      const entries = current[key] as CatalogueSelection[];
      const next = entries.some((item) => item.id === entry.id) ? entries.map((item) => item.id === entry.id ? entry : item) : [...entries, entry];
      if (key !== 'rules') next.sort((a, b) => ('name' in a ? a.name : '').localeCompare('name' in b ? b.name : ''));
      return { ...current, [key]: next } as Catalogue;
    });
    setEditing({ current: entry }); setMessage('Catalogue saved.');
  }
  if (editing) {
    if (section === 'companions') return <CompanionRuleForm readOnly={!data.isAdmin} families={data.families} plants={data.plants} cultivars={data.cultivars}
      current={editing.current as CompanionRule | undefined} onCancel={() => setEditing(null)}
      onSave={async (details) => saved('rules', await saveRule(details, editing.current as CompanionRule | undefined))} />;
    return <PlantEntryForm readOnly={!data.isAdmin} kind={section === 'families' ? 'family' : 'plant'} families={data.families}
      current={editing.current as PlantFamily | PlantType | undefined} onCancel={() => setEditing(null)}
      onSave={async (details) => section === 'families'
        ? saved('families', await saveFamily(details, editing.current as PlantFamily | undefined))
        : saved('plants', await savePlant(details as PlantDetails, editing.current as PlantType | undefined))} />;
  }
  const cannotAdd = section === 'plants' ? data.families.length === 0 : section === 'companions' && data.families.length + data.plants.length === 0;
  return <div className="space-y-4">
    {data.isAdmin && removing && section !== 'companions' && <CatalogueRemovalDialog name={(removing as PlantFamily | PlantType).name} removesCropGuidance={section === 'plants'}
      onCancel={() => setRemoving(undefined)} onRemove={() => removeCatalogueEntry(section === 'families' ? 'plant_family' : 'plant_type', removing)}
      onRemoved={() => {
        const key = section === 'families' ? 'families' : 'plants';
        setData((current) => current && ({ ...current, [key]: current[key].filter((item) => item.id !== removing.id) }));
        setRemoving(undefined); setMessage(t('catalogue.removed'));
      }} />}
    <CatalogueDescription isAdmin={data.isAdmin} />
    <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{t('catalogue.planningGuidance')}</p>
    <TextField id="catalogue-search" label="Search catalogue" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
    {data.isAdmin && <Button disabled={cannotAdd} onClick={() => { setEditing({}); setMessage(''); }}>Add {section === 'families' ? 'family' : section === 'plants' ? 'crop' : 'companion rule'}</Button>}
    {data.isAdmin && cannotAdd && <p className="text-sm text-stone-600 dark:text-stone-400">Add a plant family first.</p>}
    <p role="status" className="text-sm text-green-800 empty:hidden dark:text-green-400">{message}</p>
    <CatalogueEntries onRemove={section === 'companions' ? undefined : setRemoving} onOpen={section === 'companions' ? undefined : (entry, entries) => {
      const target = (item: CatalogueSelection): PlantDetailTarget => ({ kind: section === 'families' ? 'family' : 'crop', id: item.id, name: (item as PlantFamily | PlantType).name });
      detailScroll.remember(); setDetail({ target: target(entry), siblings: entries.map(target) });
    }} data={data} section={section} search={search} onEdit={(current) => { setEditing({ current }); setMessage(''); }} />
    <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Refresh catalogue</Button>
  </div>;
}
