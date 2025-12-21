import type {
    GenerateMovie4KomaRequest,
    GenerateMovie4KomaResponse,
    StoryboardPanel,
    MovieSummary,
    ApiError,
    ErrorCode,
} from '../../frontend/src/types';
import { getCorsHeaders, corsPreflightResponse } from './_cors';
import { getUserUsage, recordUsage, getUserFromJwt } from './_usage';
import { normalizeLanguage, getImagePrompt } from './prompts';
import { fetchYouTubeTranscriptJson3, formatTranscriptForPrompt } from './youtubeTranscript';

// ===== Env Interface =====
interface Env {
    URL_LOGS: KVNamespace;
    DEMO_LIMITS: KVNamespace;
    DB: D1Database;
    DEMO_GEMINI_API_KEY: string;
    MOVIE_DEMO_DAILY_LIMIT: string;
}

// ===== Constants =====
const ALLOWED_YOUTUBE_DOMAINS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];
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

class GeminiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GeminiError';
    }
}

async function generateVideoSummaryFromVideoInfo(
    apiKey: string,
    params: {
        videoInfo: YouTubeVideoInfo;
        youtubeUrl: string;
        userPrompt: string;
        model: string;
        language: string;
    }
): Promise<MovieSummary> {
    const lang = normalizeLanguage(params.language);

    const systemPrompt = lang === 'en'
        ? `You are a video content analyst.

Given ONLY the YouTube title/metadata, infer a plausible summary that can be adapted into a 4-panel comic.

Rules:
- This is a fallback when transcript is unavailable.
- Be explicit that this is an inference based on title/metadata.
- Keep it concise (200-400 characters).

Output format:
Return ONLY valid JSON (no markdown).
{
  "title": "...",
  "summary": "..."
}`
        : `あなたは動画コンテンツアナリストです。

YouTube動画のタイトル/メタ情報だけをもとに、内容を推測して4コマ化しやすい要約を作成してください。

ルール:
- 字幕が取得できない場合のフォールバックである
- タイトル/メタ情報からの推測であることが伝わる要約にする
- 200-400文字程度で簡潔に

出力形式:
必ずJSONのみ（Markdown禁止）。
{
  "title": "...",
  "summary": "..."
}`;

    const userContent = lang === 'en'
        ? `YouTube URL: ${params.youtubeUrl}
Video title: ${params.videoInfo.title}
Channel: ${params.videoInfo.author}
${params.videoInfo.description ? `Description: ${params.videoInfo.description}\n` : ''}
${params.userPrompt ? `Additional instructions:\n${params.userPrompt}` : ''}`
        : `YouTube URL: ${params.youtubeUrl}
動画タイトル: ${params.videoInfo.title}
チャンネル名: ${params.videoInfo.author}
${params.videoInfo.description ? `説明: ${params.videoInfo.description}\n` : ''}
${params.userPrompt ? `補足指示:\n${params.userPrompt}` : ''}`;

    const response = await fetch(`${GEMINI_API_BASE}/models/${params.model}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userContent }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            },
        }),
    });

    if (!response.ok) {
        throw new GeminiError(`動画要約の生成中にエラーが発生しました: ${response.status}`);
    }

    const result = await response.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
        throw new GeminiError('動画要約の生成結果を取得できませんでした');
    }

    return parseMovieSummaryJson(textContent);
}

function parseMovieSummaryJson(text: string): MovieSummary {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
        throw new GeminiError('動画要約のJSONを取得できませんでした');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        throw new GeminiError('動画要約のJSONのパースに失敗しました');
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new GeminiError('動画要約の形式が不正です');
    }

    const obj = parsed as Record<string, unknown>;
    if (typeof obj.title !== 'string' || typeof obj.summary !== 'string') {
        throw new GeminiError('動画要約の形式が不正です');
    }

    return { title: obj.title, summary: obj.summary };
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
function validateRequest(body: unknown): GenerateMovie4KomaRequest {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be a JSON object');
    }

    const { youtubeUrl, userPrompt, geminiApiKey, modelSettings, mode, language } = body as Record<string, unknown>;

    if (typeof youtubeUrl !== 'string' || !youtubeUrl.trim()) {
        throw new ValidationError('youtubeUrl is required');
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
        userPrompt: (userPrompt as string)?.trim() || '',
        geminiApiKey: (geminiApiKey as string)?.trim(),
        modelSettings: (modelSettings as GenerateMovie4KomaRequest['modelSettings']) || {
            storyboardModel: DEFAULT_STORYBOARD_MODEL,
            imageModel: DEFAULT_IMAGE_MODEL,
        },
        language: normalizeLanguage(language),
        mode: requestMode as 'demo' | 'byok',
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

// ===== Fetch Error Class =====
class FetchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FetchError';
    }
}

// ===== YouTube Video Info Fetching =====
interface YouTubeVideoInfo {
    title: string;
    author: string;
    description?: string;
}

async function fetchYouTubeVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
    // Use noembed.com to get video info (no API key required)
    const noembedUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;

    const response = await fetch(noembedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; 4KomaBot/1.0)',
        },
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
        throw new FetchError(`動画情報の取得に失敗しました: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
        throw new FetchError('動画が見つかりませんでした。URLを確認してください。');
    }

    return {
        title: data.title || 'タイトル不明',
        author: data.author_name || '不明',
        description: data.description || undefined,
    };
}

