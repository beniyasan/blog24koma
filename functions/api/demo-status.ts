// Demo status API endpoint
// Returns the remaining demo count for the current user

import { getCorsHeaders, corsPreflightResponse } from './_cors';

interface Env {
    DEMO_LIMITS: KVNamespace;
    DEMO_DAILY_LIMIT: string;
    DEMO_GEMINI_API_KEY: string;
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
    const { env, request } = context;
    const origin = request.headers.get('Origin');

    try {
        // Get client IP for rate limiting
        const clientIP = request.headers.get('CF-Connecting-IP') ||
            request.headers.get('X-Forwarded-For')?.split(',')[0] ||
            'unknown';

        // Get today's date as key prefix
        const today = new Date().toISOString().split('T')[0];
        const key = `demo:${clientIP}:${today}`;

        // Get current count from KV
        const usedCountStr = await env.DEMO_LIMITS?.get(key);
        const usedCount = usedCountStr ? parseInt(usedCountStr, 10) : 0;

        // Get max count from env (default 3)
        const maxCount = parseInt(env.DEMO_DAILY_LIMIT || '3', 10);

        // Check if demo API key is configured
        const isConfigured = !!env.DEMO_GEMINI_API_KEY;

        // Calculate remaining count
        const remainingCount = Math.max(0, maxCount - usedCount);
        const isAvailable = remainingCount > 0 && isConfigured;

        return jsonResponse({
            remainingCount,
            maxCount,
            isAvailable,
            message: !isConfigured
                ? '現在デモを一時停止しています。BYOKで利用できます。'
                : undefined,
        }, origin);
    } catch (error) {
        console.error('Demo status error:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({
            remainingCount: 0,
            maxCount: 3,
            isAvailable: false,
            message: 'ステータスの取得に失敗しました',
        }, origin);
    }
};
