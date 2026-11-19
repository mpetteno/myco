import type { Catalogue, CompanionTarget } from './catalogue';
import { orderedTargets, targetKey } from './catalogue';
import { effectiveCalendar, plantingMethods, referenceSections } from '../catalogue-reference/referenceModel';
import type { ReferenceData, ReferenceRow } from '../catalogue-reference/referenceModel';

export type EditorTable = 'plant_guidance' | 'plant_depths' | 'companion_rules' | 'rotation_rules' | 'plant_calendar_entries';
export type EditorRow = { key: string; table: EditorTable; values: Record<string, string>; original?: ReferenceRow; source?: ReferenceRow;
  inherited: boolean; removed: boolean; windows: { start_month: number; end_month: number }[] };
export type CropDraft = { details: Record<string, string>; rows: EditorRow[] };
export type CropChange = { table: EditorTable; id: string | null; version: number | null; details: Record<string, unknown>; remove: boolean;
  source_id?: string; source_version?: number; windows: EditorRow['windows'] };
const strings = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value == null ? '' : String(value)]));
const endpoint = (row: ReferenceRow, prefix: 'current' | 'previous') => row[`${prefix}_cultivar_id`] ? `cultivar:${row[`${prefix}_cultivar_id`]}`
  : row[`${prefix}_plant_id`] ? `plant:${row[`${prefix}_plant_id`]}` : `family:${row[`${prefix}_family_id`]}`;
export const editorOwner = (cropId: string, cultivarId?: string): CompanionTarget => ({ kind: cultivarId ? 'cultivar' : 'plant', id: cultivarId ?? cropId });

function uniqueRelationships(rows: EditorRow[]): EditorRow[] {
  const weights: Record<string, number> = { family: 0, plant: 1, cultivar: 3 };
  const priority = (row: EditorRow) => {
    if (row.original) return 100;
    const source = row.source!;
    if (row.table === 'companion_rules') {
      const first = source.first as CompanionTarget, second = source.second as CompanionTarget;
      return weights[first.kind] + weights[second.kind];
    }
    return (source.current_cultivar_id ? 3 : source.current_plant_id ? 1 : 0)
      + (source.previous_cultivar_id ? 3 : source.previous_plant_id ? 1 : 0);
  };
  const selected = new Map<string, EditorRow>();
  for (const row of rows) {
    const previous = selected.get(row.values.target);
    if (!previous || priority(row) > priority(previous) || (priority(row) === priority(previous) && ['caution', 'avoid_after'].includes(row.values.relationship))) selected.set(row.values.target, row);
  }
  return [...selected.values()];
}

