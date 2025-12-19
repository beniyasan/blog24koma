import type {
    Generate4KomaRequest,
    Generate4KomaResponse,
    StoryboardPanel,
    ImagePanel,
    ApiError,
    ErrorCode,
} from '../../frontend/src/types';
import { getCorsHeaders, corsPreflightResponse } from './_cors';
import { getUserUsage, recordUsage, getUserFromJwt } from './_usage';
import { normalizeLanguage, getStoryboardSystemPrompt, getImagePrompt } from './prompts';

// ===== Env Interface =====
interface Env {
    URL_LOGS: KVNamespace;
    DEMO_LIMITS: KVNamespace;
    DB: D1Database;
    DEMO_GEMINI_API_KEY: string;
    DEMO_DAILY_LIMIT: string;
}

// ===== Constants =====
const ALLOWED_DOMAINS = ['note.com', 'qiita.com', 'zenn.dev'];
const DEFAULT_STORYBOARD_MODEL = 'gemini-2.5-flash';
const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ===== CORS Headers (now handled by _cors.ts) =====

// ===== Error Classes =====
class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

class DomainError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DomainError';
    }
}

class FetchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FetchError';
    }
}

class GeminiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GeminiError';
    }
}

class DemoLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DemoLimitError';
    }
}

// ===== Response Helpers =====
function jsonResponse(data: unknown, origin: string | null, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    });
}

function errorResponse(code: ErrorCode, message: string, status: number, origin: string | null): Response {
    const error: ApiError = { error: { code, message } };
    return jsonResponse(error, origin, status);
}

// ===== Validation =====
function validateRequest(body: unknown): Generate4KomaRequest {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be a JSON object');
    }

    const { articleUrl, userPrompt, geminiApiKey, modelSettings, mode, language } = body as Record<string, unknown>;

    if (typeof articleUrl !== 'string' || !articleUrl.trim()) {
        throw new ValidationError('articleUrl is required');
    }

    // Validate mode
    const validModes = ['demo', 'lite', 'pro', 'byok'];
    const requestMode = (mode as string) || 'byok'; // Default to byok for backward compatibility
    if (!validModes.includes(requestMode)) {
        throw new ValidationError('Invalid mode. Must be "demo" or "byok"');
    }

    // API key required only for BYOK mode
    if (requestMode === 'byok') {
        if (typeof geminiApiKey !== 'string' || !geminiApiKey.trim()) {
            throw new ValidationError('geminiApiKey is required for BYOK mode');
        }
    }

    if (userPrompt !== undefined && typeof userPrompt !== 'string') {
        throw new ValidationError('userPrompt must be a string');
    }

    if (language !== undefined && typeof language !== 'string') {
        throw new ValidationError('language must be a string');
    }

    if (modelSettings !== undefined) {
        if (typeof modelSettings !== 'object' || modelSettings === null) {
            throw new ValidationError('modelSettings must be an object');
        }

        const { storyboardModel, imageModel } = modelSettings as Record<string, unknown>;

        if (storyboardModel !== undefined) {
            const validModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3-pro-preview'];
            if (!validModels.includes(storyboardModel as string)) {
                throw new ValidationError('Invalid storyboardModel');
            }
        }

        if (imageModel !== undefined) {
            const validModels = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
            if (!validModels.includes(imageModel as string)) {
                throw new ValidationError('Invalid imageModel');
            }
        }
    }

    // URL format validation
    let url: URL;
    try {
        url = new URL(articleUrl);
    } catch {
        throw new ValidationError('Invalid URL format');
    }

    // Protocol check
    if (url.protocol !== 'https:') {
        throw new ValidationError('Only HTTPS URLs are allowed');
    }

    return {
        articleUrl: articleUrl.trim(),
        userPrompt: (userPrompt as string)?.trim() || '',
        geminiApiKey: (geminiApiKey as string)?.trim(),
        modelSettings: (modelSettings as Generate4KomaRequest['modelSettings']) || {
            storyboardModel: DEFAULT_STORYBOARD_MODEL,
            imageModel: DEFAULT_IMAGE_MODEL,
        },
        language: normalizeLanguage(language),
        mode: requestMode as Generate4KomaRequest['mode'],
    };
}

// ===== Domain Whitelist =====
function checkDomainWhitelist(urlString: string): void {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Check exact match or subdomain
    const isAllowed = ALLOWED_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
        throw new DomainError(`Domain not allowed: ${hostname}. Allowed: ${ALLOWED_DOMAINS.join(', ')}`);
    }

    // Block internal/local addresses
    const blockedPatterns = [
        /^localhost$/i,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^0\./,
    ];

    if (blockedPatterns.some((pattern) => pattern.test(hostname))) {
        throw new DomainError('Internal addresses are not allowed');
    }
}

