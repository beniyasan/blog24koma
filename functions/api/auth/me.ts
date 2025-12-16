// Auth API - Returns current user info from Cloudflare Access
// This endpoint is used by the frontend to check authentication status

import { getCorsHeaders, corsPreflightResponse } from '../_cors';
import { getUserFromAccessHeaders } from '../_auth';

interface Env {
    DB: D1Database;
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const origin = request.headers.get('Origin');

    try {
        // Debug: Get Access-related headers
        const accessEmail = request.headers.get('CF-Access-Authenticated-User-Email');
        const accessJwt = request.headers.get('CF-Access-JWT-Assertion');
        const cookie = request.headers.get('Cookie');

        // Get user from Access headers
        const auth = getUserFromAccessHeaders(request);

        if (!auth.authenticated || !auth.user) {
            return jsonResponse({
                authenticated: false,
                user: null,
                debug: {
                    hasAccessEmail: !!accessEmail,
                    accessEmail: accessEmail || null,
                    hasAccessJwt: !!accessJwt,
                    hasCookie: !!cookie,
                    cookieContainsAuth: cookie?.includes('CF_Authorization') || false,
                },
            }, origin);
        }

        // Check if user exists in DB, if not create them
        let user = await env.DB.prepare(
            'SELECT id, email, plan, stripe_customer_id FROM users WHERE email = ?'
        ).bind(auth.user.email).first();

        if (!user) {
            // Create new user
            await env.DB.prepare(`
                INSERT INTO users (id, email, plan) VALUES (?, ?, 'free')
            `).bind(auth.user.email, auth.user.email).run();

            user = {
                id: auth.user.email,
                email: auth.user.email,
                plan: 'free',
                stripe_customer_id: null,
            };
        }

        return jsonResponse({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                plan: user.plan,
                hasStripeCustomer: !!user.stripe_customer_id,
            },
        }, origin);
    } catch (error) {
        console.error('Auth error:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({
            authenticated: false,
            user: null,
            error: 'Failed to check authentication',
        }, origin);
    }
};
