import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanupModules, loadModule } from './helpers.mjs';

const { TextField } = await loadModule('src/shared/ui/TextField.tsx', 'fields');
after(cleanupModules);

test('shared fields preserve password/email types and password-manager attributes', () => {
  const password = renderToStaticMarkup(TextField({ id: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' }));
  assert.match(password, /type="password"/);
  assert.match(password, /autoComplete="current-password"/);
  assert.match(renderToStaticMarkup(TextField({ id: 'email', label: 'Email', type: 'email' })), /type="email"/);
  assert.match(renderToStaticMarkup(TextField({ id: 'name', label: 'Name' })), /type="text"/);
});
