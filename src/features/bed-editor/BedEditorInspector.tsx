import { Button } from '../../shared/ui/Button';
import type { Bed, BedDetails } from '../beds/bed';
import { BedForm } from '../beds/BedForm';
import { PlantCataloguePanel } from '../catalogue/PlantCataloguePanel';
import { BedAreaControls } from './BedAreaControls';
import { BedPlantingSettings } from './BedPlantingSettings';
import { BedRecap } from './BedRecap';
import type { BedEditorTool } from './BedEditorToolbar';
import type { useBedEditor } from './useBedEditor';
import { MulchControls } from '../mulch/MulchControls';
import { MulchCataloguePanel } from '../mulch-catalogue/MulchCataloguePanel';
import type { AreaFocus } from '../area-editor/areaViewport';

type BedEditorInspectorProps = { bed: Bed; userId: string; tool: BedEditorTool; open: boolean;
  editor: ReturnType<typeof useBedEditor>; onClose: () => void; onTool: (tool: BedEditorTool) => void;
  onSaveDetails: (details: BedDetails) => string | null; onDelete: () => void; onCopy: () => void; copyMessage: string; onFocus: (focus: AreaFocus) => void; historyDraft?: boolean };

export function BedEditorInspector({ bed, userId, tool, open, editor, onClose, onTool, onSaveDetails, onDelete, onCopy, copyMessage, onFocus,historyDraft }: BedEditorInspectorProps) {
  const titles = { area: 'Planting areas', bed: 'Bed settings', recap: 'Bed recap', catalogue: 'Plant catalogue', mulch: 'Mulch areas and layers', 'mulch-catalogue': 'Mulch catalogue' };
  return <aside aria-label={titles[tool]}
    className={`${open ? 'flex' : 'hidden'} max-h-[45%] min-h-0 shrink-0 flex-col border-t border-stone-200 bg-white lg:flex lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l xl:w-96 dark:border-stone-800 dark:bg-stone-900`}>
    <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4 dark:border-stone-800">
      <h2 className="font-semibold">{titles[tool]}</h2>
      <button type="button" onClick={onClose} className="min-h-11 cursor-pointer rounded-lg px-2 text-sm focus-visible:outline-2 focus-visible:outline-green-600 lg:hidden">Hide controls</button>
    </div>
    <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4">
      {tool === 'area' && <>
        <BedAreaControls draft={editor.draft} bed={bed} onFocus={() => { if (editor.draft.selectedId) onFocus({ kind: 'planting', id: editor.draft.selectedId }); }} />
        <BedPlantingSettings bed={bed} editor={editor} onCatalogue={() => onTool('catalogue')} />
      </>}
      {tool === 'mulch' && <MulchControls draft={editor.mulch} onCatalogue={() => onTool('mulch-catalogue')} onFocus={() => { if (editor.mulch.selectedId) onFocus({ kind: 'mulch', id: editor.mulch.selectedId }); }} />}
      {tool === 'recap' && <BedRecap bed={bed} editor={editor} />}
      {tool === 'bed' && <>
        <BedForm bed={bed} onSave={onSaveDetails} />
        <p className="text-xs text-stone-600 dark:text-stone-400">{historyDraft ? 'Changes belong to this historical draft. Save history record explicitly to record them.' : 'Bed settings update the garden plan. Planting and mulch save automatically; completed history changes only when you record work done.'}</p>
        {!historyDraft && <><div className="space-y-3 lg:hidden [@media(pointer:coarse)]:block"><Button variant="secondary" onClick={onCopy}>Copy bed</Button>
          <p role="status" className="text-sm empty:hidden">{copyMessage}</p></div>
        <Button variant="danger" onClick={onDelete}>Delete bed</Button></>}
      </>}
      {tool === 'catalogue' && <>
        <Button variant="secondary" onClick={() => { editor.draft.retry(); onTool('area'); }}>Back to areas</Button>
        <PlantCataloguePanel userId={userId} />
      </>}
      {tool === 'mulch-catalogue' && <>
        <Button variant="secondary" onClick={() => { editor.mulch.retry(); onTool('mulch'); }}>Back to mulch plan</Button>
        <MulchCataloguePanel userId={userId} />
      </>}
    </div>
  </aside>;
}
