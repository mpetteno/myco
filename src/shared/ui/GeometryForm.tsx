import { useEffect, useState } from 'react';
import { NumberField } from './NumberField';
import { Button } from './Button';

type Geometry = { xCm: number; yCm: number; widthCm: number; lengthCm: number };
type Props = { id: string; value: Geometry; container: 'garden' | 'bed'; size?: boolean;
  onSave: (next: Geometry) => string | null };

export function GeometryForm({ id, value, container, size = false, onSave }: Props) {
  const [fields, setFields] = useState(() => Object.fromEntries(Object.entries(value).map(([key, n]) => [key, String(n)])));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setFields({ xCm: String(value.xCm), yCm: String(value.yCm), widthCm: String(value.widthCm), lengthCm: String(value.lengthCm) });
  }, [value.xCm, value.yCm, value.widthCm, value.lengthCm]);
  const keys = size ? ['xCm', 'yCm', 'widthCm', 'lengthCm'] as const : ['xCm', 'yCm'] as const;
  const labels = { xCm: 'From left edge', yCm: 'From top edge', widthCm: 'Width', lengthCm: 'Length' };
  return <details className="space-y-3 border-t border-stone-200 pt-3 dark:border-stone-700">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">{size ? 'Position & size' : 'Position in garden'}</summary>
    <form noValidate className="space-y-3" onSubmit={(event) => {
      event.preventDefault(); setError(''); setMessage('');
      const next = { ...value };
      for (const key of keys) {
        const n = Number(fields[key]);
        if (!fields[key]?.trim() || !Number.isSafeInteger(n) || n % 5 !== 0 || n < (key === 'widthCm' || key === 'lengthCm' ? 5 : 0)) {
          setError('Use multiples of 5 cm. Positions start at 0; dimensions must be at least 5 cm.'); return;
        }
        next[key] = n;
      }
      const problem = onSave(next);
      if (problem) setError(problem); else setMessage('Position updated.');
    }}>
      <p className="text-sm text-stone-600 dark:text-stone-400">Measured from the {container}’s original top-left corner, even when the drawing turns to fit the screen.</p>
      <div className="grid grid-cols-2 gap-3">{keys.map((key) => <NumberField key={key} id={`${id}-${key}`} label={labels[key]} min={key === 'widthCm' || key === 'lengthCm' ? 5 : 0} step={5}
        value={fields[key] ?? ''} aria-describedby={`${id}-error`} onChange={(event) => { setFields({ ...fields, [key]: event.target.value }); setMessage(''); setError(''); }} />)}</div>
      <p id={`${id}-error`} role="alert" className="text-sm text-red-700 empty:hidden dark:text-red-400">{error}</p>
      <Button variant="secondary" type="submit">{size ? 'Update area bounds' : 'Update position'}</Button>
      <p role="status" className="text-sm empty:hidden">{message}</p>
    </form>
  </details>;
}
