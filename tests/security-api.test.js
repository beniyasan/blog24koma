const test = require('node:test');
const assert = require('node:assert/strict');

const { onRequestGet: subscriptionGet } = require('./.dist/functions/api/subscription');
const { onRequestPost: checkoutPost } = require('./.dist/functions/api/checkout');
const { onRequestPost: portalPost } = require('./.dist/functions/api/portal');
const { onRequestGet: configGet } = require('./.dist/functions/api/config');

function makeDb() {
  const calls = [];

  const db = {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            first: async () => {
              if (/COUNT\(\*\)/i.test(sql)) return { count: 0 };

              if (sql.includes('SELECT stripe_customer_id FROM users WHERE id')) {
                return { stripe_customer_id: 'cus_test_123' };
              }

              if (sql.includes('SELECT stripe_customer_id FROM users WHERE email')) {
                return { stripe_customer_id: 'cus_test_123' };
              }

              if (sql.includes('SELECT id, email, plan, stripe_customer_id FROM users')) {
                const idOrEmail = args[0];
                return {
                  id: idOrEmail,
                  email: idOrEmail,
                  plan: 'pro',
                  stripe_customer_id: 'cus_test_123',
                };
              }

              if (sql.includes('SELECT id FROM users WHERE stripe_customer_id')) {
                return { id: 'alice@example.com' };
              }

              return null;
            },
            run: async () => ({ meta: { changes: 1 } }),
          };
        },
      };
    },
  };

  return db;
}

function mockFetch(t, handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = original;
  });
}

test('subscription: ignores userId param when unauthenticated (prevents IDOR)', async () => {
  const env = {
    DB: makeDb(),
    DEMO_DAILY_LIMIT: '5',
    MOVIE_DEMO_DAILY_LIMIT: '3',
  };

  const request = new Request('https://example.com/api/subscription?userId=bob@example.com', {
    headers: { Origin: 'https://blog4koma.com' },
  });

  const res = await subscriptionGet({ request, env });
  const data = await res.json();

  assert.equal(data.plan, 'free');
  assert.equal(data.user, null);
});

test('subscription: returns only authenticated user data even if userId query is different', async () => {
  const env = {
    DB: makeDb(),
    DEMO_DAILY_LIMIT: '5',
    MOVIE_DEMO_DAILY_LIMIT: '3',
  };

  const request = new Request('https://example.com/api/subscription?userId=bob@example.com', {
    headers: {
      Origin: 'https://blog4koma.com',
      'CF-Access-Authenticated-User-Email': 'alice@example.com',
    },
  });

  const res = await subscriptionGet({ request, env });
  const data = await res.json();

  assert.equal(data.user?.email, 'alice@example.com');
});

