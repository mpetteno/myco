import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';

const repository = await loadModule('tests/gardens/modules.ts', 'repository');
after(cleanupModules);
const row = { id: 'garden-1', owner_id: 'owner-1', name: 'Kitchen garden', width_cm: 500,
  length_cm: 300, version: 1, updated_at: '2026-01-01', beds: [] };
const document = { name: row.name, dimensions: { widthCm: 500, lengthCm: 300 }, beds: [] };
function fixture(replies) {
  const requests = [];
  globalThis.__mycoAuthClient = createClient('https://garden-test.supabase.co', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      requests.push({ url: new URL(input), method: init.method, body: init.body ? JSON.parse(init.body) : null });
      const { data, status = 200 } = replies.shift() ?? assert.fail('Unexpected storage request');
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return requests;
}

test('creates empty gardens, lists owned and shared gardens through RLS and reloads the saved layout', async () => {
  const shared = { ...row, id: 'garden-shared', owner_id: 'someone-else' };
  const requests = fixture([{ data: row }, { data: [row, shared] }, { data: [row] }]);
  const created = await repository.createGarden('owner-1', { ...document, name: ' Kitchen garden ' });
  assert.equal(created.name, 'Kitchen garden');
  assert.deepEqual(requests[0].body, { owner_id: 'owner-1', name: row.name, width_cm: 500, length_cm: 300, beds: [] });
  const gardens = await repository.listGardens();
  assert.equal(gardens.length, 2);
  assert.equal(gardens[1].ownerId, 'someone-else');
  assert.equal(requests[1].url.searchParams.has('owner_id'), false);
  assert.equal(requests[1].url.searchParams.get('order'), 'updated_at.desc');
  assert.deepEqual(await repository.loadGarden(created.id), created);
});

test('saves the full layout with a version condition and reports stale updates as conflicts', async () => {
  const bed = { id: 'bed-1', name: 'Herbs', widthCm: 100, lengthCm: 50, xCm: 5, yCm: 10 };
  const requests = fixture([{ data: [row] }, { data: [{ ...row, name: 'Renamed', beds: [bed], version: 2 }] },
    { data: [] }]);
  const current = await repository.loadGarden(row.id);
  const saved = await repository.saveGarden(current, { ...document, name: 'Renamed', beds: [bed] });
  assert.equal(saved.version, 2);
  assert.equal(requests[1].method, 'PATCH');
  assert.equal(requests[1].url.searchParams.get('id'), 'eq.garden-1');
  assert.equal(requests[1].url.searchParams.get('version'), 'eq.1');
  assert.deepEqual(requests[1].body.beds, [bed]);
  assert.ok(!('owner_id' in requests[1].body));
  await assert.rejects(repository.saveGarden(current, document), (error) => error.conflict === true);
});

test('validates before sending writes and exposes missing migration, network and unavailable-garden errors', async () => {
  const requests = fixture([{ data: { code: 'PGRST205' }, status: 404 }, { data: [] },
    { data: { message: 'Unavailable' }, status: 503 }]);
  await assert.rejects(repository.createGarden('owner-1', { ...document, dimensions: { widthCm: 12, lengthCm: 300 } }), /multiples of 5/);
  assert.equal(requests.length, 0);
  await assert.rejects(repository.listGardens(), /not available yet/);
  await assert.rejects(repository.loadGarden(row.id), /no longer available/);
  await assert.rejects(repository.createGarden('owner-1', document), /Check your connection/);
});

test('sharing repository calls scoped RPCs and maps member emails without exposing auth administration', async () => {
  const requests = fixture([{ data: [{ user_id: 'editor-1', email: 'editor@example.test' }] }, { data: null }, { data: null }]);
  assert.deepEqual(await repository.listGardenMembers(row.id), [{ userId: 'editor-1', email: 'editor@example.test' }]);
  await repository.shareGarden(row.id, ' editor@example.test ');
  await repository.unshareGarden(row.id, 'editor-1');
  assert.equal(requests[0].url.pathname, '/rest/v1/rpc/list_garden_members');
  assert.deepEqual(requests[0].body, { p_garden_id: row.id });
  assert.equal(requests[1].url.pathname, '/rest/v1/rpc/share_garden');
  assert.deepEqual(requests[1].body, { p_garden_id: row.id, p_email: 'editor@example.test' });
  assert.equal(requests[2].url.pathname, '/rest/v1/rpc/unshare_garden');
  assert.deepEqual(requests[2].body, { p_garden_id: row.id, p_user_id: 'editor-1' });
});

test('sharing reports missing accounts, owner-only access and unavailable migrations', async () => {
  fixture([{ data: { code: 'P0002' }, status: 404 }, { data: { code: '42501' }, status: 403 },
    { data: { code: 'PGRST202' }, status: 404 }, { data: { code: '22023' }, status: 400 }]);
  await assert.rejects(repository.shareGarden(row.id, 'missing@example.test'), /No confirmed account/);
  await assert.rejects(repository.unshareGarden(row.id, 'editor-1'), /Only the garden owner/);
  await assert.rejects(repository.listGardenMembers(row.id), /not available yet/);
  await assert.rejects(repository.shareGarden(row.id, 'owner@example.test'), /owner already has access/);
});
