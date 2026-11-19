import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';

const repository = await loadModule('tests/history/modules.ts', 'history-repository');
after(cleanupModules);
const document = { name: 'Garden', dimensions: { widthCm: 500, lengthCm: 300 }, beds: [] };
const row = { id: 'event-a', garden_id: 'garden-a', event_order: 1, event_date: '2026-02-10', title: 'First layout',
  notes: '', source_version: 3, recorded_at: '2026-02-11T10:00:00Z', actor_id: 'owner-a', snapshot: document };
function fixture(handler) {
  const requests = [];
  globalThis.__mycoAuthClient = createClient('https://history-test.supabase.co', 'sb_publishable_fixture', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const request = { url: new URL(input), method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null };
      requests.push(request);
      const { data, status = 200 } = request.url.pathname.endsWith('bed_activities') ? { data:[] } : handler(request);
      return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return requests;
}

test('suggestion snapshots are bulk-paginated, ordered chronologically and use frozen display states', async () => {
  const requests = fixture(({ url }) => {
    if (url.pathname.endsWith('gardens')) return { data: [{ id: 'garden-a' }] };
    return { data: url.searchParams.get('event_order') === 'gt.0'
      ? Array.from({ length: 200 }, (_, i) => ({ ...row, id: `event-${i}`, event_order: i + 1, display_snapshot: { ...document, name: `Frozen ${i}` } }))
      : [{ ...row, id: 'backdated', event_order: 201, event_date: '2026-01-01', display_snapshot: { ...document, name: 'Backdated' } }] };
  });
  const result = await repository.loadSuggestionHistory('garden-a');
  assert.equal(result.length, 201); assert.equal(result[0].document.name, 'Backdated');
  assert.equal(result.at(-1).document.name, 'Frozen 199');
  assert.equal(requests.length, 3, 'one authorization read plus bulk pages, no request per event');
  assert.equal(requests[2].url.searchParams.get('event_order'), 'gt.200');
  for (const request of requests.slice(1)) {
    assert.equal(request.method, 'GET');
    assert.equal(request.url.searchParams.get('garden_id'), 'eq.garden-a');
    assert.equal(request.url.searchParams.get('deleted_at'), 'is.null');
  }
});

test('suggestion snapshots reconstruct legacy bed scope without recording unrelated proposals', async () => {
  const bed = { id: 'bed-a', name: 'Bed A', xCm: 0, yCm: 0, widthCm: 100, lengthCm: 100 };
  const other = { ...bed, id: 'bed-b', name: 'Bed B', xCm: 200 };
  fixture(({ url }) => ({ data: url.pathname.endsWith('gardens') ? [{ id: 'garden-a' }] : [
    { ...row, id: 'base', snapshot: { ...document, beds: [bed, other] } },
    { ...row, id: 'scoped', event_order: 2, event_kind: 'bed', bed_id: bed.id,
      snapshot: { ...document, beds: [{ ...bed, name: 'Confirmed' }, { ...other, name: 'Unrecorded proposal' }] } },
  ] }));
  const result = await repository.loadSuggestionHistory('garden-a');
  assert.equal(result[1].document.beds.find((b) => b.id === 'bed-a').name, 'Confirmed');
  assert.equal(result[1].document.beds.find((b) => b.id === 'bed-b').name, 'Bed B');
  assert.equal(result[0].document.beds[0].name, 'Bed A');
});

test('suggestion history rejects revoked access and partial page failures', async () => {
  let requests = fixture(() => ({ data: [] }));
  await assert.rejects(repository.loadSuggestionHistory('garden-a'), /access|available/);
  assert.equal(requests.length, 1);
  requests = fixture(({ url }) => url.pathname.endsWith('gardens') ? { data: [{ id: 'garden-a' }] } : { data: { code: '42501' }, status: 403 });
  await assert.rejects(repository.loadSuggestionHistory('garden-a'), /access|available/);
  assert.equal(requests.length, 2);
});

test('loads paginated event metadata with stable cursors and orders backdated events by date then recording order', async () => {
  const requests = fixture(({ url }) => {
    if (url.pathname.endsWith('gardens')) return { data: [{ id: 'garden-a' }] };
    return { data: url.searchParams.get('event_order') === 'gt.0'
      ? Array.from({ length: 200 }, (_, index) => ({ ...row, id: `event-${index}`, event_order: index + 1 }))
      : [{ ...row, id: 'backdated', event_order: 201, event_date: '2026-02-09' }] };
  });
  const result = await repository.listGardenEvents('garden-a');
  assert.equal(result.length, 201); assert.equal(result[0].id, 'backdated');
  assert.equal(requests[2].url.searchParams.get('event_order'), 'gt.200');
  assert.ok(!requests[1].url.searchParams.get('select').includes('snapshot'));
  assert.equal(requests[1].url.searchParams.get('garden_id'), 'eq.garden-a');
});

test('loads a scoped snapshot and records only metadata, a revision and an idempotency ID', async () => {
  const requests = fixture(({ method }) => ({ data: method === 'POST' ? row : [row] }));
  const loaded = await repository.loadGardenEvent('garden-a', 'event-a');
  assert.deepEqual(loaded.document, document);
  assert.equal(requests[0].url.searchParams.get('id'), 'eq.event-a');
  await repository.recordGardenEvent('garden-a', 3, { date: row.event_date, title: ' First layout ', notes: ' Notes ' }, 'request-a');
  assert.equal(requests[1].url.pathname, '/rest/v1/rpc/record_garden_layout_event');
  assert.deepEqual(requests[1].body, { p_garden_id: 'garden-a', p_expected_version: 3, p_event_id: 'request-a',
    p_event_date: '2026-02-10', p_title: 'First layout', p_notes: 'Notes' });
  assert.ok(!('snapshot' in requests[1].body));
});

test('validates before writes and reports missing history, revoked access and stale snapshots', async () => {
  const requests = fixture(() => ({ data: row }));
  await assert.rejects(repository.recordGardenEvent('garden-a', 3, { date: '2026-02-30', title: 'Entry', notes: '' }, 'request-a'), /valid event date/);
  assert.equal(requests.length, 0);
  for (const [code, message] of [['PGRST202', /not available yet/], ['42501', /access was removed/], ['40001', /changed in another session/]]) {
    fixture(() => ({ data: { code }, status: 400 }));
    await assert.rejects(repository.recordGardenEvent('garden-a', 3, { date: row.event_date, title: 'Entry', notes: '' }, 'request-a'), message);
  }
  fixture(() => ({ data: [] }));
  await assert.rejects(repository.loadGardenEvent('garden-a', 'missing'), /no longer available/);
  await assert.rejects(repository.listGardenEvents('garden-a'), /access was removed/);
  fixture(() => ({ data: [{ ...row, snapshot: {} }] }));
  await assert.rejects(repository.loadGardenEvent('garden-a', 'event-a'), /unsupported or invalid layout/);
});

test('materialized history states load directly and do not replay earlier corrections into later records',async()=>{
  const displayed={...document,name:'Frozen actual garden'};
  const requests=fixture(()=>({data:[{...row,event_kind:'planting',bed_id:'bed-a',version:3,display_snapshot:displayed}]}));
  const event=await repository.loadGardenEvent('garden-a','event-a');
  assert.deepEqual(event.document,displayed);assert.equal(event.eventVersion,3);assert.equal(requests.length,1);
});

test('historical writes send an explicit document, revision, scope and retry identity without updating the live garden',async()=>{
  const requests=fixture(()=>({data:{...row,version:2,display_snapshot:document}}));
  const draft={event:{id:'event-a',eventVersion:1},kind:'layout',document,details:{date:'2026-02-10',title:'Old',notes:''}};
  const details={date:'2026-01-10',title:' Correction ',notes:' Note '};
  await repository.saveHistoricalEvent('garden-a',draft,document,details,'event-a','retry-a');
  assert.equal(requests.length,1);assert.equal(requests[0].url.pathname,'/rest/v1/rpc/save_garden_history_event');
  assert.deepEqual(requests[0].body,{p_garden_id:'garden-a',p_event_id:'event-a',p_event_version:1,p_request_id:'retry-a',
    p_event_date:'2026-01-10',p_title:'Correction',p_notes:'Note',p_document:document,p_kind:'layout',p_bed_id:null});
  await assert.rejects(repository.saveHistoricalEvent('garden-a',draft,{...document,dimensions:{widthCm:0,lengthCm:300}},details,'event-a','retry-b'),/dimensions/);
  assert.equal(requests.length,1);
});

test('past editors choose the last complete state on or before the selected date',async()=>{
  const requests=fixture(({url})=>({data:url.pathname.endsWith('gardens')?[{id:'garden-a'}]:url.searchParams.get('select')==='id'?[{id:row.id}]:[{...row,display_snapshot:document}]}));
  assert.deepEqual((await repository.loadHistoryAtDate('garden-a','2026-02-15')).document,document);
  assert.equal(requests[1].url.searchParams.get('event_date'),'lte.2026-02-15');
  assert.equal(requests[1].url.searchParams.get('order'),'event_date.desc,event_order.desc');
  assert.equal(requests[1].url.searchParams.get('limit'),'1');
  assert.equal(requests[1].url.searchParams.get('deleted_at'),'is.null');
});

test('history queries exclude deleted entries and deletion sends only the selected revision and retry identity',async()=>{
  const requests=fixture(({url})=>({data:url.pathname.endsWith('gardens')?[{id:'garden-a'}]:url.pathname.includes('/rpc/')?null:[{...row,display_snapshot:document}]}));
  await repository.listGardenEvents('garden-a');await repository.loadGardenEvent('garden-a','event-a');
  for(const request of requests.filter(item=>item.url.pathname.endsWith('garden_layout_events'))){
    assert.equal(request.url.searchParams.get('deleted_at'),'is.null');
  }
  assert.ok(requests.every(item=>!item.url.pathname.endsWith('bed_activities')));
  await repository.deleteHistoryEntry('garden-a','event-a',3,'delete-a');
  assert.equal(requests.at(-1).url.pathname,'/rest/v1/rpc/delete_garden_history_event');
  assert.deepEqual(requests.at(-1).body,{p_garden_id:'garden-a',p_event_id:'event-a',p_event_version:3,p_request_id:'delete-a'});
  fixture(()=>({data:{code:'40001'},status:409}));
  await assert.rejects(repository.deleteHistoryEntry('garden-a','event-a',3,'delete-a'),/changed in another session/);
  fixture(()=>({data:[{...row,deleted_at:'2026-01-01T00:00:00Z'}]}));
  await assert.rejects(repository.loadGardenEvent('garden-a','event-a'),/no longer available/);
});
