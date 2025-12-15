// Movie Demo status API endpoint
// Returns the remaining demo count for movie 4-koma (limit: 1 per day)

interface Env {
    DEMO_LIMITS: KVNamespace;
    MOVIE_DEMO_DAILY_LIMIT: string;
    DEMO_GEMINI_API_KEY: string;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

export const onRequestOptions: PagesFunction<Env> = async () => {
    return new Response(null, { headers: corsHeaders });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const { env, request } = context;

        // Get client IP for rate limiting
        const clientIP = request.headers.get('CF-Connecting-IP') ||
            request.headers.get('X-Forwarded-For')?.split(',')[0] ||
            'unknown';

        // Get today's date as key prefix (use different prefix for movie)
        const today = new Date().toISOString().split('T')[0];
        const key = `movie-demo:${clientIP}:${today}`;

        // Get current count from KV
        const usedCountStr = await env.DEMO_LIMITS?.get(key);
        const usedCount = usedCountStr ? parseInt(usedCountStr, 10) : 0;

        // Get max count from env (default 1 for movie)
        const maxCount = parseInt(env.MOVIE_DEMO_DAILY_LIMIT || '1', 10);

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
        });
    } catch (error) {
        console.error('Movie demo status error:', error instanceof Error ? error.message : 'Unknown error');
        return jsonResponse({
            remainingCount: 0,
            maxCount: 1,
            isAvailable: false,
            message: 'ステータスの取得に失敗しました',
        });
    }
};
