import { useI18n } from '../../shared/i18n/I18nProvider';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { NumberField } from '../../shared/ui/NumberField';
import { SpacingFields } from './SpacingFields';
import { DEFAULT_BORDER_DISTANCE_CM, parseSpacingCm, validateDetails, validatePlantDetails } from './catalogue';
import { catalogueError } from './catalogueErrors';
import type { FamilyDetails, PlantDetails, PlantFamily, PlantType } from './catalogue';

type PlantEntryFormProps = {
  kind: 'family' | 'plant'; families: PlantFamily[]; current?: PlantFamily | PlantType;
  onSave: (details: PlantDetails | FamilyDetails) => Promise<void>; onCancel: () => void;
};

export function PlantEntryForm({ kind, families, current, onSave, onCancel }: PlantEntryFormProps) {
  const { t } = useI18n();
  const [scientificName, setScientificName] = useState(current && 'familyId' in current ? current.scientificName ?? '' : '');
  const [livingMulchEnabled, setLivingMulchEnabled] = useState(current && 'familyId' in current ? current.livingMulchEnabled ?? false : false);
  const [name, setName] = useState(current?.name ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [familyId, setFamilyId] = useState(current && 'familyId' in current ? current.familyId : '');
  const [plant, setPlant] = useState(current?.plantSpacingCm?.toString() ?? '');
  const [row, setRow] = useState(current?.rowSpacingCm?.toString() ?? '');
  const [border, setBorder] = useState(String(current && 'borderDistanceCm' in current ? current.borderDistanceCm : DEFAULT_BORDER_DISTANCE_CM));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const details = { name, notes, plantSpacingCm: parseSpacingCm(plant), rowSpacingCm: parseSpacingCm(row) };
    const plantDetails = { ...details, familyId, borderDistanceCm: Number(border), scientificName, livingMulchEnabled };
    const problem = kind === 'plant' ? validatePlantDetails(plantDetails) : validateDetails(details);
    if (problem) { setError(problem); return; }
    busy.current = true; setPending(true); setError('');
    try { await onSave(kind === 'plant' ? plantDetails : details); }
    catch (problem) { setError(catalogueError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <h3 className="font-semibold">{current ? 'Edit' : 'Add'} {kind === 'plant' ? 'crop' : 'plant family'}</h3>
    <TextField id="catalogue-entry-name" label="Name" required maxLength={100} value={name} disabled={pending} onChange={(event) => setName(event.target.value)} />
    {kind === 'plant' && <SelectField id="catalogue-family" label="Family" required value={familyId} disabled={pending} onChange={(event) => setFamilyId(event.target.value)}>
      <option value="">Choose a family</option>
      {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
    </SelectField>}
    {kind === 'plant' && <>
      <TextField id="crop-scientific-name" label={t('catalogue.scientificName')} maxLength={200} value={scientificName} disabled={pending} onChange={(event) => setScientificName(event.target.value)} />
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={livingMulchEnabled} disabled={pending} onChange={(event) => setLivingMulchEnabled(event.target.checked)} />{t('catalogue.livingEligible')}</label>
    </>}
    <SpacingFields plant={plant} row={row} onPlant={setPlant} onRow={setRow} disabled={pending} inherits={kind === 'plant'} />
    {kind === 'plant' && <NumberField id="catalogue-border-distance" label="Minimum border distance" min={5} step={5} required
      value={border} disabled={pending} onChange={(event) => setBorder(event.target.value)} />}
    <TextField id="catalogue-entry-notes" label="Notes (optional)" maxLength={2000} value={notes} disabled={pending} onChange={(event) => setNotes(event.target.value)} />
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save entry'}</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Back to catalogue</Button>
  </form>;
}
