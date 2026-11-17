import type { ComponentProps } from 'react';

type NumberFieldProps = ComponentProps<'input'> & {
  id: string;
  label: string;
  unit?: string;
};

export function NumberField({ id, label, unit = 'cm', ...props }: NumberFieldProps) {
  return (
    <label htmlFor={id} className="block space-y-2 text-sm font-medium">
      <span>{label} <span className="font-normal text-stone-500 dark:text-stone-400">{unit && `(${unit})`}</span></span>
      <input
        {...props}
        id={id}
        type="number"
        inputMode="decimal"
        className="min-h-12 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus-visible:border-green-600 focus-visible:ring-2 focus-visible:ring-green-600/30 aria-invalid:border-red-500 dark:border-stone-700 dark:bg-stone-950"
      />
    </label>
  );
}
