import { getSupabaseClient } from '../../shared/supabase/client';
import { GardenStorageError } from '../gardens/gardenErrors';
import { historyError } from '../history/historyRepository';
import type { SavedGarden } from '../gardens/gardenDocument';
import { validateTask } from './workModel';
import type { GardenTask, TaskDetails, WorkEvent } from './workModel';

type Row = Record<string, unknown>;
class PlanningUnavailable extends GardenStorageError {}
const taskColumns = 'id,garden_id,task_order,bed_id,bed_name,activity_type,planned_date,title,notes,status,version,completed_date,completed_notes,completion_event_id';
const workColumns = taskColumns + ',work_recap,work_items';
const eventColumns = 'id,garden_id,event_order,event_date,title,notes,source_version,recorded_at,actor_id,event_kind,bed_id,bed_name,planned_date,version,updated_at,deleted_at';
const optional = (value: unknown) => value == null ? undefined : String(value);
export function taskFromRow(row: Row): GardenTask {
  return { id: String(row.id), gardenId: String(row.garden_id), order: Number(row.task_order), bedId: String(row.bed_id ?? ''), bedName: optional(row.bed_name),
    activityType: row.activity_type as GardenTask['activityType'], plannedDate: String(row.planned_date), title: String(row.title), notes: String(row.notes),
    ...(row.work_items !== undefined ? { workRecap: String(row.work_recap ?? ''), workItems: row.work_items as GardenTask['workItems'] } : {}),
    status: row.status as GardenTask['status'], version: Number(row.version), completedDate: optional(row.completed_date), completedNotes: optional(row.completed_notes), completionEventId: optional(row.completion_event_id) };
}
export function taskError(problem: unknown): GardenStorageError {
  if (problem instanceof GardenStorageError) return problem;
  const code = problem && typeof problem === 'object' && 'code' in problem ? problem.code : '';
  if (['42P01', '42703', 'PGRST202', 'PGRST204', 'PGRST205'].includes(String(code))) return new PlanningUnavailable('Dated task storage is not available yet. Please contact the app owner.');
  if (code === '40001') return new GardenStorageError('This task or saved garden changed. Reload and review before trying again.', true);
  if (code === '22023' || code === '23514') return new GardenStorageError('Check the date, title and activity, and choose a bed that still exists.');
  if (code === '42501' || code === 'P0002') return new GardenStorageError('This task or garden is no longer available, or your access was removed.');
  if (code === 'P0001') return historyError(problem);
  if (problem instanceof Error && !(problem instanceof TypeError)) return new GardenStorageError(problem.message);
  return new GardenStorageError('Could not reach task storage. Check your connection and try again.');
}
export async function loadWork(gardenIds: string[]): Promise<{ tasks: GardenTask[]; events: WorkEvent[]; planningAvailable?: boolean; checklistAvailable?: boolean }> {
  if (!gardenIds.length) return { tasks: [], events: [] };
  const client = getSupabaseClient();
  const access = await client.from('gardens').select('id').in('id', gardenIds);
  if (access.error) throw taskError(access.error);
  if (access.data.length !== new Set(gardenIds).size) throw new GardenStorageError('A selected garden is no longer available. Refresh your gardens.');
  async function pages(table: string, columns: string, order: string) {
    const result: Row[] = []; let cursor = 0;
    while (true) {
      const { data, error } = await client.from(table).select(columns).in('garden_id', gardenIds).gt(order, cursor).order(order).limit(200);
      if (error) throw taskError(error);
      const rows = data as unknown as Row[]; result.push(...rows);
      if (rows.length < 200) return result;
      cursor = Number(rows.at(-1)![order]);
    }
  }
  // Missing dated-task storage must not hide existing completed history.
  let checklistAvailable = true;
  const tasksWithWork = async () => {
    try { return await pages('garden_tasks', workColumns, 'task_order'); }
    catch (problem) { if (!(problem instanceof PlanningUnavailable)) throw problem; checklistAvailable = false; return await pages('garden_tasks', taskColumns, 'task_order'); }
  };
  const results = await Promise.allSettled([tasksWithWork(), pages('garden_work_events', eventColumns, 'event_order')]);
  for (const result of results) if (result.status === 'rejected' && !(result.reason instanceof PlanningUnavailable)) throw result.reason;
  const planningAvailable = results.every(result => result.status === 'fulfilled');
  const tasks = results[0].status === 'fulfilled' ? results[0].value : [];
  const events = results[1].status === 'fulfilled' ? results[1].value
    : await pages('garden_layout_events', eventColumns.replace(',bed_name', ''), 'event_order');
  return { tasks: tasks.map(taskFromRow), planningAvailable, checklistAvailable: planningAvailable && checklistAvailable, events: events.map(row => ({ id: String(row.id), gardenId: String(row.garden_id), order: Number(row.event_order), date: String(row.event_date),
    title: String(row.title), notes: String(row.notes), sourceVersion: Number(row.source_version), recordedAt: String(row.recorded_at), actorId: optional(row.actor_id) ?? null,
    eventVersion: Number(row.version), updatedAt: String(row.updated_at), kind: row.event_kind as WorkEvent['kind'], status: 'completed', bedId: optional(row.bed_id), bedName: optional(row.bed_name),
    plannedDate: optional(row.planned_date), deleted: !!row.deleted_at })) };
}