// ===== Article Fetching =====
interface ArticleContent {
    title: string;
    body: string;
}

async function fetchArticle(url: string): Promise<ArticleContent> {
    console.log(`Fetching article from: ${url}`);

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; 4KomaBot/1.0) AppleWebKit/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Referer': 'https://blog4koma.com/',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000), // 10秒タイムアウト
    });

    if (!response.ok) {
        throw new FetchError(`Failed to fetch article: ${response.status} ${url} (Type: ${response.headers.get('content-type')})`);
    }

    // Check final URL domain after redirects
    const finalUrl = response.url;
    checkDomainWhitelist(finalUrl);

    const html = await response.text();
    console.log(`Fetched HTML length: ${html.length} characters from: ${finalUrl}`);
    return parseArticleHtml(html, new URL(finalUrl).hostname);
}

function parseArticleHtml(html: string, hostname: string): ArticleContent {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : 'Untitled';

    let body = '';

    console.log(`Parsing article for hostname: ${hostname}`);

    // Domain-specific extraction
    if (hostname.includes('note.com')) {
        body = extractNoteContent(html);
        console.log('Used note.com extraction');
    } else if (hostname.includes('qiita.com')) {
        body = extractQiitaContent(html);
        console.log('Used qiita.com extraction');
    } else if (hostname.includes('zenn.dev')) {
        body = extractZennContent(html);
        console.log('Used zenn.dev extraction');
    } else {
        body = extractGenericContent(html);
        console.log('Used generic extraction');
    }

    console.log(`Extracted body length: ${body.length} characters`);

    // Trim if too long (max 8000 chars for Gemini context)
    if (body.length > 8000) {
        const truncatedBody = body.substring(0, 8000) + '...（省略）';
        console.log(`Body truncated to ${truncatedBody.length} characters`);
        body = truncatedBody;
    }

    return { title, body };
}

function extractNoteContent(html: string): string {
    // note.com article body
    const match = html.match(
        /<div[^>]*class="[^"]*note-common-styles__textnote-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    if (match) return stripHtmlTags(match[1]);

    // Fallback: try article tag
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    return articleMatch ? stripHtmlTags(articleMatch[1]) : extractGenericContent(html);
}

