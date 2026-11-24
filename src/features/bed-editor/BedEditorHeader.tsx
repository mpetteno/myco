import { EditHistoryActions } from '../../shared/ui/EditHistoryActions';
import { WorkspaceNav } from '../../shared/navigation/WorkspaceNavigation';
import { ThemeToggle } from '../appearance/ThemeToggle';
import { useEffect, useRef } from 'react';
import type { Bed } from '../beds/bed';
import type { GardenSaveStatus } from '../gardens/GardenSaveQueue';
import { PlanSaveStatus } from './PlanSaveStatus';
import { PageHeader } from '../../shared/ui/PageHeader';

type BedEditorHeaderProps = { gardenName?: string; bed: Bed; count: number; dirty: boolean; status: GardenSaveStatus;
  leaving: boolean; onBack: () => void; historyDraft?: boolean; readOnly?: boolean; canUndo: boolean; onUndo: () => void; canRedo: boolean; onRedo: () => void };

export function BedEditorHeader({ gardenName, bed, count, dirty, status, leaving, onBack,historyDraft, readOnly, canUndo, onUndo, canRedo, onRedo }: BedEditorHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [bed.id]);
  return <PageHeader title={bed.name} headingRef={heading} back={{ label: 'Back to garden', onClick: onBack, disabled: leaving }}
    subtitle={<>{gardenName && `${gardenName} · `}{bed.widthCm} × {bed.lengthCm} cm · {count} plants</>}
    status={readOnly ? 'History · read only' : historyDraft ? 'History draft' : <PlanSaveStatus status={status} dirty={dirty} compact />}
    actions={<>
    <EditHistoryActions canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} disabled={leaving} />
    <ThemeToggle /><WorkspaceNav />
  </>} />;
}
