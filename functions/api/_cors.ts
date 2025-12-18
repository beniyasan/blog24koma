// CORS Helper for Cloudflare Pages Functions
// Restricts API access to allowed origins only

const ALLOWED_ORIGINS = [
    'https://blog4koma.com',
    'https://www.blog4koma.com',
    // Preview deployments
    /^https:\/\/[a-z0-9-]+\.blog24koma\.pages\.dev$/,
    // Local development
    'http://localhost:8788',
    'http://127.0.0.1:8788',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;

    return ALLOWED_ORIGINS.some(allowed => {
        if (typeof allowed === 'string') {
            return origin === allowed;
        }
        if (allowed instanceof RegExp) {
            return allowed.test(origin);
        }
        return false;
    });
}

/**
 * Get CORS headers for the given request origin
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
    const isAllowed = isOriginAllowed(origin);

    // If origin is allowed, echo it back; otherwise return first allowed domain
    const allowedOrigin = isAllowed && origin ? origin : 'https://blog4koma.com';

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };
}

/**
 * Create a CORS preflight response
 */
export function corsPreflightResponse(origin: string | null): Response {
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
    });
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponseWithCors(
    data: unknown,
    origin: string | null,
    status = 200
): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json',
        },
    });
}
