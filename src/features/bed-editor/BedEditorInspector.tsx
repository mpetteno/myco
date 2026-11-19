import { BedSuggestions } from '../suggestions/BedSuggestions';
import { AreaFields } from '../area-editor/AreaFields';
import { Button } from '../../shared/ui/Button';
import { GeometryForm } from '../../shared/ui/GeometryForm';
import type { Bed, BedDetails } from '../beds/bed';
import { BedForm } from '../beds/BedForm';
import { BedAreaControls } from './BedAreaControls';
import { BedPlantingSettings } from './BedPlantingSettings';
import { BedRecap } from './BedRecap';
import type { BedEditorTool } from './BedEditorToolbar';
import type { useBedEditor } from './useBedEditor';
import type { AreaFocus } from '../area-editor/areaViewport';

type BedEditorInspectorProps = { bed: Bed; tool: BedEditorTool; open: boolean;
  editor: ReturnType<typeof useBedEditor>; onClose: () => void;
  onPosition?: (position: { xCm: number; yCm: number }) => string | null;
  onSaveDetails: (details: BedDetails) => string | null; onDelete: () => void; onCopy: () => void; copyMessage: string; onFocus: (focus: AreaFocus) => void; historyDraft?: boolean };

export function BedEditorInspector({ bed, tool, open, editor, onClose, onSaveDetails, onPosition, onDelete, onCopy, copyMessage, onFocus,historyDraft }: BedEditorInspectorProps) {
  const titles = { area: 'Areas', bed: 'Bed settings', recap: 'Bed summary' };
  return <aside id="bed-inspector" aria-label={titles[tool]}
    className={`${open ? 'flex' : 'hidden'} max-h-[45%] min-h-0 shrink-0 flex-col border-t border-stone-200 bg-white focus-within:max-h-[80%] lg:flex lg:max-h-none lg:focus-within:max-h-none lg:w-80 lg:border-t-0 lg:border-l xl:w-96 dark:border-stone-800 dark:bg-stone-900`}>
    <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4 dark:border-stone-800">
      <h2 className="min-w-0 flex-1 font-semibold">{titles[tool]}</h2>
      {tool === 'area' && editor.draft.selectedId && <button type="button" onClick={() => onFocus({ kind: 'planting', id: editor.draft.selectedId! })} className="min-h-11 cursor-pointer rounded-lg px-2 text-sm font-medium underline focus-visible:outline-2 focus-visible:outline-green-600">Focus area</button>}
      <button type="button" onClick={() => { onClose(); document.getElementById(`bed-tool-${tool}`)?.focus(); }} className="min-h-11 cursor-pointer rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 lg:hidden">Hide controls</button>
    </div>
    <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
      {tool === 'area' && <>
        <BedAreaControls editor={editor} />
        <AreaFields bed={bed} editor={editor} />
        <BedAreaControls editor={editor} actionsOnly />
        <BedSuggestions editor={editor} />
        <BedPlantingSettings bed={bed} editor={editor} />
      </>}
      {tool === 'recap' && <><BedRecap bed={bed} editor={editor} /><BedSuggestions editor={editor} summary /></>}
      {tool === 'bed' && <>
        <BedForm bed={bed} onSave={onSaveDetails} />
        {onPosition && <GeometryForm id="bed-position" value={bed} container="garden" onSave={onPosition} />}
        <p className="text-xs text-stone-600 dark:text-stone-400">{historyDraft ? 'Changes belong to this historical draft. Save history record explicitly to record them.' : 'Bed settings update the garden plan. Planting and mulch save automatically; completed history changes only when you record work done.'}</p>
        {!historyDraft && <><div className="space-y-3"><Button variant="secondary" onClick={onCopy}>Copy bed</Button>
          <p role="status" className="text-sm empty:hidden">{copyMessage}</p></div>
        <Button variant="danger" onClick={onDelete}>Delete bed</Button></>}
      </>}
    </div>
  </aside>;
}
