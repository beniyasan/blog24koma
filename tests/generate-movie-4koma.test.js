const test = require('node:test');
const assert = require('node:assert/strict');

const { onRequestPost: generateMoviePost } = require('./.dist/functions/api/generate-movie-4koma');

function ensureRandomUUID() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return;
  const { randomUUID } = require('node:crypto');
  globalThis.crypto = { randomUUID };
}

function mockFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = original;
  });
}

function makeKv() {
  return {
    puts: [],
    async put(key, value) {
      this.puts.push({ key, value });
    },
  };
}

function makeDemoLimits({ usedCount } = {}) {
  return {
    gets: [],
    puts: [],
    async get(key) {
      this.gets.push(key);
      if (typeof usedCount === 'number') return String(usedCount);
      return null;
    },
    async put(key, value, options) {
      this.puts.push({ key, value, options });
    },
  };
}

function jsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeGeminiTextResponse(text) {
  return jsonResponse({
    candidates: [
      {
        content: { role: 'model', parts: [{ text }] },
        finishReason: 'STOP',
      },
    ],
  });
}

function makeTimedTextJson3Response() {
  return jsonResponse({
    events: [
      { tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: 'Intro' }] },
      { tStartMs: 1000, dDurationMs: 1200, segs: [{ utf8: 'Main point' }] },
      { tStartMs: 2200, dDurationMs: 800, segs: [{ utf8: 'Twist' }] },
      { tStartMs: 3000, dDurationMs: 1000, segs: [{ utf8: 'Conclusion' }] },
    ],
  });
}

function makeGeminiImageResponse({ mimeType = 'image/png', data = 'dGVzdA==' } = {}) {
  return jsonResponse({
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ inlineData: { mimeType, data } }],
        },
        finishReason: 'STOP',
      },
    ],
  });
}

