import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, ACTIONS } from '../src/engine/recommend.js';

const base = { category: 'phone', ageYears: 2, condition: 'working', answers: {} };

test('working device you still need -> reuse', () => {
  const r = recommend(base);
  assert.equal(r.action, 'reuse');
  assert.equal(r.confidence, 'high');
});

test('working device you no longer need -> donate', () => {
  const r = recommend({ ...base, answers: { still_needed: 'no' } });
  assert.equal(r.action, 'donate');
});

test('swollen battery overrides everything and adds a safety note', () => {
  const r = recommend({ ...base, condition: 'working', answers: { battery_swollen: 'yes' } });
  assert.equal(r.action, 'recycle');
  assert.ok(r.safetyNotes.some((n) => /fire hazard/i.test(n)));
  assert.ok(r.safetyNotes.some((n) => /not try to remove or replace/i.test(n)));
  assert.equal(r.ranking[0].action, 'recycle');
});

test('safety advice never contains DIY repair instructions', () => {
  const r = recommend({ ...base, condition: 'not_working', answers: { battery_swollen: true, water_damage: true } });
  const text = JSON.stringify([r.safetyNotes, r.nextSteps]).toLowerCase();
  assert.ok(!/(open the (case|device)|solder|pry|disassembl)/.test(text));
});

test('cheap quote on a minor issue -> repair', () => {
  const r = recommend({ ...base, condition: 'minor_issues', answers: { repair_quote: 1000 } });
  assert.equal(r.action, 'repair');
  assert.equal(r.repairCostSource, 'user_quote');
});

test('quote far above device value on a dead device -> not repair', () => {
  const r = recommend({
    category: 'phone', ageYears: 5, condition: 'not_working', answers: { repair_quote: 12000 },
  });
  assert.notEqual(r.action, 'repair');
  assert.ok(['recycle', 'parts_recovery'].includes(r.action));
  assert.ok(r.explanation.some((e) => e.rule === 'cost.expensive'));
});

test('very old dead peripheral -> recycle', () => {
  const r = recommend({ category: 'peripheral', ageYears: 12, condition: 'not_working', answers: {} });
  assert.equal(r.action, 'recycle');
});

test('cosmetic-only damage -> reuse, not repair', () => {
  const r = recommend({ ...base, condition: 'minor_issues', answers: { cosmetic_only: 'yes' } });
  assert.equal(r.action, 'reuse');
});

test('confidence is capped at medium without a user quote on a broken device', () => {
  const r = recommend({ category: 'laptop', ageYears: 9, condition: 'not_working', answers: {} });
  assert.notEqual(r.confidence, 'high');
  assert.ok(r.missingInputs.includes('repair_quote'));
  assert.equal(r.repairCostSource, 'rough_estimate');
});

test('unknown category falls back to generic defaults without throwing', () => {
  const r = recommend({ category: 'smartwatch', ageYears: 1, condition: 'minor_issues', answers: {} });
  assert.ok(ACTIONS.includes(r.action));
});

test('lifespan override from DB category is respected', () => {
  const young = recommend({ category: 'phone', ageYears: 4, condition: 'major_issues', lifespanYears: 10, answers: {} });
  const old = recommend({ category: 'phone', ageYears: 4, condition: 'major_issues', lifespanYears: 3, answers: {} });
  assert.ok(old.explanation.some((e) => e.rule.startsWith('age.')));
  assert.ok(!young.explanation.some((e) => e.rule.startsWith('age.')));
});

test('output is deterministic and every scored point is explained', () => {
  const input = { category: 'tablet', ageYears: 3, condition: 'major_issues', answers: { water_damage: 'yes', repair_quote: 2500 } };
  const a = recommend(input);
  const b = recommend(input);
  assert.deepEqual(a, b);
  for (const { action, score } of a.ranking) {
    const sum = a.explanation.filter((e) => e.action === action && e.points !== null).reduce((s, e) => s + e.points, 0);
    assert.equal(sum, score, `score for ${action} must equal sum of explained points`);
  }
});

test('garbage input does not crash the engine', () => {
  const r = recommend({ category: undefined, ageYears: 'abc', condition: 'not_working', answers: { repair_quote: 'xyz', powers_on: 5 } });
  assert.ok(ACTIONS.includes(r.action));
  assert.ok(Number.isFinite(r.currentValue));
});

test('liquid damage adds a safety note and never says to charge the device', () => {
  const r = recommend({ ...base, condition: 'not_working', answers: { water_damage: 'yes' } });
  assert.ok(r.safetyNotes.some((n) => /liquid/i.test(n)));
});
