import { useI18n } from '../../shared/i18n/I18nProvider';
import { loadHistoryAtDate, deleteHistoryEntry } from './historyEditingRepository';
import type { HistoryDraft } from './historyDraft';
import { historyDocument } from './historyDraft';
import { useEffect, useRef, useState } from 'react';
import type { SavedGarden } from '../gardens/gardenDocument';
import { dayKey, eventNeighbours, eventOnDate, compareEvents } from './gardenHistory';
import type { GardenEvent, GardenEventDetails, GardenEventSnapshot } from './gardenHistory';
import { historyError, listGardenEvents, loadGardenEvent, recordGardenEvent } from './historyRepository';
import { GardenStorageError } from '../gardens/gardenErrors';
import { recordCompletedActivity } from '../activities/activityRepository';
import type { ActivityDetails } from '../activities/activities';

export function useGardenHistory(gardenId: string, beforeViewing: () => Promise<string | null>, getCurrent: () => SavedGarden, bedId?: string) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false), [inspector, setInspector] = useState(false), [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<GardenEvent[]>([]), [date, setDate] = useState(dayKey);
  const [current, setCurrent] = useState(true), [selected, setSelected] = useState<GardenEventSnapshot | null>(null);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activityForm, setActivityForm] = useState(false);
  const [deleting, setDeleting] = useState<{ event: GardenEvent; requestId: string } | null>(null);
  const [editingHistory, setEditingHistory] = useState<HistoryDraft | null>(null);
  const scoped = (items: GardenEvent[]) => bedId ? items.filter((event) => event.status !== 'planned' && (!event.bedId || event.bedId === bedId)) : items.filter((event) => event.status !== 'planned');
  const request = useRef(0), alive = useRef(true), busy = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current++; }; }, []);
  const neighbours = eventNeighbours(events, selected?.id ?? null, date, current);
  async function refresh() {
    const token = ++request.current;
    setLoading(true); setError('');
    try {
      const problem = await beforeViewing();
      if (problem) throw new GardenStorageError(problem);
      const next = await listGardenEvents(gardenId);
      if (alive.current && token === request.current) setEvents(scoped(next));
    } catch (problem) { if (alive.current && token === request.current) setError(historyError(problem).message); }
    finally { if (alive.current && token === request.current) setLoading(false); }
  }
  async function show() {
    setOpen(true); setInspector(true); setRecording(false); setActivityForm(false); await refresh();
  }
  async function select(event: GardenEvent | null, chosenDate = event?.date || date) {
    const token = ++request.current;
    setDeleting(null); setCurrent(false); setSelected(null); setDate(chosenDate); setError(''); setMessage(''); setLoading(true);
    try {
      const problem = await beforeViewing();
      if (problem) throw new GardenStorageError(problem);
      const next = event ? await loadGardenEvent(gardenId, event.id) : null;
      if (alive.current && token === request.current) setSelected(next);
    } catch (problem) { if (alive.current && token === request.current) setError(historyError(problem).message); }
    finally { if (alive.current && token === request.current) setLoading(false); }
  }
  function today() { request.current++; setDeleting(null); setCurrent(true); setSelected(null); setDate(dayKey()); setLoading(false); setError(''); setRecording(false); setActivityForm(false); }
  async function commitActivity(details: ActivityDetails, id: string) {
    if (busy.current) return;
    busy.current = true; setSaving(true);
    try {
      const problem = await beforeViewing();
      if (problem) throw new GardenStorageError(problem);
      const latest = getCurrent();
      await recordCompletedActivity(gardenId, latest.version, details, id);
      const items = await listGardenEvents(gardenId);
      if (!alive.current) return;
      setEvents(scoped(items)); today(); setMessage(t('record.bedSaved'));
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  }
  async function removeHistoryEntry() {
    if (busy.current || !deleting) return;
    busy.current = true; setSaving(true); setError('');
    try {
      const problem = await beforeViewing();
      if (problem) throw new GardenStorageError(problem);
      await deleteHistoryEntry(gardenId, deleting.event.id, deleting.event.eventVersion ?? 1, deleting.requestId);
      if (!alive.current) return;
      const remaining = events.filter((event) => event.id !== deleting.event.id);
      setEvents(remaining); setDeleting(null);
      await select(eventOnDate(remaining, date), date);
      if (alive.current) setMessage('History entry deleted. Later records and the current plan are unchanged.');
    } catch (problem) { if (alive.current) setError(historyError(problem).message); }
    finally { busy.current = false; if (alive.current) setSaving(false); }
  }
  async function save(details: GardenEventDetails, requestId: string) {
    if (busy.current) return;
    busy.current = true; setSaving(true);
    try {
      const problem = await beforeViewing();
      if (problem) throw new GardenStorageError(problem);
      const latest = getCurrent();
      const event = await recordGardenEvent(gardenId, latest.version, details, requestId);
      if (!alive.current) return;
      setEvents((items) => [...items.filter((item) => item.id !== event.id), event].sort(compareEvents));
      setRecording(false); setMessage(t('record.gardenSaved'));
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  }
  async function startHistoryEdit(editExisting = false) {
    if (busy.current) return;
    busy.current = true; const token = ++request.current; setLoading(true); setError('');
    try {
      const problem = await beforeViewing();
      if (problem) throw new GardenStorageError(problem);
      if (editExisting) {
        if (!selected || selected.status === 'planned') return;
        const event = await loadGardenEvent(gardenId, selected.id);
        if (!alive.current || token !== request.current) return;
        setEditingHistory({ event, document: structuredClone(event.document), kind: event.kind ?? 'layout',
          bedId: event.bedId, details: { date: event.date, title: event.title, notes: event.notes } });
      } else {
        const base = await loadHistoryAtDate(gardenId, date);
        const live = getCurrent();
        const document = structuredClone(base?.document ?? (bedId ? { name: live.name, dimensions: live.dimensions, beds: [] } : historyDocument(live)));
        if (bedId && !document.beds.some((bed) => bed.id === bedId)) {
          const bed = live.beds.find((item) => item.id === bedId);
          if (!bed) throw new GardenStorageError('This bed is unavailable. Add it through a past garden edit instead.');
          document.beds.push(structuredClone(bed));
          document.dimensions.widthCm = Math.max(document.dimensions.widthCm, bed.xCm + bed.widthCm);
          document.dimensions.lengthCm = Math.max(document.dimensions.lengthCm, bed.yCm + bed.lengthCm);
        }
        if (!alive.current || token !== request.current) return;
        setEditingHistory({ document: historyDocument(document), basis: base ? `Starting from the recorded state on ${base.date}.` : bedId ? 'No earlier record: this draft starts from the selected current bed.' : 'No earlier record: this draft starts from the current plan. Review it to match the past.', kind: bedId ? 'bed' : 'layout', bedId,
          details: { date, title: bedId ? 'Past bed edit' : 'Past garden edit', notes: '' } });
      }
    } catch (problem) { if (alive.current && token === request.current) setError(historyError(problem).message); }
    finally { busy.current = false; if (alive.current && token === request.current) setLoading(false); }
  }
  async function reloadHistoryEdit() {
    if (!editingHistory?.event) return;
    const event = await loadGardenEvent(gardenId, editingHistory.event.id);
    setEditingHistory({ event, document: structuredClone(event.document), kind: event.kind ?? 'layout', bedId: event.bedId,
      details: { date: event.date, title: event.title, notes: event.notes } });
  }
  function historyEdited(event: GardenEventSnapshot) {
    setEvents((items) => scoped([...items.filter((item) => item.id !== event.id), event]).sort(compareEvents));
    setSelected(event); setDate(event.date); setCurrent(false); setEditingHistory(null);
    setMessage('History record saved. Later records and the current plan are unchanged.');
  }
  return { open, inspector, setInspector, recording, setRecording, events, date, current, selected, loading, saving, error, message,
    bedId, getCurrent, editingHistory, startHistoryEdit, reloadHistoryEdit, historyEdited, closeHistoryEdit: () => setEditingHistory(null), activityForm, setActivityForm, commitActivity, deleting, setDeleting, removeHistoryEntry,
    neighbours, show, refresh, select, selectDate: (value: string) => select(eventOnDate(events, value), value), today, save,
    close: () => { today(); setOpen(false); setInspector(false); } };
}
