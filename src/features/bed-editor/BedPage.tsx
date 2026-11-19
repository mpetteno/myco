import { useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
import { useI18n } from '../../shared/i18n/I18nProvider';
import { useEditorShortcuts } from '../../shared/keyboard/useEditorShortcuts';
import type { AreaClipboard } from '../area-editor/useAreaClipboard';
import { areaLabel } from '../area-editor/areaPlan';
import { HistoryEditPage } from '../history/HistoryEditPage';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { EditorScreen } from '../../shared/ui/EditorScreen';
import { Button } from '../../shared/ui/Button';
import { useWideLayout } from '../../shared/hooks/useWideLayout';
import type { Bed, BedDetails, BedPlans } from '../beds/bed';
import { MAX_AREAS, areasFit } from '../area-editor/areaPlan';
import { AreaPlanCanvas } from '../area-editor/AreaPlanCanvas';
import type { GardenSaveStatus } from '../gardens/GardenSaveQueue';
import { useBedEditor } from './useBedEditor';
import { BedEditorHeader } from './BedEditorHeader';
import { BedEditorToolbar } from './BedEditorToolbar';
import type { BedEditorTool } from './BedEditorToolbar';
import { BedEditorInspector } from './BedEditorInspector';
import { BedLeavePrompt } from './BedLeavePrompt';
import { AreaEditorPage } from '../area-editor/AreaEditorPage';
import type { AreaFocus } from '../area-editor/areaViewport';
import { useGardenHistory } from '../history/useGardenHistory';
import type { SavedGarden } from '../gardens/gardenDocument';
import { BedHistoryPage } from './BedHistoryPage';

type BedPageProps = { areaClipboard: AreaClipboard; bed: Bed; userId: string; status: GardenSaveStatus; feedback: ReactNode;
  onSaveDetails: (details: BedDetails) => string | null; onSavePlan: (plans: BedPlans) => string | null;
  onPosition?: (position: { xCm: number; yCm: number }) => string | null;
  beforeLeaving: () => Promise<string | null>; onBack: () => void; onDelete: () => void;
  onCopy: () => void; copyMessage: string; gardenId: string; getCurrent: () => SavedGarden; onReload: () => Promise<void>;
  onEditorContextChange?: (context: 'garden' | 'bed' | 'area') => void;
  user?: import('@supabase/supabase-js').User; historyDraft?: boolean; onValidityChange?: (valid: boolean) => void };

export function BedPage({ areaClipboard, bed, userId, status, feedback, onSaveDetails, onSavePlan, onPosition, beforeLeaving, onBack, onDelete, onCopy, copyMessage, gardenId,getCurrent,onReload,historyDraft=false,onValidityChange,user,onEditorContextChange }: BedPageProps) {
  const { t } = useI18n();
  const navigation = useWorkspaceNavigation();
  const [shortcutFeedback, setShortcutFeedback] = useState('');
  const history = useGardenHistory(gardenId,beforeLeaving,getCurrent,bed.id);
  const editor = useBedEditor({ bed, userId, onSavePlan, beforeLeaving, onBack, preserveFormat: historyDraft,
    suggestionContext: { gardenId, location: getCurrent().location, enabled: !historyDraft && !history.open && !history.editingHistory,
      revision: JSON.stringify(history.events.map((event) => [event.id, event.eventVersion])) } });
  const { draft, preview } = editor;
  useEffect(() => { onValidityChange?.(!editor.dirty); }, [editor.dirty, onValidityChange]);
  useEffect(() => () => onValidityChange?.(true), [onValidityChange]);
  const [tool, setTool] = useState<BedEditorTool>(draft.selected ? 'area' : 'recap');
  const [controlsOpen, setControlsOpen] = useState(false);
  const wide = useWideLayout();
  const [focus, setFocus] = useState<AreaFocus | null>(null);
  useEffect(() => { onEditorContextChange?.(focus ? 'area' : 'bed'); }, [focus, onEditorContextChange]);
  const [historyIntent,setHistoryIntent] = useState(false);
  useEffect(() => {
    if (focus && !draft.plan.areas.some((area) => area.id === focus.id)) setFocus(null);
  }, [focus, draft.plan.areas]);
  useEditorShortcuts({ enabled: (!navigation || (navigation.destination === 'gardens' && !navigation.suspended)) && !history.open && !history.editingHistory && !editor.leaving && !editor.confirmLeave && !historyIntent && !status.conflict,
    onCopy: draft.selected ? () => {
      areaClipboard.copy(draft.selected!);
      setShortcutFeedback(t('keyboard.areaCopied', { name: areaLabel(draft.selected!) }));
    } : undefined,
    onPaste: areaClipboard.hasCopy() ? () => {
      const area = areaClipboard.paste(bed, draft.plan);
      if (!area) { setShortcutFeedback(t('keyboard.areaNoSpace')); return; }
      draft.setPlan({ ...draft.plan, areas: [...draft.plan.areas, area] });
      draft.setSelectedId(area.id);
      if (focus) setFocus({ ...focus, id: area.id });
      setShortcutFeedback(t('keyboard.areaPasted', { name: areaLabel(area) }));
    } : undefined,
    onUndo: editor.canUndo ? editor.undo : undefined,
    onRedo: editor.canRedo ? editor.redo : undefined,
  });
  const editorFeedback = <>{feedback}<p role="status" className="shrink-0 px-3 py-1 text-sm empty:hidden">{shortcutFeedback}</p></>;
  function openTool(next: BedEditorTool) {
    setControlsOpen((open) => tool !== next || !open); setTool(next);
  }
  function saveDetails(details: BedDetails) {
    if (!areasFit(draft.plan, details)) return 'This size would crop a draft area. Resize or remove the area first.';
    return onSaveDetails(details);
  }
  if (history.editingHistory && user) return <HistoryEditPage key={`${history.editingHistory.event?.id ?? 'new'}:${history.editingHistory.event?.eventVersion ?? 0}`} onReload={history.reloadHistoryEdit} draft={history.editingHistory} current={getCurrent()} user={user} onBack={history.closeHistoryEdit} onSaved={history.historyEdited} />;
  if (history.open) return <BedHistoryPage bed={bed} history={history} onBack={history.close} onReload={onReload} />;
  if (focus && draft.plan.areas.some((area) => area.id === focus.id)) return <AreaEditorPage gardenName={getCurrent().name} bed={bed} editor={editor} focus={focus} onBack={() => setFocus(null)} feedback={editorFeedback} status={status} historyDraft={historyDraft} />;
  return <EditorScreen
    header={<BedEditorHeader gardenName={getCurrent().name} bed={bed} count={preview.points.length} dirty={editor.dirty} status={status} leaving={editor.leaving} historyDraft={historyDraft} onBack={editor.back}
      canUndo={editor.canUndo && !status.conflict} onUndo={editor.undo} />}
    feedback={editorFeedback}
    toolbar={<BedEditorToolbar tool={tool} controlsOpen={controlsOpen || wide} disabled={editor.leaving}
      canAdd={draft.plan.areas.length < MAX_AREAS}
      onHistory={historyDraft ? undefined : () => { if (editor.dirty) setHistoryIntent(true); else void history.show(); }}
      onTool={openTool} onAdd={() => { draft.addArea(); setTool('area'); setControlsOpen(true); }} />}>
    {historyIntent && <BedLeavePrompt destination="history"
      onDiscard={() => { editor.discardDraft(); setHistoryIntent(false); void history.show(); }} onCancel={() => setHistoryIntent(false)} />}
    {editor.confirmLeave && <BedLeavePrompt destination="garden" onDiscard={editor.discardAndBack} onCancel={() => editor.setConfirmLeave(false)} />}
    {(draft.error || editor.validation) && <div role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {draft.error || editor.validation}
      {!draft.catalogue && !draft.loading && <button type="button" className="ml-2 min-h-11 cursor-pointer px-2 underline" onClick={draft.retry}>Retry references</button>}
    </div>}
    <div inert={editor.leaving} className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
        <AreaPlanCanvas bed={bed} plan={draft.plan} selectedId={draft.selectedId} onBounds={draft.bounds} onOpenArea={setFocus}
          onSelect={(id) => { draft.setSelectedId(id); if (id) setTool('area'); }} />
        </div>
        {!draft.plan.areas.length && <p className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg bg-white/90 p-3 text-center text-sm dark:bg-stone-900/90">
          Use Add area to plan plant rows or broadcast sowing.
        </p>}
        {draft.selected && !controlsOpen && <div className="shrink-0 px-3 pt-2 pb-3 lg:hidden">
          <Button variant="secondary" onClick={() => { setTool('area'); setControlsOpen(true); }}>Edit selected area</Button>
        </div>}
      </div>
      <BedEditorInspector bed={bed} tool={tool} open={controlsOpen} editor={editor}
        onPosition={onPosition}
        onClose={() => setControlsOpen(false)}
        onSaveDetails={saveDetails} onDelete={onDelete} onCopy={onCopy} copyMessage={copyMessage} onFocus={setFocus} historyDraft={historyDraft} />
    </div>
  </EditorScreen>;
}
