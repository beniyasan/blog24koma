import type {
    GenerateMovie4KomaRequest,
    GenerateMovie4KomaResponse,
    StoryboardPanel,
    MovieSummary,
    ApiError,
    ErrorCode,
} from '../../frontend/src/types';

// ===== Constants =====
const ALLOWED_YOUTUBE_DOMAINS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];
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
function validateRequest(body: unknown): GenerateMovie4KomaRequest {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be a JSON object');
    }

    const { youtubeUrl, userPrompt, geminiApiKey, modelSettings } = body as Record<string, unknown>;

    if (typeof youtubeUrl !== 'string' || !youtubeUrl.trim()) {
        throw new ValidationError('youtubeUrl is required');
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
        url = new URL(youtubeUrl);
    } catch {
        throw new ValidationError('Invalid URL format');
    }

    // Protocol check
    if (url.protocol !== 'https:') {
        throw new ValidationError('Only HTTPS URLs are allowed');
    }

    return {
        youtubeUrl: youtubeUrl.trim(),
        userPrompt: userPrompt?.trim() || '',
        geminiApiKey: geminiApiKey.trim(),
        modelSettings: modelSettings || {
            storyboardModel: DEFAULT_STORYBOARD_MODEL,
            imageModel: DEFAULT_IMAGE_MODEL,
        },
    };
}

// ===== YouTube URL Validation =====
function checkYouTubeDomain(urlString: string): void {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    const isAllowed = ALLOWED_YOUTUBE_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
        throw new DomainError(`YouTubeのURLを入力してください。対応: ${ALLOWED_YOUTUBE_DOMAINS.join(', ')}`);
    }
}

// ===== Extract Video ID =====
function extractVideoId(urlString: string): string {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // youtu.be format: https://youtu.be/VIDEO_ID
    if (hostname === 'youtu.be') {
        const videoId = url.pathname.slice(1);
        if (videoId) return videoId;
    }

    // youtube.com format: https://www.youtube.com/watch?v=VIDEO_ID
    if (hostname.includes('youtube.com')) {
        const videoId = url.searchParams.get('v');
        if (videoId) return videoId;

        // Handle /shorts/VIDEO_ID format
        const shortsMatch = url.pathname.match(/\/shorts\/([^/?]+)/);
        if (shortsMatch) return shortsMatch[1];

        // Handle /embed/VIDEO_ID format
        const embedMatch = url.pathname.match(/\/embed\/([^/?]+)/);
        if (embedMatch) return embedMatch[1];
    }

    throw new ValidationError('YouTube動画のIDを取得できませんでした。URLを確認してください。');
}

// ===== Gemini API: Video Analysis and Summary =====
async function analyzeVideoAndSummarize(
    apiKey: string,
    youtubeUrl: string,
    model: string
): Promise<MovieSummary> {
    const systemPrompt = `あなたは動画コンテンツアナリストです。与えられたYouTube動画のURLを分析し、その内容を要約してください。

指示:
1. 動画のメインテーマや主張を把握する
2. 重要なポイントを抽出する
3. 視聴者に伝えたいメッセージを理解する

出力形式:
必ず以下のJSON形式のみを出力してください。他の説明は不要です。
{
  "title": "動画のタイトル（推測または抽出）",
  "summary": "動画内容の要約（200-400文字程度）"
}`;

    const userContent = `以下のYouTube動画を分析し、タイトルと要約をJSON形式で出力してください。

YouTube URL: ${youtubeUrl}`;

    const response = await fetch(
        `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: systemPrompt + '\n\n' + userContent },
                            {
                                fileData: {
                                    mimeType: 'video/mp4',
                                    fileUri: youtubeUrl
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini video analysis error:', response.status);
        throw new GeminiError(`動画の分析中にエラーが発生しました: ${response.status}`);
    }

    const result = await response.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
        throw new GeminiError('動画分析の結果を取得できませんでした');
    }

    return parseMovieSummaryJson(textContent);
}

function parseMovieSummaryJson(text: string): MovieSummary {
    // Extract JSON object from response
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
        throw new GeminiError('動画要約のJSONを取得できませんでした');
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        throw new GeminiError('動画要約のJSONのパースに失敗しました');
    }

    if (typeof parsed.title !== 'string' || typeof parsed.summary !== 'string') {
        throw new GeminiError('動画要約の形式が不正です');
    }

    return {
        title: parsed.title,
        summary: parsed.summary,
    };
}

// ===== Gemini API: Storyboard Generation =====
async function generateStoryboard(
    apiKey: string,
    movieSummary: MovieSummary,
    userPrompt: string,
    model: string
): Promise<StoryboardPanel[]> {
    const systemPrompt = `あなたは4コマ漫画の脚本家です。与えられた動画の要約を4コマ漫画の絵コンテに変換してください。

制約:
- 必ず4つのパネル（起承転結）で構成する
- 各パネルには description（シーンの説明）と dialogue（セリフ）を含める
- description は視覚的に描画可能な具体的な場面を記述する（50-100文字）
- dialogue は短く印象的なセリフにする（30文字以内）
- 動画の核心的なメッセージを4コマで伝える

出力形式:
必ず以下のJSON形式のみを出力してください。他の説明は不要です。
[
  {"panel": 1, "description": "...", "dialogue": "..."},
  {"panel": 2, "description": "...", "dialogue": "..."},
  {"panel": 3, "description": "...", "dialogue": "..."},
  {"panel": 4, "description": "...", "dialogue": "..."}
]`;

    const userContent = `動画タイトル: ${movieSummary.title}

動画要約:
${movieSummary.summary}

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
        throw new GeminiError(`絵コンテ生成エラー: ${response.status}`);
    }

    const result = await response.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
        throw new GeminiError('絵コンテの生成結果を取得できませんでした');
    }

    return parseStoryboardJson(textContent);
}

