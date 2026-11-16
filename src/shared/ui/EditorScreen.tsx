import type { ReactNode } from 'react';
import { useVisualViewport } from '../hooks/useVisualViewport';

type EditorScreenProps = { header: ReactNode; feedback?: ReactNode; children: ReactNode; toolbar: ReactNode };

export function EditorScreen({ header, feedback, children, toolbar }: EditorScreenProps) {
  const viewport = useVisualViewport();
  return <main style={{ height: `var(--editor-height, ${viewport.heightPx}px)` }}
    className="flex min-h-0 flex-col overflow-hidden bg-stone-50 pt-[var(--editor-safe-top,env(safe-area-inset-top))] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] font-sans text-stone-900 dark:bg-stone-950 dark:text-stone-100">
    {header}
    {feedback}
    <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    {toolbar}
  </main>;
}
