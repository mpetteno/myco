import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule, tick } from './helpers.mjs';

const { observeAuthSession } = await loadModule('src/features/auth/authSession.ts', 'session');
after(cleanupModules);

function pendingClient() {
  let resolve, reject, listener, unsubscribed = 0;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  globalThis.__mycoAuthClient = { auth: {
    onAuthStateChange: (callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: () => { unsubscribed++; } } } };
    }, getSession: () => promise,
  } };
  return { resolve, reject, emit: (session) => listener('SIGNED_IN', session), count: () => unsubscribed };
}

test('a late restore cannot overwrite a newer sign-in', async () => {
  const client = pendingClient(), sessions = [], errors = [];
  const stop = observeAuthSession((session) => sessions.push(session), () => errors.push(true));
  const signedIn = { user: { id: 'new-account' } };
  client.emit(signedIn);
  client.resolve({ data: { session: null }, error: null });
  await tick();
  assert.deepEqual(sessions, [signedIn]); assert.deepEqual(errors, []);
  stop(); assert.equal(client.count(), 1);
  client.emit(null); assert.deepEqual(sessions, [signedIn]);
});

test('restore failures reach the retry screen and disposed observers ignore them', async () => {
  let client = pendingClient(), failures = 0;
  let stop = observeAuthSession(() => assert.fail(), () => { failures++; });
  client.reject(new Error('Fixture network failure')); await tick();
  assert.equal(failures, 1); stop();
  client = pendingClient();
  stop = observeAuthSession(() => assert.fail(), () => { failures++; });
  stop(); client.reject(new Error('Late response')); await tick();
  assert.equal(failures, 1);
});
