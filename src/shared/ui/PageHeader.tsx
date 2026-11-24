import type { ReactNode, Ref } from 'react';
import { BackButton } from './BackButton';

type Props = { title: string; subtitle?: ReactNode; status?: ReactNode; actions?: ReactNode;
  back?: { label: string; onClick: () => void; disabled?: boolean }; headingRef?: Ref<HTMLHeadingElement>;
  headingId?: string; headingAs?: 'h1' | 'h2'; tone?: 'default' | 'draft'; inert?: boolean };

export function PageHeader({ title, subtitle, status, actions, back, headingRef, headingId, headingAs: Heading = 'h1', tone = 'default', inert }: Props) {
  return <header data-page-header inert={inert} className={`flex h-18 shrink-0 items-center gap-2 px-2 text-left sm:px-4 ${tone === 'draft' ? 'border-b border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950' : 'border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900'}`}>
    {back ? <BackButton {...back} /> : <div aria-hidden="true" className="h-11 w-11 shrink-0" />}
    <div className="min-w-0 flex-1">
      <Heading ref={headingRef} id={headingId} tabIndex={-1} title={title} className="truncate text-base leading-6 font-semibold focus:outline-none">{title}</Heading>
      <div className="flex h-4 min-w-0 items-center gap-2 text-xs leading-4 text-stone-600 dark:text-stone-400">
        {subtitle && <div className={`min-w-0 truncate ${status ? 'hidden sm:block' : ''}`}>{subtitle}</div>}
        {status && <div className="max-w-full shrink-0 truncate">{status}</div>}
      </div>
    </div>
    {actions && <div className="flex shrink-0 items-center gap-1 sm:gap-2">{actions}</div>}
  </header>;
}
