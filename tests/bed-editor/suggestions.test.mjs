import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, cleanupModules } from '../auth/helpers.mjs';
const { suggest, monthInWindow, rotationAdvice, groundHistory, precedingCrops, subtract } = await loadModule('tests/bed-editor/suggestion-modules.ts', 'suggestions');
after(cleanupModules);

const crop = (id = 'crop', familyId = 'family') => ({ id, familyId, name: id, notes: '', version: 1, plantSpacingCm: 20, rowSpacingCm: 30, borderDistanceCm: 15 });
const plant = (id = 'crop', familyId = 'family') => ({ id, familyId, name: id, familyName: familyId, typeVersion: 1, familyVersion: 1, plantSpacingCm: 20, rowSpacingCm: 30, borderDistanceCm: 15 });
const bounds = { xCm: 0, yCm: 0, widthCm: 100, lengthCm: 100 };
const area = (values = {}) => ({ ...bounds, id: 'area', name: '', purpose: 'crop', kind: 'rows', plant: plant(), rowCount: 2, rowDirection: 'length', plantSpacingCm: 20, rowSpacingCm: 30, mulch: [], ...values });
const plan = (...areas) => ({ version: 5, respectAreaSpacing: false, areas });
const bed = (values = {}) => ({ ...bounds, id: 'bed', name: 'Bed', areaPlan: plan(area()), ...values });
const event = (id, date, beds, values = {}) => ({ id, date, order: Number(id), status: 'completed', kind: 'layout', document: { name: 'Garden', dimensions: { widthCm: 1000, lengthCm: 1000 }, beds }, ...values });
const entry = (values = {}) => ({ id: 'entry', version: 1, plant_type_id: 'crop', cultivar_id: null, calendar_profile_id: 'profile', activity: 'direct_sowing', planting_method: 'seed', notes: '', ...values });
const window = (values = {}) => ({ id: 'window', version: 1, calendar_entry_id: 'entry', start_month: 10, end_month: 2, ...values });
const references = (values = {}) => ({ plant_cultivars: [], plant_guidance: [], plant_depths: [], plant_types: [], plant_families: [], rotation_rules: [], mulch_categories: [], isAdmin: false,
  calendar_profiles: [{ id: 'profile', code: 'italy', name: 'Italy', version: 1 }], calendar_coverage: [{ id: 'coverage', country_code: 'IT', region_code: 'IT-25', calendar_profile_id: 'profile', version: 1 }],
  plant_calendar_entries: [entry()], calendar_windows: [window()], ...values });
const input = (values = {}) => ({ bed: bed(), plan: plan(area()), selectedId: 'area', date: '2026-11-18', location: { countryCode: 'IT', regionCode: 'IT-25', displayName: 'Lombardia' },
  catalogue: { isAdmin: false, families: [{ ...crop('family'), id: 'family' }], plants: [crop()], cultivars: [], rules: [] }, references: references(), mixtures: [], history: [], ...values });
const codes = (item) => item.reasons.map((r) => r.code);
const rotation = (values = {}) => ({ id: 'rotation', version: 1, current_family_id: 'family', current_plant_id: null, previous_family_id: 'old-family', previous_plant_id: null, relationship: 'avoid_after', notes: '', ...values });

test('month windows include boundaries, December wrap and disjoint periods', () => {
  for (const month of [10, 11, 12, 1, 2]) assert.equal(monthInWindow(month, 10, 2), true);
  for (const month of [3, 5, 9]) assert.equal(monthInWindow(month, 10, 2), false);
  assert.equal(monthInWindow(6, 6, 6), true);
  const result = suggest(input({ date: '2026-06-01', references: references({ calendar_windows: [window(), window({ id: 'second', start_month: 6, end_month: 6 })] }) }));
  assert.equal(result.candidates[0].season, 'now');
});

test('cultivar calendar replacements distinguish explicit empty entries from missing guidance', () => {
  const catalogue = input().catalogue;
  catalogue.cultivars = [{ ...crop('cultivar'), plantTypeId: 'crop', borderDistanceCm: null, livingMulchEnabled: null }];
  const result = suggest(input({ catalogue, references: references({ plant_calendar_entries: [entry(), entry({ id: 'override', cultivar_id: 'cultivar' })] }) }));
  assert.equal(result.candidates.find((c) => c.id === 'crop').season, 'now');
  const cultivar = result.candidates.find((c) => c.id === 'cultivar:cultivar');
  assert.equal(cultivar.season, 'unavailable'); assert.equal(cultivar.action, undefined);
  assert.equal(suggest(input({ references: references({ plant_calendar_entries: [] }) })).candidates[0].season, 'unknown');
});

