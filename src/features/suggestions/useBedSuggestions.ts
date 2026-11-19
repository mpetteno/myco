import { useEffect, useMemo, useState } from 'react';
import type { GardenLocation } from '../gardens/gardenLocation';
import { loadReferenceData } from '../catalogue-reference/referenceRepository';
import type { ReferenceData } from '../catalogue-reference/referenceModel';
import { loadSuggestionHistory } from '../history/historyRepository';
import type { GardenEventSnapshot } from '../history/gardenHistory';
import { dayKey, parseDay } from '../history/gardenHistory';
import { groundHistory } from './groundHistory';
import { suggest } from './suggestionEngine';
import type { SuggestionInput } from './suggestionEngine';

export type SuggestionContext = { gardenId: string; location?: GardenLocation; enabled: boolean; revision: string };
export function useBedSuggestions(userId: string, context: SuggestionContext | undefined,
  input: Omit<SuggestionInput, 'date' | 'location' | 'references' | 'history' | 'catalogue'> & { catalogue: SuggestionInput['catalogue'] | null }, referenceAttempt: number) {
  const [today, setToday] = useState(dayKey), [override, setOverride] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0), [focusVersion, setFocusVersion] = useState(0);
  const [state, setState] = useState<{ key: string; loading: boolean; references: ReferenceData | null;
    events: GardenEventSnapshot[] | null; referenceError: boolean; historyError: boolean } | null>(null);
  const enabled = !!context?.enabled, gardenId = context?.gardenId;
  const key = `${userId}:${gardenId}:${context?.revision}:${attempt}:${referenceAttempt}:${focusVersion}:${enabled}`;
  useEffect(() => {
    if (!enabled) return;
    let timeout: ReturnType<typeof setTimeout>;
    function tick() {
      setToday(dayKey());
      const next = new Date(); next.setHours(24, 0, 0, 0);
      timeout = setTimeout(tick, Math.max(1, next.getTime() - Date.now()));
    }
    function focus() { setToday(dayKey()); setFocusVersion((v) => v + 1); }
    tick(); window.addEventListener('focus', focus);
    return () => { clearTimeout(timeout); window.removeEventListener('focus', focus); };
  }, [enabled]);
  useEffect(() => { setOverride(null); }, [gardenId]);
  useEffect(() => {
    if (!enabled || !gardenId) return;
    let alive = true;
    setState({ key, loading: true, references: null, events: null, referenceError: false, historyError: false });
    void Promise.allSettled([loadReferenceData(userId), loadSuggestionHistory(gardenId)]).then(([references, history]) => {
      if (!alive) return;
      setState({ key, loading: false, references: references.status === 'fulfilled' ? references.value : null,
        events: history.status === 'fulfilled' ? history.value : null, referenceError: references.status === 'rejected', historyError: history.status === 'rejected' });
    });
    return () => { alive = false; };
  }, [enabled, gardenId, userId, key]);
  const date = override ?? today;
  const validState = state?.key === key ? state : null;
  const normalized = useMemo(() => {
    if (!validState?.events) return { observations: null, failed: false };
    try { return { observations: groundHistory(validState.events, date), failed: false }; }
    catch { return { observations: null, failed: true }; }
  }, [validState?.events, date]);
  const result = useMemo(() => enabled && input.catalogue ? suggest({ ...input, catalogue: input.catalogue,
    date, location: context?.location, references: validState?.references ?? null, history: normalized.observations }) : null,
  [enabled, input.bed, input.plan, input.selectedId, input.catalogue, input.mixtures, date, context?.location, validState?.references, normalized.observations]);
  const summary = useMemo(() => enabled && input.catalogue ? suggest({ ...input, selectedId: null, catalogue: input.catalogue,
    date, location: context?.location, references: validState?.references ?? null, history: normalized.observations }) : null,
  [enabled, input.bed, input.plan, input.catalogue, input.mixtures, date, context?.location, validState?.references, normalized.observations]);
  return { enabled, date, setDate: (value: string) => { if (parseDay(value)) setOverride(value); }, today: () => { setToday(dayKey()); setOverride(null); },
    result, summary, loading: enabled && (!validState || validState.loading), referenceError: validState?.referenceError ?? false,
    historyError: (validState?.historyError ?? false) || normalized.failed, retry: () => setAttempt((n) => n + 1) };
}
