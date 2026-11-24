import { CatalogueBack } from './CatalogueBack';
import { useFormLeave } from '../../shared/navigation/WorkspaceNavigation';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { targetKey } from './catalogue';
import { catalogueError } from './catalogueErrors';
import type { CompanionRule, CompanionTarget, PlantFamily, PlantType, PlantCultivar, RuleDetails } from './catalogue';

type CompanionRuleFormProps = { families: PlantFamily[]; plants: PlantType[]; cultivars?: PlantCultivar[]; fixedTarget?: CompanionTarget; current?: CompanionRule;
  onSave: (details: RuleDetails) => Promise<void>; cancelLabel?: string; onCancel: () => void; readOnly?: boolean };

export function CompanionRuleForm({ families, plants, cultivars = [], fixedTarget, current, onSave, onCancel, cancelLabel, readOnly = false }: CompanionRuleFormProps) {
  const [first, setFirst] = useState(current ? targetKey(current.first) : fixedTarget ? targetKey(fixedTarget) : '');
  const [second, setSecond] = useState(current ? targetKey(current.second) : '');
  const [relationship, setRelationship] = useState<CompanionRule['relationship']>(current?.relationship ?? 'companion');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const busy = useRef(false);
  const targets: { value: CompanionTarget; label: string }[] = [
    ...cultivars.map((item) => ({ value: { kind: 'cultivar' as const, id: item.id }, label: `${plants.find((crop) => crop.id === item.plantTypeId)?.name ?? ''} · ${item.name}` })),
    ...families.map((family) => ({ value: { kind: 'family' as const, id: family.id }, label: family.name })),
    ...plants.map((plant) => ({ value: { kind: 'plant' as const, id: plant.id }, label: `${plant.name} (${families.find((family) => family.id === plant.familyId)?.name ?? 'Family'})` })),
  ];
  const options = <><option value="">Choose a crop, cultivar or family</option>
    <optgroup label="Families">{targets.filter((item) => item.value.kind === 'family').map((item) => <option key={targetKey(item.value)} value={targetKey(item.value)}>{item.label}</option>)}</optgroup>
    <optgroup label="Plant types">{targets.filter((item) => item.value.kind === 'plant').map((item) => <option key={targetKey(item.value)} value={targetKey(item.value)}>{item.label}</option>)}</optgroup><optgroup label="Cultivars">{targets.filter((item) => item.value.kind === 'cultivar').map((item) => <option key={targetKey(item.value)} value={targetKey(item.value)}>{item.label}</option>)}</optgroup></>;
  const [originalFields, setOriginalFields] = useState(() => JSON.stringify([first,second,relationship,notes]));
  const formRef = useFormLeave(!readOnly && JSON.stringify([first,second,relationship,notes]) !== originalFields, pending, submit, onCancel);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || readOnly) return;
    const a = targets.find((item) => targetKey(item.value) === first)?.value;
    const b = targets.find((item) => targetKey(item.value) === second)?.value;
    if (!a || !b) { setError('Choose both crops, cultivars or families.'); return; }
    busy.current = true; setPending(true); setError('');
    try { await onSave({ first: a, second: b, relationship, notes }); setOriginalFields(JSON.stringify([first,second,relationship,notes])); setMessage('Catalogue saved.'); return true; }
    catch (problem) { setError(catalogueError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  return <form ref={formRef} onSubmit={submit} className="space-y-4">
    <CatalogueBack onBack={onCancel} disabled={pending} label={cancelLabel} />
    <h3 className="font-semibold">{current?.id ? 'Edit' : 'Add'} companion rule</h3>
    <SelectField id="companion-first" label="Crop, cultivar or family" value={first} required disabled={pending || readOnly || !!fixedTarget} onChange={(event) => setFirst(event.target.value)}>{options}</SelectField>
    <SelectField id="companion-second" label="Companion crop, cultivar or family" value={second} required disabled={pending || readOnly} onChange={(event) => setSecond(event.target.value)}>{options}</SelectField>
    <SelectField id="companion-relationship" label="Guidance" value={relationship} disabled={pending || readOnly} onChange={(event) => setRelationship(event.target.value as CompanionRule['relationship'])}>
      <option value="companion">Companion suggestion</option><option value="caution">Caution / warning</option>
    </SelectField>
    <TextField id="companion-notes" label="Reason or notes (optional)" maxLength={2000} value={notes} disabled={pending || readOnly} onChange={(event) => setNotes(event.target.value)} />
    <p className="text-xs text-stone-600 dark:text-stone-400">Applies in both directions. Cultivar rules take priority over crop rules, and crop rules over family rules. Guidance can be overridden while planning.</p>
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    <p role="status" className="text-sm empty:hidden">{message}</p>
    {!readOnly && <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save rule'}</Button>}
  </form>;
}
