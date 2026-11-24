import type { ReactNode } from 'react';

type Props = { title: string; actions?: ReactNode; titleLevel?: 3 | 4 };

export function CatalogueEntryRow({ title, actions, titleLevel = 3 }: Props) {
  const Heading = titleLevel === 4 ? 'h4' : 'h3';
  return <li className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
    <Heading className="min-w-0 break-words font-medium">{title}</Heading>
    {actions && <div className="flex shrink-0 gap-2 [&>button]:w-auto">{actions}</div>}
  </li>;
}
