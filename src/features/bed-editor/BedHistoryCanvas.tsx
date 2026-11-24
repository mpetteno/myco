import { AreaPlanCanvas } from '../area-editor/AreaPlanCanvas';
import { useEffect, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import type { Bed } from '../beds/bed';
import type { useGardenHistory } from '../history/useGardenHistory';
import { BedPlanCanvas } from '../planting/BedPlanCanvas';
import type { AreaFocus } from '../area-editor/areaViewport';

export function BedHistoryCanvas({ bed, history }: { bed: Bed; history: ReturnType<typeof useGardenHistory> }) {
  const [mulch,setMulch] = useState(false),[areaId,setAreaId] = useState<string|null>(null),[focus,setFocus] = useState<AreaFocus|undefined>();
  const shown = history.current ? history.getCurrent().beds.find((item) => item.id === bed.id) : history.selected?.document.beds.find((item) => item.id === bed.id);
  useEffect(() => { setAreaId(null); setFocus(undefined); }, [history.selected?.id,history.current,mulch]);
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="min-h-0 flex-1">
        {shown && !history.loading && !history.error ? shown.areaPlan ? <AreaPlanCanvas bed={shown} plan={shown.areaPlan} selectedId={areaId} onSelect={setAreaId} onBounds={() => {}} readOnly focus={focus} /> : <BedPlanCanvas key={`${history.selected?.id ?? 'current'}:${mulch}`} bed={shown}
          plan={shown.plantingPlan ?? { version:5,respectAreaSpacing:true,areas:[],advice:[] }} selectedId={mulch ? null : areaId}
          onSelect={setAreaId} onBounds={() => {}} editingMulch={mulch} readOnly focus={focus}
          mulch={{ plan:shown.mulchPlan ?? { version:1,areas:[] },selectedId:mulch ? areaId : null,preview:null,onSelect:setAreaId,onBounds:() => {} }} />
          : <p className="p-6 text-center text-sm">{history.loading ? 'Loading bed history…' : history.error || (history.selected ? 'This bed is not present in this recorded layout.' : 'No completed record for this date.')}</p>}
    </div>
    <div className="grid shrink-0 grid-cols-3 gap-2 border-t border-stone-200 p-2 dark:border-stone-700">
      <Button variant="secondary" disabled={history.saving} aria-pressed={!!shown?.areaPlan || !mulch} onClick={() => setMulch(false)}>{shown?.areaPlan ? 'Areas' : 'Planting'}</Button>
      {!shown?.areaPlan && <Button variant="secondary" disabled={history.saving} aria-pressed={mulch} onClick={() => setMulch(true)}>Mulch</Button>}
      <Button variant="secondary" disabled={!areaId || history.saving} onClick={() => setFocus(focus ? undefined : { kind: !shown?.areaPlan && mulch ? 'mulch' : 'planting', id: areaId! })}>{focus ? 'Whole bed' : 'Focus area'}</Button>
    </div>
  </div>;
}