function extractQiitaContent(html: string): string {
    // qiita.com article body
    const match = html.match(/<div[^>]*class="[^"]*it-MdContent[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (match) return stripHtmlTags(match[1]);

    // Fallback: try article tag
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    return articleMatch ? stripHtmlTags(articleMatch[1]) : extractGenericContent(html);
}

function extractZennContent(html: string): string {
    // Try multiple approaches for Zenn content extraction

    // Method 1: Try the primary znc class (main article content)
    let match = html.match(/<div[^>]*class="[^"]*znc[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (match) return stripHtmlTags(match[1]);

    // Method 2: Try article tag
    match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (match) return stripHtmlTags(match[1]);

    // Method 3: Try finding content within main section
    match = html.match(/<main[^>]*>([\s\S]*?<\/main>)/i);
    if (match) {
        const mainContent = match[1];
        // Look for any div with content-like classes within main
        const contentMatch = mainContent.match(/<div[^>]*class="[^"]*(?:content|article|text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (contentMatch) return stripHtmlTags(contentMatch[1]);
        return stripHtmlTags(mainContent);
    }

    // Method 4: Look for any paragraph content
    const paragraphs = html.match(/<p[^>]*>([\s\S]{100,2000})<\/p>/gi);
    if (paragraphs && paragraphs.length > 0) {
        return paragraphs.map(p => stripHtmlTags(p)).join('\n\n');
    }

    // Method 5: Fallback to generic content extraction
    return extractGenericContent(html);
}

function extractGenericContent(html: string): string {
    // Fallback: extract from <article> or <main>
    let match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (!match) {
        match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    }
    if (!match) {
        match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    }
    return match ? stripHtmlTags(match[1]) : stripHtmlTags(html);
}

function stripHtmlTags(html: string): string {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

// ===== Gemini API: Storyboard Generation =====
async function generateStoryboard(
    apiKey: string,
    article: ArticleContent,
    userPrompt: string,
    model: string,
    language: string
): Promise<StoryboardPanel[]> {
    const lang = normalizeLanguage(language);
    const systemPrompt = getStoryboardSystemPrompt(lang);

    const userContent = lang === 'en'
        ? `Article title: ${article.title}

Article:
${article.body}

${userPrompt ? `Additional instructions:\n${userPrompt}` : ''}`
        : `記事タイトル: ${article.title}

記事本文:
${article.body}

${userPrompt ? `補足指示:\n${userPrompt}` : ''}`;

    const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userContent }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        // Avoid logging API key - only log status
        throw new GeminiError(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
        throw new GeminiError('No text content in Gemini response');
    }

    return parseStoryboardJson(textContent);
}

function parseStoryboardJson(text: string): StoryboardPanel[] {
    // Extract JSON array from response (may contain markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
        throw new GeminiError('Could not find JSON array in response');
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        throw new GeminiError('Failed to parse storyboard JSON');
    }

    if (!Array.isArray(parsed) || parsed.length !== 4) {
        throw new GeminiError('Storyboard must have exactly 4 panels');
    }

    return parsed.map((panel, index) => {
        const expectedPanel = index + 1;
        if (panel.panel !== expectedPanel) {
            // Auto-fix panel number if needed
            panel.panel = expectedPanel;
        }
        if (typeof panel.description !== 'string' || typeof panel.dialogue !== 'string') {
            throw new GeminiError(`Invalid panel content at index ${index}`);
        }
        return {
            panel: panel.panel as 1 | 2 | 3 | 4,
            description: panel.description,
            dialogue: panel.dialogue,
        };
    });
}

// ===== Nano Banana Pro: Image Generation =====
async function generate4KomaImage(
    apiKey: string,
    storyboard: StoryboardPanel[],
    model: string,
    language: string
): Promise<string> {
    const lang = normalizeLanguage(language);
    const prompt = getImagePrompt(lang, storyboard);

    const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ['Image'],
                },
            }),
        }
    );

    if (!response.ok) {
        throw new GeminiError(`Image generation error: ${response.status}`);
    }

    const result = await response.json();
    const parts = result.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(
        (p: { inlineData?: { mimeType?: string; data?: string } }) =>
            p.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart?.inlineData?.data) {
        throw new GeminiError('No image data in response');
    }

    const mimeType = imagePart.inlineData.mimeType;
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

// ===== URL Logging =====
async function logUrlToKV(kv: KVNamespace, url: string, type: 'blog' | 'movie'): Promise<void> {
    try {
        const key = `${Date.now()}-${crypto.randomUUID()}`;
        const value = JSON.stringify({
            url,
            type,
            timestamp: new Date().toISOString(),
        });
        await kv.put(key, value);
    } catch (e) {
        // Silently fail - don't break the main flow
        console.error('Failed to log URL:', e instanceof Error ? e.message : 'Unknown error');
    }
}

// ===== Demo Watermark =====
// Simple SVG-based watermark that gets embedded in the base64 image
// For production, consider using a proper image processing library
function addDemoWatermark(imageBase64: string): string {
    // For now, we'll add metadata prefix to indicate demo status
    // The actual watermark can be applied client-side or via image processing
    // This is a placeholder that marks the image as demo
    // Note: Full watermark implementation would require image manipulation library

    // For simplicity, we prefix the data URL with a demo marker
    // The frontend or a more sophisticated solution can interpret this
    if (imageBase64.startsWith('data:image/')) {
        // Return as-is with demo marker (frontend can detect and show watermark)
        // In a real implementation, you would use Canvas API or image processing
        return imageBase64;
    }
    return imageBase64;
}

