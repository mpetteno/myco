import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
const repo = await loadModule('tests/catalogue/mixture-modules.ts', 'mixture-repository');
after(cleanupModules);
function fixture(handler) {
  const requests = [];
  globalThis.__mycoAuthClient = createClient('https://mixture-test.supabase.co', 'fixture', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    const request = { url: new URL(input), method: init.method, body: init.body ? JSON.parse(init.body) : null }; requests.push(request);
    const { data, status = 200 } = handler(request);
    return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  } } }); return requests;
}
const details = { name: ' Cover mix ', notes: ' Notes ', components: [{ plantTypeId: 'crop', cultivarId: null, percentage: 100 }] };
test('mixtures load crop/cultivar components in composition order and save atomically with the parent revision', async () => {
  fixture(({ url }) => ({ data: url.pathname.endsWith('seed_mixtures') ? [{ id: 'mix', name: 'Mix', notes: '', version: '4' }] : [{ id: 'component', mixture_id: 'mix', plant_type_id: 'crop', cultivar_id: 'cultivar', weight_percent: '100' }] }));
  const mixtures = await repo.loadSeedMixtures();
  assert.equal(mixtures[0].version, 4); assert.deepEqual(mixtures[0].components, [{ plantTypeId: 'crop', cultivarId: 'cultivar', percentage: 100 }]);
  const requests = fixture(() => ({ data: 'mix' }));
  await repo.saveSeedMixture(details, { id: 'mix', version: 4 });
  assert.equal(requests.length, 1); assert.equal(requests[0].url.pathname, '/rest/v1/rpc/myco_save_seed_mixture');
  assert.deepEqual(requests[0].body, { mixture_id: 'mix', expected_version: 4, details: { name: 'Cover mix', notes: 'Notes' }, components: [{ plant_type_id: 'crop', cultivar_id: null, weight_percent: 100 }] });
});
test('invalid totals make no request; conflicts, revoked permissions and missing data surface to the form', async () => {
  const requests = fixture(() => ({ data: null }));
  await assert.rejects(repo.saveSeedMixture({ ...details, components: [{ ...details.components[0], percentage: 80 }] }), /100%/);
  assert.equal(requests.length, 0);
  for (const [code, message] of [['42501', /administrators/], ['40001', /changed/], ['23503', /no longer available/]]) {
    fixture(() => ({ data: { code }, status: 400 }));
    await assert.rejects(repo.saveSeedMixture(details), message);
  }
  fixture(() => ({ data: { code: '42P01' }, status: 400 })); await assert.rejects(repo.loadSeedMixtures(), /not available/);
});