export function createCropDraft(data: ReferenceData, catalogue: Catalogue, cropId: string, cultivarId?: string): CropDraft {
  const owner = editorOwner(cropId, cultivarId), ownerKey = targetKey(owner);
  const crop = data.plant_types.find((row) => row.id === cropId)!;
  const current = cultivarId ? data.plant_cultivars.find((row) => row.id === cultivarId)! : crop;
  const owns = (row: ReferenceRow) => row.plant_type_id === cropId && (row.cultivar_id ?? null) === (cultivarId ?? null);
  const matches = (target: CompanionTarget) => target.kind === 'cultivar' ? target.id === cultivarId : target.kind === 'plant' ? target.id === cropId : target.id === crop.family_id;
  const row = (table: EditorTable, key: string, values: Record<string, unknown>, original?: ReferenceRow, source?: ReferenceRow): EditorRow => ({
    table, key, values: strings(values), original, source, inherited: !!source && !original, removed: false, windows: [],
  });
  const care = data.plant_guidance.find(owns);
  const rows: EditorRow[] = [row('plant_guidance', 'care', Object.fromEntries(referenceSections.plant_guidance.fields.filter((field) => !field.reference).map((field) => [field.key, care?.[field.key] ?? null])), care)];
  for (const method of plantingMethods) {
    const own = data.plant_depths.find((item) => owns(item) && item.planting_method === method);
    const base = cultivarId ? data.plant_depths.find((item) => item.plant_type_id === cropId && !item.cultivar_id && item.planting_method === method) : undefined;
    rows.push(row('plant_depths', `depth-${method}`, { planting_method: method, depth_cm: own?.depth_cm ?? '', notes: own?.notes ?? '' }, own, base));
  }
  const companions = catalogue.rules.filter((rule) => matches(rule.first) || matches(rule.second)).map((rule) => {
    const own = targetKey(rule.first) === ownerKey || targetKey(rule.second) === ownerKey;
    const other = targetKey(rule.first) === ownerKey ? rule.second : targetKey(rule.second) === ownerKey ? rule.first : matches(rule.first) ? rule.second : rule.first;
    const raw = { ...rule, id: rule.id, version: rule.version } as ReferenceRow;
    return row('companion_rules', `companion-${rule.id}`, { target: targetKey(other), relationship: rule.relationship, notes: rule.notes }, own ? raw : undefined, own ? undefined : raw);
  });
  rows.push(...uniqueRelationships(companions));
  const rotations = data.rotation_rules.filter((item) => matches({ kind: item.current_cultivar_id ? 'cultivar' : item.current_plant_id ? 'plant' : 'family', id: String(item.current_cultivar_id ?? item.current_plant_id ?? item.current_family_id) })).map((item) => {
    const own = endpoint(item, 'current') === ownerKey;
    return row('rotation_rules', `rotation-${item.id}`, { target: endpoint(item, 'previous'), relationship: item.relationship, notes: item.notes }, own ? item : undefined, own ? undefined : item);
  });
  rows.push(...uniqueRelationships(rotations));
  for (const entry of data.calendar_profiles.flatMap((profile) => effectiveCalendar(data, cropId, profile.id, cultivarId))) {
    const item = row('plant_calendar_entries', `calendar-${entry.id}`, Object.fromEntries(['calendar_profile_id', 'activity', 'planting_method', 'notes'].map((key) => [key, entry[key]])), owns(entry) ? entry : undefined, owns(entry) ? undefined : entry);
    item.windows = data.calendar_windows.filter((window) => window.calendar_entry_id === entry.id).map((window) => ({ start_month: window.start_month, end_month: window.end_month }));
    rows.push(item);
  }
  const fields = ['name', 'notes', 'plant_spacing_cm', 'row_spacing_cm', 'border_distance_cm', 'living_mulch_enabled', ...(!cultivarId ? ['family_id', 'scientific_name'] : [])];
  return { details: strings(Object.fromEntries(fields.map((key) => [key, current[key]]))), rows };
}
export function cropDetailsPayload(draft: CropDraft) {
  return Object.fromEntries(Object.entries(draft.details).map(([key, value]) => [key,
    key.endsWith('_cm') ? value === '' ? null : Number(value) : key === 'living_mulch_enabled' ? value === '' ? null : value === 'true' : value.trim()]));
}
export function cropChanges(draft: CropDraft, initial: CropDraft, cropId: string, cultivarId?: string): CropChange[] {
  const owner = editorOwner(cropId, cultivarId);
  return draft.rows.flatMap((row) => {
    const before = initial.rows.find((item) => item.key === row.key);
    if (JSON.stringify(before) === JSON.stringify(row) || (row.removed && !row.original)) return [];
    let details: Record<string, unknown> = { ...row.values };
    let remove = row.removed;
    if (row.table === 'plant_guidance') {
      details = Object.fromEntries(referenceSections.plant_guidance.fields.filter((field) => !field.reference).map((field) => {
        const value = row.values[field.key];
        return [field.key, value === '' ? null : field.type === 'boolean' ? value === 'true' : field.type === 'number' ? Number(value) : value];
      }));
    } else if (row.table === 'plant_depths') {
      remove ||= row.values.depth_cm === '' && row.values.notes === '';
      if (remove && !row.original) return [];
      details.depth_cm = Number(row.values.depth_cm || row.source?.depth_cm);
    } else if (row.table === 'companion_rules' || row.table === 'rotation_rules') {
      const [kind, id] = row.values.target.split(':');
      const other = { kind, id } as CompanionTarget;
      const targets = row.table === 'companion_rules' ? orderedTargets(owner, other) : [owner, other];
      details = { relationship: row.values.relationship, notes: row.values.notes };
      targets.forEach((target, index) => {
        const keys = row.table === 'companion_rules' ? [`family_${index ? 'b' : 'a'}_id`, `plant_${index ? 'b' : 'a'}_id`, `cultivar_${index ? 'b' : 'a'}_id`] : [`${index ? 'previous' : 'current'}_family_id`, `${index ? 'previous' : 'current'}_plant_id`, `${index ? 'previous' : 'current'}_cultivar_id`];
        ['family', 'plant', 'cultivar'].forEach((type, i) => { details[keys[i]] = target.kind === type ? target.id : null; });
      });
    }
    if (['plant_guidance', 'plant_depths', 'plant_calendar_entries'].includes(row.table)) Object.assign(details, { plant_type_id: cropId, cultivar_id: cultivarId ?? null });
    return [{ table: row.table, id: row.original?.id ?? null, version: row.original?.version ?? null, details, remove,
      ...(row.source ? { source_id: row.source.id, source_version: row.source.version } : {}), windows: row.windows }];
  });
}

export function linkCropRelationship(draft: CropDraft, initial: CropDraft, table: 'companion_rules' | 'rotation_rules', target: string, relationship: string): CropDraft {
  const existing = draft.rows.find((row) => row.table === table && row.values.target === target);
  if (existing) {
    const before = initial.rows.find((row) => row.key === existing.key);
    const next = existing.inherited && before?.values.relationship === relationship ? structuredClone(before)
      : { ...existing, removed: false, values: { ...existing.values, relationship, ...(!existing.original ? { notes: '' } : {}) } };
    return { ...draft, rows: draft.rows.map((row) => row.key === existing.key ? next : row) };
  }
  return { ...draft, rows: [...draft.rows, { key: crypto.randomUUID(), table, values: { target, relationship, notes: '' }, inherited: false, removed: false, windows: [] }] };
}

export function removeCropRelationship(draft: CropDraft, initial: CropDraft, key: string): CropDraft {
  const row = draft.rows.find((item) => item.key === key);
  if (!row) return draft;
  if (row.original) return { ...draft, rows: draft.rows.map((item) => item.key === key ? { ...item, removed: true } : item) };
  const before = initial.rows.find((item) => item.key === key);
  return { ...draft, rows: before ? draft.rows.map((item) => item.key === key ? structuredClone(before) : item) : draft.rows.filter((item) => item.key !== key) };
}
