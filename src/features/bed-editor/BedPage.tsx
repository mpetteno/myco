import { useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { useEditorShortcuts } from '../../shared/keyboard/useEditorShortcuts';
import type { AreaClipboard } from '../area-editor/useAreaClipboard';
import { areaLabel } from '../area-editor/areaPlan';
import { HistoryEditPage } from '../history/HistoryEditPage';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { useWideLayout } from '../../shared/hooks/useWideLayout';
import type { Bed, BedDetails, BedPlans } from '../beds/bed';
import { MAX_AREAS } from '../area-editor/areaPlan';
import { resizeBedContents } from '../beds/resizeBedContents';
import { AreaPlanCanvas } from '../area-editor/AreaPlanCanvas';
import type { GardenSaveStatus } from '../gardens/GardenSaveQueue';
import { useBedEditor } from './useBedEditor';
import { BedEditorHeader } from './BedEditorHeader';
import { BedEditorToolbar } from './BedEditorToolbar';
import type { BedEditorTool } from './BedEditorToolbar';
import { BedEditorInspector } from './BedEditorInspector';
import { BedLeavePrompt } from './BedLeavePrompt';
import type { AreaFocus } from '../area-editor/areaViewport';
import type { CameraCommand } from '../plan-camera/planCamera';
import { BedCanvasToolbar } from './BedCanvasToolbar';
import { useGardenHistory } from '../history/useGardenHistory';
import type { SavedGarden } from '../gardens/gardenDocument';
import { BedHistoryCanvas } from './BedHistoryCanvas';
import { GardenHistoryInspector } from '../history/GardenHistoryInspector';

type BedPageProps = { areaClipboard: AreaClipboard; bed: Bed; userId: string; status: GardenSaveStatus; feedback: ReactNode;
  onSaveDetails: (details: BedDetails) => string | null; onSavePlan: (plans: BedPlans) => string | null;
  onPosition?: (position: { xCm: number; yCm: number }) => string | null;
  beforeLeaving: () => Promise<string | null>; onBack: () => void; onDelete: () => void;
  onCopy: () => void; copyMessage: string; gardenId: string; getCurrent: () => SavedGarden; onReload: () => Promise<void>;
  onEditorContextChange?: (context: 'garden' | 'bed' | 'area') => void;
  onOpenCalendar?: () => void; calendarVisible?: boolean;
  user?: import('@supabase/supabase-js').User; historyDraft?: boolean; onValidityChange?: (valid: boolean) => void };

export function BedPage({ areaClipboard, bed, userId, status, feedback, onSaveDetails, onSavePlan, onPosition, beforeLeaving, onBack, onDelete, onCopy, copyMessage, gardenId,getCurrent,onReload,historyDraft=false,onValidityChange,user,onEditorContextChange,onOpenCalendar,calendarVisible=true }: BedPageProps) {
  const { t } = useI18n();
  const navigation = useWorkspaceNavigation();
  const [shortcutFeedback, setShortcutFeedback] = useState('');
  const history = useGardenHistory(gardenId,beforeLeaving,getCurrent,bed.id);
  const readOnly = !history.current || history.saving;
  const editor = useBedEditor({ bed, userId, onSavePlan, beforeLeaving, onBack, preserveFormat: historyDraft,
    suggestionContext: { gardenId, location: getCurrent().location, enabled: !historyDraft && !readOnly && !history.editingHistory,
      revision: JSON.stringify(history.events.map((event) => [event.id, event.eventVersion])) } });
  const { draft, preview } = editor;
  useEffect(() => { onValidityChange?.(!editor.dirty); }, [editor.dirty, onValidityChange]);
  useEffect(() => () => onValidityChange?.(true), [onValidityChange]);
  const [tool, setTool] = useState<BedEditorTool>(draft.selected ? 'area' : 'recap');
  const [controlsOpen, setControlsOpen] = useState(false);
  const wide = useWideLayout();
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>();
  const [panning, setPanning] = useState(false);
  useEffect(() => { onEditorContextChange?.('bed'); }, [onEditorContextChange]);
  function moveCamera(action: CameraCommand['action'], targetId = draft.selectedId ?? undefined) {
    setCameraCommand((previous) => ({ action, targetId, revision: (previous?.revision ?? 0) + 1 }));
    if (action === 'focus') setControlsOpen(false);
  }
  function focusArea(focus: AreaFocus) { moveCamera('focus', focus.id); }
  useEditorShortcuts({ enabled: (!navigation || (navigation.destination === 'gardens' && !navigation.suspended)) && !readOnly && !history.editingHistory && !editor.leaving && !editor.confirmLeave && !status.conflict,
    onCopy: draft.selected ? () => {
      areaClipboard.copy(draft.selected!);
      setShortcutFeedback(t('keyboard.areaCopied', { name: areaLabel(draft.selected!) }));
    } : undefined,
    onPaste: areaClipboard.hasCopy() ? () => {
      const area = areaClipboard.paste(bed, draft.plan);
      if (!area) { setShortcutFeedback(t('keyboard.areaNoSpace')); return; }
      editor.setResizing(false);
      draft.setPlan({ ...draft.plan, areas: [...draft.plan.areas, area] });
      draft.setSelectedId(area.id);
      setShortcutFeedback(t('keyboard.areaPasted', { name: areaLabel(area) }));
    } : undefined,
    onUndo: editor.canUndo ? editor.undo : undefined,
    onRedo: editor.canRedo ? editor.redo : undefined,
  });
  useEffect(() => { if (history.open || history.editingHistory || (navigation && navigation.destination !== 'gardens')) editor.setResizing(false); }, [history.open, history.editingHistory, navigation?.destination]);
  function openTool(next: BedEditorTool) {
    if (readOnly) return;
    history.close();
    setControlsOpen((open) => history.open || tool !== next || !open); setTool(next);
  }
  function saveDetails(details: BedDetails) {
    const resizing = details.widthCm !== bed.widthCm || details.lengthCm !== bed.lengthCm;
    if (resizing && editor.dirty) return 'Complete or discard the area settings before resizing the bed.';
    const next = resizeBedContents(bed, { ...bed, ...details });
    if (next.error) return next.error;
    const error = onSaveDetails(details);
    if (!error && resizing) {
      const selectedId = draft.selectedId;
      editor.resetFromBed(next.bed);
      draft.setSelectedId(selectedId);
    }
    return error;
  }
  if (history.editingHistory && user) return <HistoryEditPage key={`${history.editingHistory.event?.id ?? 'new'}:${history.editingHistory.event?.eventVersion ?? 0}`} onReload={history.reloadHistoryEdit} draft={history.editingHistory} current={getCurrent()} user={user} onBack={history.closeHistoryEdit} onSaved={history.historyEdited} />;
  return <EditorScreen
    header={<BedEditorHeader gardenName={getCurrent().name} bed={bed} count={preview.points.length} dirty={editor.dirty} status={status} leaving={editor.leaving || history.saving} readOnly={!history.current} historyDraft={historyDraft} onBack={editor.back}
      canUndo={editor.canUndo && !status.conflict && !readOnly} onUndo={editor.undo} canRedo={editor.canRedo && !status.conflict && !readOnly} onRedo={editor.redo} />}
    toolbar={<BedEditorToolbar tool={tool} controlsOpen={controlsOpen || wide} disabled={editor.leaving || history.saving} readOnly={!history.current}
      canAdd={draft.plan.areas.length < MAX_AREAS}
      onCalendar={historyDraft ? undefined : () => { if (history.open) history.close(); else void history.show(); }} calendarOpen={history.open}
      onTool={openTool} onAdd={() => { history.close(); setPanning(false); draft.addArea(); setTool('area'); setControlsOpen(true); }} />}>
    <div className="relative flex min-h-0 flex-1 flex-col">
    <div className="pointer-events-none absolute inset-x-2 top-2 z-30 max-h-[70%] space-y-2 overflow-y-auto [&>*]:pointer-events-auto [&>*]:rounded-lg [&>*]:shadow-lg">
    {feedback}
    {shortcutFeedback && <p role="status" className="bg-white px-3 py-2 text-sm dark:bg-stone-900">{shortcutFeedback}<button type="button" className="ml-2 min-h-11 cursor-pointer px-2 underline" onClick={() => setShortcutFeedback('')}>Dismiss</button></p>}
    {editor.confirmLeave && <BedLeavePrompt onDiscard={editor.discardAndBack} onCancel={() => editor.setConfirmLeave(false)} />}
    {!history.open && (draft.error || editor.validation) && <div role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {draft.error || editor.validation}
      {!draft.catalogue && !draft.loading && <button type="button" className="ml-2 min-h-11 cursor-pointer px-2 underline" onClick={draft.retry}>Retry references</button>}
    </div>}
    </div>
    <div inert={editor.leaving} className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <div hidden={!history.current} inert={!history.current} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
        <AreaPlanCanvas bed={bed} plan={draft.plan} selectedId={draft.selectedId} resizing={editor.resizing && !status.conflict} onBounds={draft.bounds} onOpenArea={focusArea} cameraCommand={cameraCommand} panning={panning}
          onSelect={(id) => { draft.setSelectedId(id); if (id && tool !== 'suggestions') setTool('area'); }} />
        </div>
        {!draft.plan.areas.length && <p className="pointer-events-none absolute inset-x-4 top-16 rounded-lg bg-white/90 p-3 text-center text-sm dark:bg-stone-900/90">
          Use Add area to plan plant rows or broadcast sowing.
        </p>}
        <BedCanvasToolbar selected={!!draft.selected} resizing={editor.resizing} panning={panning} disabled={!!status.conflict || editor.leaving}
          onCamera={moveCamera} onPan={() => { setPanning(!panning); editor.setResizing(false); }}
          onResize={() => { setPanning(false); editor.setResizing(!editor.resizing); }} onEdit={() => { history.close(); setPanning(false); setTool('area'); setControlsOpen(true); }} />
      </div>
      {!history.current && <BedHistoryCanvas bed={bed} history={history} />}
      {history.open && <GardenHistoryInspector showClose={false} history={history} onReload={onReload} visible={calendarVisible} onFullCalendar={onOpenCalendar} />}
      <div hidden={history.open} inert={history.open} className="contents"><BedEditorInspector bed={bed} tool={tool} open={controlsOpen} editor={editor}
        onPosition={onPosition}
        onClose={() => setControlsOpen(false)}
        onSaveDetails={saveDetails} onDelete={onDelete} onCopy={onCopy} copyMessage={copyMessage} onEditArea={() => { setTool('area'); setControlsOpen(true); }} historyDraft={historyDraft} /></div>
    </div>
    </div>
  </EditorScreen>;
}
