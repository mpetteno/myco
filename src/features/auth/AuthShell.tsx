import type { CSSProperties, ReactNode } from 'react';
import { useVisualViewport } from '../../shared/hooks/useVisualViewport';

type AuthShellProps = { title: string; children: ReactNode };

export function AuthShell({ title, children }: AuthShellProps) {
  const viewport = useVisualViewport();
  const viewportStyle = { '--auth-height': `${viewport.heightPx}px`, '--auth-top': `${viewport.topPx}px` } as CSSProperties;

  return (
    <main style={viewportStyle} className="fixed top-[var(--auth-top)] left-0 h-[var(--auth-height)] w-full overflow-y-auto overscroll-contain bg-stone-50 font-sans text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <div className="flex min-h-full items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
        <section className="w-full max-w-sm space-y-6 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 dark:border-stone-800 dark:bg-stone-900">
          <header className="space-y-2">
            <p className="text-sm font-semibold tracking-widest text-green-800 uppercase dark:text-green-400">Myco</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
