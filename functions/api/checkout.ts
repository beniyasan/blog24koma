// Stripe Checkout API endpoint
// Creates a Stripe Checkout session for subscription

import { getCorsHeaders, corsPreflightResponse } from './_cors';

interface Env {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
    STRIPE_LITE_PRICE_ID: string;
    STRIPE_PRO_PRICE_ID: string;
}

interface CheckoutConsent {
    accepted: boolean;
    version: string;
}

interface CheckoutRequest {
    plan: 'lite' | 'pro';
    userEmail: string;
    userId: string;
    consent?: CheckoutConsent;
}

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
    const origin = context.request.headers.get('Origin');
    return corsPreflightResponse(origin);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const origin = request.headers.get('Origin');

    try {
        const body = await request.json() as CheckoutRequest;

        if (!body.plan || !['lite', 'pro'].includes(body.plan)) {
            return jsonResponse({ error: 'Invalid plan' }, origin, 400);
        }

        if (!body.userEmail || !body.userId) {
            return jsonResponse({ error: 'userEmail and userId are required' }, origin, 400);
        }

        if (!body.consent?.accepted || !body.consent?.version) {
            return jsonResponse({ error: 'Consent is required before checkout' }, origin, 400);
        }

        // Check if Stripe is configured
        if (!env.STRIPE_SECRET_KEY) {
            return jsonResponse({ error: 'Stripe is not configured', debug: 'STRIPE_SECRET_KEY missing' }, origin, 500);
        }

        // Get the appropriate price ID
        const priceId = body.plan === 'lite'
            ? env.STRIPE_LITE_PRICE_ID
            : env.STRIPE_PRO_PRICE_ID;

        if (!priceId) {
            return jsonResponse({ error: 'Price ID not configured', debug: `STRIPE_${body.plan.toUpperCase()}_PRICE_ID missing` }, origin, 500);
        }

        // Check if user already exists in Stripe
        let stripeCustomerId: string | null = null;
        const existingUser = await env.DB.prepare(
            'SELECT stripe_customer_id FROM users WHERE id = ?'
        ).bind(body.userId).first();

        if (existingUser?.stripe_customer_id) {
            stripeCustomerId = existingUser.stripe_customer_id as string;
        } else {
            // Create new Stripe customer
            const customerParams = new URLSearchParams();
            customerParams.append('email', body.userEmail);
            customerParams.append('metadata[user_id]', body.userId);

            const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: customerParams,
            });

            if (!customerResponse.ok) {
                const errorText = await customerResponse.text();
                console.error('Failed to create Stripe customer:', errorText);
                return jsonResponse({ error: 'Failed to create Stripe customer', debug: errorText }, origin, 500);
            }

            const customer = await customerResponse.json() as { id: string };
            stripeCustomerId = customer.id;

            // Save customer ID to database
            await env.DB.prepare(`
                INSERT INTO users (id, email, stripe_customer_id) 
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET stripe_customer_id = ?
            `).bind(body.userId, body.userEmail, stripeCustomerId, stripeCustomerId).run();
        }

        // Store consent evidence (best-effort)
        try {
            const ip = request.headers.get('CF-Connecting-IP')
                || request.headers.get('X-Forwarded-For')
                || request.headers.get('X-Real-IP');
            const userAgent = request.headers.get('User-Agent');
            const acceptedAt = new Date().toISOString();

            await env.DB.prepare(`
                INSERT INTO consents (user_id, kind, version, accepted_at, ip, user_agent)
                VALUES (?, 'subscription_checkout', ?, ?, ?, ?)
            `).bind(
                body.userId,
                body.consent.version,
                acceptedAt,
                ip,
                userAgent ? userAgent.slice(0, 512) : null
            ).run();
        } catch (e) {
            console.warn('Failed to store consent evidence (non-blocking):', e);
        }

        // Create Stripe Checkout session
        const successUrl = `${origin || 'https://blog4koma.com'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${origin || 'https://blog4koma.com'}/pricing`;
        const consentAcceptedAt = new Date().toISOString();

        const sessionResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                customer: stripeCustomerId,
                mode: 'subscription',
                'line_items[0][price]': priceId,
                'line_items[0][quantity]': '1',
                success_url: successUrl,
                cancel_url: cancelUrl,
                'metadata[user_id]': body.userId,
                'metadata[plan]': body.plan,
                'metadata[consent_version]': body.consent.version,
                'metadata[consent_accepted_at]': consentAcceptedAt,
            }),
        });

        if (!sessionResponse.ok) {
            const error = await sessionResponse.text();
            console.error('Stripe session creation failed:', error);
            throw new Error('Failed to create checkout session');
        }

        const session = await sessionResponse.json() as { url: string };

        return jsonResponse({ url: session.url }, origin);
    } catch (error) {
        console.error('Checkout error:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({ error: 'Failed to create checkout session' }, origin, 500);
    }
};
