import type {
    Generate4KomaRequest,
    Generate4KomaResponse,
    StoryboardPanel,
    ImagePanel,
    ApiError,
    ErrorCode,
} from '../../frontend/src/types';

// ===== Constants =====
const ALLOWED_DOMAINS = ['note.com', 'qiita.com', 'zenn.dev'];
const DEFAULT_STORYBOARD_MODEL = 'gemini-2.5-flash';
const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ===== CORS Headers =====
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

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

// ===== Response Helpers =====
function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

function errorResponse(code: ErrorCode, message: string, status: number): Response {
    const error: ApiError = { error: { code, message } };
    return jsonResponse(error, status);
}

// ===== Validation =====
function validateRequest(body: unknown): Generate4KomaRequest {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be a JSON object');
    }

    const { articleUrl, userPrompt, geminiApiKey, modelSettings } = body as Record<string, unknown>;

    if (typeof articleUrl !== 'string' || !articleUrl.trim()) {
        throw new ValidationError('articleUrl is required');
    }

    if (typeof geminiApiKey !== 'string' || !geminiApiKey.trim()) {
        throw new ValidationError('geminiApiKey is required');
    }

    if (userPrompt !== undefined && typeof userPrompt !== 'string') {
        throw new ValidationError('userPrompt must be a string');
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
        userPrompt: userPrompt?.trim() || '',
        geminiApiKey: geminiApiKey.trim(),
        modelSettings: modelSettings || {
            storyboardModel: DEFAULT_STORYBOARD_MODEL,
            imageModel: DEFAULT_IMAGE_MODEL,
        },
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
    model: string
): Promise<StoryboardPanel[]> {
    const systemPrompt = `あなたは4コマ漫画の脚本家です。与えられた記事の内容を4コマ漫画の絵コンテに変換してください。

制約:
- 必ず4つのパネル（起承転結）で構成する
- 各パネルには description（シーンの説明）と dialogue（セリフ）を含める
- description は視覚的に描画可能な具体的な場面を記述する（50-100文字）
- dialogue は短く印象的なセリフにする（30文字以内）
- 記事の核心的なメッセージを4コマで伝える

出力形式:
必ず以下のJSON形式のみを出力してください。他の説明は不要です。
[
  {"panel": 1, "description": "...", "dialogue": "..."},
  {"panel": 2, "description": "...", "dialogue": "..."},
  {"panel": 3, "description": "...", "dialogue": "..."},
  {"panel": 4, "description": "...", "dialogue": "..."}
]`;

    const userContent = `記事タイトル: ${article.title}

記事本文:
${article.body}

${userPrompt ? `補足指示:\n${userPrompt}` : ''}`;

    const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
async function generate4KomaImage(apiKey: string, storyboard: StoryboardPanel[], model: string): Promise<string> {
    // Build a detailed prompt for all 4 panels with dialogues
    const panelDescriptions = storyboard.map((panel) =>
        `【コマ${panel.panel}】\nシーン: ${panel.description}\nセリフ: 「${panel.dialogue}」`
    ).join('\n\n');

    const prompt = `日本の4コマ漫画を1枚の画像として生成してください。

【レイアウト】
- 縦に4コマ並べた構成（上から下へ1→2→3→4の順）
- 各コマは同じサイズで、明確な枠線で区切る
- アスペクト比は縦長（1:2程度）

【スタイル】
- シンプルでかわいい日本の4コマ漫画風
- 明るく親しみやすいトーン
- キャラクターはデフォルメされたかわいいスタイル
- 背景はシンプルに

【重要】
- 各コマ内にセリフを吹き出しで表示すること
- セリフは日本語で、読みやすいフォントで描くこと
- 起承転結の流れを意識した構成

【各コマの内容】
${panelDescriptions}`;

    const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

// ===== Request Handlers =====
export const onRequestOptions: PagesFunction = async () => {
    return new Response(null, { headers: corsHeaders });
};

export const onRequestPost: PagesFunction = async (context) => {
    try {
        const { request } = context;
        const rawBody = await request.json();

        // 1. Validate input
        const body = validateRequest(rawBody);

        // 2. Check URL whitelist
        checkDomainWhitelist(body.articleUrl);

        // 3. Fetch and parse article
        const article = await fetchArticle(body.articleUrl);

        // 4. Generate storyboard with Gemini
        const storyboard = await generateStoryboard(
            body.geminiApiKey, 
            article, 
            body.userPrompt || '',
            body.modelSettings.storyboardModel
        );

        // 5. Generate 4-koma image with selected image model
        const imageBase64 = await generate4KomaImage(
            body.geminiApiKey, 
            storyboard,
            body.modelSettings.imageModel
        );

        // 6. Return response
        const response: Generate4KomaResponse = { storyboard, imageBase64 };
        return jsonResponse(response);
    } catch (error) {
        // Error handling with appropriate status codes
        if (error instanceof ValidationError) {
            return errorResponse('VALIDATION_ERROR', error.message, 400);
        }
        if (error instanceof DomainError) {
            return errorResponse('INVALID_DOMAIN', error.message, 400);
        }
        if (error instanceof FetchError) {
            return errorResponse('FETCH_ERROR', error.message, 502);
        }
        if (error instanceof GeminiError) {
            return errorResponse('GEMINI_ERROR', error.message, 502);
        }

        // Log error without sensitive data
        console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
        return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }
};