// ===== Gemini API: Story (Kishotenketsu) from Transcript =====
interface MovieStoryPart {
    part: 1 | 2 | 3 | 4;
    startSec: number;
    endSec: number;
    summary: string;
}

interface MovieStory {
    title: string;
    overallSummary: string;
    parts: MovieStoryPart[];
}

async function generateKishotenketsuStory(
    apiKey: string,
    params: {
        videoInfo: YouTubeVideoInfo;
        youtubeUrl: string;
        transcriptText: string;
        userPrompt: string;
        model: string;
        language: string;
    }
): Promise<MovieStory> {
    const lang = normalizeLanguage(params.language);

    const systemPrompt = lang === 'en'
        ? `You are a video content analyst and story editor.

Turn the provided timestamped transcript into a 4-part kishotenketsu story (setup, development, twist, conclusion) that can be converted into a 4-panel comic.

Rules:
- Use the transcript as the source of truth (do not invent scenes not implied by it).
- Output exactly 4 parts.
- Each part must include startSec and endSec (numbers in seconds) that reflect the transcript timeline.
- overallSummary should be 200-400 characters.

Output format:
Return ONLY valid JSON (no markdown).
{
  "title": "...",
  "overallSummary": "...",
  "parts": [
    {"part": 1, "startSec": 0, "endSec": 10, "summary": "..."},
    {"part": 2, "startSec": 10, "endSec": 20, "summary": "..."},
    {"part": 3, "startSec": 20, "endSec": 30, "summary": "..."},
    {"part": 4, "startSec": 30, "endSec": 40, "summary": "..."}
  ]
}`
        : `あなたは動画コンテンツアナリスト兼ストーリー編集者です。

以下の「タイムスタンプ付き字幕（時系列）」を根拠に、4コマにできる起承転結のストーリーを作ってください。

ルール:
- 字幕の内容を根拠にし、根拠のない創作はしない
- 起承転結の4パートに必ず分ける
- 各パートに startSec/endSec（秒・数値）を入れ、字幕の時間軸と整合させる
- overallSummary は200-400文字程度

出力形式:
必ずJSONのみ（Markdown禁止）。
{
  "title": "...",
  "overallSummary": "...",
  "parts": [
    {"part": 1, "startSec": 0, "endSec": 10, "summary": "..."},
    {"part": 2, "startSec": 10, "endSec": 20, "summary": "..."},
    {"part": 3, "startSec": 20, "endSec": 30, "summary": "..."},
    {"part": 4, "startSec": 30, "endSec": 40, "summary": "..."}
  ]
}`;

    const userContent = lang === 'en'
        ? `YouTube URL: ${params.youtubeUrl}
Video title: ${params.videoInfo.title}
Channel: ${params.videoInfo.author}

[Transcript]
${params.transcriptText}

${params.userPrompt ? `Additional instructions:\n${params.userPrompt}` : ''}`
        : `YouTube URL: ${params.youtubeUrl}
動画タイトル: ${params.videoInfo.title}
チャンネル名: ${params.videoInfo.author}

【字幕（タイムスタンプ付き）】
${params.transcriptText}

${params.userPrompt ? `補足指示:\n${params.userPrompt}` : ''}`;

    const response = await fetch(`${GEMINI_API_BASE}/models/${params.model}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userContent }] }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048,
            },
        }),
    });

    if (!response.ok) {
        throw new GeminiError(`動画ストーリー生成エラー: ${response.status}`);
    }

    const result = await response.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
        throw new GeminiError('動画ストーリーの生成結果を取得できませんでした');
    }

    return parseMovieStoryJson(textContent);
}

function parseMovieStoryJson(text: string): MovieStory {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new GeminiError('動画ストーリーのJSONを取得できませんでした');
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch {
        throw new GeminiError('動画ストーリーのJSONのパースに失敗しました');
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new GeminiError('動画ストーリーの形式が不正です');
    }

    const obj = parsed as Record<string, unknown>;
    if (typeof obj.title !== 'string' || typeof obj.overallSummary !== 'string' || !Array.isArray(obj.parts)) {
        throw new GeminiError('動画ストーリーの形式が不正です');
    }

    if (obj.parts.length !== 4) {
        throw new GeminiError('動画ストーリーは4パート（起承転結）である必要があります');
    }

    const parts = obj.parts.map((p, index) => {
        const partObj = p as Record<string, unknown>;
        const expectedPart = (index + 1) as 1 | 2 | 3 | 4;
        const part = typeof partObj.part === 'number' ? (partObj.part as number) : expectedPart;
        const startSec = typeof partObj.startSec === 'number' ? partObj.startSec : NaN;
        const endSec = typeof partObj.endSec === 'number' ? partObj.endSec : NaN;
        const summary = typeof partObj.summary === 'string' ? partObj.summary : '';

        if (![1, 2, 3, 4].includes(part) || !Number.isFinite(startSec) || !Number.isFinite(endSec) || !summary) {
            throw new GeminiError('動画ストーリーのパート形式が不正です');
        }

        return {
            part: expectedPart,
            startSec: Math.max(0, startSec),
            endSec: Math.max(0, endSec),
            summary,
        } as MovieStoryPart;
    });

    for (let i = 0; i < parts.length; i += 1) {
        if (parts[i].startSec > parts[i].endSec) {
            throw new GeminiError('動画ストーリーの時間範囲が不正です');
        }
        if (i > 0 && parts[i].startSec < parts[i - 1].startSec) {
            throw new GeminiError('動画ストーリーの時系列が不正です');
        }
    }

    return {
        title: obj.title,
        overallSummary: obj.overallSummary,
        parts,
    };
}

// ===== Gemini API: Storyboard Generation =====
async function generateStoryboardFromStory(
    apiKey: string,
    params: {
        story: MovieStory;
        userPrompt: string;
        model: string;
        language: string;
    }
): Promise<StoryboardPanel[]> {
    const lang = normalizeLanguage(params.language);

    const systemPrompt = lang === 'en'
        ? `You are a 4-panel manga (yonkoma) scriptwriter.

Convert the provided kishotenketsu story into a 4-panel storyboard.

Constraints:
- Exactly 4 panels (setup, development, twist, punchline)
- Each panel must include description (a concrete, drawable scene; ~50-120 characters) and dialogue (short; <= 50 characters)
- Dialogue must be in English

Output format:
Return ONLY the following JSON array.
[
  {"panel": 1, "description": "...", "dialogue": "..."},
  {"panel": 2, "description": "...", "dialogue": "..."},
  {"panel": 3, "description": "...", "dialogue": "..."},
  {"panel": 4, "description": "...", "dialogue": "..."}
]`
        : `あなたは4コマ漫画の脚本家です。与えられた起承転結ストーリーを4コマ漫画の絵コンテに変換してください。

制約:
- 必ず4つのパネル（起承転結）で構成する
- 各パネルには description（シーンの説明）と dialogue（セリフ）を含める
- description は視覚的に描画可能な具体的な場面を記述する（50-100文字）
- dialogue は短く印象的なセリフにする（30文字以内）
- ストーリーの流れと核心を4コマで伝える

出力形式:
必ず以下のJSON形式のみを出力してください。他の説明は不要です。
[
  {"panel": 1, "description": "...", "dialogue": "..."},
  {"panel": 2, "description": "...", "dialogue": "..."},
  {"panel": 3, "description": "...", "dialogue": "..."},
  {"panel": 4, "description": "...", "dialogue": "..."}
]`;

    const partsText = params.story.parts
        .map((p) => {
            const label = p.part === 1 ? '起' : p.part === 2 ? '承' : p.part === 3 ? '転' : '結';
            return `${label} [${p.startSec.toFixed(1)}-${p.endSec.toFixed(1)}s]: ${p.summary}`;
        })
        .join('\n');

    const userContent = lang === 'en'
        ? `Title: ${params.story.title}
Overall summary: ${params.story.overallSummary}

Story parts:
${partsText}

${params.userPrompt ? `Additional instructions:\n${params.userPrompt}` : ''}`
        : `タイトル: ${params.story.title}
全体要約: ${params.story.overallSummary}

起承転結:
${partsText}

${params.userPrompt ? `補足指示:\n${params.userPrompt}` : ''}`;

    const response = await fetch(`${GEMINI_API_BASE}/models/${params.model}:generateContent`, {
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
    });

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

async function generateStoryboardFromSummary(
    apiKey: string,
    params: {
        movieSummary: MovieSummary;
        userPrompt: string;
        model: string;
        language: string;
    }
): Promise<StoryboardPanel[]> {
    const lang = normalizeLanguage(params.language);

    const systemPrompt = lang === 'en'
        ? `You are a 4-panel manga (yonkoma) scriptwriter.

Convert the provided video summary into a 4-panel storyboard.

Constraints:
- Exactly 4 panels (setup, development, twist, punchline)
- Each panel must include description (a concrete, drawable scene; ~50-120 characters) and dialogue (short; <= 50 characters)
- Dialogue must be in English

Output format:
Return ONLY the following JSON array.
[
  {"panel": 1, "description": "...", "dialogue": "..."},
  {"panel": 2, "description": "...", "dialogue": "..."},
  {"panel": 3, "description": "...", "dialogue": "..."},
  {"panel": 4, "description": "...", "dialogue": "..."}
]`
        : `あなたは4コマ漫画の脚本家です。与えられた動画の要約を4コマ漫画の絵コンテに変換してください。

制約:
- 必ず4つのパネル（起承転結）で構成する
- 各パネルには description（シーンの説明）と dialogue（セリフ）を含める
- description は視覚的に描画可能な具体的な場面を記述する（50-100文字）
- dialogue は短く印象的なセリフにする（30文字以内）

出力形式:
必ず以下のJSON形式のみを出力してください。他の説明は不要です。
[
  {"panel": 1, "description": "...", "dialogue": "..."},
  {"panel": 2, "description": "...", "dialogue": "..."},
  {"panel": 3, "description": "...", "dialogue": "..."},
  {"panel": 4, "description": "...", "dialogue": "..."}
]`;

    const userContent = lang === 'en'
        ? `Title: ${params.movieSummary.title}

Summary:
${params.movieSummary.summary}

${params.userPrompt ? `Additional instructions:\n${params.userPrompt}` : ''}`
        : `動画タイトル: ${params.movieSummary.title}

動画要約:
${params.movieSummary.summary}

${params.userPrompt ? `補足指示:\n${params.userPrompt}` : ''}`;

    const response = await fetch(`${GEMINI_API_BASE}/models/${params.model}:generateContent`, {
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
    });

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
async function generate4KomaImage(
    apiKey: string,
    storyboard: StoryboardPanel[],
    model: string,
    language: string
): Promise<string> {
    const prompt = getImagePrompt(normalizeLanguage(language), storyboard);

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
            const key = `movie-demo:${clientIP}:${today}`;

            const usedCountStr = await env.DEMO_LIMITS?.get(key);
            const usedCount = usedCountStr ? parseInt(usedCountStr, 10) : 0;
            const maxCount = parseInt(env.MOVIE_DEMO_DAILY_LIMIT || '1', 10);

            if (usedCount >= maxCount) {
                return errorResponse('DEMO_LIMIT_EXCEEDED', '本日の動画デモ回数に達しました。プランにアップグレード →', 429, origin);
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

        // 3. Check YouTube domain
        checkYouTubeDomain(body.youtubeUrl);

        // 4. Extract video ID
        const videoId = extractVideoId(body.youtubeUrl);

        // 5. Fetch YouTube video info (title, author)
        const videoInfo = await fetchYouTubeVideoInfo(videoId);

        // 6. Fetch transcript (timestamped, chronological). If unavailable, fall back to title/metadata.
        let transcriptText: string | null = null;
        try {
            const transcriptLines = await fetchYouTubeTranscriptJson3(videoId, { language: body.language, timeoutMs: 10000 });
            const formatted = formatTranscriptForPrompt(transcriptLines, { maxChars: 12000, maxLines: 120 });
            transcriptText = formatted || null;
        } catch {
            transcriptText = null;
        }

        let movieSummary: MovieSummary;
        let storyboard: StoryboardPanel[];

        if (transcriptText) {
            // 7. Generate kishotenketsu story from transcript
            const story = await generateKishotenketsuStory(apiKey, {
                videoInfo,
                youtubeUrl: body.youtubeUrl,
                transcriptText,
                userPrompt: body.userPrompt || '',
                model: body.modelSettings?.storyboardModel || DEFAULT_STORYBOARD_MODEL,
                language: body.language || 'ja',
            });

            movieSummary = {
                title: videoInfo.title,
                summary: story.overallSummary,
            };

            // 8. Generate storyboard from story
            storyboard = await generateStoryboardFromStory(apiKey, {
                story,
                userPrompt: body.userPrompt || '',
                model: body.modelSettings?.storyboardModel || DEFAULT_STORYBOARD_MODEL,
                language: body.language || 'ja',
            });
        } else {
            // 7. Fallback: infer summary from title/metadata
            const inferred = await generateVideoSummaryFromVideoInfo(apiKey, {
                videoInfo,
                youtubeUrl: body.youtubeUrl,
                userPrompt: body.userPrompt || '',
                model: body.modelSettings?.storyboardModel || DEFAULT_STORYBOARD_MODEL,
                language: body.language || 'ja',
            });

            movieSummary = {
                title: videoInfo.title,
                summary: inferred.summary,
            };

            // 8. Generate storyboard from inferred summary
            storyboard = await generateStoryboardFromSummary(apiKey, {
                movieSummary,
                userPrompt: body.userPrompt || '',
                model: body.modelSettings?.storyboardModel || DEFAULT_STORYBOARD_MODEL,
                language: body.language || 'ja',
            });
        }

        // 9. Generate 4-koma image
        const imageBase64 = await generate4KomaImage(
            apiKey,
            storyboard,
            body.modelSettings?.imageModel || DEFAULT_IMAGE_MODEL,
            body.language || 'ja'
        );

        // 10. Log URL to KV (silent, non-blocking)
        await logUrlToKV(env.URL_LOGS, body.youtubeUrl, 'movie');

        // 11. Return response
        const response: GenerateMovie4KomaResponse = { movieSummary, storyboard, imageBase64 };
        return jsonResponse(response, origin);
    } catch (error) {
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

        console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
        return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, origin);
    }
};
