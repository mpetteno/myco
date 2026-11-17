import { areaLabel } from './areaPlan';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { Button } from '../../shared/ui/Button';
import type { Bed } from '../beds/bed';
import type { useBedEditor } from '../bed-editor/useBedEditor';
import { AreaPlanCanvas } from './AreaPlanCanvas';
import { AreaFields } from './AreaFields';
import type { AreaFocus } from './areaViewport';
import type { GardenSaveStatus } from '../gardens/GardenSaveQueue';
import { PlanSaveStatus } from '../bed-editor/PlanSaveStatus';

export function AreaEditorPage({ bed, editor, focus, onBack, feedback,status,historyDraft }: { bed: Bed; editor: ReturnType<typeof useBedEditor>;
  focus: AreaFocus; onBack: () => void; feedback: ReactNode; status:GardenSaveStatus; historyDraft?: boolean }) {
  const [controls, setControls] = useState(true), [zoom,setZoom] = useState(0.8), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [focus.id]);
  const { draft } = editor;
  const area = draft.plan.areas.find((item) => item.id === focus.id);
  if (!area) return null;
  return <EditorScreen feedback={feedback} header={<header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-stone-200 bg-white px-3 dark:border-stone-800 dark:bg-stone-900">
    <button type="button" onClick={onBack} className="min-h-11 shrink-0 cursor-pointer px-2 text-sm">← Back to bed</button>
    <div className="min-w-0 flex-1 py-1">
      <h1 ref={heading} tabIndex={-1} className="truncate font-semibold focus:outline-none">{areaLabel(area)}</h1>
      {historyDraft ? <span className="text-xs text-stone-600 dark:text-stone-400">History draft · not recorded yet</span> : <PlanSaveStatus status={status} dirty={editor.dirty} />}
    </div>
    <ThemeToggle />
  </header>} toolbar={<footer className="shrink-0 border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-stone-800 dark:bg-stone-900">
    <div className="flex gap-2">
      <div className="min-w-0 flex-1"><Button variant="secondary" aria-label="Zoom out" onClick={() => setZoom((value)=>Math.max(0.2,value/1.25))}>−</Button></div>
      <div className="min-w-0 flex-1"><Button variant="secondary" onClick={() => setZoom(0.8)}>Fit area</Button></div>
      <div className="min-w-0 flex-1"><Button variant="secondary" aria-label="Zoom in" onClick={() => setZoom((value)=>Math.min(3,value*1.25))}>+</Button></div>
      <div className="min-w-0 flex-1 lg:hidden"><Button variant="secondary" aria-expanded={controls} onClick={() => setControls(!controls)}>{controls ? 'Hide settings' : 'Show settings'}</Button></div>
    </div>
  </footer>}>
    {(draft.error || editor.validation) && <p role="alert" className="shrink-0 p-3 text-sm text-red-700 dark:text-red-400">{draft.error || editor.validation}</p>}
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-h-0 min-w-0 flex-1"><AreaPlanCanvas bed={bed} plan={draft.plan} selectedId={draft.selectedId} focus={focus} focusZoom={zoom}
        onSelect={draft.setSelectedId} onBounds={draft.bounds} /></div>
      <aside aria-label="Area editor controls" className={`${controls ? 'block' : 'hidden'} max-h-[45%] min-h-0 shrink-0 space-y-4 overflow-y-auto border-t border-stone-200 bg-white p-4 lg:block lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l dark:border-stone-800 dark:bg-stone-900`}>
        <h2 className="font-semibold">Area settings</h2>
        <AreaFields bed={bed} editor={editor} />
      </aside>
    </div>
  </EditorScreen>;
}
