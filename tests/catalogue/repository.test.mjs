import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';

const repository = await loadModule('tests/catalogue/modules.ts', 'catalogue-repository');
after(cleanupModules);
const familyRow = { id: 'family-a', name: 'Family A', notes: '', plant_spacing_cm: 30, row_spacing_cm: 40, version: 1 };
const plantRow = { ...familyRow, id: 'plant-a', name: 'Type A', family_id: familyRow.id, plant_spacing_cm: null, border_distance_cm: 25 };
const ruleRow = { id: 'rule-a', family_a_id: familyRow.id, plant_a_id: null, family_b_id: null, plant_b_id: plantRow.id,
  relationship: 'companion', notes: '', version: 1 };
const details = { name: ' Family A ', notes: '', plantSpacingCm: 30, rowSpacingCm: 40, borderDistanceCm: 25 };
function fixture(handler) {
  const requests = [];
  globalThis.__mycoAuthClient = createClient('https://catalogue-test.supabase.co', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const request = { url: new URL(input), method: init.method, body: init.body ? JSON.parse(init.body) : null };
      requests.push(request);
      const { data, status = 200 } = handler(request);
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return requests;
}

test('loads the app-wide catalogue and checks only the current user’s administrator membership', async () => {
  const tables = { plant_families: [familyRow], plant_types: [plantRow], companion_rules: [ruleRow], catalogue_administrators: [{ user_id: 'admin-a' }] };
  const requests = fixture(({ url }) => ({ data: tables[url.pathname.split('/').at(-1)] }));
  const data = await repository.loadCatalogue('admin-a');
  assert.equal(data.isAdmin, true);
  assert.equal(data.plants[0].familyId, familyRow.id);
  assert.equal(data.plants[0].plantSpacingCm, null);
  assert.equal(data.plants[0].borderDistanceCm,25);
  assert.deepEqual(data.rules[0].first, { kind: 'family', id: familyRow.id });
  assert.equal(requests.find((item) => item.url.pathname.endsWith('catalogue_administrators')).url.searchParams.get('user_id'), 'eq.admin-a');
  tables.catalogue_administrators = [];
  assert.equal((await repository.loadCatalogue('reader-a')).isAdmin, false);
});

test('writes trimmed family and plant details and protects updates with the loaded version', async () => {
  const requests = fixture(({ url, method }) => ({ data: method === 'PATCH' ? [{ ...plantRow, version: 2 }] : url.pathname.endsWith('plant_types') ? plantRow : familyRow }));
  const family = await repository.saveFamily(details);
  assert.equal(family.name, familyRow.name);
  assert.deepEqual(requests[0].body, { name: 'Family A', notes: '', plant_spacing_cm: 30, row_spacing_cm: 40 });
  const plant = await repository.savePlant({ ...details, name: 'Type A', familyId: familyRow.id, plantSpacingCm: null });
  assert.equal(plant.plantSpacingCm, null);
  assert.equal(plant.borderDistanceCm,25);
  assert.equal(requests[1].body.border_distance_cm,25);
  await repository.savePlant({ ...details, name: 'Updated', familyId: familyRow.id }, plant);
  assert.equal(requests[2].url.searchParams.get('id'), 'eq.plant-a');
  assert.equal(requests[2].url.searchParams.get('version'), 'eq.1');
  assert.ok(!('version' in requests[2].body));
});

test('canonicalizes companion pairs and writes suggestions and warnings without hard restrictions', async () => {
  const requests = fixture(() => ({ data: ruleRow }));
  await repository.saveRule({ first: { kind: 'plant', id: plantRow.id }, second: { kind: 'family', id: familyRow.id }, relationship: 'caution', notes: ' Optional warning ' });
  assert.deepEqual(requests[0].body, { family_a_id: familyRow.id, plant_a_id: null, family_b_id: null, plant_b_id: plantRow.id,
    relationship: 'caution', notes: 'Optional warning' });
});

test('validates before writes and reports permission, duplicate and stale-entry errors', async () => {
  const requests = fixture(() => ({ data: { code: '42501' }, status: 403 }));
  await assert.rejects(repository.saveFamily({ ...details, plantSpacingCm: -1 }), /positive distance/);
  await assert.rejects(repository.savePlant({ ...details, familyId: '' }), /Choose a plant family/);
  await assert.rejects(repository.savePlant({ ...details, familyId:familyRow.id, borderDistanceCm:12 }), /Border distance/);
  assert.equal(requests.length, 0);
  await assert.rejects(repository.saveFamily(details), /Only catalogue administrators/);
  fixture(() => ({ data: { code: '23505' }, status: 409 }));
  await assert.rejects(repository.saveFamily(details), /already exists/);
  fixture(() => ({ data: [] }));
  await assert.rejects(repository.saveFamily(details, { id: familyRow.id, version: 1 }), /changed or your administrator access/);
});
