import { Button } from '../../shared/ui/Button';
import type { Bed } from './bed';
import type { BedClipboard } from './useBedClipboard';

type BedTouchActionsProps = {
  bed?: Bed;
  clipboard: BedClipboard;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function BedTouchActions({ bed, clipboard, onEdit, onDelete, onClose }: BedTouchActionsProps) {
  return (
    <div className="space-y-3">
      <p className="break-words text-sm text-stone-600 dark:text-stone-400">
        {bed ? `${bed.name} · ${bed.widthCm} × ${bed.lengthCm} cm` : 'Select a bed to edit, copy or delete it.'}
      </p>
      <Button variant="secondary" disabled={!bed} onClick={onEdit}>Edit bed</Button>
      <Button variant="secondary" disabled={!clipboard.canCopy} onClick={() => { clipboard.copy(); onClose(); }}>Copy bed</Button>
      <Button variant="secondary" disabled={!clipboard.canPaste} onClick={() => { if (clipboard.paste()) onClose(); }}>Paste bed</Button>
      <Button variant="danger" disabled={!bed} onClick={onDelete}>Delete bed</Button>
      <p role={clipboard.feedback.error ? 'alert' : 'status'} className="break-words text-sm text-stone-600 empty:hidden dark:text-stone-400">{clipboard.feedback.text}</p>
    </div>
  );
}
