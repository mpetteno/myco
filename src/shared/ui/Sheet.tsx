import { useId, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useVisualViewport } from '../hooks/useVisualViewport';
import { BackButton } from './BackButton';
import { PageBackScope, usePageBackRegistry } from '../navigation/PageBackNavigation';

type SheetProps = { title: string; onClose: () => void; children: ReactNode; dismissible?: boolean };

export function Sheet({ title, onClose, children, dismissible = true }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const viewport = useVisualViewport();
  const { back, register } = usePageBackRegistry();
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    heading.current?.focus();
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
          <header data-dialog-header className="grid min-h-18 shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-3 border-b border-stone-200 px-4 py-2 dark:border-stone-800">
            <div className="col-start-1 row-start-1">{back && <BackButton {...back} />}</div>
            <h2 ref={heading} id={titleId} tabIndex={-1} className="col-start-2 row-start-1 min-w-0 text-center text-base leading-6 font-semibold break-words text-stone-900 focus:outline-none dark:text-stone-100">{title}</h2>
            <button type="button" aria-label="Close" title="Close" disabled={!dismissible} onClick={onClose}
              className="col-start-3 row-start-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-sm font-medium hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50 dark:hover:bg-stone-800">
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
            <PageBackScope register={register}>{children}</PageBackScope>
          </div>
        </section>
      </div>
    </dialog>
  );
}
