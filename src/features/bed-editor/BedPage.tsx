import { HistoryEditPage } from '../history/HistoryEditPage';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import type { Bed, BedDetails, BedPlans } from '../beds/bed';
import { MAX_PLANTING_AREAS, plantingAreasFit } from '../planting/plantingPlan';
import { BedPlanCanvas } from '../planting/BedPlanCanvas';
import type { GardenSaveStatus } from '../gardens/GardenSaveQueue';
import { useBedEditor } from './useBedEditor';
import { BedEditorHeader } from './BedEditorHeader';
import { BedEditorToolbar } from './BedEditorToolbar';
import type { BedEditorTool } from './BedEditorToolbar';
import { BedEditorInspector } from './BedEditorInspector';
import { BedLeavePrompt } from './BedLeavePrompt';
import { mulchAreasFit } from '../mulch/mulchPlan';
import { AreaEditorPage } from '../area-editor/AreaEditorPage';
import type { AreaFocus } from '../area-editor/areaViewport';
import { useGardenHistory } from '../history/useGardenHistory';
import type { SavedGarden } from '../gardens/gardenDocument';
import { BedHistoryPage } from './BedHistoryPage';

type BedPageProps = { bed: Bed; userId: string; status: GardenSaveStatus; feedback: ReactNode;
  onSaveDetails: (details: BedDetails) => string | null; onSavePlan: (plans: BedPlans) => string | null;
  beforeLeaving: () => Promise<string | null>; onBack: () => void; onDelete: () => void;
  onCopy: () => void; copyMessage: string; gardenId: string; getCurrent: () => SavedGarden; onReload: () => Promise<void>;
  user?: import('@supabase/supabase-js').User; historyDraft?: boolean; onValidityChange?: (valid: boolean) => void };

export function BedPage({ bed, userId, status, feedback, onSaveDetails, onSavePlan, beforeLeaving, onBack, onDelete, onCopy, copyMessage, gardenId,getCurrent,onReload,historyDraft=false,onValidityChange,user }: BedPageProps) {
  const editor = useBedEditor({ bed, userId, onSavePlan, beforeLeaving, onBack, preserveFormat: historyDraft });
  const { draft, preview, mulch } = editor;
  useEffect(() => { onValidityChange?.(!editor.dirty); }, [editor.dirty, onValidityChange]);
  useEffect(() => () => onValidityChange?.(true), [onValidityChange]);
  const [tool, setTool] = useState<BedEditorTool>(draft.selected ? 'area' : 'recap');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [focus, setFocus] = useState<AreaFocus | null>(null);
  const history = useGardenHistory(gardenId,beforeLeaving,getCurrent,bed.id);
  const [historyIntent,setHistoryIntent] = useState(false);
  const editingMulch = tool === 'mulch' || tool === 'mulch-catalogue';
  function openTool(next: BedEditorTool) {
    setControlsOpen((open) => tool !== next || !open); setTool(next);
  }
  function saveDetails(details: BedDetails) {
    if (!plantingAreasFit(draft.plan, details)) return 'This size would crop a draft planting area. Resize or remove the area first.';
    if (!mulchAreasFit(mulch.plan, details)) return 'This size would crop a draft mulch area. Resize or remove the area first.';
    return onSaveDetails(details);
  }
  if (history.editingHistory && user) return <HistoryEditPage key={`${history.editingHistory.event?.id ?? 'new'}:${history.editingHistory.event?.eventVersion ?? 0}`} onReload={history.reloadHistoryEdit} draft={history.editingHistory} current={getCurrent()} user={user} onBack={history.closeHistoryEdit} onSaved={history.historyEdited} />;
  if (history.open) return <BedHistoryPage bed={bed} history={history} onBack={history.close} onReload={onReload} />;
  if (focus) return <AreaEditorPage bed={bed} editor={editor} focus={focus} onBack={() => setFocus(null)} feedback={feedback} status={status} historyDraft={historyDraft} />;
  return <EditorScreen
    header={<BedEditorHeader bed={bed} count={preview.points.length} dirty={editor.dirty} status={status} leaving={editor.leaving} historyDraft={historyDraft} onBack={editor.back} />}
    feedback={feedback}
    toolbar={<BedEditorToolbar tool={tool} disabled={editor.leaving}
      canAdd={!!draft.catalogue?.plants.length && !draft.loading && draft.plan.areas.length < MAX_PLANTING_AREAS}
      onHistory={historyDraft ? undefined : () => { if (editor.dirty) setHistoryIntent(true); else void history.show(); }}
      onTool={openTool} onAdd={() => { draft.addArea(); setTool('area'); setControlsOpen(true); }} />}>
    {historyIntent && <BedLeavePrompt destination="history"
      onDiscard={() => { editor.discardDraft(); setHistoryIntent(false); void history.show(); }} onCancel={() => setHistoryIntent(false)} />}
    {editor.confirmLeave && <BedLeavePrompt destination="garden" onDiscard={editor.discardAndBack} onCancel={() => editor.setConfirmLeave(false)} />}
    {(draft.error || (draft.plan.areas.length > 0 && preview.error)) && <div role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {draft.error || preview.error}
      {!draft.catalogue && !draft.loading && <button type="button" className="ml-2 min-h-11 cursor-pointer px-2 underline" onClick={draft.retry}>Retry references</button>}
    </div>}
    {editor.mulchError && <p role="alert" className="shrink-0 bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{editor.mulchError}</p>}
    <div inert={editor.leaving} className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="relative min-h-0 min-w-0 flex-1">
        <BedPlanCanvas bed={bed} plan={draft.plan} selectedId={draft.selectedId} onBounds={draft.bounds} onOpenArea={setFocus}
          onSelect={(id) => { draft.setSelectedId(id); if (id) setTool('area'); }} editingMulch={editingMulch}
          mulch={{ plan: mulch.plan, selectedId: mulch.selectedId, preview: mulch.preview, onBounds: mulch.bounds,
            onSelect: (id) => { mulch.setSelectedId(id); mulch.setPreview(null); } }} />
        {!editingMulch && !draft.plan.areas.length && <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg bg-white/90 p-3 text-center text-sm dark:bg-stone-900/90">
          {draft.loading ? 'Loading planting references…' : draft.catalogue?.plants.length ? 'Use Add area to plan plants in this bed.' : 'Open Areas → Plant catalogue to add plant types.'}
        </p>}
      </div>
      <BedEditorInspector bed={bed} userId={userId} tool={tool} open={controlsOpen} editor={editor}
        onClose={() => setControlsOpen(false)} onTool={(next) => { setTool(next); setControlsOpen(true); }}
        onSaveDetails={saveDetails} onDelete={onDelete} onCopy={onCopy} copyMessage={copyMessage} onFocus={setFocus} historyDraft={historyDraft} />
    </div>
  </EditorScreen>;
}