function parseStoryboardJson(text: string): StoryboardPanel[] {
    const jsonMatch = text.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) {
        throw new GeminiError('絵コンテのJSONを取得できませんでした');
    }

    let parsed;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        throw new GeminiError('絵コンテのJSONのパースに失敗しました');
    }

    if (!Array.isArray(parsed) || parsed.length !== 4) {
        throw new GeminiError('絵コンテは4つのパネルで構成される必要があります');
    }

    return parsed.map((panel, index) => {
        const expectedPanel = index + 1;
        if (panel.panel !== expectedPanel) {
            panel.panel = expectedPanel;
        }
        if (typeof panel.description !== 'string' || typeof panel.dialogue !== 'string') {
            throw new GeminiError(`パネル${index + 1}の内容が不正です`);
        }
        return {
            panel: panel.panel as 1 | 2 | 3 | 4,
            description: panel.description,
            dialogue: panel.dialogue,
        };
    });
}

// ===== Gemini: Image Generation =====
async function generate4KomaImage(apiKey: string, storyboard: StoryboardPanel[], model: string): Promise<string> {
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
        throw new GeminiError(`画像生成エラー: ${response.status}`);
    }

    const result = await response.json();
    const parts = result.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(
        (p: { inlineData?: { mimeType?: string; data?: string } }) =>
            p.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart?.inlineData?.data) {
        throw new GeminiError('画像データを取得できませんでした');
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

        // 2. Check YouTube domain
        checkYouTubeDomain(body.youtubeUrl);

        // 3. Extract video ID (for validation)
        extractVideoId(body.youtubeUrl);

        // 4. Analyze video and generate summary with Gemini
        const movieSummary = await analyzeVideoAndSummarize(
            body.geminiApiKey,
            body.youtubeUrl,
            body.modelSettings.storyboardModel
        );

        // 5. Generate storyboard from summary
        const storyboard = await generateStoryboard(
            body.geminiApiKey,
            movieSummary,
            body.userPrompt || '',
            body.modelSettings.storyboardModel
        );

        // 6. Generate 4-koma image
        const imageBase64 = await generate4KomaImage(
            body.geminiApiKey,
            storyboard,
            body.modelSettings.imageModel
        );

        // 7. Return response
        const response: GenerateMovie4KomaResponse = { movieSummary, storyboard, imageBase64 };
        return jsonResponse(response);
    } catch (error) {
        if (error instanceof ValidationError) {
            return errorResponse('VALIDATION_ERROR', error.message, 400);
        }
        if (error instanceof DomainError) {
            return errorResponse('INVALID_DOMAIN', error.message, 400);
        }
        if (error instanceof GeminiError) {
            return errorResponse('GEMINI_ERROR', error.message, 502);
        }

        console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
        return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }
};
