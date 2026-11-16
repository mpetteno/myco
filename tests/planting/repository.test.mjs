import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';
import { bed, areaV2, planV5 } from './fixtures.mjs';
import { mulchPlan } from '../mulch/fixtures.mjs';

const repository = await loadModule('tests/planting/modules.ts', 'planting-repository');
after(cleanupModules);
test('garden saves and reloads retain planting geometry, overrides and catalogue snapshots', async () => {
  const row = { id: 'garden-a', owner_id: 'owner-a', name: 'Garden', width_cm: 500, length_cm: 500,
    version: 1, updated_at: '2026-01-01', beds: [bed] };
  const requests = [];
  globalThis.__mycoAuthClient = createClient('https://planting-test.supabase.co', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const body = init.body ? JSON.parse(init.body) : null; requests.push({ url: new URL(input), body });
      if (init.method === 'PATCH') { Object.assign(row, body); row.version++; }
      return new Response(JSON.stringify([row]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const current = await repository.loadGarden(row.id);
  const plantingPlan = planV5({ respectAreaSpacing: false, areas: [areaV2({ rowDirection: 'width', rowCount: 2 })] });
  const next = { name: current.name, dimensions: current.dimensions, beds: [{ ...bed, plantingPlan, mulchPlan: mulchPlan() }] };
  await repository.saveGarden(current, next);
  assert.deepEqual(requests[1].body.beds[0].plantingPlan, plantingPlan);
  assert.deepEqual(requests[1].body.beds[0].mulchPlan, mulchPlan());
  assert.equal(requests[1].url.searchParams.get('version'), 'eq.1');
  const restored = await repository.loadGarden(row.id);
  assert.deepEqual(restored.beds[0].plantingPlan, plantingPlan);
  assert.deepEqual(restored.beds[0].mulchPlan, mulchPlan());
  await repository.saveGarden(restored, { ...next, beds: [bed] });
  assert.equal((await repository.loadGarden(row.id)).beds[0].plantingPlan, undefined);
});
