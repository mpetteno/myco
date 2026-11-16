import { useEffect } from 'react';
import { isTextEditingEvent } from '../../shared/keyboard/isTextEditingEvent';

export function useBedDeletion(selectedBedId: string | null, onDelete: (id: string) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (!selectedBedId || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
      if (event.defaultPrevented || event.isComposing || event.repeat
        || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
        || isTextEditingEvent(event)) return;

      event.preventDefault();
      onDelete(selectedBedId);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBedId, onDelete, enabled]);
}
