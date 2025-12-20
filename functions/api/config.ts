import { corsPreflightResponse, getCorsHeaders } from './_cors';

interface Env {
    BILLING_ENABLED?: string;
}

function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'CDN-Cache-Control': 'no-store',
        },
    });
}

function isEnabled(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return value.trim().toLowerCase() === 'true';
}

export const onRequestOptions: PagesFunction<Env> = async (context) => {
    const origin = context.request.headers.get('Origin');
    return corsPreflightResponse(origin);
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const origin = context.request.headers.get('Origin');
    return jsonResponse(
        {
            billingEnabled: isEnabled(context.env.BILLING_ENABLED),
        },
        origin
    );
};
