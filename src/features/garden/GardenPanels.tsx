import { Sheet } from '../../shared/ui/Sheet';
import type { User } from '@supabase/supabase-js';
import { AccountPanel } from '../auth/AccountPanel';
import { Button } from '../../shared/ui/Button';
import { BedForm } from '../beds/BedForm';
import { BedsList } from '../beds/BedsList';
import { BedTouchActions } from '../beds/BedTouchActions';
import type { BedClipboard } from '../beds/useBedClipboard';
import { GardenDimensionsForm } from './GardenDimensionsForm';
import { GardenHelp } from './GardenHelp';
import type { useGardenLayout } from './useGardenLayout';
import { GardenNameForm } from '../gardens/GardenNameForm';
import { GardenSharingPanel } from '../sharing/GardenSharingPanel';

export type GardenPanel = 'garden' | 'beds' | 'add' | 'edit' | 'actions' | 'help' | 'account' | 'rename' | 'sharing';

type GardenPanelsProps = {
  panel: GardenPanel | null;
  onPanelChange: (panel: GardenPanel | null) => void;
  layout: ReturnType<typeof useGardenLayout>;
  selectedBedId: string | null;
  onSelectBed: (id: string | null) => void;
  clipboard: BedClipboard;
  onDelete: () => void;
  user: User;
  beforeSignOut: () => Promise<string | null>;
  onChooseGardens: () => void;
  gardenId: string;
  ownerId: string;
};

export function GardenPanels({ panel, onPanelChange, layout, selectedBedId, onSelectBed, clipboard, onDelete, user, beforeSignOut, onChooseGardens, gardenId, ownerId }: GardenPanelsProps) {
  if (!panel) return null;
  const selected = layout.beds.find((bed) => bed.id === selectedBedId);
  const close = () => onPanelChange(null);
  const titles = { garden: 'Garden size', beds: `Beds (${layout.beds.length})`, add: 'Add bed', edit: 'Edit bed', actions: 'Garden tools', help: 'How to use Myco', account: 'Account', rename: 'Garden name', sharing: 'Sharing' };

  return (
    <Sheet key={panel} title={titles[panel]} onClose={close}>
      {panel === 'garden' && <GardenDimensionsForm dimensions={layout.dimensions} onApply={(dimensions) => {
        const error = layout.applyDimensions(dimensions);
        if (!error) close();
        return error;
      }} />}
      {panel === 'beds' && <BedsList beds={layout.beds} selectedBedId={selectedBedId}
        onEdit={(id) => { onSelectBed(id); onPanelChange('edit'); }} />}
      {(panel === 'add' || panel === 'edit') && <BedForm key={selected?.id ?? 'new'}
        bed={panel === 'edit' ? selected : undefined} onSave={(details) => {
          const error = layout.saveBed(details, panel === 'edit' ? selected?.id : undefined);
          if (!error) close();
          return error;
        }} />}
      {panel === 'actions' && (
        <div className="space-y-3">
          <Button variant="secondary" onClick={onChooseGardens}>Your gardens</Button>
          <Button variant="secondary" onClick={() => onPanelChange('sharing')}>Sharing</Button>
          <Button variant="secondary" onClick={() => onPanelChange('rename')}>Rename garden</Button>
          <Button variant="secondary" onClick={() => onPanelChange('garden')}>Garden size</Button>
          <Button variant="secondary" onClick={() => onPanelChange('help')}>Help</Button>
          <div className="lg:hidden [@media(pointer:coarse)]:block">
            <BedTouchActions bed={selected} clipboard={clipboard}
              onEdit={() => onPanelChange('edit')} onDelete={onDelete} onClose={close} />
          </div>
        </div>
      )}
      {panel === 'help' && <GardenHelp />}
      {panel === 'account' && <AccountPanel user={user} beforeSignOut={beforeSignOut} />}
      {panel === 'sharing' && <GardenSharingPanel gardenId={gardenId} isOwner={ownerId === user.id} />}
      {panel === 'rename' && <GardenNameForm name={layout.name} onSave={(name) => {
        const error = layout.renameGarden(name); if (!error) close(); return error;
      }} />}
    </Sheet>
  );
}
