import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../shared/ui/Button';
import { NumberField } from '../../shared/ui/NumberField';
import { GRID_SIZE_CM, parseDimensionCm } from './garden';
import type { GardenDimensions } from './garden';

type GardenDimensionsFormProps = {
  onApply: (dimensions: GardenDimensions) => string | null;
  dimensions: GardenDimensions | null;
};

export function GardenDimensionsForm({ onApply, dimensions }: GardenDimensionsFormProps) {
  const [width, setWidth] = useState(dimensions ? String(dimensions.widthCm) : '');
  const [length, setLength] = useState(dimensions ? String(dimensions.lengthCm) : '');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const widthCm = parseDimensionCm(width);
    const lengthCm = parseDimensionCm(length);
    if (widthCm === null || lengthCm === null) {
      setError('Enter a valid width and length of at least 5 cm each.');
      setMessage('');
      return;
    }
    const wasSnapped = widthCm !== Number(width) || lengthCm !== Number(length);
    const problem = onApply({ widthCm, lengthCm });
    if (problem) {
      setError(problem);
      setMessage('');
      return;
    }
    setWidth(String(widthCm));
    setLength(String(lengthCm));
    setError('');
    setMessage(wasSnapped ? 'Dimensions rounded to the nearest 5 cm.' : 'Garden dimensions applied.');
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      <p id="dimension-help" className="text-sm text-stone-600 dark:text-stone-400">Dimensions snap to 5 cm.</p>
      <NumberField id="garden-width" label="Width" min={GRID_SIZE_CM} step={GRID_SIZE_CM} required
        value={width} onChange={(event) => setWidth(event.target.value)}
        aria-describedby="dimension-help dimension-error" aria-invalid={error ? true : undefined} />
      <NumberField id="garden-length" label="Length" min={GRID_SIZE_CM} step={GRID_SIZE_CM} required
        value={length} onChange={(event) => setLength(event.target.value)}
        aria-describedby="dimension-help dimension-error" aria-invalid={error ? true : undefined} />
      <p id="dimension-error" role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <Button type="submit">{dimensions ? 'Update garden' : 'Create garden'}</Button>
      <p role="status" className="text-sm text-stone-600 empty:hidden dark:text-stone-400">{message}</p>
    </form>
  );
}
