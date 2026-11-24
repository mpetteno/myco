import { useI18n } from '../../shared/i18n/I18nProvider';
import { Sheet } from '../../shared/ui/Sheet';
import type { User } from '@supabase/supabase-js';
import { Button } from '../../shared/ui/Button';
import { BedForm } from '../beds/BedForm';
import { BedTouchActions } from '../beds/BedTouchActions';
import type { BedClipboard } from '../beds/useBedClipboard';
import { GardenDimensionsForm } from './GardenDimensionsForm';
import type { useGardenLayout } from './useGardenLayout';
import { GardenNameForm } from '../gardens/GardenNameForm';
import { GardenSharingPanel } from '../sharing/GardenSharingPanel';
import { GardenRecap } from './GardenRecap';
import { DeleteGardenDialog } from '../gardens/DeleteGardenDialog';

export type GardenPanel = 'garden' | 'edit-garden' | 'recap' | 'bed-recap' | 'add' | 'actions' | 'rename' | 'sharing' | 'delete';

type GardenPanelsProps = {
  panel: GardenPanel | null;
  onPanelChange: (panel: GardenPanel | null) => void;
  layout: ReturnType<typeof useGardenLayout>;
  selectedBedId: string | null;
  onCreatedBed?: (id: string) => void;
  clipboard: BedClipboard;
  onDelete: () => void;
  user: User;
  gardenId: string;
  ownerId: string;
  onEditBed: (id: string) => void;
  onLocation?: () => void;
  onDeleteGarden?: () => Promise<void>;
  onReload?: () => Promise<void>;
  readOnly?: boolean; historyDraft?: boolean; bedScope?: string;
};

export function GardenPanels({ panel, onPanelChange, layout, selectedBedId, onCreatedBed, clipboard, onDelete, user, gardenId, ownerId, onEditBed, onLocation, onDeleteGarden, onReload, historyDraft = false, bedScope, readOnly = false }: GardenPanelsProps) {
  const { t } = useI18n();
  if (!panel) return null;
  const selected = layout.beds.find((bed) => bed.id === selectedBedId);
  const close = () => onPanelChange(null);
  if (panel === 'delete') return !historyDraft && !readOnly && ownerId === user.id && onDeleteGarden
    ? <DeleteGardenDialog name={layout.name} onDelete={onDeleteGarden} onReload={onReload} onCancel={close} /> : null;
  const titles = { garden: 'Garden size', 'edit-garden': 'Garden settings', recap: 'Garden summary', 'bed-recap': `${selected?.name ?? 'Bed'} · Summary`, add: 'Add bed', actions: selected ? `${selected.name} · ${selected.widthCm} × ${selected.lengthCm} cm` : 'More garden actions', rename: 'Garden name', sharing: 'Share garden' };

  return (
    <Sheet key={panel} title={titles[panel]} onClose={close}>
      {panel === 'garden' && !readOnly && <GardenDimensionsForm dimensions={layout.dimensions} onApply={(dimensions) => {
        const error = layout.applyDimensions(dimensions);
        if (!error) close();
        return error;
      }} />}
      {panel === 'add' && !readOnly && <BedForm showHeading={false} onSave={(details) => {
          const error = layout.saveBed(details, undefined, onCreatedBed);
          if (!error) close();
          return error;
        }} />}
      {panel === 'actions' && (
        <div className="space-y-5">
          {selected ? !readOnly && !bedScope ? <section aria-label="Bed actions" className="space-y-2">
            <BedTouchActions hideEdit bed={selected} clipboard={clipboard}
              hidePaste onEdit={() => onEditBed(selected.id)} onDelete={onDelete} onClose={close} />
          </section> : <p className="text-sm">{readOnly ? 'This bed is read-only.' : 'Copying or deleting beds is unavailable in this historical draft.'}</p> : <section aria-label="Garden actions" className="space-y-2">
            {!bedScope && <Button variant="secondary" onClick={() => onPanelChange('edit-garden')}>Garden settings</Button>}
            {!readOnly && !bedScope && <Button variant="secondary" disabled={!clipboard.canPaste} onClick={() => { if (clipboard.paste()) close(); }}>Paste bed</Button>}
            {!readOnly && !historyDraft && !bedScope && ownerId === user.id && onDeleteGarden && <Button variant="danger" onClick={() => onPanelChange('delete')}>Delete garden</Button>}
          </section>}
        </div>
      )}
      {panel === 'edit-garden' && <div className="space-y-3">
        {!historyDraft && <Button variant="secondary" onClick={() => onPanelChange('sharing')}>Share garden</Button>}
        <Button variant="secondary" disabled={readOnly} onClick={() => onPanelChange('rename')}>Rename garden</Button>
        <Button variant="secondary" disabled={readOnly} onClick={() => onPanelChange('garden')}>Garden size</Button>
        {onLocation && <Button variant="secondary" disabled={readOnly} onClick={onLocation}>{t('location.title')}</Button>}
      </div>}
      {panel === 'recap' && <GardenRecap garden={layout} />}
      {panel === 'bed-recap' && selected && <GardenRecap scope="bed" garden={{ ...layout, name: selected.name, dimensions: selected, beds: [selected] }} />}
      {panel === 'sharing' && <GardenSharingPanel gardenId={gardenId} isOwner={ownerId === user.id} />}
      {panel === 'rename' && !readOnly && <GardenNameForm name={layout.name} onSave={(name) => {
        const error = layout.renameGarden(name); if (!error) close(); return error;
      }} />}
    </Sheet>
  );
}
