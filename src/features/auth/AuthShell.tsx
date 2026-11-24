import { ThemeToggle } from '../appearance/ThemeToggle';
import type { CSSProperties, ReactNode } from 'react';
import { useVisualViewport } from '../../shared/hooks/useVisualViewport';
import { PageHeader } from '../../shared/ui/PageHeader';

type AuthShellProps = { title: string; children: ReactNode; actions?: ReactNode };

export function AuthShell({ title, children, actions }: AuthShellProps) {
  const viewport = useVisualViewport();
  const viewportStyle = { '--auth-height': `${viewport.heightPx}px`, '--auth-top': `${viewport.topPx}px` } as CSSProperties;

  return (
    <main style={viewportStyle} className="fixed top-[var(--auth-top)] left-0 flex h-[var(--auth-height)] w-full flex-col overflow-hidden bg-stone-50 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-sans text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <PageHeader title={title} subtitle="Myco" actions={<><ThemeToggle />{actions}</>} />
      <div className="flex min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="m-auto flex w-full items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <section className="w-full max-w-sm space-y-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 dark:border-stone-800 dark:bg-stone-900">
          {children}
        </section>
      </div>
      </div>
    </main>
  );
}