test('seedbed-only advice prepares seedlings without offering direct bed planting', () => {
  const candidate = suggest(input({ references: references({ plant_calendar_entries: [entry({ activity: 'seedbed_sowing' })] }) })).candidates[0];
  assert.equal(candidate.season, 'preparation'); assert.equal(candidate.action, undefined);
  assert.ok(codes(candidate).includes('suggestions.preparation'));
  assert.equal(suggest(input({ date: '2026-07-01' })).candidates[0].season, 'outside');
});

test('history follows physical ground through IDs, moves and replacement beds, with edge contact excluded', () => {
  const events = [event('1', '2025-01-01', [bed({ id: 'old', xCm: 100 })]), event('2', '2025-06-01', []),
    event('3', '2027-01-01', [bed({ xCm: 100, areaPlan: plan(area({ plant: plant('future') })) })])];
  const observations = groundHistory(events, '2026-11-18');
  assert.equal(observations.length, 1); assert.equal(observations[0].xCm, 100); assert.equal(observations[0].endedAt, '2025-06-01');
  assert.equal(precedingCrops(observations, { ...bounds, xCm: 100 }).crops[0].observation.plant.id, 'crop');
  assert.equal(precedingCrops(observations, { ...bounds, xCm: 200 }).crops.length, 0);
  assert.equal(precedingCrops(observations, bounds).unknownArea, 10000);
});

test('unchanged checkpoints extend one observation, including area recreation', () => {
  const observations = groundHistory([event('1', '2025-01-01', [bed()]), event('2', '2025-02-01', [bed({ id: 'replacement', areaPlan: plan(area({ id: 'new-area' })) })])], '2026-11-18');
  assert.equal(observations.length, 1); assert.equal(observations[0].since, '2025-01-01');
  assert.equal(observations[0].lastDate, '2025-02-01'); assert.equal(observations[0].eventId, '2');
});

test('splits and partial overlap retain the latest predecessor on each ground portion', () => {
  const observations = groundHistory([event('1', '2025-01-01', [bed()]),
    event('2', '2025-02-01', [bed({ areaPlan: plan(area({ widthCm: 50, plant: plant('new') })) })])], '2026-11-18');
  const result = precedingCrops(observations, bounds);
  assert.equal(result.unknownArea, 0);
  assert.deepEqual(result.crops.map((c) => [c.observation.plant.id, c.overlap]), [['new', 5000], ['crop', 5000]]);
  assert.equal(subtract(bounds, { ...bounds, xCm: 25, yCm: 25, widthCm: 50, lengthCm: 50 }).reduce((s, r) => s + r.widthCm * r.lengthCm, 0), 7500);
});

test('same-day event ordering, planned exclusion and legacy plans retain saved crop identity', () => {
  const legacy = { ...bed(), areaPlan: undefined, plantingPlan: { version: 1, rowDirection: 'length', respectAreaSpacing: true, areas: [{ ...bounds, id: 'legacy', plant: plant(), plantSpacingCm: 20, rowSpacingCm: 30 }], advice: [] } };
  const observations = groundHistory([event('2', '2025-01-01', [bed({ areaPlan: plan(area({ plant: plant('new') })) })]), event('1', '2025-01-01', [legacy]), event('3', '2025-02-01', [], { status: 'planned' })], '2026-11-18');
  assert.equal(precedingCrops(observations, bounds).crops[0].observation.plant.id, 'new');
  assert.equal(observations.find((o) => o.plant.id === 'crop').endedAt, '2025-01-01');
});

test('rotation rules are directional, prefer cultivar specificity, and resolve ties to caution', () => {
  const current = { ...plant(), cultivarId: 'cultivar' }, previous = plant('old', 'old-family');
  const broad = rotation(), specific = rotation({ id: 'specific', current_family_id: null, current_cultivar_id: 'cultivar', relationship: 'favourable_after' });
  assert.equal(rotationAdvice(current, previous, [broad, specific]).relationship, 'favourable_after');
  assert.equal(rotationAdvice(current, previous, [specific, { ...specific, id: 'tie', relationship: 'avoid_after' }]).relationship, 'avoid_after');
  assert.equal(rotationAdvice(previous, current, [broad]).relationship, 'unknown');
});

