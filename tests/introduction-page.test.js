const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relPath) {
  const absPath = path.join(__dirname, '..', relPath);
  return fs.readFileSync(absPath, 'utf8');
}

test('App routes include /introduction', () => {
  const app = read('frontend/src/App.tsx');
  assert.match(app, /path=\"\/introduction\"/);
});

test('NavBar includes link to /introduction', () => {
  const nav = read('frontend/src/components/NavBar.tsx');
  assert.match(nav, /to=\"\/introduction\"/);
});

test('TitleManager maps /introduction to title.introduction', () => {
  const titleManager = read('frontend/src/components/TitleManager.tsx');
  assert.match(titleManager, /pathname\.startsWith\('\/introduction'\)\) return 'title\.introduction';/);
});

test('i18n defines nav/title keys for introduction (ja/en)', () => {
  const i18n = read('frontend/src/i18n.ts');

  const navKeyMatches = i18n.match(/'nav\.introduction'\s*:/g) ?? [];
  const titleKeyMatches = i18n.match(/'title\.introduction'\s*:/g) ?? [];

  assert.equal(navKeyMatches.length, 2);
  assert.equal(titleKeyMatches.length, 2);
});

test('Introduction page shows sample image and asset exists', () => {
  const page = read('frontend/src/pages/IntroductionPage.tsx');
  assert.match(page, /\/intro\/4koma_sample\.png/);

  const assetPath = path.join(__dirname, '..', 'frontend/public/intro/4koma_sample.png');
  assert.equal(fs.existsSync(assetPath), true);
});
