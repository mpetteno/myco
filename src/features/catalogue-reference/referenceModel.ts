export const referenceTables = ['plant_cultivars', 'plant_guidance', 'plant_depths', 'calendar_profiles', 'calendar_coverage', 'plant_calendar_entries', 'rotation_rules', 'mulch_categories'] as const;
export type ReferenceTable = typeof referenceTables[number];
export type ReferenceRow = { id: string; version: number; [key: string]: unknown };
export type GuidanceOwner = { plant_type_id: string; cultivar_id: string | null };
export type PlantingMethod = 'seed' | 'crown' | 'bulb' | 'tuber' | 'sucker' | 'offset' | 'plant';
export type CalendarActivity = 'seedbed_sowing' | 'direct_sowing' | 'transplant' | 'harvest';
export type CareGuidance = ReferenceRow & GuidanceOwner & {
  sun_requirement: 'full_sun' | 'sun_or_part_shade' | null; tolerates_shade: boolean | null;
  rotation_years: number | null; organic_feed_level: 'low' | 'medium' | 'abundant' | null;
  feed_in_planting_hole: boolean | null; monthly_feed: boolean | null;
  reduce_water_before_harvest: boolean | null; stop_water_before_harvest: boolean | null; watering_notes: string | null;
};
export type PlantDepth = ReferenceRow & GuidanceOwner & { planting_method: PlantingMethod; depth_cm: number; notes: string };
export type CalendarProfile = ReferenceRow & { name: string; code: string; notes: string };
export type CalendarCoverage = ReferenceRow & { calendar_profile_id: string; country_code: string; region_code: string };
export type PlantCalendarEntry = ReferenceRow & GuidanceOwner & { calendar_profile_id: string; activity: CalendarActivity; planting_method: PlantingMethod; notes: string };
export type CalendarWindow = ReferenceRow & { calendar_entry_id: string; start_month: number; end_month: number };
export type RotationRule = ReferenceRow & { current_family_id: string | null; current_plant_id: string | null;
  previous_family_id: string | null; previous_plant_id: string | null; current_cultivar_id?: string | null; previous_cultivar_id?: string | null; relationship: 'favourable_after' | 'avoid_after'; notes: string };
export type ReferenceData = {
  plant_cultivars: ReferenceRow[]; plant_guidance: CareGuidance[]; plant_depths: PlantDepth[];
  calendar_profiles: CalendarProfile[]; calendar_coverage: CalendarCoverage[]; plant_calendar_entries: PlantCalendarEntry[];
  rotation_rules: RotationRule[]; mulch_categories: ReferenceRow[];
  plant_types: ReferenceRow[]; plant_families: ReferenceRow[]; calendar_windows: CalendarWindow[]; isAdmin: boolean;
};
export type Field = { key: string; label: string; type?: 'number' | 'boolean' | 'text' | 'choice'; required?: boolean;
  reference?: 'plant_types' | 'plant_cultivars' | 'calendar_profiles'; choices?: readonly string[]; min?: number; step?: number };
const crop: Field = { key: 'plant_type_id', label: 'Crop', required: true, reference: 'plant_types' };
const cultivar: Field = { key: 'cultivar_id', label: 'Cultivar', reference: 'plant_cultivars' };
const notes: Field = { key: 'notes', label: 'Notes' };
const name: Field = { key: 'name', label: 'Name', required: true };
const spacing: Field[] = [{ key: 'plant_spacing_cm', label: 'Plant spacing (cm)', type: 'number', min: 0.01 },
  { key: 'row_spacing_cm', label: 'Row spacing (cm)', type: 'number', min: 0.01 },
  { key: 'border_distance_cm', label: 'Minimum border distance (cm)', type: 'number', min: 5, step: 5 }];
