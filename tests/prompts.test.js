const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getStoryboardSystemPrompt,
  getImagePrompt,
  normalizeLanguage,
} = require('./.dist/functions/api/prompts');

test('normalizeLanguage defaults to ja', () => {
  assert.equal(normalizeLanguage(undefined), 'ja');
  assert.equal(normalizeLanguage(null), 'ja');
  assert.equal(normalizeLanguage(''), 'ja');
});

test('normalizeLanguage accepts en/ja', () => {
  assert.equal(normalizeLanguage('en'), 'en');
  assert.equal(normalizeLanguage('ja'), 'ja');
});

test('en storyboard prompt enforces English output and JSON-only', () => {
  const prompt = getStoryboardSystemPrompt('en');
  assert.match(prompt, /JSON/i);
  assert.match(prompt, /English/i);
  assert.match(prompt, /Exactly 4/i);
});

test('ja storyboard prompt stays Japanese', () => {
  const prompt = getStoryboardSystemPrompt('ja');
  assert.match(prompt, /あなたは4コマ漫画/);
  assert.match(prompt, /必ず4つのパネル/);
});

test('en image prompt includes English dialogue constraint and panel text', () => {
  const storyboard = [
    { panel: 1, description: 'A dev reads a blog post at a desk.', dialogue: 'Interesting!' },
    { panel: 2, description: 'They try the tool and smile.', dialogue: 'Nice.' },
    { panel: 3, description: 'A twist: the bug appears.', dialogue: 'Wait, what?' },
    { panel: 4, description: 'They fix it and celebrate.', dialogue: 'Shipped!' },
  ];
  const prompt = getImagePrompt('en', storyboard);
  assert.match(prompt, /Dialogue must be in English/i);
  assert.match(prompt, /\[Panel 1\]/i);
  assert.match(prompt, /Shipped!/);
});
