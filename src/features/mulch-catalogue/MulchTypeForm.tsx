import { SelectField } from '../../shared/ui/SelectField';
import { useI18n } from '../../shared/i18n/I18nProvider';
import type { MulchCatalogue } from './mulchCatalogue';
import { materialAvailable } from './mulchCatalogue';
import { effectiveCultivar } from '../catalogue/catalogue';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { validateMulchDetails } from './mulchCatalogue';
import type { MulchDetails, MulchType } from './mulchCatalogue';
import { mulchCatalogueError } from './mulchCatalogueErrors';

type MulchTypeFormProps = { catalogue: MulchCatalogue; current?: MulchType; onSave: (details: MulchDetails) => Promise<void>; onCancel: () => void };

export function MulchTypeForm({ catalogue, current, onSave, onCancel }: MulchTypeFormProps) {
  const { t } = useI18n();
  const [categoryId, setCategoryId] = useState(current?.categoryId ?? '');
  const [plantKey, setPlantKey] = useState(current?.cultivarId ? `cultivar:${current.cultivarId}` : current?.plantTypeId ?? '');
  const living = catalogue.categories?.find((item) => item.id === categoryId)?.code === 'living';
  const [name, setName] = useState(current?.name ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const cultivar = plantKey.startsWith('cultivar:') ? catalogue.plants?.cultivars?.find((item) => item.id === plantKey.slice(9)) : undefined;
    const details = { name, notes, categoryId: categoryId || null, plantTypeId: living ? cultivar?.plantTypeId ?? (plantKey || null) : null, cultivarId: living ? cultivar?.id ?? null : null };
    const problem = validateMulchDetails(details);
    if (problem) { setError(problem); return; }
    busy.current = true; setPending(true); setError('');
    try { await onSave(details); }
    catch (problem) { setError(mulchCatalogueError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <h3 className="font-semibold">{current ? 'Edit mulch type' : 'Add mulch type'}</h3>
    <TextField id="mulch-type-name" label="Name" required maxLength={100} value={name} disabled={pending} onChange={(event) => setName(event.target.value)} />
    <SelectField id="mulch-category" label={t('catalogue.category')} value={categoryId} required={!current || !!current.categoryId} disabled={pending} onChange={(e) => { setCategoryId(e.target.value); setPlantKey(''); }}>
      <option value="">{t('catalogue.unclassified')}</option>
      {catalogue.categories?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </SelectField>
    {living && <SelectField id="mulch-living-plant" label={t('catalogue.livingPlant')} required value={plantKey} disabled={pending} onChange={(e) => setPlantKey(e.target.value)}>
      <option value="">{t('catalogue.choosePlant')}</option>
      {catalogue.plants?.plants.filter((crop) => crop.livingMulchEnabled).map((crop) => <option key={crop.id} value={crop.id}>{crop.name}</option>)}
      {catalogue.plants?.cultivars?.filter((cultivar) => { const crop = catalogue.plants!.plants.find((item) => item.id === cultivar.plantTypeId); return crop && effectiveCultivar(crop, cultivar).livingMulchEnabled; }).map((cultivar) => <option key={cultivar.id} value={`cultivar:${cultivar.id}`}>{catalogue.plants?.plants.find((crop) => crop.id === cultivar.plantTypeId)?.name} · {cultivar.name}</option>)}
      {current?.plantTypeId && catalogue.plants && !materialAvailable(current, catalogue.categories ?? [], catalogue.plants) && <option value={current.cultivarId ? `cultivar:${current.cultivarId}` : current.plantTypeId}>{t('catalogue.savedPlant')}</option>}
    </SelectField>}
    <TextField id="mulch-type-notes" label="Notes (optional)" maxLength={2000} value={notes} disabled={pending} onChange={(event) => setNotes(event.target.value)} />
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save mulch type'}</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Back to catalogue</Button>
  </form>;
}