test('rotation intervals use removal upper bounds and never invent removal of ongoing crops', () => {
  const data = references({ plant_guidance: [{ id: 'care', version: 1, plant_type_id: 'crop', cultivar_id: null, rotation_years: 2 }] });
  const history = groundHistory([event('1', '2020-01-01', [bed()]), event('2', '2025-01-01', [])], '2026-11-18');
  assert.ok(codes(suggest(input({ references: data, history })).candidates[0]).includes('suggestions.rotationInterval'));
  assert.ok(!codes(suggest(input({ references: data, history, date: '2027-01-01' })).candidates[0]).includes('suggestions.rotationInterval'));
  const ongoing = groundHistory([event('1', '2020-01-01', [bed()])], '2030-01-01');
  const result = suggest(input({ references: data, history: ongoing, date: '2030-01-01' }));
  assert.equal(result.candidates[0].reasons.find((r) => r.code === 'suggestions.rotationInterval').values.date, '2020-01-01');
  assert.ok(result.notices.some((r) => r.code === 'suggestions.ongoing'));
});

test('mixtures evaluate every component and preserve all predecessors observed together', () => {
  const catalogue = input().catalogue; catalogue.plants.push(crop('other'));
  const mixtures = [{ id: 'mix', name: 'Mix', version: 1, notes: '', components: [{ plantTypeId: 'crop', cultivarId: null, percentage: 50 }, { plantTypeId: 'other', cultivarId: null, percentage: 50 }] }];
  const data = references({ plant_calendar_entries: [entry(), entry({ id: 'other-entry', plant_type_id: 'other' })], calendar_windows: [window(), window({ calendar_entry_id: 'other-entry', start_month: 3, end_month: 4 })] });
  const mixture = suggest(input({ catalogue, references: data, mixtures })).candidates.find((c) => c.category === 'green_manure');
  assert.equal(mixture.season, 'outside'); assert.ok(codes(mixture).includes('suggestions.outSeason')); assert.ok(codes(mixture).includes('suggestions.density'));
  const mixtureArea = area({ purpose: 'green_manure', kind: 'broadcast', density: 10, densityUnit: 'g_m2', sowing: { kind: 'mixture', mixture: { ...mixtures[0], components: [{ plant: plant(), percentage: 50 }, { plant: plant('other'), percentage: 50 }] } } });
  const observations = groundHistory([event('1', '2025-01-01', [bed({ areaPlan: plan(mixtureArea) })])], '2026-11-18');
  assert.equal(precedingCrops(observations, bounds).crops.length, 2);
});

test('companions include broadcast crops, mixtures and living mulch; current area is excluded', () => {
  const catalogue = input().catalogue; catalogue.plants.push(crop('other'));
  catalogue.rules = [{ id: 'caution', version: 1, first: { kind: 'plant', id: 'crop' }, second: { kind: 'plant', id: 'other' }, relationship: 'caution', notes: 'Rule' }];
  const neighbor = area({ id: 'neighbor', xCm: 100, kind: 'broadcast', sowing: { kind: 'crop', plant: plant('other') }, mulch: [] });
  const result = suggest(input({ catalogue, plan: plan(area(), neighbor) }));
  assert.ok(codes(result.current).includes('suggestions.companionCaution'));
  assert.ok(!codes(suggest(input({ catalogue })).current).includes('suggestions.companionCaution'));
  const mulch = area({ id: 'neighbor', xCm: 100, plant: plant(), mulch: [{ id: 'layer', material: { plantTypeId: 'other' } }] });
  assert.ok(codes(suggest(input({ catalogue, plan: plan(area(), mulch) })).current).includes('suggestions.companionCaution'));
});

