// Authentication utilities for Cloudflare Access JWT validation
// Used to verify users authenticated via Zero Trust

interface AccessJWTPayload {
    aud: string[];           // Audience (application ID)
    email: string;           // User email
    exp: number;             // Expiration timestamp
    iat: number;             // Issued at timestamp
    nbf: number;             // Not before timestamp
    iss: string;             // Issuer (your team domain)
    type: string;            // Token type
    identity_nonce: string;
    sub: string;             // Subject (user ID)
    country: string;
}

interface AuthResult {
    authenticated: boolean;
    user?: {
        id: string;
        email: string;
    };
    error?: string;
}

/**
 * Get public keys from Cloudflare Access
 */
async function getAccessPublicKeys(teamDomain: string): Promise<CryptoKey[]> {
    const certsUrl = `https://${teamDomain}/cdn-cgi/access/certs`;
    const response = await fetch(certsUrl);

    if (!response.ok) {
        throw new Error('Failed to fetch Access public keys');
    }

    const data = await response.json() as { keys: JsonWebKey[] };

    const keys: CryptoKey[] = [];
    for (const jwk of data.keys) {
        const key = await crypto.subtle.importKey(
            'jwk',
            jwk,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
        );
        keys.push(key);
    }

    return keys;
}

/**
 * Decode base64url to Uint8Array
 */
function base64urlDecode(str: string): Uint8Array {
    // Replace URL-safe characters
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Pad if needed
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Verify and decode the Access JWT
 */
async function verifyAccessJWT(
    token: string,
    teamDomain: string,
    audience: string
): Promise<AccessJWTPayload | null> {
    try {
        const [headerB64, payloadB64, signatureB64] = token.split('.');
        if (!headerB64 || !payloadB64 || !signatureB64) {
            return null;
        }

        // Decode payload
        const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
        const payload = JSON.parse(payloadJson) as AccessJWTPayload;

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            return null;
        }

        // Check audience
        if (!payload.aud.includes(audience)) {
            return null;
        }

        // Get public keys
        const keys = await getAccessPublicKeys(teamDomain);

        // Verify signature
        const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
        const signature = base64urlDecode(signatureB64);

        for (const key of keys) {
            try {
                const valid = await crypto.subtle.verify(
                    { name: 'RSASSA-PKCS1-v1_5' },
                    key,
                    signature,
                    signedData
                );
                if (valid) {
                    return payload;
                }
            } catch {
                // Try next key
            }
        }

        return null;
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}

/**
 * Authenticate request using Cloudflare Access JWT
 */
export async function authenticateRequest(
    request: Request,
    teamDomain: string,
    audience: string
): Promise<AuthResult> {
    // Get JWT from header or cookie
    const jwtHeader = request.headers.get('CF-Access-JWT-Assertion');
    const cookies = request.headers.get('Cookie') || '';
    const jwtCookie = cookies.match(/CF_Authorization=([^;]+)/)?.[1];

    const token = jwtHeader || jwtCookie;

    if (!token) {
        return { authenticated: false, error: 'No authentication token' };
    }

    const payload = await verifyAccessJWT(token, teamDomain, audience);

    if (!payload) {
        return { authenticated: false, error: 'Invalid token' };
    }

    return {
        authenticated: true,
        user: {
            id: payload.sub,
            email: payload.email,
        },
    };
}

/**
 * Get user from Access headers (simpler method, trusts Cloudflare)
 * Use this when Access is configured to protect the route
 */
export function getUserFromAccessHeaders(request: Request): AuthResult {
    const email = request.headers.get('CF-Access-Authenticated-User-Email');
    const userId = request.headers.get('CF-Access-Jwt-Assertion');

    if (!email) {
        return { authenticated: false, error: 'Not authenticated' };
    }

    // Generate a stable user ID from email
    const id = email; // or use a hash

    return {
        authenticated: true,
        user: {
            id,
            email,
        },
    };
}
