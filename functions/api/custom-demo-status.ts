// Custom Demo status API endpoint
// Returns the remaining demo count for custom storyboard generation

import { getCorsHeaders, corsPreflightResponse } from './_cors';

interface Env {
    DEMO_LIMITS: KVNamespace;
    CUSTOM_DEMO_DAILY_LIMIT: string;
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
        const clientIP = request.headers.get('CF-Connecting-IP') ||
            request.headers.get('X-Forwarded-For')?.split(',')[0] ||
            'unknown';

        const today = new Date().toISOString().split('T')[0];
        const key = `custom-demo:${clientIP}:${today}`;

        const usedCountStr = await env.DEMO_LIMITS?.get(key);
        const usedCount = usedCountStr ? parseInt(usedCountStr, 10) : 0;

        const maxCount = parseInt(env.CUSTOM_DEMO_DAILY_LIMIT || '3', 10);
        const isConfigured = !!env.DEMO_GEMINI_API_KEY;

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
        console.error('Custom demo status error:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({
            remainingCount: 0,
            maxCount: 3,
            isAvailable: false,
            message: 'ステータスの取得に失敗しました',
        }, origin);
    }
};
