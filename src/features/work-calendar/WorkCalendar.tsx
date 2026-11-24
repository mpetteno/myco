import { useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { SelectField } from '../../shared/ui/SelectField';
import { listGardens, loadGarden } from '../gardens/gardenRepository';
import type { GardenSummary, SavedGarden } from '../gardens/gardenDocument';
import type { useGardenHistory } from '../history/useGardenHistory';
import { TaskWorkPreview } from './TaskWorkFields';
import { dayKey, parseDay } from '../history/gardenHistory';
import { combineWork, filterWork, activityLabels, activityTypes } from './workModel';
import type { GardenTask, WorkEntry, WorkEvent } from './workModel';
import { loadTask, loadWork, taskError } from './taskRepository';
import { WorkMonthGrid } from './WorkMonthGrid';
import { CancelTaskDialog, CompleteTaskDialog, TaskForm } from './TaskDialogs';

type Data = { tasks: GardenTask[]; events: WorkEvent[]; planningAvailable?: boolean; checklistAvailable?: boolean };
type Dialog = { kind: 'edit' | 'complete'; task?: GardenTask; garden: SavedGarden; initialTitle?: string } | { kind: 'cancel'; task: GardenTask };
export function WorkCalendar({ garden, visible, planRequest, onOpenHistory, editor, onFullCalendar }: { garden: SavedGarden; visible: boolean; planRequest?: { title: string; revision: number }; editor?: ReturnType<typeof useGardenHistory>; onFullCalendar?: () => void; onOpenHistory: (entry: WorkEntry) => Promise<void> }) {
  const [scope, setScope] = useState('current'), [selected, setSelected] = useState<string[]>([garden.id]);
  const [gardens, setGardens] = useState<GardenSummary[]>([garden]), [newGardenId, setNewGardenId] = useState(garden.id);
  const [bed, setBed] = useState(''), [status, setStatus] = useState(''), [activity, setActivity] = useState('');
  const [month, setMonth] = useState(() => dayKey().slice(0, 7)), [day, setDay] = useState(''), [allDates, setAllDates] = useState(false);
  const [today, setToday] = useState(dayKey), [refresh, setRefresh] = useState(0), [data, setData] = useState<Data>({ tasks: [], events: [] });
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [filtersOpen,setFiltersOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(), [opening, setOpening] = useState(false);
  const generation = useRef(0), openingBusy = useRef(false), alive = useRef(true);
  const visibleRef = useRef(visible); visibleRef.current = visible;
  const lastPlanRequest = useRef<number>(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const ids = scope === 'all' ? gardens.map(item => item.id) : scope === 'selected' ? selected : [garden.id];
  const selectedKey = selected.join(',');
  const historyRevision = editor ? JSON.stringify(editor.events.map(event => [event.id, event.eventVersion, event.date, event.title, event.notes])) : '';
  useEffect(() => { if (editor && !editor.current) { setDay(editor.date); setMonth(editor.date.slice(0, 7)); setAllDates(false); } }, [editor?.date, editor?.current, editor?.selected?.id]);
  useEffect(() => {
    if (!visible) return;
    const tick = () => setToday(dayKey());
    const timer = window.setInterval(tick, 30000); window.addEventListener('focus', tick); tick();
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); };
  }, [visible]);
  useEffect(() => {
    if (!visible || !planRequest || planRequest.revision === lastPlanRequest.current || data.planningAvailable === undefined || loading) return;
    lastPlanRequest.current = planRequest.revision;
    if (!data.planningAvailable) { setError('Dated planning is not available yet. Completed history remains available.'); return; }
    setNewGardenId(garden.id);
    void open('edit', undefined, planRequest.title, garden.id);
  }, [visible, planRequest, loading, data.planningAvailable]);
  useEffect(() => {
    if (!visible) return;
    const token = ++generation.current; let active = true;
    setLoading(true); setError(''); setData({ tasks: [], events: [] });
    void (async () => {
      try {
        const available = editor ? [garden] : await listGardens();
        const chosen = scope === 'all' ? available.map(item => item.id) : scope === 'selected' ? selectedKey.split(',').filter(Boolean) : [garden.id];
        if (chosen.some(id => !available.some(item => item.id === id))) throw Error('A selected garden is no longer available. Refresh your garden selection.');
        const result = await loadWork(chosen);
        if (active && token === generation.current) { setGardens(available); setData({ ...result, planningAvailable: result.planningAvailable ?? true, checklistAvailable: result.checklistAvailable ?? true }); }
      } catch (problem) { if (active && token === generation.current) setError(problem instanceof Error ? problem.message : taskError(problem).message); }
      finally { if (active && token === generation.current) setLoading(false); }
    })();
    return () => { active = false; };
  }, [garden.id, scope, selectedKey, refresh, visible, historyRevision]);
  const events = editor && !editor.loading && !editor.error ? [...data.events.filter(event => event.deleted), ...editor.events.map(event => ({ ...event, deleted: false,
    bedName: data.events.find(item => item.id === event.id)?.bedName ?? garden.beds.find(bed => bed.id === event.bedId)?.name }))] : data.events;
  const entries = combineWork(data.tasks, events, today).filter(entry => !editor?.bedId || !entry.bedId || entry.bedId === editor.bedId);
  const baseFilters = { gardenIds: ids, bed, status, activity, month, day: '', allDates: true };
  const filtered = filterWork(entries, { ...baseFilters, day, allDates });
  const calendarEntries = filterWork(entries, baseFilters);
  const bedChoices = [...new Map(entries.filter(entry => entry.bedId && ids.includes(entry.gardenId)).map(entry => [`${entry.gardenId}:${entry.bedId}`, entry])).entries()];
  const gardenName = (id: string) => id === garden.id ? garden.name : gardens.find(item => item.id === id)?.name ?? 'Unavailable garden';
  async function open(kind: 'edit' | 'complete', task?: GardenTask, initialTitle?: string, forcedGardenId?: string) {
    if (openingBusy.current) return;
    openingBusy.current = true; setOpening(true); setError(''); setMessage('');
    try {
      const saved = await loadGarden(task?.gardenId ?? forcedGardenId ?? newGardenId);
      if (kind === 'complete' && task?.bedId && !saved.beds.some(bed => bed.id === task.bedId)) throw Error('This bed is no longer in the garden. Edit the task scope or cancel the task.');
      if (alive.current && visibleRef.current) setDialog({ kind, task, garden: saved, initialTitle });
    } catch (problem) { if (alive.current) setError(problem instanceof Error ? problem.message : taskError(problem).message); }
    finally { openingBusy.current = false; if (alive.current) setOpening(false); }
  }
  function saved(task: GardenTask) {
    setDialog(undefined); setMessage(task.status === 'completed' ? 'Completion recorded.' : task.status === 'cancelled' ? 'Task cancelled.' : `Task saved for ${task.plannedDate}.`);
    setData(current => ({ ...current, tasks: [...current.tasks.filter(item => item.id !== task.id), task] }));
    setRefresh(value => value + 1);
    if (editor) void editor.refresh();
  }
  async function history(entry: WorkEntry) {
    if (openingBusy.current) return; openingBusy.current = true; setOpening(true); setError('');
    try { await onOpenHistory(entry); } catch (problem) { if (alive.current) setError(taskError(problem).message); }
    finally { openingBusy.current = false; if (alive.current) setOpening(false); }
  }
  const disabled = opening || !!editor?.loading || !!editor?.saving;
  const unavailable = data.planningAvailable === false ? <p role="status" className="text-xs text-stone-600 dark:text-stone-400">Dated planning is not available yet. Completed history is available.</p> : null;
  const planning = <div className={`grid items-end gap-3 ${editor ? '' : 'sm:grid-cols-[1fr_auto]'}`}>
      {!editor && <SelectField id="new-task-garden" label="Plan activity in" value={newGardenId} onChange={e => setNewGardenId(e.target.value)}>
        {gardens.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </SelectField>}
      <Button disabled={disabled || loading || data.planningAvailable === false || !gardens.some(item => item.id === newGardenId)} onClick={() => void open('edit')}>Plan activity</Button>
    </div>;
  const filters = <div className={`grid gap-3 ${editor ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>

      {!editor && <SelectField id="work-gardens" label="Gardens" value={scope} onChange={e => { setScope(e.target.value); setBed(''); }}>
        <option value="current">Current garden</option><option value="selected">Selected gardens</option><option value="all">All accessible gardens</option>
      </SelectField>}
      {!editor?.bedId && <SelectField id="work-bed" label="Bed" value={bed} onChange={e => setBed(e.target.value)}><option value="">All beds and garden work</option>
        {bedChoices.map(([key, entry]) => <option key={key} value={key}>{gardenName(entry.gardenId)} · {entry.bedName ?? garden.beds.find(item => item.id === entry.bedId)?.name ?? 'Recorded bed'}</option>)}
      </SelectField>}
      <SelectField id="work-status" label="Status" value={status} onChange={e => { setStatus(e.target.value); setDay(''); if (e.target.value === 'overdue') setAllDates(true); }}>
        <option value="">Planned and completed</option>{['planned','overdue','completed','cancelled'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
      </SelectField>
      <SelectField id="work-type" label="Activity" value={activity} onChange={e => setActivity(e.target.value)}><option value="">All activities</option>{activityTypes.map(type => <option key={type} value={type}>{activityLabels[type]}</option>)}</SelectField>
    </div>;
  const refreshWork = () => { setRefresh(value=>value+1); if (editor) void editor.refresh(); };
  const rangeLabel = day ? parseDay(day)!.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) : allDates ? 'All dates' : parseDay(`${month}-01`)!.toLocaleDateString(undefined,{month:'long',year:'numeric',timeZone:'UTC'});
  return <div className="space-y-4">
    {editor&&<section aria-label="Calendar commands" className="space-y-3 border-b border-stone-200 pb-3 dark:border-stone-700">
      <div className={`grid ${onFullCalendar?'grid-cols-[minmax(0,1fr)_auto_auto_auto]':'grid-cols-[minmax(0,1fr)_auto_auto]'} items-center gap-2`}>
        {planning}
        <button type="button" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(value=>!value)} className="min-h-11 cursor-pointer rounded-lg border border-stone-300 px-2 text-xs font-medium dark:border-stone-700">Filters</button>
        <button type="button" aria-label="Refresh work calendar" title="Refresh calendar" disabled={loading||disabled} onClick={refreshWork} className="min-h-11 min-w-11 cursor-pointer rounded-lg border border-stone-300 text-lg disabled:opacity-40 dark:border-stone-700">↻</button>
        {onFullCalendar?<button type="button" aria-label="Open full calendar" title="Open full calendar" disabled={disabled} onClick={onFullCalendar} className="min-h-11 min-w-11 cursor-pointer rounded-lg border border-stone-300 text-lg disabled:opacity-40 dark:border-stone-700">⤢</button>:null}
      </div>
      {filtersOpen&&filters}
      {unavailable}
    </section>}
    {!editor && planning}
    {!editor && unavailable}
    {!editor && filters}
    {!editor && scope === 'selected' && <fieldset className="flex flex-wrap gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700"><legend className="text-sm font-medium">Choose gardens</legend>{gardens.map(item => <label key={item.id} className="flex min-h-11 items-center min-w-0 gap-2 text-sm">
      <input className="shrink-0" type="checkbox" checked={selected.includes(item.id)} onChange={e => { setSelected(current => e.target.checked ? [...current, item.id] : current.filter(id => id !== item.id)); setBed(''); }} /><span className="min-w-0 break-words">{item.name}</span>
    </label>)}</fieldset>}
    {message && <p role="status" className="text-sm text-green-800 dark:text-green-300">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
    {loading && <p role="status" className="text-sm">Loading calendar…</p>}
    {!ids.length && <p className="text-sm">Choose at least one garden.</p>}
    <div className={`grid items-start gap-4 ${editor ? '' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'}`}>
      <WorkMonthGrid compact={!!editor} disabled={!!editor?.saving} month={month} day={day} entries={calendarEntries} onMonth={value => { setMonth(value); setDay(''); setAllDates(false); }} onDay={value => { setDay(value); setMonth(value.slice(0, 7)); setAllDates(false); if (editor) void editor.selectDate(value); }} onToday={() => { setMonth(today.slice(0, 7)); setDay(today); setAllDates(false); if (editor) void editor.selectDate(today); }} />
      <section aria-label="Work agenda" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2"><div className="mr-auto min-w-0"><h2 className="font-semibold">Activities</h2><p className="text-xs text-stone-500">{rangeLabel} · {filtered.length} {filtered.length===1?'activity':'activities'}</p></div>
          <button type="button" className="min-h-11 cursor-pointer rounded-lg px-2 text-xs font-medium underline" aria-pressed={!day&&!allDates} onClick={() => { setDay(''); setAllDates(false); }}>Whole month</button>
          <button type="button" className="min-h-11 cursor-pointer rounded-lg px-2 text-xs font-medium underline" aria-pressed={allDates} onClick={() => { setDay(''); setAllDates(true); }}>All dates</button>
        </div>
        {!loading && !error && !filtered.length && <p className="text-sm">No matching activities. Plan work or change the filters.</p>}
        <ul className="space-y-3">{filtered.map(entry => <li key={entry.id} className="min-w-0 space-y-2 rounded-xl border border-stone-200 bg-white p-3 text-sm dark:border-stone-700 dark:bg-stone-900">
          <h3 className="break-words font-semibold">{entry.title}</h3>
          <p className={`font-medium ${entry.status === 'overdue' ? 'text-red-700 dark:text-red-300' : entry.status === 'completed' ? 'text-green-800 dark:text-green-300' : entry.status === 'planned' ? 'text-amber-800 dark:text-amber-300' : 'text-stone-500'}`}>{entry.status[0].toUpperCase() + entry.status.slice(1)} · {entry.date} · {activityLabels[entry.activityType]}{(entry.event?.eventVersion ?? 1) > 1 && ' · Corrected'}</p>
          <p className="break-words">{gardenName(entry.gardenId)} · {entry.bedName ?? (entry.bedId ? 'Recorded bed' : 'Whole garden')}</p>
          {entry.status === 'completed' && entry.plannedDate && <p className="text-xs text-stone-500">Planned for {entry.plannedDate}</p>}
          {entry.notes && <p className="whitespace-pre-wrap break-words">{entry.notes}</p>}
          {entry.task&&<TaskWorkPreview work={entry.task} />}
          {entry.historyRemoved && !loading && !editor?.loading && !editor?.error && <p className="text-xs text-stone-500">Linked history record was removed.</p>}
          {entry.event && <Button variant="secondary" aria-label={editor ? `View completed event: ${entry.title}` : undefined} aria-pressed={editor ? !editor.current && editor.selected?.id === entry.event.id : undefined} disabled={disabled} onClick={() => void history(entry)}>{editor ? 'View record' : 'Open history'}</Button>}
          {entry.task?.status === 'planned' && <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-700"><div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={disabled} onClick={() => void open('edit', entry.task)}>Edit task</Button>
            <Button disabled={disabled} onClick={() => void open('complete', entry.task)}>Record completion</Button>
            </div><details><summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-stone-500">Task options</summary>
              <Button variant="danger" disabled={disabled} onClick={() => setDialog({ kind: 'cancel', task: entry.task! })}>Cancel task</Button>
            </details>
          </div>}
        </li>)}</ul>
      </section>
    </div>
    {!editor&&<nav aria-label="Calendar navigation" className="space-y-2 border-t border-stone-200 pt-3 dark:border-stone-700">
      {!editor&&<Button variant="secondary" disabled={loading||disabled} onClick={refreshWork}>Refresh work calendar</Button>}
      {!editor&&onFullCalendar&&<Button variant="secondary" disabled={disabled} onClick={onFullCalendar}>Open full calendar</Button>}
    </nav>}
    {dialog?.kind === 'edit' && <TaskForm key={dialog.task?.id ?? `new:${dialog.garden.id}`} garden={dialog.garden} task={dialog.task} initialBedId={editor?.bedId} checklistAvailable={data.checklistAvailable!==false} initialTitle={dialog.initialTitle} initialDate={day || today} onSaved={saved} onClose={() => setDialog(undefined)} />}
    {dialog?.kind === 'complete' && dialog.task && <CompleteTaskDialog task={dialog.task} initialGarden={dialog.garden} onSaved={saved} onClose={() => setDialog(undefined)} onReload={async () => {
      const task = await loadTask(dialog.task!.id); if (task.status !== 'planned') throw Error('This task is no longer planned. Close and refresh the calendar.');
      const garden = await loadGarden(task.gardenId); if (task.bedId && !garden.beds.some(bed => bed.id === task.bedId)) throw Error('The task bed no longer exists. Edit its scope or cancel it.');
      return { task, garden };
    }} />}
    {dialog?.kind === 'cancel' && <CancelTaskDialog task={dialog.task} onSaved={saved} onClose={() => setDialog(undefined)} />}
  </div>;
}