export async function saveTask(details: TaskDetails, current: GardenTask | undefined, id: string, requestId: string, cancel = false) {
  const invalid = validateTask(details); if (invalid) throw new GardenStorageError(invalid);
  const withWork = details.workRecap !== undefined || details.workItems !== undefined;
  const { data, error } = await getSupabaseClient().rpc(withWork ? 'save_garden_task_work' : 'save_garden_task', { p_garden_id: details.gardenId, p_task_id: id, p_expected_version: current?.version ?? null,
    p_request_id: requestId, p_bed_id: details.bedId || null, p_activity_type: details.activityType, p_planned_date: details.plannedDate, p_title: details.title.trim(), p_notes: details.notes.trim(), p_cancel: cancel,
    ...(withWork ? { p_work_recap: (details.workRecap ?? '').trim(), p_work_items: details.workItems ?? [] } : {}) }).single();
  if (error) { const failure=taskError(error);if(withWork&&failure instanceof PlanningUnavailable)throw new GardenStorageError('Work checklists are not available yet. Your draft has been kept.');throw failure; }
  return taskFromRow(data as unknown as Row);
}
export async function completeTask(task: GardenTask, garden: SavedGarden, date: string, notes: string, confirmed: boolean, requestId: string) {
  const { data, error } = await getSupabaseClient().rpc('complete_garden_task', { p_garden_id: task.gardenId, p_task_id: task.id, p_expected_version: task.version, p_garden_version: garden.version,
    p_request_id: requestId, p_completed_date: date, p_notes: notes.trim(), p_confirmed: confirmed }).single();
  if (error) throw taskError(error);
  return taskFromRow(data as unknown as Row);
}
export async function loadTask(id: string) {
  const { data, error } = await getSupabaseClient().from('garden_tasks').select(workColumns).eq('id', id).maybeSingle();
  if (error && taskError(error) instanceof PlanningUnavailable) {
    const legacy = await getSupabaseClient().from('garden_tasks').select(taskColumns).eq('id', id).maybeSingle();
    if (legacy.error) throw taskError(legacy.error);
    if (!legacy.data) throw new GardenStorageError('This task is no longer available, or access was removed.');
    return taskFromRow(legacy.data as Row);
  }
  if (error) throw taskError(error);
  if (!data) throw new GardenStorageError('This task is no longer available, or access was removed.');
  return taskFromRow(data as unknown as Row);
}