test('checkout: requires authentication (prevents anonymous session creation)', async (t) => {
  const env = {
    DB: makeDb(),
    BILLING_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_LITE_PRICE_ID: 'price_lite',
    STRIPE_PRO_PRICE_ID: 'price_pro',
  };

  const fetchCalls = [];
  mockFetch(t, async (url, options) => {
    fetchCalls.push({ url, options });
    return new Response(JSON.stringify({ url: 'https://stripe.test/checkout' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const request = new Request('https://example.com/api/checkout', {
    method: 'POST',
    headers: {
      Origin: 'https://blog4koma.com',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan: 'lite',
      userId: 'alice@example.com',
      userEmail: 'alice@example.com',
      consent: { accepted: true, version: 'test' },
    }),
  });

  const res = await checkoutPost({ request, env });
  assert.equal(res.status, 401);
  assert.equal(fetchCalls.length, 0);
});

test('checkout: rejects mismatched userId/email vs authenticated user', async (t) => {
  const env = {
    DB: makeDb(),
    BILLING_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_LITE_PRICE_ID: 'price_lite',
    STRIPE_PRO_PRICE_ID: 'price_pro',
  };

  const fetchCalls = [];
  mockFetch(t, async (url, options) => {
    fetchCalls.push({ url, options });
    return new Response(JSON.stringify({ url: 'https://stripe.test/checkout' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const request = new Request('https://example.com/api/checkout', {
    method: 'POST',
    headers: {
      Origin: 'https://blog4koma.com',
      'Content-Type': 'application/json',
      'CF-Access-Authenticated-User-Email': 'alice@example.com',
    },
    body: JSON.stringify({
      plan: 'lite',
      userId: 'bob@example.com',
      userEmail: 'bob@example.com',
      consent: { accepted: true, version: 'test' },
    }),
  });

  const res = await checkoutPost({ request, env });
  assert.equal(res.status, 403);
  assert.equal(fetchCalls.length, 0);
});

test('checkout: does not reflect untrusted Origin into Stripe redirect URLs', async (t) => {
  const env = {
    DB: makeDb(),
    BILLING_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_LITE_PRICE_ID: 'price_lite',
    STRIPE_PRO_PRICE_ID: 'price_pro',
  };

  const fetchCalls = [];
  mockFetch(t, async (url, options) => {
    fetchCalls.push({ url, options });
    return new Response(JSON.stringify({ url: 'https://stripe.test/checkout' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const request = new Request('https://example.com/api/checkout', {
    method: 'POST',
    headers: {
      Origin: 'https://evil.example',
      'Content-Type': 'application/json',
      'CF-Access-Authenticated-User-Email': 'alice@example.com',
    },
    body: JSON.stringify({
      plan: 'lite',
      userId: 'alice@example.com',
      userEmail: 'alice@example.com',
      consent: { accepted: true, version: 'test' },
    }),
  });

  const res = await checkoutPost({ request, env });
  assert.equal(res.status, 200);

  const stripeCall = fetchCalls.find((c) => String(c.url).includes('/v1/checkout/sessions'));
  assert.ok(stripeCall, 'expected a call to Stripe checkout sessions');

  const body = stripeCall.options?.body;
  const bodyString = body && typeof body === 'string' ? body : body?.toString?.();
  const params = new URLSearchParams(bodyString);
  assert.equal(params.get('success_url')?.startsWith('https://blog4koma.com/'), true);
  assert.equal(params.get('cancel_url')?.startsWith('https://blog4koma.com/'), true);
});

test('portal: sanitizes returnUrl to prevent open redirects via Stripe portal', async (t) => {
  const env = {
    DB: makeDb(),
    BILLING_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_123',
  };

  const fetchCalls = [];
  mockFetch(t, async (url, options) => {
    fetchCalls.push({ url, options });
    return new Response(JSON.stringify({ url: 'https://stripe.test/portal' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const request = new Request('https://example.com/api/portal', {
    method: 'POST',
    headers: {
      Origin: 'https://blog4koma.com',
      'Content-Type': 'application/json',
      'CF-Access-Authenticated-User-Email': 'alice@example.com',
    },
    body: JSON.stringify({
      returnUrl: 'https://evil.example/phish',
    }),
  });

  const res = await portalPost({ request, env });
  assert.equal(res.status, 200);

  const stripeCall = fetchCalls.find((c) => String(c.url).includes('/v1/billing_portal/sessions'));
  assert.ok(stripeCall, 'expected a call to Stripe billing portal sessions');

  const params = new URLSearchParams(String(stripeCall.options?.body));
  assert.equal(params.get('return_url'), 'https://blog4koma.com/pricing');
});

test('checkout: returns 503 and does not call Stripe when billing is disabled', async (t) => {
  const env = {
    DB: makeDb(),
    BILLING_ENABLED: 'false',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_LITE_PRICE_ID: 'price_lite',
    STRIPE_PRO_PRICE_ID: 'price_pro',
  };

  const fetchCalls = [];
  mockFetch(t, async (url, options) => {
    fetchCalls.push({ url, options });
    return new Response(JSON.stringify({ url: 'https://stripe.test/checkout' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const request = new Request('https://example.com/api/checkout', {
    method: 'POST',
    headers: {
      Origin: 'https://blog4koma.com',
      'Content-Type': 'application/json',
      'CF-Access-Authenticated-User-Email': 'alice@example.com',
    },
    body: JSON.stringify({
      plan: 'lite',
      userId: 'alice@example.com',
      userEmail: 'alice@example.com',
      consent: { accepted: true, version: 'test' },
    }),
  });

  const res = await checkoutPost({ request, env });
  assert.equal(res.status, 503);
  assert.equal(fetchCalls.length, 0);
});

test('portal: returns 503 and does not call Stripe when billing is disabled', async (t) => {
  const env = {
    DB: makeDb(),
    BILLING_ENABLED: 'false',
    STRIPE_SECRET_KEY: 'sk_test_123',
  };

  const fetchCalls = [];
  mockFetch(t, async (url, options) => {
    fetchCalls.push({ url, options });
    return new Response(JSON.stringify({ url: 'https://stripe.test/portal' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const request = new Request('https://example.com/api/portal', {
    method: 'POST',
    headers: {
      Origin: 'https://blog4koma.com',
      'Content-Type': 'application/json',
      'CF-Access-Authenticated-User-Email': 'alice@example.com',
    },
    body: JSON.stringify({
      returnUrl: '/pricing',
    }),
  });

  const res = await portalPost({ request, env });
  assert.equal(res.status, 503);
  assert.equal(fetchCalls.length, 0);
});

test('config: returns billingEnabled based on env', async () => {
  const request = new Request('https://example.com/api/config', {
    headers: { Origin: 'https://blog4koma.com' },
  });

  const resDisabled = await configGet({ request, env: { BILLING_ENABLED: 'false' } });
  assert.equal((await resDisabled.json()).billingEnabled, false);

  const resEnabled = await configGet({ request, env: { BILLING_ENABLED: 'true' } });
  assert.equal((await resEnabled.json()).billingEnabled, true);
});
