import type { GardenLocation } from '../gardens/gardenLocation';
import { GardenCalendarGuidance } from '../catalogue-reference/GardenCalendarGuidance';
import { useI18n } from '../../shared/i18n/I18nProvider';
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
import { GardenRecap } from './GardenRecap';

export type GardenPanel = 'garden' | 'edit-garden' | 'recap' | 'beds' | 'add' | 'actions' | 'help' | 'account' | 'rename' | 'sharing' | 'calendar';

type GardenPanelsProps = {
  panel: GardenPanel | null;
  onPanelChange: (panel: GardenPanel | null) => void;
  layout: ReturnType<typeof useGardenLayout>;
  selectedBedId: string | null;
  clipboard: BedClipboard;
  onDelete: () => void;
  user: User;
  beforeSignOut: () => Promise<string | null>;
  onChooseGardens: () => void;
  gardenId: string;
  ownerId: string;
  onEditBed: (id: string) => void;
  onLocation?: () => void; location?: GardenLocation;
  readOnly?: boolean; historyDraft?: boolean; bedScope?: string;
};

export function GardenPanels({ panel, onPanelChange, layout, selectedBedId, clipboard, onDelete, user, beforeSignOut, onChooseGardens, gardenId, ownerId, onEditBed, onLocation, location, historyDraft = false, bedScope, readOnly = false }: GardenPanelsProps) {
  const { t } = useI18n();
  if (!panel) return null;
  const selected = layout.beds.find((bed) => bed.id === selectedBedId);
  const close = () => onPanelChange(null);
  const titles = { garden: 'Garden size', 'edit-garden': 'Edit garden', recap: 'Garden recap', beds: `Beds (${layout.beds.length})`, add: 'Add bed', actions: 'Garden tools', help: 'How to use Myco', account: 'Account', rename: 'Garden name', sharing: 'Share garden', calendar: t('location.calendar') };

  return (
    <Sheet key={panel} title={titles[panel]} onClose={close}>
      {panel === 'garden' && !readOnly && <GardenDimensionsForm dimensions={layout.dimensions} onApply={(dimensions) => {
        const error = layout.applyDimensions(dimensions);
        if (!error) close();
        return error;
      }} />}
      {panel === 'beds' && <BedsList beds={layout.beds} selectedBedId={selectedBedId}
        onEdit={onEditBed} readOnly={readOnly} editableBedId={bedScope} />}
      {panel === 'add' && !readOnly && <BedForm onSave={(details) => {
          const error = layout.saveBed(details);
          if (!error) close();
          return error;
        }} />}
      {panel === 'actions' && (
        <div className="space-y-3">
          {!historyDraft && <Button variant="secondary" onClick={onChooseGardens}>Your gardens</Button>}
          <Button variant="secondary" onClick={() => onPanelChange('calendar')}>{t('location.calendar')}</Button>
          <Button variant="secondary" onClick={() => onPanelChange('help')}>Help</Button>
          {!readOnly && !bedScope && <div className="lg:hidden [@media(pointer:coarse)]:block">
            <BedTouchActions bed={selected} clipboard={clipboard}
              onEdit={() => { if (selected) onEditBed(selected.id); }} onDelete={onDelete} onClose={close} />
          </div>}
        </div>
      )}
      {panel === 'edit-garden' && <div className="space-y-3">
        {!historyDraft && <Button variant="secondary" onClick={() => onPanelChange('sharing')}>Share garden</Button>}
        <Button variant="secondary" disabled={readOnly} onClick={() => onPanelChange('rename')}>Rename garden</Button>
        <Button variant="secondary" disabled={readOnly} onClick={() => onPanelChange('garden')}>Garden size</Button>
        {onLocation && <Button variant="secondary" disabled={readOnly} onClick={onLocation}>{t('location.title')}</Button>}
      </div>}
      {panel === 'recap' && <GardenRecap garden={layout} />}
      {panel === 'help' && <GardenHelp />}
      {panel === 'account' && <AccountPanel user={user} beforeSignOut={beforeSignOut} />}
      {panel === 'sharing' && <GardenSharingPanel gardenId={gardenId} isOwner={ownerId === user.id} />}
      {panel === 'calendar' && <GardenCalendarGuidance userId={user.id} location={location} />}
      {panel === 'rename' && !readOnly && <GardenNameForm name={layout.name} onSave={(name) => {
        const error = layout.renameGarden(name); if (!error) close(); return error;
      }} />}
    </Sheet>
  );
}
