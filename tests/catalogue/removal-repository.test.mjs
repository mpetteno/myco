import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
const { removeCatalogueEntry } = await loadModule('tests/catalogue/removal-modules.ts', 'catalogue-removal');
after(cleanupModules);
function fixture(code) {
  const requests = [];
  globalThis.__mycoAuthClient = createClient('https://test.supabase.co', 'fixture', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, init) => {
    requests.push({ url: new URL(input), body: JSON.parse(init.body) });
    return new Response(JSON.stringify(code ? { code } : null), { status: code ? 400 : 200, headers: { 'Content-Type': 'application/json' } });
  } } });
  return requests;
}
test('all removal kinds submit the loaded ID and revision through their scoped RPC', async () => {
  const requests = fixture();
  for (const kind of ['plant_family', 'plant_type', 'seed_mixture', 'mulch_category', 'cultivar', 'mulch_type']) await removeCatalogueEntry(kind, { id: 'entry', version: 4 });
  assert.deepEqual(requests.map(request => request.url.pathname.split('/').at(-1)), ['myco_remove_plant_family', 'myco_remove_plant_type', 'myco_remove_seed_mixture', 'myco_remove_mulch_category', 'myco_remove_cultivar', 'myco_remove_mulch_type']);
  assert.ok(requests.every(request => request.body.entry_id === 'entry' && request.body.expected_version === 4));
});
test('removal errors explain dependency, access, stale-data and missing-migration failures', async () => {
  for (const [kind, message] of [['plant_family', /used by crops/], ['plant_type', /used by cultivars/], ['mulch_category', /used by materials/]]) {
    fixture('23503'); await assert.rejects(removeCatalogueEntry(kind, { id: 'entry', version: 1 }), message);
  }
  for (const [code, message] of [['42501', /Only catalogue administrators/], ['40001', /changed|removed/], ['PGRST202', /not available/]]) {
    fixture(code); await assert.rejects(removeCatalogueEntry('seed_mixture', { id: 'entry', version: 1 }), message);
  }
});
