import { useEffect } from 'react';
import { isTextEditingEvent } from './isTextEditingEvent';

type EditorShortcuts = {
  enabled?: boolean;
  onCopy?: () => void;
  onPaste?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
};

export function useEditorShortcuts({ enabled = true, onCopy, onPaste, onUndo, onRedo }: EditorShortcuts) {
  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey
        || !(event.ctrlKey || event.metaKey) || isTextEditingEvent(event)
        || document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      let action: (() => void) | undefined;
      if (key === 'z') action = event.shiftKey ? onRedo : onUndo;
      else if (key === 'y' && !event.shiftKey) action = onRedo;
      else if (key === 'c' && !event.shiftKey && !window.getSelection()?.toString()) action = onCopy;
      else if (key === 'v' && !event.shiftKey) action = onPaste;
      if (!action) return;
      event.preventDefault();
      action();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onCopy, onPaste, onUndo, onRedo]);
}
