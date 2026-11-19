import { WorkspaceNav } from '../../shared/navigation/WorkspaceNavigation';
import { AreaPlanCanvas } from '../area-editor/AreaPlanCanvas';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { useEffect, useState } from 'react';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { Button } from '../../shared/ui/Button';
import type { Bed } from '../beds/bed';
import type { useGardenHistory } from '../history/useGardenHistory';
import { GardenHistoryBar } from '../history/GardenHistoryBar';
import { GardenHistoryInspector } from '../history/GardenHistoryInspector';
import { BedPlanCanvas } from '../planting/BedPlanCanvas';
import type { AreaFocus } from '../area-editor/areaViewport';

export function BedHistoryPage({ bed, history, onBack, onReload }: { bed: Bed; history: ReturnType<typeof useGardenHistory>;
  onBack: () => void; onReload: () => Promise<void> }) {
  const [mulch,setMulch] = useState(false),[areaId,setAreaId] = useState<string|null>(null),[focus,setFocus] = useState<AreaFocus|undefined>();
  const shown = history.current ? history.getCurrent().beds.find((item) => item.id === bed.id) : history.selected?.document.beds.find((item) => item.id === bed.id);
  useEffect(() => { setAreaId(null); setFocus(undefined); }, [history.selected?.id,history.current,mulch]);
  return <EditorScreen header={<header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-3 dark:border-stone-800 dark:bg-stone-900">
    <button type="button" disabled={history.saving} onClick={onBack} className="min-h-11 cursor-pointer px-2 text-sm">← Back to bed</button>
    <h1 className="min-w-0 flex-1 truncate font-semibold">{shown?.name ?? bed.name} · History</h1>
    <ThemeToggle /><WorkspaceNav />
  </header>} toolbar={<footer className="grid shrink-0 grid-cols-3 gap-2 border-t border-stone-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-stone-800 dark:bg-stone-900">
    <Button variant="secondary" disabled={history.saving} aria-pressed={!!shown?.areaPlan || !mulch} onClick={() => setMulch(false)}>{shown?.areaPlan ? 'Areas' : 'Planting'}</Button>
    {!shown?.areaPlan && <Button variant="secondary" disabled={history.saving} aria-pressed={mulch} onClick={() => setMulch(true)}>Mulch</Button>}
    <Button variant="secondary" disabled={!areaId || history.saving} onClick={() => setFocus(focus ? undefined : { kind:!shown?.areaPlan && mulch ? 'mulch' : 'planting',id:areaId! })}>{focus ? 'Whole bed' : 'Focus area'}</Button>
  </footer>}>
    <GardenHistoryBar history={history} bedView />
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-h-0 min-w-0 flex-1">
        {shown && !history.loading && !history.error ? shown.areaPlan ? <AreaPlanCanvas bed={shown} plan={shown.areaPlan} selectedId={areaId} onSelect={setAreaId} onBounds={() => {}} readOnly focus={focus} /> : <BedPlanCanvas key={`${history.selected?.id ?? 'current'}:${mulch}`} bed={shown}
          plan={shown.plantingPlan ?? { version:5,respectAreaSpacing:true,areas:[],advice:[] }} selectedId={mulch ? null : areaId}
          onSelect={setAreaId} onBounds={() => {}} editingMulch={mulch} readOnly focus={focus}
          mulch={{ plan:shown.mulchPlan ?? { version:1,areas:[] },selectedId:mulch ? areaId : null,preview:null,onSelect:setAreaId,onBounds:() => {} }} />
          : <p className="p-6 text-center text-sm">{history.loading ? 'Loading bed history…' : history.error || (history.selected ? 'This bed is not present in this recorded layout.' : 'No completed record for this date.')}</p>}
      </div>
      <GardenHistoryInspector history={history} onReload={onReload} />
    </div>
  </EditorScreen>;
}
