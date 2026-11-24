import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Sheet } from '../../shared/ui/Sheet';
import { Button } from '../../shared/ui/Button';
import { TextAreaField } from '../../shared/ui/TextAreaField';
import { TaskWorkFields, TaskWorkPreview } from './TaskWorkFields';
import { generateTaskWork } from './taskWork';
import type { TaskWork } from './taskWork';
import { TextField } from '../../shared/ui/TextField';
import { SelectField } from '../../shared/ui/SelectField';
import { useFormLeave, useGuardedBack } from '../../shared/navigation/WorkspaceNavigation';
import type { SavedGarden } from '../gardens/gardenDocument';
import { dayKey, parseDay } from '../history/gardenHistory';
import { completeTask, loadTask, saveTask, taskError } from './taskRepository';
import { loadGarden } from '../gardens/gardenRepository';
import { activityLabels, activityTypes, validateTask } from './workModel';
import type { GardenTask, TaskDetails } from './workModel';

export function TaskForm({ garden, task, initialDate, initialTitle = '', initialBedId = '', checklistAvailable = true, onSaved, onClose }: { garden: SavedGarden; task?: GardenTask; initialDate: string; initialTitle?: string; initialBedId?: string; checklistAvailable?: boolean; onSaved: (task: GardenTask) => void; onClose: () => void }) {
  const [review, setReview] = useState({ garden, task });
  const taskDetails = (value: GardenTask): TaskDetails => ({ gardenId:value.gardenId,bedId:value.bedId,activityType:value.activityType,plannedDate:value.plannedDate,title:value.title,notes:value.notes,
    ...(checklistAvailable ? {workRecap:value.workRecap??'',workItems:value.workItems??[]} : {}) });
  const [initial, setInitial] = useState<TaskDetails>(() => task ? taskDetails(task)
    : { gardenId:garden.id,bedId:initialBedId,activityType:'other',plannedDate:initialDate,title:initialTitle,notes:'',...(checklistAvailable?generateTaskWork(garden,initialBedId,'other'):{}) });
  const [details, setDetails] = useState(initial), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [operation,setOperation] = useState<'save'|'generate'|'reload'>();
  const [conflict, setConflict] = useState(false), [scopeChanged,setScopeChanged] = useState(false);
  const [candidate,setCandidate] = useState<{work:TaskWork;garden:SavedGarden}>();
  const workOf = (value:TaskDetails):TaskWork => ({workRecap:value.workRecap??'',workItems:value.workItems??[]});
  const generated = useRef<string|null>(task?null:JSON.stringify(workOf(initial)));
  const busy = useRef(false), [id] = useState(() => task?.id ?? crypto.randomUUID()), request = useRef({ key: '', id: '' });
  const dirty = JSON.stringify(details) !== JSON.stringify(initial);
  const form = useFormLeave(dirty, pending, submit, () => setDetails(initial));
  const close = useGuardedBack(onClose);
  function change(values: Partial<TaskDetails>) {
    const next = {...details,...values};
    if (checklistAvailable && (values.bedId !== undefined || values.activityType !== undefined)) {
      if (generated.current === JSON.stringify(workOf(details))) {
        const work=generateTaskWork(review.garden,next.bedId,next.activityType);Object.assign(next,work);generated.current=JSON.stringify(work);setScopeChanged(false);
      } else setScopeChanged(true);
      setCandidate(undefined);
    }
    setDetails(next);
  }
  function applyWork(work:TaskWork,garden:SavedGarden) {
    setReview(current=>({...current,garden}));setDetails(current=>({...current,...work}));generated.current=JSON.stringify(work);setCandidate(undefined);setScopeChanged(false);
  }
  async function regenerate() {
    if (busy.current) return;busy.current=true;setPending(true);setOperation('generate');setError('');
    try {
      const saved=await loadGarden(details.gardenId);
      if (details.bedId&&!saved.beds.some(bed=>bed.id===details.bedId)) throw Error('Choose a bed that still exists, or choose Whole garden.');
      const work=generateTaskWork(saved,details.bedId,details.activityType),current=workOf(details);
      if ((current.workRecap||current.workItems.length)&&generated.current!==JSON.stringify(current)) setCandidate({work,garden:saved});
      else applyWork(work,saved);
    } catch(problem) {setError(taskError(problem).message);}
    finally {busy.current=false;setPending(false);setOperation(undefined);}
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current || conflict || candidate) return false;
    const problem = validateTask(details) ?? (details.bedId && !review.garden.beds.some(bed => bed.id === details.bedId) ? 'Choose a bed that still exists, or choose Whole garden.' : null);
    if (problem) { setError(problem); return false; }
    const key = JSON.stringify(details); if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
    busy.current = true; setPending(true); setOperation('save'); setError('');
    try { onSaved(await saveTask(details, review.task, id, request.current.id)); return true; }
    catch (problem) { const failure = taskError(problem); setError(failure.message); setConflict(failure.conflict); return false; }
    finally { busy.current = false; setPending(false); setOperation(undefined); }
  }
  async function reload() {
    if (busy.current || !task) return; busy.current = true; setPending(true); setOperation('reload');
    try {
      const latest = await loadTask(task.id), saved = await loadGarden(task.gardenId);
      if (latest.status !== 'planned') throw Error('This task is no longer planned. Close and refresh the calendar.');
      const values=taskDetails(latest);generated.current=null;setCandidate(undefined);setScopeChanged(false);
      setReview({ task: latest, garden: saved }); setInitial(values); setDetails(values); setConflict(false); setError('');
    } catch (problem) { setError(taskError(problem).message); }
    finally { busy.current = false; setPending(false); setOperation(undefined); }
  }
  return <Sheet title={task ? 'Edit task' : 'Plan activity'} dismissible={!pending} onClose={close}>
    <form ref={form} onSubmit={submit} className="space-y-3">
      <p className="break-words text-sm font-medium">{review.garden.name}</p>
      <p className="text-xs text-stone-600 dark:text-stone-400">Planning a task leaves the garden plan and completed history unchanged.</p>
      <SelectField id="task-bed" label="Scope" value={details.bedId} disabled={pending} onChange={e => change({ bedId: e.target.value })}>
        <option value="">Whole garden</option>{details.bedId && !review.garden.beds.some(bed => bed.id === details.bedId) && <option value={details.bedId}>Bed no longer in garden — choose another scope</option>}
        {review.garden.beds.map(bed => <option key={bed.id} value={bed.id}>{bed.name}</option>)}
      </SelectField>
      <SelectField id="task-type" label="Activity" value={details.activityType} disabled={pending} onChange={e => change({ activityType: e.target.value as TaskDetails['activityType'] })}>
        {activityTypes.map(type => <option key={type} value={type}>{activityLabels[type]}</option>)}
      </SelectField>
      <TextField id="task-date" label="Planned date" type="date" min="0001-01-01" max="9999-12-31" required value={details.plannedDate} disabled={pending} onChange={e => change({ plannedDate: e.target.value })} />
      <TextField id="task-title" label="Title" required maxLength={120} value={details.title} disabled={pending} onChange={e => change({ title: e.target.value })} />
      {checklistAvailable ? <>
        {scopeChanged&&<p role="status" className="text-xs text-amber-800 dark:text-amber-300">Scope or activity changed. Your instructions were preserved; review them or generate a new recap.</p>}
        <TaskWorkFields work={workOf(details)} pending={pending||!!candidate} onChange={work=>{setDetails(current=>({...current,...work}));setScopeChanged(false);}} onGenerate={()=>void regenerate()} />
        {candidate&&<section aria-label="Replace work instructions" className="space-y-3 rounded-lg border border-amber-300 p-3 dark:border-amber-800">
          <p className="text-sm">Replace your recap and checklist with this suggestion? Edited text and checked progress will be replaced.</p>
          <TaskWorkPreview work={candidate.work} open />
          <Button type="button" onClick={()=>applyWork(candidate.work,candidate.garden)}>Replace recap and checklist</Button>
          <Button type="button" variant="secondary" onClick={()=>setCandidate(undefined)}>Keep my instructions</Button>
        </section>}
      </> : <p role="status" className="text-xs text-stone-600 dark:text-stone-400">Work checklists are not available yet. You can still plan with a title and notes.</p>}
      <TextAreaField id="task-notes" label="Notes" rows={2} maxLength={2000} value={details.notes} disabled={pending} onChange={e => change({ notes: e.target.value })} />
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {conflict && task && <Button type="button" variant="secondary" disabled={pending} onClick={() => void reload()}>Reload task and discard changes</Button>}
      <Button type="submit" disabled={pending || conflict || !!candidate}>{pending ? operation==='generate'?'Generating…':operation==='reload'?'Reloading…':'Saving…' : 'Save task'}</Button>
      <Button type="button" variant="secondary" disabled={pending} onClick={close}>Back to calendar</Button>
    </form>
  </Sheet>;
}

