const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(relPath) {
  const absPath = path.join(__dirname, '..', relPath);
  return fs.readFileSync(absPath, 'utf8');
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let index = 0;

  while (true) {
    const found = haystack.indexOf(needle, index);
    if (found === -1) return count;
    count += 1;
    index = found + needle.length;
  }
}

test('App routes include /introduction', () => {
  const app = read('frontend/src/App.tsx');
  assert.ok(app.includes('path="/introduction"'));
});

test('NavBar includes link to /introduction', () => {
  const nav = read('frontend/src/components/NavBar.tsx');
  assert.ok(nav.includes('to="/introduction"'));
});

test('TitleManager maps /introduction to title.introduction', () => {
  const titleManager = read('frontend/src/components/TitleManager.tsx');
  assert.ok(titleManager.includes("pathname.startsWith('/introduction')"));
  const titleKey = ['title', 'introduction'].join('.');
  assert.ok(titleManager.includes(`return '${titleKey}'`));
});

test('i18n defines nav/title keys for introduction (ja/en)', () => {
  const i18n = read('frontend/src/i18n.ts');

  const navKey = ['nav', 'introduction'].join('.');
  const titleKey = ['title', 'introduction'].join('.');
  const navKeyMatches = countOccurrences(i18n, navKey);
  const titleKeyMatches = countOccurrences(i18n, titleKey);

  assert.equal(navKeyMatches, 2);
  assert.equal(titleKeyMatches, 2);
});

test('Introduction page shows sample image and asset exists', () => {
  const page = read('frontend/src/pages/IntroductionPage.tsx');
  assert.ok(page.includes('/intro/4koma_sample.png'));

  const assetPath = path.join(__dirname, '..', 'frontend/public/intro/4koma_sample.png');
  assert.equal(fs.existsSync(assetPath), true);
});