function makeRequest(body, headers = {}) {
  return new Request('https://example.com/api/generate-movie-4koma', {
    method: 'POST',
    headers: {
      Origin: 'https://blog4koma.com',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

test('movie: rejects non-YouTube domains', async (t) => {
  ensureRandomUUID();

  const fetchCalls = [];
  mockFetch(t, async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    throw new Error('fetch should not be called');
  });

  const env = {
    URL_LOGS: makeKv(),
    DEMO_LIMITS: makeDemoLimits(),
    MOVIE_DEMO_DAILY_LIMIT: '1',
  };

  const request = makeRequest({
    youtubeUrl: 'https://example.com/watch?v=abc',
    mode: 'byok',
    geminiApiKey: 'test-key',
    modelSettings: { storyboardModel: 'gemini-2.5-flash', imageModel: 'gemini-3-pro-image-preview' },
  });

  const res = await generateMoviePost({ request, env });
  assert.equal(res.status, 400);

  const data = await res.json();
  assert.equal(data?.error?.code, 'INVALID_DOMAIN');
  assert.equal(fetchCalls.length, 0);
});

test('movie: demo limit reached returns 429 without external calls', async (t) => {
  ensureRandomUUID();

  const fetchCalls = [];
  mockFetch(t, async (url, options) => {
    fetchCalls.push({ url: String(url), options });
    throw new Error('fetch should not be called');
  });

  const env = {
    URL_LOGS: makeKv(),
    DEMO_LIMITS: makeDemoLimits({ usedCount: 1 }),
    DEMO_GEMINI_API_KEY: 'server-key',
    MOVIE_DEMO_DAILY_LIMIT: '1',
  };

  const request = makeRequest(
    { youtubeUrl: 'https://www.youtube.com/watch?v=abc123', mode: 'demo' },
    { 'CF-Connecting-IP': '203.0.113.10' }
  );

  const res = await generateMoviePost({ request, env });
  assert.equal(res.status, 429);

  const data = await res.json();
  assert.equal(data?.error?.code, 'DEMO_LIMIT_EXCEEDED');
  assert.equal(fetchCalls.length, 0);
});

test('movie: falls back to title/metadata when transcript is unavailable', async (t) => {
  ensureRandomUUID();

  const fetchCalls = [];
  let geminiCallIndex = 0;

  mockFetch(t, async (url, options) => {
    const urlString = String(url);
    fetchCalls.push({ url: urlString, options });

    if (urlString.startsWith('https://noembed.com/embed?url=')) {
      return jsonResponse({
        title: 'テスト動画',
        author_name: 'テストチャンネル',
        description: 'desc',
      });
    }

    if (urlString.includes('www.youtube.com/api/timedtext')) {
      return jsonResponse({}, { status: 404 });
    }

    if (urlString.includes('generativelanguage.googleapis.com')) {
      geminiCallIndex += 1;

      const bodyString = options?.body && typeof options.body === 'string' ? options.body : String(options?.body || '');
      const reqJson = JSON.parse(bodyString);
      const text = reqJson?.contents?.[0]?.parts?.[0]?.text;

      if (geminiCallIndex === 1) {
        assert.match(text, /フォールバック/);
        assert.doesNotMatch(text, /\[0\.0-1\.0\]/);
        return makeGeminiTextResponse(JSON.stringify({
          title: 'テスト動画',
          summary: '字幕がないのでタイトルから推測した要約です。',
        }));
      }

      if (geminiCallIndex === 2) {
        return makeGeminiTextResponse(JSON.stringify([
          { panel: 1, description: '1', dialogue: 'a' },
          { panel: 2, description: '2', dialogue: 'b' },
          { panel: 3, description: '3', dialogue: 'c' },
          { panel: 4, description: '4', dialogue: 'd' },
        ]));
      }

      return makeGeminiImageResponse({ mimeType: 'image/png', data: 'dGVzdA==' });
    }

    throw new Error(`unexpected fetch url: ${urlString}`);
  });

  const env = {
    URL_LOGS: makeKv(),
    DEMO_LIMITS: makeDemoLimits(),
    MOVIE_DEMO_DAILY_LIMIT: '1',
  };

  const request = makeRequest({
    youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
    mode: 'byok',
    geminiApiKey: 'test-key',
    language: 'ja',
    modelSettings: { storyboardModel: 'gemini-2.5-flash', imageModel: 'gemini-3-pro-image-preview' },
  });

  const res = await generateMoviePost({ request, env });
  assert.equal(res.status, 200);

  assert.ok(fetchCalls.filter((c) => c.url.includes('noembed.com')).length === 1);
  assert.ok(fetchCalls.filter((c) => c.url.includes('www.youtube.com/api/timedtext')).length >= 1);
  assert.equal(fetchCalls.filter((c) => c.url.includes('generativelanguage.googleapis.com')).length, 3);
});

for (const { label, youtubeUrl, expectedVideoId } of [
  {
    label: 'youtu.be format',
    youtubeUrl: 'https://youtu.be/abc123',
    expectedVideoId: 'abc123',
  },
  {
    label: 'watch?v= format',
    youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
    expectedVideoId: 'abc123',
  },
  {
    label: 'shorts format',
    youtubeUrl: 'https://www.youtube.com/shorts/abc123',
    expectedVideoId: 'abc123',
  },
  {
    label: 'embed format',
    youtubeUrl: 'https://www.youtube.com/embed/abc123',
    expectedVideoId: 'abc123',
  },
]) {
  test(`movie: extracts videoId from ${label}`, async (t) => {
    ensureRandomUUID();

    const fetchCalls = [];
    let geminiCallIndex = 0;

    mockFetch(t, async (url, options) => {
      const urlString = String(url);
      fetchCalls.push({ url: urlString, options });

      if (urlString.startsWith('https://noembed.com/embed?url=')) {
        assert.ok(urlString.includes(`watch?v=${expectedVideoId}`));
        return jsonResponse({
          title: 'テスト動画',
          author_name: 'テストチャンネル',
          description: 'desc',
        });
      }

      if (urlString.includes('www.youtube.com/api/timedtext')) {
        assert.ok(urlString.includes(`v=${expectedVideoId}`));
        return makeTimedTextJson3Response();
      }

      if (urlString.includes('generativelanguage.googleapis.com')) {
        geminiCallIndex += 1;

        if (geminiCallIndex === 1) {
          return makeGeminiTextResponse(JSON.stringify({
            title: 'テスト動画',
            overallSummary: 'これは字幕に基づく要約です。',
            parts: [
              { part: 1, startSec: 0, endSec: 1.0, summary: '起' },
              { part: 2, startSec: 1.0, endSec: 2.2, summary: '承' },
              { part: 3, startSec: 2.2, endSec: 3.0, summary: '転' },
              { part: 4, startSec: 3.0, endSec: 4.0, summary: '結' },
            ],
          }));
        }

        if (geminiCallIndex === 2) {
          return makeGeminiTextResponse(JSON.stringify([
            { panel: 1, description: '1', dialogue: 'a' },
            { panel: 2, description: '2', dialogue: 'b' },
            { panel: 3, description: '3', dialogue: 'c' },
            { panel: 4, description: '4', dialogue: 'd' },
          ]));
        }

        if (geminiCallIndex === 3) {
          return makeGeminiImageResponse({ mimeType: 'image/png', data: 'dGVzdA==' });
        }

        throw new Error(`unexpected Gemini call index: ${geminiCallIndex}`);
      }

      throw new Error(`unexpected fetch url: ${urlString}`);
    });

    const env = {
      URL_LOGS: makeKv(),
      DEMO_LIMITS: makeDemoLimits(),
      MOVIE_DEMO_DAILY_LIMIT: '1',
    };

    const request = makeRequest({
      youtubeUrl,
      mode: 'byok',
      geminiApiKey: 'test-key',
      userPrompt: 'prompt',
      modelSettings: { storyboardModel: 'gemini-2.5-flash', imageModel: 'gemini-3-pro-image-preview' },
    });

    const res = await generateMoviePost({ request, env });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(typeof data.movieSummary?.title, 'string');
    assert.equal(typeof data.movieSummary?.summary, 'string');
    assert.equal(Array.isArray(data.storyboard), true);
    assert.equal(data.storyboard.length, 4);
    assert.equal(typeof data.imageBase64, 'string');
    assert.ok(data.imageBase64.startsWith('data:image/'));

    assert.equal(fetchCalls.filter((c) => c.url.includes('noembed.com')).length, 1);
    assert.equal(fetchCalls.filter((c) => c.url.includes('www.youtube.com/api/timedtext')).length, 1);
    assert.equal(fetchCalls.filter((c) => c.url.includes('generativelanguage.googleapis.com')).length, 3);
  });
}

test('youtube analyze: builds story from timestamped transcript segments', async (t) => {
  ensureRandomUUID();

  const fetchCalls = [];

  mockFetch(t, async (url, options) => {
    const urlString = String(url);
    fetchCalls.push({ url: urlString, options });

    if (urlString.startsWith('https://noembed.com/embed?url=')) {
      return jsonResponse({
        title: 'テスト動画',
        author_name: 'テストチャンネル',
        description: 'desc',
      });
    }

    if (urlString.includes('www.youtube.com/api/timedtext')) {
      return makeTimedTextJson3Response();
    }

    if (urlString.includes('generativelanguage.googleapis.com')) {
      const bodyString = options?.body && typeof options.body === 'string' ? options.body : String(options?.body || '');
      const reqJson = JSON.parse(bodyString);
      const text = reqJson?.contents?.[0]?.parts?.[0]?.text;

      if (fetchCalls.filter((c) => c.url.includes('generativelanguage.googleapis.com')).length === 1) {
        assert.match(text, /\[0\.0-1\.0\] Intro/);
        assert.match(text, /\[1\.0-2\.2\] Main point/);
        return makeGeminiTextResponse(JSON.stringify({
          title: 'テスト動画',
          overallSummary: 'これは字幕に基づく要約です。',
          parts: [
            { part: 1, startSec: 0, endSec: 1.0, summary: '起' },
            { part: 2, startSec: 1.0, endSec: 2.2, summary: '承' },
            { part: 3, startSec: 2.2, endSec: 3.0, summary: '転' },
            { part: 4, startSec: 3.0, endSec: 4.0, summary: '結' },
          ],
        }));
      }

      if (fetchCalls.filter((c) => c.url.includes('generativelanguage.googleapis.com')).length === 2) {
        return makeGeminiTextResponse(JSON.stringify([
          { panel: 1, description: '1', dialogue: 'a' },
          { panel: 2, description: '2', dialogue: 'b' },
          { panel: 3, description: '3', dialogue: 'c' },
          { panel: 4, description: '4', dialogue: 'd' },
        ]));
      }

      return makeGeminiImageResponse({ mimeType: 'image/png', data: 'dGVzdA==' });
    }

    throw new Error(`unexpected fetch url: ${urlString}`);
  });

  const env = {
    URL_LOGS: makeKv(),
    DEMO_LIMITS: makeDemoLimits(),
    MOVIE_DEMO_DAILY_LIMIT: '1',
  };

  const request = makeRequest({
    youtubeUrl: 'https://www.youtube.com/watch?v=abc123',
    mode: 'byok',
    geminiApiKey: 'test-key',
    language: 'ja',
    modelSettings: { storyboardModel: 'gemini-2.5-flash', imageModel: 'gemini-3-pro-image-preview' },
  });

  const res = await generateMoviePost({ request, env });
  assert.equal(res.status, 200);
});