export const plantingMethods = ['seed', 'crown', 'bulb', 'tuber', 'sucker', 'offset', 'plant'] as const;
const method: Field = { key: 'planting_method', label: 'Planting method', choices: plantingMethods, required: true };
export const referenceSections: Record<ReferenceTable, { label: string; fields: Field[] }> = {
  plant_cultivars: { label: 'Cultivars', fields: [crop, name, notes, ...spacing, { key: 'living_mulch_enabled', label: 'Can be used as living mulch', type: 'boolean' }] },
  plant_guidance: { label: 'Care guidance', fields: [crop, cultivar,
    { key: 'sun_requirement', label: 'Sunlight', choices: ['full_sun', 'sun_or_part_shade'] },
    { key: 'tolerates_shade', label: 'Tolerates shade', type: 'boolean' },
    { key: 'rotation_years', label: 'Rotation interval (years)', type: 'number', min: 1, step: 1 },
    { key: 'organic_feed_level', label: 'Organic feed level', choices: ['low', 'medium', 'abundant'] },
    ...[['feed_in_planting_hole', 'Feed in planting hole'], ['monthly_feed', 'Monthly feeding'], ['reduce_water_before_harvest', 'Reduce water before harvest'], ['stop_water_before_harvest', 'Stop water before harvest']].map(([key, label]): Field => ({ key, label, type: 'boolean' })),
    { key: 'watering_notes', label: 'Watering notes' }] },
  plant_depths: { label: 'Planting depths', fields: [crop, cultivar, method, { key: 'depth_cm', label: 'Depth (cm)', type: 'number', min: 0.01, required: true }, notes] },
  calendar_profiles: { label: 'Calendars', fields: [name, { key: 'code', label: 'Calendar identifier', required: true }, notes] },
  calendar_coverage: { label: 'Calendar coverage', fields: [{ key: 'calendar_profile_id', label: 'Calendar', reference: 'calendar_profiles', required: true },
    { key: 'country_code', label: 'Country', choices: ['IT'], required: true },
    { key: 'region_code', label: 'Region', choices: ['IT-21', 'IT-23', 'IT-25', 'IT-32', 'IT-34', 'IT-36', 'IT-42', 'IT-45', 'IT-52', 'IT-55', 'IT-57', 'IT-62'], required: true }] },
  plant_calendar_entries: { label: 'Growing calendar', fields: [crop, cultivar, { key: 'calendar_profile_id', label: 'Calendar', required: true, reference: 'calendar_profiles' },
    { key: 'activity', label: 'Activity', required: true, choices: ['seedbed_sowing', 'direct_sowing', 'transplant', 'harvest'] }, method, notes] },
  rotation_rules: { label: 'Rotation rules', fields: [
    { key: 'current_target', label: 'Current crop or family', required: true }, { key: 'previous_target', label: 'Previous crop or family', required: true },
    { key: 'relationship', label: 'Relationship', choices: ['favourable_after', 'avoid_after'], required: true }, notes] },
  mulch_categories: { label: 'Mulch categories', fields: [name, { key: 'code', label: 'Category', choices: ['organic', 'synthetic', 'living'], required: true }, notes] },
};

export function effectiveGuidance(data: ReferenceData, cropId: string, cultivarId?: string): Record<string, unknown> {
  const base = data.plant_guidance.find((row) => row.plant_type_id === cropId && !row.cultivar_id) ?? {};
  const overrides = data.plant_guidance.find((row) => row.cultivar_id === cultivarId && cultivarId) ?? {};
  return { ...base, ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== null)) };
}
export function effectiveCalendar(data: ReferenceData, cropId: string, profileId: string, cultivarId?: string): ReferenceRow[] {
  const rows = data.plant_calendar_entries.filter((row) => row.calendar_profile_id === profileId && row.plant_type_id === cropId);
  const overrides = rows.filter((row) => cultivarId && row.cultivar_id === cultivarId);
  return [...rows.filter((row) => !row.cultivar_id && !overrides.some((other) => other.activity === row.activity && other.planting_method === row.planting_method)), ...overrides];
}
