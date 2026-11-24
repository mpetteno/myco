import type { ComponentProps } from 'react';
import { useScopedId } from './FieldScope';

export function TextAreaField({ id, label, ...props }: ComponentProps<'textarea'> & { id: string; label: string }) {
  const scopedId = useScopedId(id);
  return <label htmlFor={scopedId} className="block space-y-2 text-sm font-medium">
    <span>{label}</span>
    <textarea {...props} id={scopedId} className="min-h-24 w-full min-w-0 resize-y rounded-lg border border-stone-300 bg-white px-3 py-2 text-base outline-none focus-visible:border-green-600 focus-visible:ring-2 focus-visible:ring-green-600/30 dark:border-stone-700 dark:bg-stone-950" />
  </label>;
}
