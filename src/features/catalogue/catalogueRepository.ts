import { getSupabaseClient } from '../../shared/supabase/client';
import { GardenStorageError } from '../gardens/gardenErrors';
import { catalogueError } from './catalogueErrors';
import { DEFAULT_BORDER_DISTANCE_CM, orderedTargets, validateDetails, validatePlantDetails } from './catalogue';
import type { Catalogue, FamilyDetails, PlantDetails, RuleDetails, PlantFamily, PlantType, CompanionRule } from './catalogue';

type FamilyRow = { id: string; name: string; notes: string; plant_spacing_cm: number | null; row_spacing_cm: number | null; version: number };
type PlantRow = FamilyRow & { family_id: string; border_distance_cm: number };
type RuleRow = { id: string; family_a_id: string | null; plant_a_id: string | null; family_b_id: string | null;
  plant_b_id: string | null; relationship: CompanionRule['relationship']; notes: string; version: number };
const familyColumns = 'id,name,notes,plant_spacing_cm,row_spacing_cm,version';
const plantColumns = `${familyColumns},family_id,border_distance_cm`;
const ruleColumns = 'id,family_a_id,plant_a_id,family_b_id,plant_b_id,relationship,notes,version';
const family = (row: FamilyRow): PlantFamily => ({ id: row.id, name: row.name, notes: row.notes,
  plantSpacingCm: row.plant_spacing_cm, rowSpacingCm: row.row_spacing_cm, version: row.version });
const plant = (row: PlantRow): PlantType => ({ ...family(row), familyId: row.family_id, borderDistanceCm: row.border_distance_cm ?? DEFAULT_BORDER_DISTANCE_CM });
const rule = (row: RuleRow): CompanionRule => ({ id: row.id, notes: row.notes, relationship: row.relationship, version: row.version,
  first: row.family_a_id ? { kind: 'family', id: row.family_a_id } : { kind: 'plant', id: row.plant_a_id! },
  second: row.family_b_id ? { kind: 'family', id: row.family_b_id } : { kind: 'plant', id: row.plant_b_id! } });

export async function loadCatalogue(userId: string): Promise<Catalogue> {
  const client = getSupabaseClient();
  const results = await Promise.all([
    client.from('plant_families').select(familyColumns).order('name'),
    client.from('plant_types').select(plantColumns).order('name'),
    client.from('companion_rules').select(ruleColumns).order('created_at'),
    client.from('catalogue_administrators').select('user_id').eq('user_id', userId).maybeSingle(),
  ]);
  for (const result of results) if (result.error) throw catalogueError(result.error);
  return { families: (results[0].data as FamilyRow[]).map(family), plants: (results[1].data as PlantRow[]).map(plant),
    rules: (results[2].data as RuleRow[]).map(rule), isAdmin: !!results[3].data };
}

async function write(table: string, columns: string, payload: object, current?: { id: string; version: number }): Promise<unknown> {
  const query = getSupabaseClient().from(table);
  const { data, error } = current
    ? await query.update(payload).eq('id', current.id).eq('version', current.version).select(columns).maybeSingle()
    : await query.insert(payload).select(columns).single();
  if (error) throw catalogueError(error);
  if (!data) throw new GardenStorageError('This entry changed or your administrator access was removed. Refresh before editing again.');
  return data;
}
function detailsPayload(details: FamilyDetails) {
  const error = validateDetails(details);
  if (error) throw new GardenStorageError(error);
  return { name: details.name.trim(), notes: details.notes.trim(), plant_spacing_cm: details.plantSpacingCm, row_spacing_cm: details.rowSpacingCm };
}
export async function saveFamily(details: FamilyDetails, current?: PlantFamily): Promise<PlantFamily> {
  return family(await write('plant_families', familyColumns, detailsPayload(details), current) as FamilyRow);
}
export async function savePlant(details: PlantDetails, current?: PlantType): Promise<PlantType> {
  const error = validatePlantDetails(details);
  if (error) throw new GardenStorageError(error);
  return plant(await write('plant_types', plantColumns, { ...detailsPayload(details), family_id: details.familyId,
    border_distance_cm: details.borderDistanceCm }, current) as PlantRow);
}
export async function saveRule(details: RuleDetails, current?: CompanionRule): Promise<CompanionRule> {
  if (!details.first.id || !details.second.id || !['companion', 'caution'].includes(details.relationship) || details.notes.length > 2000) {
    throw new GardenStorageError('Choose two families or plant types, a relationship, and notes within 2000 characters.');
  }
  const [a, b] = orderedTargets(details.first, details.second);
  return rule(await write('companion_rules', ruleColumns, { family_a_id: a.kind === 'family' ? a.id : null,
    plant_a_id: a.kind === 'plant' ? a.id : null, family_b_id: b.kind === 'family' ? b.id : null,
    plant_b_id: b.kind === 'plant' ? b.id : null, relationship: details.relationship, notes: details.notes.trim() }, current) as RuleRow);
}
