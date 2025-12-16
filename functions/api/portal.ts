// Stripe Customer Portal API
// Allows users to manage their subscription (change plan, cancel, update payment)

import { getCorsHeaders, corsPreflightResponse } from './_cors';
import { getUserFromAccessHeaders } from './_auth';

interface Env {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
}

interface PortalRequest {
    returnUrl?: string;
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
        // Check authentication
        const auth = getUserFromAccessHeaders(request);
        if (!auth.authenticated || !auth.user) {
            return jsonResponse({ error: 'Authentication required' }, origin, 401);
        }

        // Get user from database
        const user = await env.DB.prepare(
            'SELECT stripe_customer_id FROM users WHERE email = ?'
        ).bind(auth.user.email).first() as { stripe_customer_id: string | null } | null;

        if (!user?.stripe_customer_id) {
            return jsonResponse({ error: 'No subscription found' }, origin, 400);
        }

        // Parse request body
        const body = await request.json() as PortalRequest;
        const returnUrl = body.returnUrl || 'https://blog4koma.com/pricing';

        // Create Stripe Customer Portal session
        const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                customer: user.stripe_customer_id,
                return_url: returnUrl,
            }).toString(),
        });

        if (!portalResponse.ok) {
            const error = await portalResponse.text();
            console.error('Stripe portal creation failed:', error);
            return jsonResponse({ error: 'Failed to create portal session' }, origin, 500);
        }

        const session = await portalResponse.json() as { url: string };
        return jsonResponse({ url: session.url }, origin);
    } catch (error) {
        console.error('Portal error:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({ error: 'Failed to create portal session' }, origin, 500);
    }
};
