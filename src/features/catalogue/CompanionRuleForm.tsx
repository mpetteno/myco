import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { targetKey } from './catalogue';
import { catalogueError } from './catalogueErrors';
import type { CompanionRule, CompanionTarget, PlantFamily, PlantType, RuleDetails } from './catalogue';

type CompanionRuleFormProps = { families: PlantFamily[]; plants: PlantType[]; current?: CompanionRule;
  onSave: (details: RuleDetails) => Promise<void>; onCancel: () => void };

export function CompanionRuleForm({ families, plants, current, onSave, onCancel }: CompanionRuleFormProps) {
  const [first, setFirst] = useState(current ? targetKey(current.first) : '');
  const [second, setSecond] = useState(current ? targetKey(current.second) : '');
  const [relationship, setRelationship] = useState<CompanionRule['relationship']>(current?.relationship ?? 'companion');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const targets: { value: CompanionTarget; label: string }[] = [
    ...families.map((family) => ({ value: { kind: 'family' as const, id: family.id }, label: family.name })),
    ...plants.map((plant) => ({ value: { kind: 'plant' as const, id: plant.id }, label: `${plant.name} (${families.find((family) => family.id === plant.familyId)?.name ?? 'Family'})` })),
  ];
  const options = <><option value="">Choose a family or plant type</option>
    <optgroup label="Families">{targets.filter((item) => item.value.kind === 'family').map((item) => <option key={targetKey(item.value)} value={targetKey(item.value)}>{item.label}</option>)}</optgroup>
    <optgroup label="Plant types">{targets.filter((item) => item.value.kind === 'plant').map((item) => <option key={targetKey(item.value)} value={targetKey(item.value)}>{item.label}</option>)}</optgroup></>;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const a = targets.find((item) => targetKey(item.value) === first)?.value;
    const b = targets.find((item) => targetKey(item.value) === second)?.value;
    if (!a || !b) { setError('Choose both families or plant types.'); return; }
    busy.current = true; setPending(true); setError('');
    try { await onSave({ first: a, second: b, relationship, notes }); }
    catch (problem) { setError(catalogueError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  return <form onSubmit={submit} className="space-y-4">
    <h3 className="font-semibold">{current ? 'Edit' : 'Add'} companion rule</h3>
    <SelectField id="companion-first" label="First family or plant type" value={first} required disabled={pending} onChange={(event) => setFirst(event.target.value)}>{options}</SelectField>
    <SelectField id="companion-second" label="Second family or plant type" value={second} required disabled={pending} onChange={(event) => setSecond(event.target.value)}>{options}</SelectField>
    <SelectField id="companion-relationship" label="Guidance" value={relationship} disabled={pending} onChange={(event) => setRelationship(event.target.value as CompanionRule['relationship'])}>
      <option value="companion">Companion suggestion</option><option value="caution">Caution / warning</option>
    </SelectField>
    <TextField id="companion-notes" label="Reason or notes (optional)" maxLength={2000} value={notes} disabled={pending} onChange={(event) => setNotes(event.target.value)} />
    <p className="text-xs text-stone-600 dark:text-stone-400">Applies in both directions. Specific plant rules take priority over family rules. Guidance can be overridden while planning.</p>
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save rule'}</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Back to catalogue</Button>
  </form>;
}
