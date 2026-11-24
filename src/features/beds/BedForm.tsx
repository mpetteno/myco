import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { NumberField } from '../../shared/ui/NumberField';
import { TextField } from '../../shared/ui/TextField';
import { GRID_SIZE_CM, parseDimensionCm } from '../garden/garden';
import type { Bed, BedDetails } from './bed';

type BedFormProps = {
  bed?: Bed;
  onSave: (details: BedDetails, wasSnapped: boolean) => string | null;
  showHeading?: boolean;
};

export function BedForm({ bed, onSave, showHeading = true }: BedFormProps) {
  const [name, setName] = useState(bed?.name ?? '');
  const [width, setWidth] = useState(bed ? String(bed.widthCm) : '');
  const [length, setLength] = useState(bed ? String(bed.lengthCm) : '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bed) return;
    setWidth(String(bed.widthCm));
    setLength(String(bed.lengthCm));
    setError('');
  }, [bed?.widthCm, bed?.lengthCm]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const widthCm = parseDimensionCm(width);
    const lengthCm = parseDimensionCm(length);
    if (!name.trim() || widthCm === null || lengthCm === null) {
      setError('Enter a name and dimensions of at least 5 cm each.');
      return;
    }
    const problem = onSave({ name: name.trim(), widthCm, lengthCm },
      widthCm !== Number(width) || lengthCm !== Number(length));
    setError(problem ?? '');
    if (problem) return;
    setName(bed ? name.trim() : '');
    setWidth(bed ? String(widthCm) : '');
    setLength(bed ? String(lengthCm) : '');
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        {showHeading && <h3 className="font-semibold">{bed ? 'Edit bed' : 'Add a bed'}</h3>}
        <p id="bed-help" className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {bed ? 'Position stays fixed. ' : ''}Dimensions snap to 5 cm.
        </p>
      </div>
      <TextField id="bed-name" label="Name" required value={name}
        onChange={(event) => setName(event.target.value)} aria-describedby="bed-error" />
      <NumberField id="bed-width" label="Width" min={GRID_SIZE_CM} step={GRID_SIZE_CM} required
        value={width} onChange={(event) => setWidth(event.target.value)} aria-describedby="bed-help bed-error" />
      <NumberField id="bed-length" label="Length" min={GRID_SIZE_CM} step={GRID_SIZE_CM} required
        value={length} onChange={(event) => setLength(event.target.value)} aria-describedby="bed-help bed-error" />
      <p id="bed-error" role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <Button type="submit">{bed ? 'Save bed' : 'Add bed'}</Button>
    </form>
  );
}
