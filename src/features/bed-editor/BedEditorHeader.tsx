import { WorkspaceNav } from '../../shared/navigation/WorkspaceNavigation';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { useEffect, useRef } from 'react';
import type { Bed } from '../beds/bed';
import type { GardenSaveStatus } from '../gardens/GardenSaveQueue';
import { PlanSaveStatus } from './PlanSaveStatus';

type BedEditorHeaderProps = { gardenName?: string; bed: Bed; count: number; dirty: boolean; status: GardenSaveStatus;
  leaving: boolean; onBack: () => void; historyDraft?: boolean; canUndo: boolean; onUndo: () => void };

export function BedEditorHeader({ gardenName, bed, count, dirty, status, leaving, onBack,historyDraft, canUndo, onUndo }: BedEditorHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [bed.id]);
  return <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3 sm:px-4 dark:border-stone-800 dark:bg-stone-900">
    <button type="button" disabled={leaving} onClick={onBack} aria-label="Back to garden"
      className="min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-50">← Garden</button>
    <div className="min-w-0 flex-1 py-1">
      <h1 ref={heading} tabIndex={-1} title={bed.name} className="truncate font-semibold focus:outline-none">{bed.name}</h1>
      <p className="truncate text-xs text-stone-600 dark:text-stone-400">{gardenName && `${gardenName} · `}{bed.widthCm} × {bed.lengthCm} cm · {count} plants</p>
      <div>{historyDraft ? <span className="text-xs text-stone-600 dark:text-stone-400">History draft · not recorded yet</span> : <PlanSaveStatus status={status} dirty={dirty} compact />}</div>
    </div>
    <button type="button" disabled={!canUndo || leaving} onClick={onUndo} className="min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-green-600 disabled:opacity-40">Undo</button>
    <ThemeToggle /><WorkspaceNav />
  </header>;
}
