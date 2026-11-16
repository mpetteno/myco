import type { ComponentProps } from 'react';

type SelectFieldProps = ComponentProps<'select'> & { id: string; label: string };

export function SelectField({ id, label, children, ...props }: SelectFieldProps) {
  return <label htmlFor={id} className="block space-y-2 text-sm font-medium">
    <span>{label}</span>
    <select {...props} id={id}
      className="min-h-12 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus-visible:border-green-600 focus-visible:ring-2 focus-visible:ring-green-600/30 dark:border-stone-700 dark:bg-stone-950">
      {children}
    </select>
  </label>;
}
