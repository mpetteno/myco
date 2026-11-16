import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bed, BedPlans } from '../beds/bed';
import { usePlantingDraft } from '../planting/usePlantingDraft';
import { previewPlanting } from '../planting/plantingGeometry';
import { planAdvice } from '../planting/plantingAdvice';
import { bedPlanDraftKey } from './bedEditorDraft';
import { gardenStorageError } from '../gardens/gardenErrors';
import { useMulchDraft } from '../mulch/useMulchDraft';
import { validateMulchPlan } from '../mulch/mulchPlan';
import { editablePlantingPlan } from '../planting/plantingPlan';

type BedEditorOptions = { bed: Bed; userId: string; onSavePlan: (plans: BedPlans) => string | null;
  beforeLeaving: () => Promise<string | null>; onBack: () => void; preserveFormat?: boolean };

export function useBedEditor({ bed, userId, onSavePlan, beforeLeaving, onBack, preserveFormat = false }: BedEditorOptions) {
  const draft = usePlantingDraft(bed, userId, preserveFormat);
  const mulch = useMulchDraft(bed, userId);
  const [savedKey, setSavedKey] = useState(() => bedPlanDraftKey({ plantingPlan: draft.plan, mulchPlan: mulch.plan }));
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const busy = useRef(false);
  const draftKey = bedPlanDraftKey({ plantingPlan: draft.plan, mulchPlan: mulch.plan });
  const dirty = draftKey !== savedKey;
  const lastAutoAttempt = useRef<string | null>(null);
  const preview = useMemo(() => previewPlanting({ ...draft.plan, advice: [] }, bed), [draft.plan, bed]);
  const advice = useMemo(() => draft.catalogue ? planAdvice(draft.plan, draft.catalogue) : draft.plan.advice,
    [draft.plan, draft.catalogue]);
  const mulchError = mulch.plan.areas.length ? validateMulchPlan(mulch.plan, bed) : null;
  const canSave = (!draft.plan.areas.length || (!preview.error && preview.points.length > 0)) && !mulchError;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function savePlan() {
    const plan = draft.plan.areas.length ? { ...draft.plan, advice } : undefined;
    const error = plan && (preview.error || (!preview.points.length ? 'No plants fit these areas.' : null));
    const plans = { plantingPlan: plan, mulchPlan: mulch.plan.areas.length ? mulch.plan : undefined };
    const problem = error || mulchError || onSavePlan(plans);
    draft.setError(problem ?? '');
    if (problem) return false;
    setSavedKey(bedPlanDraftKey(plans));
    return true;
  }
  useEffect(() => {
    if (!dirty || !canSave || lastAutoAttempt.current === draftKey) return;
    // Queue committed edits immediately; the persistence queue coalesces changes
    // while a request is running. Invalid intermediate fields stay editable.
    lastAutoAttempt.current = draftKey;
    savePlan();
  });
  async function returnToGarden() {
    if (busy.current) return;
    busy.current = true; setLeaving(true);
    try {
      const error = await beforeLeaving();
      if (error) draft.setError(error); else onBack();
    } catch (problem) { draft.setError(gardenStorageError(problem).message); }
    finally { busy.current = false; setLeaving(false); }
  }
  function back() { if (dirty) setConfirmLeave(true); else void returnToGarden(); }
  function discardDraft() {
    resetFromBed(bed);
  }
  function resetFromBed(next: Bed) {
    draft.resetPlan(next.plantingPlan); mulch.resetPlan(next.mulchPlan);
    setSavedKey(bedPlanDraftKey({ plantingPlan: editablePlantingPlan(next, next.plantingPlan, preserveFormat), mulchPlan: next.mulchPlan }));
    lastAutoAttempt.current = null;
  }
  function discardAndBack() {
    discardDraft();
    setConfirmLeave(false); void returnToGarden();
  }
  function clearPlan() {
    draft.resetPlan();
  }
  return { draft, mulch, mulchError, dirty, preview, advice, leaving, confirmLeave, setConfirmLeave,
    back, discardAndBack, discardDraft, resetFromBed, clearPlan };
}