export function CompleteTaskDialog({ task, initialGarden, onReload, onSaved, onClose }: { task: GardenTask; initialGarden: SavedGarden; onReload: () => Promise<{ task: GardenTask; garden: SavedGarden }>; onSaved: (task: GardenTask) => void; onClose: () => void }) {
  const [review, setReview] = useState({ task, garden: initialGarden }), [date, setDate] = useState(dayKey), [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState(''), [conflict, setConflict] = useState(false);
  const busy = useRef(false), request = useRef({ key: '', id: '' });
  const dirty = !!notes || confirmed || date !== dayKey();
  const form = useFormLeave(dirty, pending, submit, () => { setConfirmed(false); setNotes(''); setDate(dayKey()); });
  const close = useGuardedBack(onClose);
  const bed = review.garden.beds.find(bed => bed.id === review.task.bedId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current || conflict) return false;
    if (!confirmed || !parseDay(date) || notes.length > 2000) { setError('Choose an actual completion date and confirm the saved plan matches the work done.'); return false; }
    const key = JSON.stringify([review.task.version, review.garden.version, date, notes]);
    if (request.current.key !== key) request.current = { key, id: crypto.randomUUID() };
    busy.current = true; setPending(true); setError('');
    try { onSaved(await completeTask(review.task, review.garden, date, notes, confirmed, request.current.id)); return true; }
    catch (problem) { const failure = taskError(problem); setError(failure.message); setConflict(failure.conflict); return false; }
    finally { busy.current = false; setPending(false); }
  }
  async function reload() {
    if (busy.current) return; busy.current = true; setPending(true);
    try { setReview(await onReload()); setConfirmed(false); setConflict(false); setError(''); }
    catch (problem) { setError(taskError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  return <Sheet title="Record task completion" dismissible={!pending} onClose={close}>
    <form ref={form} onSubmit={submit} className="space-y-3">
      <p className="break-words text-sm font-medium">{review.task.title}</p>
      <p className="break-words text-sm">{review.garden.name} · {bed ? `${bed.name} · ${bed.widthCm} × ${bed.lengthCm} cm` : 'Whole garden'}</p>
      <p className="text-sm">This records the current saved {bed ? 'bed' : 'garden'} as completed history. Review it in the editor first if it needs changes.</p>
      <TaskWorkPreview work={review.task} open />
      <TextField id="task-completed-date" label="Actual completion date" type="date" min="0001-01-01" max="9999-12-31" required value={date} disabled={pending} onChange={e => setDate(e.target.value)} />
      <TextAreaField id="task-completed-notes" rows={2} label="Completion notes" maxLength={2000} value={notes} disabled={pending} onChange={e => setNotes(e.target.value)} />
      <label className="flex min-h-12 items-center gap-3 text-sm"><input id="task-confirm" type="checkbox" checked={confirmed} disabled={pending} onChange={e => setConfirmed(e.target.checked)} />I completed this work and the saved {bed ? 'bed' : 'garden'} matches the result.</label>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {conflict && <Button type="button" variant="secondary" disabled={pending} onClick={() => void reload()}>Reload task and saved plan</Button>}
      <Button type="submit" disabled={pending || conflict || !confirmed}>{pending ? 'Recording…' : 'Record completion'}</Button>
      <Button type="button" variant="secondary" disabled={pending} onClick={close}>Keep task planned</Button>
    </form>
  </Sheet>;
}

export function CancelTaskDialog({ task, onSaved, onClose }: { task: GardenTask; onSaved: (task: GardenTask) => void; onClose: () => void }) {
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const busy = useRef(false), [requestId] = useState(() => crypto.randomUUID());
  async function cancel() {
    if (busy.current) return; busy.current = true; setPending(true); setError('');
    try { onSaved(await saveTask(task, task, task.id, requestId, true)); }
    catch (problem) { setError(taskError(problem).message); }
    finally { busy.current = false; setPending(false); }
  }
  return <Sheet title="Cancel planned task?" dismissible={!pending} onClose={onClose}>
    <div className="space-y-3"><p className="break-words text-sm">{task.title} · {task.plannedDate}</p><p className="text-sm">The task remains listed as cancelled. No completed work will be recorded.</p>
      {error && <p role="alert">{error}</p>}
      <Button type="button" variant="danger" disabled={pending} onClick={() => void cancel()}>{pending ? 'Cancelling…' : 'Cancel task'}</Button>
      <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Keep task</Button>
    </div>
  </Sheet>;
}
