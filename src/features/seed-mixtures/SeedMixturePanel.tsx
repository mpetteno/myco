import { CatalogueDescription } from '../catalogue/CatalogueDescription';
import { CatalogueEntryRow } from '../catalogue/CatalogueEntryRow';
import { CatalogueRemovalDialog } from '../catalogue/CatalogueRemovalDialog';
import { removeCatalogueEntry } from '../catalogue/catalogueRemoval';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { CatalogueBack } from '../catalogue/CatalogueBack';
import { useFormLeave } from '../../shared/navigation/WorkspaceNavigation';
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
  const { t } = useI18n();
  const [removing, setRemoving] = useState<SeedMixture>();
  const [message, setMessage] = useState('');
  const [data, setData] = useState<{ catalogue: Catalogue; mixtures: SeedMixture[] }>();
  const [editing, setEditing] = useState<{ current?: SeedMixture }>();
  const [error, setError] = useState(''), [search, setSearch] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => { onEditingChange?.(!!editing || !!removing); return () => onEditingChange?.(false); }, [editing, removing, onEditingChange]);
  useEffect(() => {
    let alive = true; setData(undefined); setError(''); setRemoving(undefined);
    void Promise.all([loadCatalogue(userId), loadSeedMixtures()]).then(([catalogue, mixtures]) => { if (alive) setData({ catalogue, mixtures }); })
      .catch((problem) => { if (alive) setError(catalogueError(problem).message); });
    return () => { alive = false; };
  }, [userId, attempt]);
  if (!data) return <div className="space-y-3"><p role={error ? 'alert' : 'status'}>{error || 'Loading seed mixtures…'}</p>{error && <Button onClick={() => setAttempt(attempt + 1)}>Try again</Button>}</div>;
  const { catalogue, mixtures } = data;
  if (editing) return <SeedMixtureForm readOnly={!catalogue.isAdmin} catalogue={catalogue} current={editing.current} onCancel={() => setEditing(undefined)}
    onSave={async (details) => {
      const id = await saveSeedMixture(details, editing.current);
      return async () => {
        const mixtures = await loadSeedMixtures();
        const saved = mixtures.find((item) => item.id === id);
        if (!saved) throw new Error('Saved mixture is unavailable.');
        setData({ catalogue, mixtures }); setEditing({ current: saved });
      };
    }} />;
  const matches = mixtures.filter((mixture) => `${mixture.name} ${mixture.notes}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="space-y-4">
    {catalogue.isAdmin && removing && <CatalogueRemovalDialog name={removing.name} onCancel={() => setRemoving(undefined)}
      onRemove={() => removeCatalogueEntry('seed_mixture', removing)} onRemoved={() => {
        setData((current) => current && ({ ...current, mixtures: current.mixtures.filter((item) => item.id !== removing.id) }));
        setRemoving(undefined); setMessage(t('catalogue.removed'));
      }} />}
    <p role="status" className="text-sm empty:hidden">{message}</p>
    <CatalogueDescription isAdmin={catalogue.isAdmin} />
    <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">{t('catalogue.mixtureGuidance')}</p>
    <TextField id="mixture-search" label="Search seed mixtures" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
    {catalogue.isAdmin && <Button disabled={!catalogue.plants.length} onClick={() => setEditing({})}>Add seed mixture</Button>}
    <ul className="space-y-3">{matches.map((mixture) => <CatalogueEntryRow key={mixture.id} title={mixture.name} actions={<>
      <Button variant="secondary" aria-label={`${catalogue.isAdmin ? 'Edit' : 'View'} ${mixture.name}`} onClick={() => setEditing({ current: mixture })}>{catalogue.isAdmin ? 'Edit' : 'View'}</Button>
      {catalogue.isAdmin && <Button type="button" variant="danger" aria-label={t('catalogue.removeNamed', { name: mixture.name })} onClick={() => setRemoving(mixture)}>{t('catalogue.remove')}</Button>}
    </>} />)}</ul>
    {!matches.length && <p className="text-sm">No matching seed mixtures.</p>}
    <Button variant="secondary" onClick={() => setAttempt(attempt + 1)}>Refresh catalogue</Button>
  </div>;
}
function SeedMixtureForm({ catalogue, current, onCancel, onSave, readOnly = false }: { catalogue: Catalogue; current?: SeedMixture; onCancel: () => void; readOnly?: boolean; onSave: (details: SeedMixtureDetails) => Promise<() => Promise<void>> }) {
  const [name, setName] = useState(current?.name ?? ''), [notes, setNotes] = useState(current?.notes ?? '');
  const [components, setComponents] = useState<SeedMixtureComponent[]>(() => current ? structuredClone(current.components) : [{ plantTypeId: catalogue.plants[0]?.id ?? '', cultivarId: null, percentage: 100 }]);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  function update(index: number, values: Partial<SeedMixtureComponent>) { setComponents((items) => items.map((item, i) => i === index ? { ...item, ...values } : item)); }
  const [refresh, setRefresh] = useState<(() => Promise<void>)>();
  const [message, setMessage] = useState('');
  const [originalFields, setOriginalFields] = useState(() => JSON.stringify([name,notes,components]));
  const formRef = useFormLeave(!readOnly && JSON.stringify([name,notes,components]) !== originalFields, pending, submit, onCancel);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || readOnly || refresh) return;
    const details = { name, notes, components }, problem = validateSeedMixture(details);
    if (problem) { setError(problem); return; }
    setPending(true); setError('');
    try {
      const reload = await onSave(details);
      setRefresh(() => reload);
      setOriginalFields(JSON.stringify([name,notes,components]));
      try { await reload(); setRefresh(undefined); setMessage('Catalogue saved.'); return true; }
      catch { setError('Saved successfully, but refresh failed. Refresh before saving again.'); }
    } catch (failure) { setError(catalogueError(failure).message); } finally { setPending(false); }
  }
  return <form ref={formRef} className="space-y-4" onSubmit={submit}>
    <CatalogueBack onBack={onCancel} disabled={pending} />
    <h3 className="font-semibold">{readOnly ? 'Seed mixture' : current ? 'Edit seed mixture' : 'Add seed mixture'}</h3>
    <TextField id="mixture-name" label="Name" required maxLength={100} value={name} disabled={pending || readOnly || !!refresh} onChange={(event) => setName(event.target.value)} />
    <TextField id="mixture-notes" label="Notes (optional)" maxLength={2000} value={notes} disabled={pending || readOnly || !!refresh} onChange={(event) => setNotes(event.target.value)} />
    <fieldset className="space-y-3"><legend className="font-medium">Components · percentage by weight</legend>
      {components.map((component, index) => <div key={index} className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
        <SelectField id={`mixture-crop-${index}`} label="Crop" required value={component.plantTypeId} disabled={pending || readOnly || !!refresh} onChange={(event) => update(index, { plantTypeId: event.target.value, cultivarId: null })}>
          <option value="">Choose a crop</option>{catalogue.plants.map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
        </SelectField>
        <SelectField id={`mixture-cultivar-${index}`} label="Cultivar (optional)" value={component.cultivarId ?? ''} disabled={pending || readOnly || !!refresh} onChange={(event) => update(index, { cultivarId: event.target.value || null })}>
          <option value="">Any cultivar</option>{catalogue.cultivars?.filter((cultivar) => cultivar.plantTypeId === component.plantTypeId).map((cultivar) => <option key={cultivar.id} value={cultivar.id}>{cultivar.name}</option>)}
        </SelectField>
        <NumberField id={`mixture-percentage-${index}`} label="Percentage by weight" unit="%" min={0.000001} max={100} step="any" required value={component.percentage || ''} disabled={pending || readOnly || !!refresh} onChange={(event) => update(index, { percentage: Number(event.target.value) })} />
        <Button variant="secondary" disabled={pending || readOnly || !!refresh || components.length === 1} onClick={() => setComponents(components.filter((_, i) => i !== index))}>Remove component</Button>
      </div>)}
      <p role="status" className="text-sm">Total: {Number(components.reduce((sum, item) => sum + item.percentage, 0).toFixed(6))}% · must equal 100%</p>
      <Button variant="secondary" disabled={pending || readOnly || !!refresh || components.length >= 50} onClick={() => setComponents([...components, { plantTypeId: '', cultivarId: null, percentage: 0 }])}>Add component</Button>
    </fieldset>
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    <p role="status" className="text-sm empty:hidden">{message}</p>
    {refresh && <Button variant="secondary" disabled={pending} onClick={async () => { setPending(true); try { await refresh(); setRefresh(undefined); setError(''); setMessage('Catalogue saved.'); } catch { setError('Saved successfully, but refresh failed. Refresh before saving again.'); } finally { setPending(false); } }}>Refresh saved entry</Button>}
    {!readOnly && <Button type="submit" disabled={pending || !!refresh}>Save entry</Button>}
  </form>;
}
