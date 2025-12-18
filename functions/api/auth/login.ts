// Auth login helper
// Navigating to this endpoint triggers Cloudflare Access login (if protected), then redirects back.

import { getUserFromAccessHeaders } from '../_auth';

function isSafeRelativePath(path: string): boolean {
    // Allow only same-origin relative paths like "/pricing" or "/movie?x=1"
    if (!path.startsWith('/')) return false;
    if (path.startsWith('//')) return false;
    if (path.includes('\\')) return false;
    return true;
}

export const onRequestGet: PagesFunction = async (context) => {
    const { request } = context;
    const url = new URL(request.url);
    const returnParam = url.searchParams.get('return');

    // Require authentication (Cloudflare Access should enforce this upstream)
    const auth = getUserFromAccessHeaders(request);
    if (!auth.authenticated || !auth.user) {
        return new Response('Authentication required', {
            status: 401,
            headers: { 'Cache-Control': 'no-store' },
        });
    }

    const returnPath = returnParam && isSafeRelativePath(returnParam) ? returnParam : '/pricing';
    return new Response(null, {
        status: 302,
        headers: {
            'Location': returnPath,
            'Cache-Control': 'no-store',
        },
    });
};