test('row fit, missing spacing, missing region and failed history remain explicit', () => {
  const tiny = area({ widthCm: 20 });
  assert.ok(codes(suggest(input({ plan: plan(tiny) })).candidates[0]).includes('suggestions.noFit'));
  const catalogue = input().catalogue; catalogue.plants[0].plantSpacingCm = null;
  catalogue.families[0].plantSpacingCm = null;
  assert.ok(codes(suggest(input({ catalogue })).candidates[0]).includes('suggestions.spacingUnknown'));
  const result = suggest(input({ location: undefined, history: null }));
  assert.equal(result.candidates[0].season, 'unknown');
  assert.ok(result.notices.some((r) => r.code === 'suggestions.regionMissing'));
  assert.ok(!result.notices.some((r) => r.code === 'suggestions.partialHistory'));
});

test('ranking puts supported choices first, remains deterministic and cites matched rules', () => {
  const catalogue = input().catalogue; catalogue.plants.push(crop('better'));
  const data = references({ plant_calendar_entries: [entry(), entry({ id: 'better-entry', plant_type_id: 'better' })], calendar_windows: [window(), window({ calendar_entry_id: 'better-entry' })], rotation_rules: [rotation({ current_family_id: null, current_plant_id: 'crop' })] });
  const history = groundHistory([event('1', '2025-01-01', [bed({ areaPlan: plan(area({ plant: plant('old', 'old-family') })) })])], '2026-11-18');
  const result = suggest(input({ catalogue, references: data, history }));
  assert.equal(result.candidates[0].id, 'better');
  assert.deepEqual(suggest(input({ catalogue, references: data, history })), result);
  assert.deepEqual(result.candidates[1].reasons.find((r) => r.code === 'suggestions.rotationAvoid').sourceIds, ['rotation', '1']);
});

test('care inheritance preserves false overrides and harvest advice never establishes ripeness', () => {
  const selected = area({ plant: { ...plant(), cultivarId: 'cultivar', cultivarName: 'Cultivar' } });
  const data = references({ plant_guidance: [{ id: 'base', version: 1, plant_type_id: 'crop', cultivar_id: null, monthly_feed: true, watering_notes: 'Check soil' }, { id: 'override', version: 1, plant_type_id: 'crop', cultivar_id: 'cultivar', monthly_feed: false, watering_notes: null }],
    plant_calendar_entries: [entry({ activity: 'harvest' })], plant_depths: [{ id: 'depth', plant_type_id: 'crop', cultivar_id: null, planting_method: 'seed', depth_cm: 2, notes: '', version: 1 }] });
  const result = suggest(input({ plan: plan(selected), references: data }));
  assert.equal(result.care[0].guidance.monthly_feed, false); assert.equal(result.care[0].guidance.watering_notes, 'Check soil');
  assert.ok(codes(result.care[0]).includes('suggestions.harvest')); assert.ok(codes(result.care[0]).includes('suggestions.depth'));
  assert.equal(result.cover, true);
});

test('broadcast choices do not turn transplant-only windows into direct-sowing advice', () => {
  const broadcast = area({ kind: 'broadcast', sowing: { kind: 'crop', plant: plant() }, density: 10, densityUnit: 'g_m2' });
  const result = suggest(input({ plan: plan(broadcast), references: references({ plant_calendar_entries: [entry({ activity: 'transplant', planting_method: 'plant' })] }) }));
  assert.equal(result.candidates[0].season, 'unknown');
  assert.ok(!codes(result.candidates[0]).includes('suggestions.inSeason'));
});

test('retained living mulch and mixture components participate in companion checks', () => {
  const catalogue = input().catalogue; catalogue.plants.push(crop('other'));
  catalogue.rules = [{ id: 'caution', version: 1, first: { kind: 'plant', id: 'crop' }, second: { kind: 'plant', id: 'other' }, relationship: 'caution', notes: 'Rule' }];
  const selected = area({ mulch: [{ id: 'layer', material: { plantTypeId: 'other' } }] });
  assert.ok(codes(suggest(input({ catalogue, plan: plan(selected) })).current).includes('suggestions.companionCaution'));
  const mixtures = [{ id: 'mix', name: 'Mix', version: 1, notes: '', components: [{ plantTypeId: 'crop', cultivarId: null, percentage: 50 }, { plantTypeId: 'other', cultivarId: null, percentage: 50 }] }];
  const result = suggest(input({ catalogue, mixtures }));
  assert.ok(codes(result.candidates.find((c) => c.category === 'green_manure')).includes('suggestions.companionCaution'));
});
