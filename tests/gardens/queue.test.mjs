import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule, tick } from '../auth/helpers.mjs';

const { GardenSaveQueue, GardenStorageError } = await loadModule('tests/gardens/modules.ts', 'queue');
after(cleanupModules);
const initial = { id: 'garden-1', ownerId: 'owner-1', name: 'Herb garden', version: 1,
  dimensions: { widthCm: 500, lengthCm: 300 }, beds: [], updatedAt: '2026-01-01' };
const document = (name) => ({ name, dimensions: initial.dimensions, beds: [] });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('serializes saves, coalesces pending edits and waits for the latest version before leaving', async () => {
  const calls = [], saved = [], requests = [];
  const queue = new GardenSaveQueue(initial, (current, next) => {
    const request = deferred(); requests.push(request); calls.push({ current, next }); return request.promise;
  }, (garden) => saved.push(garden));
  queue.enqueue(document('First'));
  queue.enqueue(document('Second'));
  queue.enqueue(document('Latest'));
  let left = false;
  const leaving = queue.flush().then(() => { left = true; });
  assert.equal(calls.length, 1);
  assert.equal(queue.getSnapshot().state, 'saving');
  requests[0].resolve({ ...initial, ...calls[0].next, version: 2 }); await tick();
  assert.equal(left, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].current.version, 2);
  assert.equal(calls[1].next.name, 'Latest');
  requests[1].resolve({ ...initial, ...calls[1].next, version: 3 }); await leaving;
  assert.equal(queue.getSnapshot().state, 'saved');
  assert.equal(saved.at(-1).name, 'Latest');
});

test('a failed save retains the newest layout and explicit retry uses the last saved version', async () => {
  const first = deferred(), calls = [];
  const queue = new GardenSaveQueue(initial, async (current, next) => {
    calls.push({ current, next });
    if (calls.length === 1) return first.promise;
    return { ...current, ...next, version: current.version + 1 };
  }, () => {});
  queue.enqueue(document('Failed'));
  queue.enqueue(document('Newer'));
  const failure = assert.rejects(queue.flush()); first.reject(new Error('Offline')); await failure;
  assert.equal(queue.getSnapshot().state, 'error');
  queue.enqueue(document('Newest'));
  assert.equal(calls.length, 1, 'does not repeatedly retry while offline');
  await queue.flush();
  assert.equal(calls[1].current.version, 1);
  assert.equal(calls[1].next.name, 'Newest');
  assert.equal(queue.getSnapshot().state, 'saved');
});

test('a version conflict keeps unsaved edits and exposes reload feedback', async () => {
  const queue = new GardenSaveQueue(initial, async () => {
    throw new GardenStorageError('Changed elsewhere', true);
  }, () => {});
  queue.enqueue(document('Local'));
  await assert.rejects(queue.flush());
  assert.equal(queue.getSnapshot().state, 'error');
  assert.equal(queue.getSnapshot().conflict, true);
  assert.equal(queue.getSnapshot().message, 'Changed elsewhere');
});

test('a completed work result advances the save base before subsequent edits',async()=>{
  const calls=[];
  const queue=new GardenSaveQueue(initial,async(current,next)=>{calls.push(current.version);return {...current,...next,version:current.version+1};},()=>{});
  queue.adopt({...initial,version:5,name:'Completed work'});
  queue.enqueue(document('Next edit'));await queue.flush();
  assert.deepEqual(calls,[5]);assert.equal(queue.getCurrent().version,6);
});
