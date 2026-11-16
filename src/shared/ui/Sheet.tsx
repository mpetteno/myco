import { useId, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useVisualViewport } from '../hooks/useVisualViewport';
import { ThemeToggle } from '../../features/appearance/ThemeToggle';

type SheetProps = { title: string; onClose: () => void; children: ReactNode; dismissible?: boolean };

export function Sheet({ title, onClose, children, dismissible = true }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const viewport = useVisualViewport();
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  const viewportStyle = {
    '--sheet-height': `${viewport.heightPx}px`,
    '--sheet-top': `${viewport.topPx}px`,
  } as CSSProperties;

  return (
    <dialog ref={ref} aria-labelledby={titleId} style={viewportStyle}
      onCancel={(event) => { event.preventDefault(); if (dismissible) onClose(); }}
      className="fixed top-[var(--sheet-top)] left-0 m-0 h-[var(--sheet-height)] max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-stone-900 backdrop:bg-stone-950/50 dark:text-stone-100">
      <div className="flex h-full items-end justify-center sm:items-center sm:p-4"
        onClick={(event) => { if (dismissible && event.target === event.currentTarget) onClose(); }}>
        <section className="flex max-h-[95%] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-stone-200 bg-white shadow-xl sm:max-w-md sm:rounded-2xl dark:border-stone-800 dark:bg-stone-900">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 py-2 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] dark:border-stone-800">
            <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold">{title}</h2>
            <ThemeToggle />
            <button type="button" disabled={!dismissible} onClick={onClose}
              className="min-h-12 cursor-pointer rounded-lg px-3 text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:hover:bg-stone-800">
              Close
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
            {children}
          </div>
        </section>
      </div>
    </dialog>
  );
}
