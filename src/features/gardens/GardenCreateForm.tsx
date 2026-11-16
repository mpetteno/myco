import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { TextField } from '../../shared/ui/TextField';
import { NumberField } from '../../shared/ui/NumberField';
import { parseDimensionCm } from '../garden/garden';
import type { GardenDocument } from './gardenDocument';
import { gardenStorageError } from './gardenErrors';

export function GardenCreateForm({ onCreate }: { onCreate: (document: GardenDocument) => Promise<void> }) {
  const [name, setName] = useState('');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const widthCm = parseDimensionCm(width), lengthCm = parseDimensionCm(length);
    if (!name.trim() || !widthCm || !lengthCm) { setError('Enter a name and dimensions of at least 5 cm.'); return; }
    busy.current = true; setPending(true); setError('');
    try { await onCreate({ name: name.trim(), dimensions: { widthCm, lengthCm }, beds: [] }); }
    catch (problem) { setError(gardenStorageError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField id="new-garden-name" label="Garden name" maxLength={100} required disabled={pending}
        value={name} onChange={(event) => setName(event.target.value)} />
      <NumberField id="new-garden-width" label="Width" min={5} step={5} required disabled={pending}
        value={width} onChange={(event) => setWidth(event.target.value)} />
      <NumberField id="new-garden-length" label="Length" min={5} step={5} required disabled={pending}
        value={length} onChange={(event) => setLength(event.target.value)} />
      <p className="text-xs text-stone-600 dark:text-stone-400">Dimensions snap to the nearest 5 cm. The garden starts without beds.</p>
      <p role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create garden'}</Button>
    </form>
  );
}
