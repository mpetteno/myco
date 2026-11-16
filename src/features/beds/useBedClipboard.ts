import { useEffect, useState } from 'react';
import type { Bed, BedCopy } from './bed';
import { isTextEditingEvent } from '../../shared/keyboard/isTextEditingEvent';

type BedClipboardOptions = {
  selectedBed?: Bed;
  onPaste: (copied: BedCopy) => Bed | null;
  onSelect: (id: string) => void;
  enabled?: boolean;
};

export type BedClipboardFeedback = { text: string; error: boolean };

export function useBedClipboard({ selectedBed, onPaste, onSelect, enabled = true }: BedClipboardOptions) {
  const [copiedBed, setCopiedBed] = useState<BedCopy | null>(null);
  const [feedback, setFeedback] = useState({ text: '', error: false });

  function copy() {
    if (!selectedBed) return;
    const { name, widthCm, lengthCm, plantingPlan, mulchPlan } = selectedBed;
    setCopiedBed({ name, widthCm, lengthCm, ...(plantingPlan ? { plantingPlan: structuredClone(plantingPlan) } : {}),
      ...(mulchPlan ? { mulchPlan: structuredClone(mulchPlan) } : {}) });
    setFeedback({ text: `Copied “${name}”.`, error: false });
  }

  function paste() {
    if (!copiedBed) return false;
    const pasted = onPaste(copiedBed);
    if (!pasted) {
      setFeedback({ text: 'No free space fits this copy. Enlarge the garden or copy a smaller bed.', error: true });
      return false;
    }
    onSelect(pasted.id);
    setFeedback({ text: `Added “${pasted.name}”: ${pasted.widthCm} × ${pasted.lengthCm} cm.`, error: false });
    return true;
  }

  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.shiftKey
        || !(event.ctrlKey || event.metaKey)) return;
      // Preserve normal text editing and copying in browser form fields.
      if (isTextEditingEvent(event)) return;
      const key = event.key.toLowerCase();
      if (key === 'c' && selectedBed && !window.getSelection()?.toString()) {
        event.preventDefault();
        copy();
      } else if (key === 'v' && copiedBed) {
        event.preventDefault();
        paste();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBed, copiedBed, onPaste, onSelect, enabled]);

  return { feedback, copy, paste, canCopy: !!selectedBed, canPaste: !!copiedBed };
}

export type BedClipboard = ReturnType<typeof useBedClipboard>;
