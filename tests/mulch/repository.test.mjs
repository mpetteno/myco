import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';

const repository = await loadModule('tests/mulch/modules.ts', 'mulch-repository');
after(cleanupModules);
const row = { id: 'mulch-a', name: 'Straw', notes: 'Dry material', version: 1 };
function fixture(handler) {
  const requests = [];
  globalThis.__mycoAuthClient = createClient('https://mulch-test.supabase.co', 'sb_publishable_fixture', {
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

test('loads global mulch types and only the current account administrator membership', async () => {
  const requests = fixture(({ url }) => ({ data: url.pathname.endsWith('mulch_types') ? [row] : url.pathname.endsWith('catalogue_administrators') ? [{ user_id: 'admin-a' }] : [] }));
  const loaded = await repository.loadMulchCatalogue('admin-a');
  assert.equal(loaded.isAdmin, true);
  assert.deepEqual(loaded.types, [{ ...row, categoryId: null, plantTypeId: null, cultivarId: null, categoryCode: undefined, available: true }]);
  assert.deepEqual(loaded.categories, []);
  assert.equal(requests[0].url.searchParams.get('order'), 'name.asc');
  assert.equal(requests[1].url.searchParams.get('user_id'), 'eq.admin-a');
  fixture(({ url }) => ({ data: url.pathname.endsWith('mulch_types') ? [row] : [] }));
  assert.equal((await repository.loadMulchCatalogue('reader-a')).isAdmin, false);
});

test('saves only trimmed details and checks the loaded revision on edits', async () => {
  const requests = fixture(({ method }) => ({ data: method === 'PATCH' ? [{ ...row, version: 2 }] : row }));
  const details = { name: ' Straw ', notes: ' Dry material ' };
  const created = await repository.saveMulchType(details);
  assert.deepEqual(requests[0].body, { name: 'Straw', notes: 'Dry material', category_id: null, plant_type_id: null, cultivar_id: null });
  const updated = await repository.saveMulchType(details, created);
  assert.equal(updated.version, 2);
  assert.equal(requests[1].url.searchParams.get('id'), 'eq.mulch-a');
  assert.equal(requests[1].url.searchParams.get('version'), 'eq.1');
  assert.deepEqual(requests[1].body, requests[0].body);
});

test('validates before writing and reports duplicates, revoked access, conflicts and missing migrations', async () => {
  const requests = fixture(() => ({ data: row }));
  for (const details of [{ name: '  ', notes: '' }, { name: 'x'.repeat(101), notes: '' }, { name: 'Straw', notes: 'x'.repeat(2001) }])
    await assert.rejects(repository.saveMulchType(details), /name|notes/);
  assert.equal(requests.length, 0);
  for (const [code, message] of [['23505', /already exists/], ['42501', /Only catalogue administrators/], ['PGRST205', /not available yet/]]) {
    fixture(() => ({ data: { code }, status: 400 }));
    await assert.rejects(repository.saveMulchType(row), message);
  }
  fixture(() => ({ data: [] }));
  await assert.rejects(repository.saveMulchType(row, row), /entry changed/);
  fixture(() => ({ data: { code: 'PGRST205' }, status: 404 }));
  await assert.rejects(repository.loadMulchCatalogue('admin-a'), /mulch catalogue is not available/);
});

test('removes mulch through the admin RPC with the loaded revision and reports failures',async()=>{
  const requests=fixture(()=>({data:null}));
  await repository.removeMulchType(row);
  assert.equal(requests[0].url.pathname,'/rest/v1/rpc/myco_remove_mulch_type');
  assert.deepEqual(requests[0].body,{entry_id:row.id,expected_version:row.version});
  for(const [code,message] of [['42501',/Only catalogue administrators/],['40001',/changed or was already removed/],['PGRST202',/not available yet/],['unknown',/Could not remove/]]){
    fixture(()=>({data:{code},status:400}));await assert.rejects(repository.removeMulchType(row),message);
  }
});

test('living choices derive automatically from flags, inherit cultivar eligibility and retain stable IDs', async () => {
  const categories = [{ id: 'living', code: 'living', name: 'Living mulch', notes: '', version: 1 }];
  const crop = { id: 'crop', name: 'Clover', familyId: 'family', notes: '', version: 2, plantSpacingCm: 10, rowSpacingCm: 20, borderDistanceCm: 15, livingMulchEnabled: true };
  const cultivar = { id: 'cultivar', plantTypeId: 'crop', name: 'White', notes: '', version: 1, plantSpacingCm: null, rowSpacingCm: null, borderDistanceCm: null, livingMulchEnabled: null };
  const plants = { families: [], plants: [crop], cultivars: [cultivar], rules: [], isAdmin: false };
  let types = repository.livingMulchTypes(plants, categories);
  assert.deepEqual(types.map(type => type.id), ['living:crop:crop', 'living:cultivar:cultivar']);
  crop.name = 'Renamed'; assert.equal(repository.livingMulchTypes(plants, categories)[0].id, types[0].id);
  cultivar.livingMulchEnabled = false; assert.equal(repository.livingMulchTypes(plants, categories).length, 1);
  crop.livingMulchEnabled = false; cultivar.livingMulchEnabled = true;
  assert.deepEqual(repository.livingMulchTypes(plants, categories).map(type => type.id), ['living:cultivar:cultivar']);
  crop.name = 'x'.repeat(100); cultivar.name = 'y'.repeat(100);
  assert.ok(repository.livingMulchTypes(plants, categories)[0].name.length <= 100);
});

test('repository refresh builds eligible living choices without manual rows and excludes legacy duplicates', async () => {
  let enabled = true;
  const requests = fixture(({ url }) => ({ data: url.pathname.endsWith('mulch_types')
    ? [{ ...row, id: 'legacy-living', category_id: 'living', plant_type_id: 'crop' }]
    : url.pathname.endsWith('mulch_categories') ? [{ id: 'living', code: 'living', name: 'Living', version: 1 }]
    : url.pathname.endsWith('plant_types') ? [{ id: 'crop', name: 'Basil', notes: '', version: 1, family_id: 'family', living_mulch_enabled: enabled }]
    : [] }));
  let data = await repository.loadMulchCatalogue('reader');
  assert.equal(data.types.find(item => item.id === 'legacy-living').available, false);
  assert.deepEqual(data.types.filter(item => item.available).map(item => item.name), ['Basil']);
  const living = data.types.find(item => item.available);
  const count = requests.length;
  await assert.rejects(repository.saveMulchType({ name: 'Changed', notes: '' }, living), /managed from the plant catalogue/);
  await assert.rejects(repository.removeMulchType(living), /managed from the plant catalogue/);
  assert.equal(requests.length, count);
  enabled = false; data = await repository.loadMulchCatalogue('reader');
  assert.equal(data.types.filter(item => item.available).length, 0);
});
