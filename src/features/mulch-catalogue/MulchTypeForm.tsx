import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { validateMulchDetails } from './mulchCatalogue';
import type { MulchDetails, MulchType } from './mulchCatalogue';
import { mulchCatalogueError } from './mulchCatalogueErrors';

type MulchTypeFormProps = { current?: MulchType; onSave: (details: MulchDetails) => Promise<void>; onCancel: () => void };

export function MulchTypeForm({ current, onSave, onCancel }: MulchTypeFormProps) {
  const [name, setName] = useState(current?.name ?? '');
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const details = { name, notes };
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
    <TextField id="mulch-type-notes" label="Notes (optional)" maxLength={2000} value={notes} disabled={pending} onChange={(event) => setNotes(event.target.value)} />
    <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
    <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save mulch type'}</Button>
    <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>Back to catalogue</Button>
  </form>;
}
