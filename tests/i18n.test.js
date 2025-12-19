const test = require('node:test');
const assert = require('node:assert/strict');

const { MESSAGES, getMissingKeys, t } = require('./.dist/frontend/src/i18n');

test('en has all ja keys (no missing translations)', () => {
  assert.deepEqual(getMissingKeys('en'), []);
});

test('ja has all en keys (no extra-only keys)', () => {
  assert.deepEqual(getMissingKeys('ja'), []);
});

test('t returns English for known key', () => {
  assert.equal(t('en', 'nav.blog'), MESSAGES.en['nav.blog']);
});

test('t falls back to ja when key missing in selected lang', () => {
  const key = 'nav.blog';
  const original = MESSAGES.en[key];
  delete MESSAGES.en[key];
  assert.equal(t('en', key), MESSAGES.ja[key]);
  MESSAGES.en[key] = original;
});
