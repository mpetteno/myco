import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { createClient } from '@supabase/supabase-js';

const directory = mkdtempSync(join(tmpdir(), 'myco-auth-tests-'));
const stub = join(directory, 'client.mjs');
writeFileSync(stub, 'export const getSupabaseClient = () => globalThis.__mycoAuthClient;');

export async function loadModule(entry, name, { sharedReact = false } = {}) {
  const result = await build({ configFile: false, envFile: false, logLevel: 'silent',
    plugins: sharedReact ? [{ name: 'shared-test-react', enforce: 'pre', resolveId(id) { if (id === 'react' || id === 'react/jsx-runtime') return { id: import.meta.resolve(id), external: true }; } }] : [],
    resolve: { alias: { '../../shared/supabase/client': stub } },
    build: { write: false, minify: false, lib: { entry, formats: ['es'] } },
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  const file = join(directory, `${name}.mjs`);
  writeFileSync(file, output.find((item) => item.type === 'chunk').code);
  return import(pathToFileURL(file).href);
}

export function cleanupModules() { rmSync(directory, { recursive: true, force: true }); }
export const tick = () => new Promise((resolve) => setImmediate(resolve));

export const user = {
  id: '11111111-1111-4111-8111-111111111111', email: 'gardener@example.test',
  aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' },
  user_metadata: {}, created_at: '2026-01-01T00:00:00Z', identities: [],
};

export function makeAuthClient() {
  const storage = new Map();
  const requests = [];
  const server = { confirmation: true, invalidCredentials: false, failSignOut: false };
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  const session = { access_token: token, refresh_token: 'fixture-refresh-token', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user };
  const fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    requests.push({ url, body: init.body ? JSON.parse(init.body) : null });
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status,
      headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } });
    if (url.pathname.endsWith('/signup')) return reply(server.confirmation ? { user } : session);
    if (url.pathname.endsWith('/token')) return server.invalidCredentials
      ? reply({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 400) : reply(session);
    if (url.pathname.endsWith('/logout')) return server.failSignOut
      ? reply({ code: 'unexpected_failure', message: 'Fixture logout failure' }, 400)
      : new Response(null, { status: 204 });
    if (url.pathname.endsWith('/user')) return reply(user);
    throw new Error(`Unexpected mocked endpoint: ${url.pathname}`);
  };
  const client = createClient('https://auth-test.supabase.co', 'sb_publishable_fixture', {
    global: { fetch }, auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true,
      storage: { getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => { storage.set(key, value); }, removeItem: (key) => { storage.delete(key); } },
    },
  });
  return { client, server, storage, requests, session };
}
