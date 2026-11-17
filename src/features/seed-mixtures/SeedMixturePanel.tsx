import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { NumberField } from '../../shared/ui/NumberField';
import type { Catalogue } from '../catalogue/catalogue';
import { loadCatalogue } from '../catalogue/catalogueRepository';
import { catalogueError } from '../catalogue/catalogueErrors';
import { loadSeedMixtures, saveSeedMixture } from './seedMixtureRepository';
import type { SeedMixture, SeedMixtureComponent, SeedMixtureDetails } from './seedMixture';
import { validateSeedMixture } from './seedMixture';

export function SeedMixturePanel({ userId, onEditingChange }: { userId: string; onEditingChange?: (editing: boolean) => void }) {
  const [data, setData] = useState<{ catalogue: Catalogue; mixtures: SeedMixture[] }>();
  const [editing, setEditing] = useState<{ current?: SeedMixture }>();
  const [error, setError] = useState(''), [search, setSearch] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => { onEditingChange?.(!!editing); return () => onEditingChange?.(false); }, [editing, onEditingChange]);
  useEffect(() => {
    let alive = true; setData(undefined); setError('');
    void Promise.all([loadCatalogue(userId), loadSeedMixtures()]).then(([catalogue, mixtures]) => { if (alive) setData({ catalogue, mixtures }); })
      .catch((problem) => { if (alive) setError(catalogueError(problem).message); });
    return () => { alive = false; };
  }, [userId, attempt]);
  if (!data) return <div className="space-y-3"><p role={error ? 'alert' : 'status'}>{error || 'Loading seed mixtures…'}</p>{error && <Button onClick={() => setAttempt(attempt + 1)}>Try again</Button>}</div>;
  const { catalogue, mixtures } = data;
  if (editing && catalogue.isAdmin) return <SeedMixtureForm catalogue={catalogue} current={editing.current} onCancel={() => setEditing(undefined)}
    onSave={async (details) => { await saveSeedMixture(details, editing.current); setEditing(undefined); setAttempt(attempt + 1); }} />;
  const matches = mixtures.filter((mixture) => `${mixture.name} ${mixture.notes}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="space-y-4">
    <p className="text-sm">Mixtures combine crops or cultivars by percentage of seed weight. Green manure areas select a mixture and specify grams per m².</p>
    <TextField id="mixture-search" label="Search seed mixtures" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
    {catalogue.isAdmin && <Button disabled={!catalogue.plants.length} onClick={() => setEditing({})}>Add seed mixture</Button>}
    <ul className="space-y-3">{matches.map((mixture) => <li key={mixture.id} className="space-y-2 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
      <h3 className="font-semibold">{mixture.name}</h3>
      {mixture.notes && <p className="whitespace-pre-wrap text-sm">{mixture.notes}</p>}
      <ul className="space-y-1 text-sm">{mixture.components.map((component, index) => <li key={index}>{catalogue.plants.find((crop) => crop.id === component.plantTypeId)?.name}
        {component.cultivarId && ` · ${catalogue.cultivars?.find((cultivar) => cultivar.id === component.cultivarId)?.name}`} · {component.percentage}% by weight</li>)}</ul>
      {catalogue.isAdmin && <Button variant="secondary" onClick={() => setEditing({ current: mixture })}>Edit</Button>}
    </li>)}</ul>
    {!matches.length && <p className="text-sm">No matching seed mixtures.</p>}
    <Button variant="secondary" onClick={() => setAttempt(attempt + 1)}>Refresh catalogue</Button>
  </div>;
}
function SeedMixtureForm({ catalogue, current, onCancel, onSave }: { catalogue: Catalogue; current?: SeedMixture; onCancel: () => void; onSave: (details: SeedMixtureDetails) => Promise<void> }) {
  const [name, setName] = useState(current?.name ?? ''), [notes, setNotes] = useState(current?.notes ?? '');
  const [components, setComponents] = useState<SeedMixtureComponent[]>(() => current ? structuredClone(current.components) : [{ plantTypeId: catalogue.plants[0]?.id ?? '', cultivarId: null, percentage: 100 }]);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  function update(index: number, values: Partial<SeedMixtureComponent>) { setComponents((items) => items.map((item, i) => i === index ? { ...item, ...values } : item)); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return;
    const details = { name, notes, components }, problem = validateSeedMixture(details);
    if (problem) { setError(problem); return; }
    setPending(true); setError('');
    try { await onSave(details); } catch (failure) { setError(catalogueError(failure).message); } finally { setPending(false); }
  }
  return <form className="space-y-4" onSubmit={submit}>
    <h3 className="font-semibold">{current ? 'Edit seed mixture' : 'Add seed mixture'}</h3>
    <TextField id="mixture-name" label="Name" required maxLength={100} value={name} disabled={pending} onChange={(event) => setName(event.target.value)} />
    <TextField id="mixture-notes" label="Notes (optional)" maxLength={2000} value={notes} disabled={pending} onChange={(event) => setNotes(event.target.value)} />
    <fieldset className="space-y-3"><legend className="font-medium">Components · percentage by weight</legend>
      {components.map((component, index) => <div key={index} className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
        <SelectField id={`mixture-crop-${index}`} label="Crop" required value={component.plantTypeId} disabled={pending} onChange={(event) => update(index, { plantTypeId: event.target.value, cultivarId: null })}>
          <option value="">Choose a crop</option>{catalogue.plants.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
        </SelectField>
        <SelectField id={`mixture-cultivar-${index}`} label="Cultivar (optional)" value={component.cultivarId ?? ''} disabled={pending} onChange={(event) => update(index, { cultivarId: event.target.value || null })}>
          <option value="">Any cultivar</option>{catalogue.cultivars?.filter((cultivar) => cultivar.plantTypeId === component.plantTypeId).map((cultivar) => <option key={cultivar.id} value={cultivar.id}>{cultivar.name}</option>)}
        </SelectField>
        <NumberField id={`mixture-percentage-${index}`} label="Percentage by weight" unit="%" min={0.000001} max={100} step="any" required value={component.percentage || ''} disabled={pending} onChange={(event) => update(index, { percentage: Number(event.target.value) })} />
        <Button variant="secondary" disabled={pending || components.length === 1} onClick={() => setComponents(components.filter((_, i) => i !== index))}>Remove component</Button>
      </div>)}
      <p role="status" className="text-sm">Total: {Number(components.reduce((sum, item) => sum + item.percentage, 0).toFixed(6))}% · must equal 100%</p>
      <Button variant="secondary" disabled={pending || components.length >= 50} onClick={() => setComponents([...components, { plantTypeId: '', cultivarId: null, percentage: 0 }])}>Add component</Button>
    </fieldset>
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    <Button type="submit" disabled={pending}>Save entry</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Back to catalogue</Button>
  </form>;
}
