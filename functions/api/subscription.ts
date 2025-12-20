// Subscription status API endpoint
// Returns user's current plan and usage

import { getCorsHeaders, corsPreflightResponse } from './_cors';

interface Env {
    DB: D1Database;
    DEMO_DAILY_LIMIT: string;
    MOVIE_DEMO_DAILY_LIMIT: string;
}

interface UsageRow {
    count: number;
}

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
}

// Plan limits (monthly)
const PLAN_LIMITS = {
    free: { blog: 0, movie: 0, monthly: 0 },  // Free uses daily demo limits
    lite: { blog: 30, movie: 30, monthly: 30 },  // 30 total/month
    pro: { blog: 100, movie: 100, monthly: 100 }, // 100 total/month
};

export const onRequestOptions: PagesFunction<Env> = async (context) => {
    const origin = context.request.headers.get('Origin');
    return corsPreflightResponse(origin);
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const origin = request.headers.get('Origin');

    try {
        const authenticatedEmail = request.headers.get('CF-Access-Authenticated-User-Email')?.trim();

        if (!authenticatedEmail) {
            return jsonResponse({
                plan: 'free',
                limits: PLAN_LIMITS.free,
                usage: { blog: 0, movie: 0, total: 0 },
                remaining: { blog: 0, movie: 0, total: 0 },
                user: null,
            }, origin);
        }

        const userId = authenticatedEmail;

        // Get user from database
        const user = await env.DB.prepare(
            'SELECT id, email, plan, stripe_customer_id FROM users WHERE id = ?'
        ).bind(userId).first();

        const plan = (user?.plan as 'free' | 'lite' | 'pro') || 'free';
        const limits = PLAN_LIMITS[plan];

        // Get this month's usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const usageResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM usage 
            WHERE user_id = ? AND created_at >= ?
        `).bind(userId, startOfMonth.toISOString()).first() as UsageRow | null;

        const totalUsage = usageResult?.count || 0;

        // Get usage by type
        const blogUsageResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM usage 
            WHERE user_id = ? AND type = 'blog' AND created_at >= ?
        `).bind(userId, startOfMonth.toISOString()).first() as UsageRow | null;

        const movieUsageResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM usage 
            WHERE user_id = ? AND type = 'movie' AND created_at >= ?
        `).bind(userId, startOfMonth.toISOString()).first() as UsageRow | null;

        const blogUsage = blogUsageResult?.count || 0;
        const movieUsage = movieUsageResult?.count || 0;

        return jsonResponse({
            plan,
            limits,
            usage: {
                blog: blogUsage,
                movie: movieUsage,
                total: totalUsage,
            },
            remaining: {
                blog: Math.max(0, limits.monthly - totalUsage),
                movie: Math.max(0, limits.monthly - totalUsage),
                total: Math.max(0, limits.monthly - totalUsage),
            },
            user: user ? {
                email: user.email,
                hasStripeCustomer: !!user.stripe_customer_id,
            } : null,
        }, origin);
    } catch (error) {
        console.error('Subscription status error:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({
            plan: 'free',
            limits: PLAN_LIMITS.free,
            usage: { blog: 0, movie: 0, total: 0 },
            remaining: { blog: 0, movie: 0, total: 0 },
            error: 'Failed to fetch subscription status',
        }, origin);
    }
};