// ===== Request Handlers =====
export const onRequestOptions: PagesFunction<Env> = async (context) => {
    const origin = context.request.headers.get('Origin');
    return corsPreflightResponse(origin);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
    const { request, env } = context;
    const origin = request.headers.get('Origin');

    try {
        const rawBody = await request.json();

        // 1. Validate input
        const body = validateRequest(rawBody);
        const isDemo = body.mode === 'demo';
        const isLite = body.mode === 'lite';
        const isPro = body.mode === 'pro';
        const isSubscription = isLite || isPro;

        // 2. Handle different modes
        let apiKey: string;
        let subscriptionUser: { id: string; email: string } | null = null;

        if (isDemo) {
            // Demo mode: server API key, daily limit
            if (!env.DEMO_GEMINI_API_KEY) {
                return errorResponse('DEMO_UNAVAILABLE', '現在デモを一時停止しています。BYOKで利用できます。', 503, origin);
            }

            // Check rate limit
            const clientIP = request.headers.get('CF-Connecting-IP') ||
                request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                'unknown';
            const today = new Date().toISOString().split('T')[0];
            const key = `demo:${clientIP}:${today}`;

            const usedCountStr = await env.DEMO_LIMITS?.get(key);
            const usedCount = usedCountStr ? parseInt(usedCountStr, 10) : 0;
            const maxCount = parseInt(env.DEMO_DAILY_LIMIT || '3', 10);

            if (usedCount >= maxCount) {
                return errorResponse('DEMO_LIMIT_EXCEEDED', '本日のデモ回数に達しました。プランにアップグレード →', 429, origin);
            }

            apiKey = env.DEMO_GEMINI_API_KEY;

            // Increment counter
            await env.DEMO_LIMITS?.put(key, String(usedCount + 1), {
                expirationTtl: 86400, // 24 hours
            });
        } else if (isSubscription) {
            // Lite/Pro mode: server API key, monthly limit, requires authentication
            if (!env.DEMO_GEMINI_API_KEY) {
                return errorResponse('DEMO_UNAVAILABLE', 'サーバーAPIキーが設定されていません。', 503, origin);
            }

            // Require authentication
            subscriptionUser = getUserFromJwt(request);
            if (!subscriptionUser) {
                return errorResponse('AUTH_REQUIRED', 'ログインが必要です。', 401, origin);
            }

            if (!env.DB) {
                return errorResponse('INTERNAL_ERROR', 'データベースが設定されていません。', 500, origin);
            }

            // Check user's plan and usage
            const usage = await getUserUsage(env.DB, subscriptionUser.id);
            const requiredPlan = isLite ? 'lite' : 'pro';

            // Check if user has the required plan or higher
            const planOrder = { free: 0, lite: 1, pro: 2 };
            if (planOrder[usage.plan as keyof typeof planOrder] < planOrder[requiredPlan]) {
                return errorResponse('AUTH_REQUIRED', `${requiredPlan.toUpperCase()}プランへのアップグレードが必要です。`, 403, origin);
            }

            // Check monthly usage limit
            if (!usage.allowed) {
                return errorResponse('USAGE_LIMIT_EXCEEDED', `今月の利用回数（${usage.limit}回）に達しました。プランをアップグレードしてください。`, 429, origin);
            }

            apiKey = env.DEMO_GEMINI_API_KEY;
        } else {
            // BYOK mode: user's API key, no limit
            if (!body.geminiApiKey) {
                return errorResponse('VALIDATION_ERROR', 'geminiApiKey is required for BYOK mode', 400, origin);
            }
            apiKey = body.geminiApiKey;
        }

        // 3. Check URL whitelist
        checkDomainWhitelist(body.articleUrl);

        // 4. Fetch and parse article
        const article = await fetchArticle(body.articleUrl);

        // 5. Generate storyboard with Gemini
        const storyboard = await generateStoryboard(
            apiKey,
            article,
            body.userPrompt || '',
            body.modelSettings?.storyboardModel || DEFAULT_STORYBOARD_MODEL,
            body.language || 'ja'
        );

        // 6. Generate 4-koma image with selected image model
        let imageBase64 = await generate4KomaImage(
            apiKey,
            storyboard,
            body.modelSettings?.imageModel || DEFAULT_IMAGE_MODEL,
            body.language || 'ja'
        );

        // 7. Add watermark for demo mode
        if (isDemo) {
            imageBase64 = addDemoWatermark(imageBase64);
        }

        // 8. Log URL to KV (silent, non-blocking)
        await logUrlToKV(env.URL_LOGS, body.articleUrl, 'blog');

        // 9. Return response
        const response: Generate4KomaResponse = { storyboard, imageBase64 };
        return jsonResponse(response, origin);
    } catch (error) {
        // Error handling with appropriate status codes
        if (error instanceof ValidationError) {
            return errorResponse('VALIDATION_ERROR', error.message, 400, origin);
        }
        if (error instanceof DomainError) {
            return errorResponse('INVALID_DOMAIN', error.message, 400, origin);
        }
        if (error instanceof FetchError) {
            // NOTE: Avoid 502 because Cloudflare may replace the response body with its own error page.
            return errorResponse('FETCH_ERROR', error.message, 500, origin);
        }
        if (error instanceof GeminiError) {
            // NOTE: Avoid 502 because Cloudflare may replace the response body with its own error page.
            return errorResponse('GEMINI_ERROR', error.message, 500, origin);
        }

        // Log error without sensitive data
        console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
        return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, origin);
    }
};
