import { useDetailScroll } from '../../shared/hooks/useDetailScroll';
import { CropGuidancePanel } from './CropGuidancePanel';
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
  const [data, setData] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ current?: CatalogueSelection } | null>(null);
  const [guidance, setGuidance] = useState<PlantType>();
  const [guidanceEditing, setGuidanceEditing] = useState(false);
  const [message, setMessage] = useState('');
  const detailScroll = useDetailScroll(!guidance && !loading);
  useEffect(() => {
    onEditingChange?.(!!editing || guidanceEditing);
    return () => onEditingChange?.(false);
  }, [editing, guidanceEditing, onEditingChange]);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setEditing(null);
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

  if (guidance) return <CropGuidancePanel userId={userId} cropId={guidance.id} name={guidance.name} onEditingChange={setGuidanceEditing} onBack={() => { detailScroll.restore(); setGuidance(undefined); setEditing(null); setAttempt((value) => value + 1); }} />;

  function saved(key: 'families' | 'plants' | 'rules', entry: CatalogueSelection) {
    setData((current) => {
      if (!current) return current;
      const entries = current[key] as CatalogueSelection[];
      const next = entries.some((item) => item.id === entry.id) ? entries.map((item) => item.id === entry.id ? entry : item) : [...entries, entry];
      if (key !== 'rules') next.sort((a, b) => ('name' in a ? a.name : '').localeCompare('name' in b ? b.name : ''));
      return { ...current, [key]: next } as Catalogue;
    });
    setEditing(null); setMessage('Catalogue saved.');
  }
  if (editing && data.isAdmin) {
    if (section === 'companions') return <CompanionRuleForm families={data.families} plants={data.plants} cultivars={data.cultivars}
      current={editing.current as CompanionRule | undefined} onCancel={() => setEditing(null)}
      onSave={async (details) => saved('rules', await saveRule(details, editing.current as CompanionRule | undefined))} />;
    return <PlantEntryForm kind={section === 'families' ? 'family' : 'plant'} families={data.families}
      current={editing.current as PlantFamily | PlantType | undefined} onCancel={() => setEditing(null)}
      onSave={async (details) => section === 'families'
        ? saved('families', await saveFamily(details, editing.current as PlantFamily | undefined))
        : saved('plants', await savePlant(details as PlantDetails, editing.current as PlantType | undefined))} />;
  }
  const cannotAdd = section === 'plants' ? data.families.length === 0 : section === 'companions' && data.families.length + data.plants.length === 0;
  return <div className="space-y-4">
    <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">An app-wide reference catalogue. {data.isAdmin ? 'You are a catalogue administrator and can add or edit entries.' : 'Catalogue administrators manage these entries.'} Spacing and companion rules are recommendations; planning will allow exceptions.</p>
    <TextField id="catalogue-search" label="Search catalogue" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
    {data.isAdmin && <Button disabled={cannotAdd} onClick={() => { setEditing({}); setMessage(''); }}>Add {section === 'families' ? 'family' : section === 'plants' ? 'crop' : 'companion rule'}</Button>}
    {data.isAdmin && cannotAdd && <p className="text-sm text-stone-600 dark:text-stone-400">Add a plant family first.</p>}
    <p role="status" className="text-sm text-green-800 empty:hidden dark:text-green-400">{message}</p>
    <CatalogueEntries onGuidance={(crop) => { detailScroll.remember(); setGuidance(crop); }} data={data} section={section} search={search} onEdit={(current) => { setEditing({ current }); setMessage(''); }} />
    <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Refresh catalogue</Button>
  </div>;
}
