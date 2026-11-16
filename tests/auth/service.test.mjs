import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule, makeAuthClient, tick, user } from './helpers.mjs';

const service = await loadModule('src/features/auth/authService.ts', 'service');
const { observeAuthSession } = await loadModule('src/features/auth/authSession.ts', 'observer');
const { authErrorMessage } = await loadModule('src/features/auth/authErrors.ts', 'errors');
globalThis.window = { location: { origin: 'http://localhost:5173', pathname: '/' } };
after(cleanupModules);

test('confirmation-required signup does not unlock the editor and uses the app redirect', async () => {
  const fixture = makeAuthClient();
  globalThis.__mycoAuthClient = fixture.client;
  assert.deepEqual(await service.signUp(user.email, 'Fixture-password!'), { needsConfirmation: true });
  assert.equal((await fixture.client.auth.getSession()).data.session, null);
  assert.equal(fixture.requests[0].url.searchParams.get('redirect_to'), 'http://localhost:5173/');
  assert.equal(fixture.requests[0].body.email, user.email);
});

test('sign-in restores a persisted session and local sign-out clears it', async () => {
  const fixture = makeAuthClient();
  globalThis.__mycoAuthClient = fixture.client;
  const sessions = [];
  const stop = observeAuthSession((session) => sessions.push(session), () => assert.fail('Session restore failed'));
  try {
    await fixture.client.auth.getSession();
    await tick();
    assert.equal(sessions.at(-1), null);
    await service.signIn(user.email, 'Fixture-password!');
    assert.equal(sessions.at(-1).user.id, user.id);
    assert.equal((await fixture.client.auth.getSession()).data.session.user.id, user.id);
    assert.ok([...fixture.storage.values()].some((value) => value.includes('access_token')));
    const restored = [];
    const stopRestore = observeAuthSession((session) => restored.push(session), () => assert.fail());
    await tick();
    assert.equal(restored.at(-1).user.id, user.id);
    stopRestore();
    await service.signOut();
    assert.equal(sessions.at(-1), null);
    assert.equal((await fixture.client.auth.getSession()).data.session, null);
    assert.equal(fixture.requests.at(-1).url.searchParams.get('scope'), 'local');
    assert.ok(![...fixture.storage.values()].some((value) => value.includes('access_token')));
  } finally { stop(); }
});

test('signup opens a session when confirmation is disabled', async () => {
  const fixture = makeAuthClient(); fixture.server.confirmation = false;
  globalThis.__mycoAuthClient = fixture.client;
  assert.deepEqual(await service.signUp(user.email, 'Fixture-password!'), { needsConfirmation: false });
  assert.equal((await fixture.client.auth.getSession()).data.session.user.id, user.id);
});

test('invalid credentials surface a useful message and create no session', async () => {
  const fixture = makeAuthClient(); fixture.server.invalidCredentials = true;
  globalThis.__mycoAuthClient = fixture.client;
  await assert.rejects(service.signIn(user.email, 'incorrect'), (error) => {
    assert.equal(authErrorMessage(error), 'The email or password is incorrect.'); return true;
  });
  assert.equal((await fixture.client.auth.getSession()).data.session, null);
});

test('local sign-out clears device credentials even if server revocation fails', async () => {
  const fixture = makeAuthClient(); globalThis.__mycoAuthClient = fixture.client;
  await service.signIn(user.email, 'Fixture-password!'); fixture.server.failSignOut = true;
  await assert.rejects(service.signOut());
  assert.equal((await fixture.client.auth.getSession()).data.session, null);
});
