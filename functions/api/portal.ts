// Stripe Customer Portal API
// Allows users to manage their subscription (change plan, cancel, update payment)

import { getAllowedOrigin, getCorsHeaders, corsPreflightResponse } from './_cors';

interface Env {
    DB: D1Database;
    BILLING_ENABLED?: string;
    STRIPE_SECRET_KEY: string;
}

interface PortalRequest {
    returnUrl?: string;
}

function isSafeRelativePath(path: string): boolean {
    if (!path.startsWith('/')) return false;
    if (path.startsWith('//')) return false;
    if (path.includes('\\')) return false;
    return true;
}

function sanitizeReturnUrl(value: unknown, origin: string | null): string {
    const baseOrigin = getAllowedOrigin(origin);
    const defaultUrl = `${baseOrigin}/pricing`;

    if (typeof value !== 'string') return defaultUrl;
    const trimmed = value.trim();
    if (!trimmed) return defaultUrl;

    if (isSafeRelativePath(trimmed)) {
        return `${baseOrigin}${trimmed}`;
    }

    try {
        const parsed = new URL(trimmed);
        const allowedOrigin = getAllowedOrigin(parsed.origin);
        if (allowedOrigin === parsed.origin) {
            return parsed.toString();
        }
    } catch {
        return defaultUrl;
    }

    return defaultUrl;
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
        const billingEnabled = env.BILLING_ENABLED?.trim().toLowerCase() === 'true';
        if (!billingEnabled) {
            return jsonResponse({ error: 'Billing is temporarily disabled' }, origin, 503);
        }

        const authenticatedEmail = request.headers.get('CF-Access-Authenticated-User-Email')?.trim();
        if (!authenticatedEmail) {
            return jsonResponse({ error: 'Authentication required' }, origin, 401);
        }

        // Get user from database
        const user = await env.DB.prepare(
            'SELECT stripe_customer_id FROM users WHERE email = ?'
        ).bind(authenticatedEmail).first() as { stripe_customer_id: string | null } | null;

        if (!user?.stripe_customer_id) {
            return jsonResponse({ error: 'No subscription found' }, origin, 400);
        }

        // Parse request body
        const body = await request.json() as PortalRequest;
        const returnUrl = sanitizeReturnUrl(body.returnUrl, origin);

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
