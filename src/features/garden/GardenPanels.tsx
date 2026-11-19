import { useWorkspaceNavigation } from '../../shared/navigation/WorkspaceNavigation';
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
  onHistory?: () => void;
  gardenId: string;
  ownerId: string;
  onEditBed: (id: string) => void;
  onLocation?: () => void; location?: GardenLocation;
  readOnly?: boolean; historyDraft?: boolean; bedScope?: string;
};

export function GardenPanels({ panel, onPanelChange, layout, selectedBedId, clipboard, onDelete, user, beforeSignOut, onChooseGardens, onHistory, gardenId, ownerId, onEditBed, onLocation, location, historyDraft = false, bedScope, readOnly = false }: GardenPanelsProps) {
  const { t } = useI18n();
  const navigation = useWorkspaceNavigation();
  if (!panel) return null;
  const selected = layout.beds.find((bed) => bed.id === selectedBedId);
  const close = () => onPanelChange(null);
  const titles = { garden: 'Garden size', 'edit-garden': 'Garden settings', recap: 'Garden summary', beds: `Beds (${layout.beds.length})`, add: 'Add bed', actions: 'More garden tools', help: 'How to use Myco', account: 'Account', rename: 'Garden name', sharing: 'Share garden', calendar: t('location.calendar') };

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
        <div className="space-y-5">
          <section aria-label="Garden views and settings" className="space-y-2">
            <h3 className="text-sm font-semibold">Garden</h3>
            {onHistory && <Button variant="secondary" onClick={onHistory}>History</Button>}
            {!bedScope && <Button variant="secondary" onClick={() => onPanelChange('edit-garden')}>Garden settings</Button>}
            {selected && !readOnly && <Button variant="secondary" onClick={() => onPanelChange('recap')}>Summary</Button>}
            {!navigation && <Button variant="secondary" onClick={() => onPanelChange('calendar')}>{t('location.calendar')}</Button>}
          </section>
          {!readOnly && !bedScope && <section aria-label="Bed actions" className="space-y-2 border-t border-stone-200 pt-4 dark:border-stone-700">
            <h3 className="text-sm font-semibold">Bed actions</h3>
            <BedTouchActions hideEdit bed={selected} clipboard={clipboard}
              onEdit={() => { if (selected) onEditBed(selected.id); }} onDelete={onDelete} onClose={close} />
          </section>}
          <section aria-label="Workspace" className="space-y-2 border-t border-stone-200 pt-4 dark:border-stone-700">
            <h3 className="text-sm font-semibold">Workspace</h3>
            {!navigation && !historyDraft && <Button variant="secondary" onClick={onChooseGardens}>Your gardens</Button>}
            {!historyDraft && <Button variant="secondary" onClick={() => onPanelChange('account')}>Account</Button>}
            <Button variant="secondary" onClick={() => onPanelChange('help')}>Help</Button>
          </section>
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
