// Usage limit utilities for subscription plans
// Checks if user has remaining usage for their plan

interface Env {
    DB: D1Database;
}

interface UsageRow {
    count: number;
}

// Plan monthly limits
export const PLAN_LIMITS = {
    free: 0,    // Free users use demo mode (daily limits)
    lite: 30,   // 30 generations per month
    pro: 100,   // 100 generations per month
};

interface UsageCheckResult {
    allowed: boolean;
    plan: string;
    used: number;
    limit: number;
    remaining: number;
    error?: string;
}

/**
 * Get user plan and usage from database
 */
export async function getUserUsage(
    db: D1Database,
    userId: string
): Promise<UsageCheckResult> {
    try {
        // Get user plan
        const user = await db.prepare(
            'SELECT plan FROM users WHERE id = ?'
        ).bind(userId).first();

        const plan = (user?.plan as 'free' | 'lite' | 'pro') || 'free';
        const limit = PLAN_LIMITS[plan];

        // Free plan users should use demo mode
        if (plan === 'free') {
            return {
                allowed: false,
                plan: 'free',
                used: 0,
                limit: 0,
                remaining: 0,
                error: 'Free plan users should use demo mode',
            };
        }

        // Get this month's usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const usageResult = await db.prepare(`
            SELECT COUNT(*) as count FROM usage 
            WHERE user_id = ? AND created_at >= ?
        `).bind(userId, startOfMonth.toISOString()).first() as UsageRow | null;

        const used = usageResult?.count || 0;
        const remaining = Math.max(0, limit - used);

        return {
            allowed: remaining > 0,
            plan,
            used,
            limit,
            remaining,
        };
    } catch (error) {
        console.error('Error checking usage:', error);
        return {
            allowed: false,
            plan: 'free',
            used: 0,
            limit: 0,
            remaining: 0,
            error: 'Failed to check usage',
        };
    }
}

/**
 * Record a usage for a user
 */
export async function recordUsage(
    db: D1Database,
    userId: string,
    type: 'blog' | 'movie'
): Promise<boolean> {
    try {
        await db.prepare(`
            INSERT INTO usage (user_id, type) VALUES (?, ?)
        `).bind(userId, type).run();
        return true;
    } catch (error) {
        console.error('Error recording usage:', error);
        return false;
    }
}

/**
 * Get user from JWT in request (for BYOK mode)
 */
export function getUserFromJwt(request: Request): { id: string; email: string } | null {
    // Try the Access email header first
    const emailHeader = request.headers.get('CF-Access-Authenticated-User-Email');
    if (emailHeader) {
        return { id: emailHeader, email: emailHeader };
    }

    // Try JWT from cookie
    const cookies = request.headers.get('Cookie') || '';
    const jwtCookie = cookies.match(/CF_Authorization=([^;]+)/)?.[1];

    if (!jwtCookie) {
        return null;
    }

    try {
        const parts = jwtCookie.split('.');
        if (parts.length !== 3) return null;

        const payloadB64 = parts[1];
        const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
        const payloadJson = atob(padded);
        const payload = JSON.parse(payloadJson) as { email?: string; sub?: string };

        if (!payload.email) return null;

        return {
            id: payload.sub || payload.email,
            email: payload.email,
        };
    } catch {
        return null;
    }
}
