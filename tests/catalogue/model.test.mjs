import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupModules, loadModule } from '../auth/helpers.mjs';

const model = await loadModule('tests/catalogue/modules.ts', 'catalogue-model');
after(cleanupModules);
const families = [{ id: 'a', plantSpacingCm: 30, rowSpacingCm: 40 }, { id: 'b', plantSpacingCm: 20, rowSpacingCm: 60 }];
const a = { id: 'type-a', familyId: 'a', plantSpacingCm: null, rowSpacingCm: 50 };
const b = { id: 'type-b', familyId: 'b', plantSpacingCm: 35, rowSpacingCm: null };
const rule = (first, second, relationship) => ({ first, second, relationship });
const family = (id) => ({ kind: 'family', id });
const plant = (id) => ({ kind: 'plant', id });

test('inherits each missing spacing independently and takes the larger recommendation for neighbours', () => {
  const first = model.effectiveSpacing(a, families), second = model.effectiveSpacing(b, families);
  assert.deepEqual(first, { plantSpacingCm: 30, rowSpacingCm: 50 });
  assert.deepEqual(second, { plantSpacingCm: 35, rowSpacingCm: 60 });
  assert.deepEqual(model.recommendedPairSpacing(first, second), { plantSpacingCm: 35, rowSpacingCm: 60 });
  assert.equal(model.effectiveSpacing({ ...a, familyId: 'missing' }, families).plantSpacingCm, null);
  assert.equal(model.recommendedPairSpacing({ plantSpacingCm: null, rowSpacingCm: 40 }, second).plantSpacingCm, null);
});

test('companion advice is symmetric, specific type rules override family rules and unknown remains unknown', () => {
  const rules = [rule(family('a'), family('b'), 'caution'), rule(plant(a.id), family('b'), 'companion')];
  assert.equal(model.companionAdvice(a, b, rules).relationship, 'companion');
  assert.equal(model.companionAdvice(b, a, rules).relationship, 'companion');
  rules.push(rule(plant(a.id), plant(b.id), 'caution'));
  assert.equal(model.companionAdvice(a, b, rules).relationship, 'caution');
  assert.equal(model.companionAdvice(a, b, []).relationship, 'unknown');
});

test('conflicting guidance at equal specificity produces a warning without prohibiting a plan', () => {
  const rules = [rule(plant(a.id), family('b'), 'companion'), rule(family('a'), plant(b.id), 'caution')];
  const advice = model.companionAdvice(a, b, rules);
  assert.equal(advice.relationship, 'caution'); assert.equal(advice.rules.length, 2);
  assert.deepEqual(model.orderedTargets(plant(b.id), family('a')), [family('a'), plant(b.id)]);
});

test('catalogue distances are positive centimetre recommendations; blank means inherit and decimals are preserved', () => {
  assert.equal(model.parseSpacingCm(''), null);
  assert.equal(model.parseSpacingCm(' 12.5 '), 12.5);
  assert.equal(model.validateSpacing({ plantSpacingCm: 12.5, rowSpacingCm: null }), null);
  for (const value of [0, -5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.ok(model.validateSpacing({ plantSpacingCm: value, rowSpacingCm: 10 }));
});
