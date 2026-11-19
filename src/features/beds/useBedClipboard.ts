import { useState } from 'react';
import type { Bed, BedCopy } from './bed';
import { useEditorShortcuts } from '../../shared/keyboard/useEditorShortcuts';

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
    const { name, widthCm, lengthCm, areaPlan, plantingPlan, mulchPlan } = selectedBed;
    setCopiedBed({ name, widthCm, lengthCm, ...(areaPlan ? { areaPlan: structuredClone(areaPlan) } : {}), ...(plantingPlan ? { plantingPlan: structuredClone(plantingPlan) } : {}),
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

  useEditorShortcuts({ enabled, onCopy: selectedBed ? copy : undefined, onPaste: copiedBed ? paste : undefined });

  return { feedback, copy, paste, canCopy: !!selectedBed, canPaste: !!copiedBed };
}

export type BedClipboard = ReturnType<typeof useBedClipboard>;
