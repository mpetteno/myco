import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from './helpers.mjs';

const { TextField } = await loadModule('src/shared/ui/TextField.tsx', 'fields', { sharedReact: true });
const renderField = (props) => renderToStaticMarkup(createElement(TextField, props));
after(cleanupModules);

test('shared fields preserve password/email types and password-manager attributes', () => {
  const password = renderField({ id: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' });
  assert.match(password, /type="password"/);
  assert.match(password, /autoComplete="current-password"/);
  assert.match(renderField({ id: 'email', label: 'Email', type: 'email' }), /type="email"/);
  assert.match(renderField({ id: 'name', label: 'Name' }), /type="text"/);
});
