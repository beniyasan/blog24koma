import type {
    StoryboardPanel,
    ApiError,
    ErrorCode,
    ModelSettings,
    GenerationMode,
    Language,
} from '../../frontend/src/types';
import { getCorsHeaders, corsPreflightResponse } from './_cors';
import { getUserUsage, getUserFromJwt } from './_usage';
import { normalizeLanguage, getStoryboardSystemPrompt } from './prompts';

// ===== Env Interface =====
interface Env {
    DEMO_LIMITS: KVNamespace;
    DB: D1Database;
    DEMO_GEMINI_API_KEY: string;
    CUSTOM_DEMO_DAILY_LIMIT: string;
}

// ===== Constants =====
const DEFAULT_STORYBOARD_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ===== Request/Response Types =====
interface GenerateStoryboardRequest {
    inputText: string;
    userPrompt?: string;
    geminiApiKey?: string;
    modelSettings?: Pick<ModelSettings, 'storyboardModel'>;
    language?: Language;
    mode: GenerationMode;
}

interface CharacterInfo {
    name: string;
    description: string;
}

interface DialogueLine {
    speaker: string;
    text: string;
}

interface EnhancedStoryboardPanel {
    panel: 1 | 2 | 3 | 4;
    description: string;
    dialogues: DialogueLine[];
}

interface GenerateStoryboardResponse {
    characters: CharacterInfo[];
    storyboard: EnhancedStoryboardPanel[];
}

// ===== Error Classes =====
class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

class GeminiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GeminiError';
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
function validateRequest(body: unknown): GenerateStoryboardRequest {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be a JSON object');
    }

    const { inputText, userPrompt, geminiApiKey, modelSettings, mode, language } = body as Record<string, unknown>;

    if (typeof inputText !== 'string' || !inputText.trim()) {
        throw new ValidationError('inputText is required');
    }

    if (inputText.trim().length < 10) {
        throw new ValidationError('inputText must be at least 10 characters');
    }

    if (inputText.trim().length > 10000) {
        throw new ValidationError('inputText must be at most 10000 characters');
    }

    const validModes = ['demo', 'lite', 'pro', 'byok'];
    const requestMode = (mode as string) || 'byok';
    if (!validModes.includes(requestMode)) {
        throw new ValidationError('Invalid mode');
    }

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

        const { storyboardModel } = modelSettings as Record<string, unknown>;

        if (storyboardModel !== undefined) {
            const validModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3-pro-preview'];
            if (!validModels.includes(storyboardModel as string)) {
                throw new ValidationError('Invalid storyboardModel');
            }
        }
    }

    return {
        inputText: inputText.trim(),
        userPrompt: (userPrompt as string)?.trim() || '',
        geminiApiKey: (geminiApiKey as string)?.trim(),
        modelSettings: (modelSettings as GenerateStoryboardRequest['modelSettings']) || {
            storyboardModel: DEFAULT_STORYBOARD_MODEL,
        },
        language: normalizeLanguage(language),
        mode: requestMode as GenerationMode,
    };
}

// ===== Gemini API: Storyboard Generation =====
async function generateStoryboard(
    apiKey: string,
    inputText: string,
    userPrompt: string,
    model: string,
    language: string
): Promise<GenerateStoryboardResponse> {
    const lang = normalizeLanguage(language);
    const systemPrompt = getStoryboardSystemPrompt(lang);

    const userContent = lang === 'en'
        ? `Content to convert into a 4-panel comic:

${inputText}

${userPrompt ? `Additional instructions:\n${userPrompt}` : ''}`
        : `4コマ漫画にする内容:

${inputText}

${userPrompt ? `補足指示:\n${userPrompt}` : ''}`;

    const requestBody = {
        contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userContent }] }],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
        },
    };

    const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new GeminiError(`絵コンテ生成エラー: ${response.status}`);
    }

    const result = await response.json();
    const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
        throw new GeminiError('絵コンテの生成結果を取得できませんでした');
    }

    try {
        return parseStoryboardJson(textContent);
    } catch (error) {
        // Retry once with deterministic settings if the model returned invalid JSON.
        console.error('Storyboard JSON parse failed, retrying once');
        const retryResponse = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                ...requestBody,
                generationConfig: {
                    temperature: 0,
                    maxOutputTokens: 4096,
                },
            }),
        });

        if (!retryResponse.ok) {
            throw error;
        }

        const retryResult = await retryResponse.json();
        const retryTextContent = retryResult.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!retryTextContent) {
            throw error;
        }
        return parseStoryboardJson(retryTextContent);
    }
}

function stripMarkdownCodeFences(text: string): string {
    // Remove fenced code blocks while keeping their contents.
    // Handles: ```json ... ```, ``` ... ```
    return text
        .replace(/```\s*(?:json)?\s*\n([\s\S]*?)\n```/gi, '$1')
        .replace(/```/g, '');
}

function normalizeJsonText(text: string): string {
    // Minimal repairs for common model formatting mistakes.
    return text
        .replace(/^\uFEFF/, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/,\s*([}\]])/g, '$1')
        .trim();
}

function quoteUnquotedKeys(text: string): string {
    let out = '';
    let inString = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            out += ch;
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === '\\') {
                escape = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            out += ch;
            continue;
        }

        if (/[A-Za-z_]/.test(ch)) {
            let j = i - 1;
            while (j >= 0 && /\s/.test(text[j])) j--;
            const prev = j >= 0 ? text[j] : '';

            if (prev === '{' || prev === ',') {
                let k = i;
                while (k < text.length && /[A-Za-z0-9_]/.test(text[k])) k++;
                const ident = text.slice(i, k);

                let m = k;
                while (m < text.length && /\s/.test(text[m])) m++;
                if (m < text.length && text[m] === ':') {
                    out += `"${ident}"`;
                    i = k - 1;
                    continue;
                }
            }
        }

        out += ch;
    }

    return out;
}

function convertSingleQuotedStrings(text: string): string {
    let out = '';
    let inDouble = false;
    let inSingle = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inDouble) {
            out += ch;
            if (escape) {
                escape = false;
                continue;
            }
            if (ch === '\\') {
                escape = true;
                continue;
            }
            if (ch === '"') {
                inDouble = false;
            }
            continue;
        }

        if (inSingle) {
            if (escape) {
                out += ch;
                escape = false;
                continue;
            }
            if (ch === '\\') {
                out += ch;
                escape = true;
                continue;
            }
            if (ch === "'") {
                out += '"';
                inSingle = false;
                continue;
            }
            if (ch === '"') {
                // Escape embedded double-quotes when converting to JSON strings.
                out += '\\"';
                continue;
            }
            out += ch;
            continue;
        }

        if (ch === '"') {
            inDouble = true;
            out += ch;
            continue;
        }

        if (ch === "'") {
            inSingle = true;
            out += '"';
            continue;
        }

        out += ch;
    }

    return out;
}

function repairJsonLike(text: string): string {
    // Apply only after JSON.parse fails.
    return normalizeJsonText(convertSingleQuotedStrings(quoteUnquotedKeys(text)));
}

function tryJsonParse(text: string): unknown | null {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function extractFirstBalancedJson(text: string, openChar: '{' | '['): string | null {
    const closeChar = openChar === '{' ? '}' : ']';

    let startIndex = text.indexOf(openChar);
    while (startIndex !== -1) {
        let inString = false;
        let escape = false;
        let depth = 0;

        for (let i = startIndex; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
                if (escape) {
                    escape = false;
                    continue;
                }
                if (ch === '\\') {
                    escape = true;
                    continue;
                }
                if (ch === '"') {
                    inString = false;
                }
                continue;
            }

            if (ch === '"') {
                inString = true;
                continue;
            }

            if (ch === openChar) {
                depth++;
            } else if (ch === closeChar) {
                depth--;
                if (depth === 0) {
                    return text.slice(startIndex, i + 1);
                }
            }
        }

        startIndex = text.indexOf(openChar, startIndex + 1);
    }
    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function coerceCharacters(value: unknown): CharacterInfo[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((c: unknown) => {
            const char = isRecord(c) ? c : {};
            return {
                name: typeof char.name === 'string' ? char.name.trim() : '',
                description: typeof char.description === 'string'
                    ? char.description.trim()
                    : (typeof char.desc === 'string' ? char.desc.trim() : ''),
            };
        })
        .filter((c) => c.name);
}

function coerceStoryboardValueToArray(value: unknown): unknown[] | null {
    if (Array.isArray(value)) return value;
    if (!isRecord(value)) return null;

    const ordered: unknown[] = [];
    for (let i = 1; i <= 4; i++) {
        const directKey = String(i);
        const panelKey = `panel${i}`;
        const shortKey = `p${i}`;

        if (directKey in value) {
            ordered.push(value[directKey]);
        } else if (panelKey in value) {
            ordered.push(value[panelKey]);
        } else if (shortKey in value) {
            ordered.push(value[shortKey]);
        }
    }

    return ordered.length > 0 ? ordered : null;
}

function looksLikeStoryboardPanel(value: unknown): boolean {
    if (!isRecord(value)) return false;
    return (
        'panel' in value ||
        'description' in value ||
        'scene' in value ||
        'dialogue' in value ||
        'dialogues' in value
    );
}

function parseDialogues(value: unknown): DialogueLine[] {
    if (Array.isArray(value)) {
        return value
            .map((d: unknown) => {
                const dl = isRecord(d) ? d : {};
                return {
                    speaker: typeof dl.speaker === 'string' ? dl.speaker.trim() : '',
                    text: typeof dl.text === 'string' ? dl.text.trim() : '',
                };
            })
            .filter((d) => d.text);
    }

    if (typeof value === 'string') {
        // Sometimes the model returns dialogues as a single string; split into lines.
        return value
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 3)
            .map((line) => {
                const idx = line.indexOf(':');
                if (idx > 0) {
                    return {
                        speaker: line.slice(0, idx).trim(),
                        text: line.slice(idx + 1).trim(),
                    };
                }
                return { speaker: '', text: line };
            })
            .filter((d) => d.text);
    }

    return [];
}

function coerceStoryboardPanels(value: unknown[]): EnhancedStoryboardPanel[] | null {
    if (!value.some(looksLikeStoryboardPanel)) return null;

    const panels: EnhancedStoryboardPanel[] = value.map((panel: unknown, index: number) => {
        const p = isRecord(panel) ? panel : {};
        const expectedPanel = index + 1;

        const description =
            typeof p.description === 'string' ? p.description :
                (typeof p.scene === 'string' ? p.scene : '');

        let dialogues: DialogueLine[] = [];
        if ('dialogues' in p) {
            dialogues = parseDialogues(p.dialogues);
        }

        if (dialogues.length === 0 && typeof p.dialogue === 'string' && p.dialogue.trim()) {
            dialogues = [{ speaker: '', text: p.dialogue.trim() }];
        }

        return {
            panel: expectedPanel as 1 | 2 | 3 | 4,
            description,
            dialogues,
        };
    });

    if (panels.length < 4) {
        while (panels.length < 4) {
            const panelNum = panels.length + 1;
            panels.push({
                panel: panelNum as 1 | 2 | 3 | 4,
                description: '',
                dialogues: [],
            });
        }
    } else if (panels.length > 4) {
        panels.length = 4;
    }

    return panels;
}

function coerceStoryboardResponse(parsed: unknown): GenerateStoryboardResponse | null {
    if (Array.isArray(parsed)) {
        const storyboard = coerceStoryboardPanels(parsed);
        if (!storyboard) return null;
        return { characters: [], storyboard };
    }

    if (!isRecord(parsed)) return null;

    const characters = coerceCharacters(parsed.characters ?? parsed['登場人物']);

    const storyboardRaw =
        parsed.storyboard ??
        parsed['絵コンテ'] ??
        parsed.panels ??
        parsed.frames;

    const storyboardArray = coerceStoryboardValueToArray(storyboardRaw) ||
        (Array.isArray(storyboardRaw) ? storyboardRaw : null);

    if (!storyboardArray) return null;

    const storyboard = coerceStoryboardPanels(storyboardArray);
    if (!storyboard) return null;

    return { characters, storyboard };
}

function parseStoryboardJson(text: string): GenerateStoryboardResponse {
    const cleanText = normalizeJsonText(stripMarkdownCodeFences(text));

    const candidates: string[] = [cleanText];

    const balancedObject = extractFirstBalancedJson(cleanText, '{');
    if (balancedObject) candidates.push(balancedObject);

    const balancedArray = extractFirstBalancedJson(cleanText, '[');
    if (balancedArray) candidates.push(balancedArray);

    const objectMatch = cleanText.match(/\{[\s\S]*\}/);
    if (objectMatch) candidates.push(objectMatch[0]);

    const arrayMatches = cleanText.match(/\[[\s\S]*?\]/g);
    if (arrayMatches) candidates.push(...arrayMatches);

    for (const candidate of candidates) {
        const direct = tryJsonParse(candidate) ?? tryJsonParse(normalizeJsonText(candidate));
        if (direct) {
            const coerced = coerceStoryboardResponse(direct);
            if (coerced) return coerced;
            continue;
        }

        const repaired = tryJsonParse(repairJsonLike(candidate));
        if (repaired) {
            const coerced = coerceStoryboardResponse(repaired);
            if (coerced) return coerced;
        }
    }

    throw new GeminiError('絵コンテのJSONを取得できませんでした。再試行してください。');
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
        const body = validateRequest(rawBody);

        const isDemo = body.mode === 'demo';
        const isLite = body.mode === 'lite';
        const isPro = body.mode === 'pro';
        const isSubscription = isLite || isPro;

        let apiKey: string;

        if (isDemo) {
            if (!env.DEMO_GEMINI_API_KEY) {
                return errorResponse('DEMO_UNAVAILABLE', '現在デモを一時停止しています。BYOKで利用できます。', 503, origin);
            }

            const clientIP = request.headers.get('CF-Connecting-IP') ||
                request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                'unknown';
            const today = new Date().toISOString().split('T')[0];
            const key = `custom-demo:${clientIP}:${today}`;

            const usedCountStr = await env.DEMO_LIMITS?.get(key);
            const usedCount = usedCountStr ? parseInt(usedCountStr, 10) : 0;
            const maxCount = parseInt(env.CUSTOM_DEMO_DAILY_LIMIT || '3', 10);

            if (usedCount >= maxCount) {
                return errorResponse('DEMO_LIMIT_EXCEEDED', '本日の自作4コマデモ回数に達しました。', 429, origin);
            }

            apiKey = env.DEMO_GEMINI_API_KEY;

            await env.DEMO_LIMITS?.put(key, String(usedCount + 1), {
                expirationTtl: 86400,
            });
        } else if (isSubscription) {
            if (!env.DEMO_GEMINI_API_KEY) {
                return errorResponse('DEMO_UNAVAILABLE', 'サーバーAPIキーが設定されていません。', 503, origin);
            }

            const subscriptionUser = getUserFromJwt(request);
            if (!subscriptionUser) {
                return errorResponse('AUTH_REQUIRED', 'ログインが必要です。', 401, origin);
            }

            if (!env.DB) {
                return errorResponse('INTERNAL_ERROR', 'データベースが設定されていません。', 500, origin);
            }

            const usage = await getUserUsage(env.DB, subscriptionUser.id);
            const requiredPlan = isLite ? 'lite' : 'pro';

            const planOrder = { free: 0, lite: 1, pro: 2 };
            if (planOrder[usage.plan as keyof typeof planOrder] < planOrder[requiredPlan]) {
                return errorResponse('AUTH_REQUIRED', `${requiredPlan.toUpperCase()}プランへのアップグレードが必要です。`, 403, origin);
            }

            if (!usage.allowed) {
                return errorResponse('USAGE_LIMIT_EXCEEDED', `今月の利用回数（${usage.limit}回）に達しました。`, 429, origin);
            }

            apiKey = env.DEMO_GEMINI_API_KEY;
        } else {
            if (!body.geminiApiKey) {
                return errorResponse('VALIDATION_ERROR', 'geminiApiKey is required for BYOK mode', 400, origin);
            }
            apiKey = body.geminiApiKey;
        }

        const result = await generateStoryboard(
            apiKey,
            body.inputText,
            body.userPrompt || '',
            body.modelSettings?.storyboardModel || DEFAULT_STORYBOARD_MODEL,
            body.language || 'ja'
        );

        return jsonResponse(result, origin);
    } catch (error) {
        if (error instanceof ValidationError) {
            return errorResponse('VALIDATION_ERROR', error.message, 400, origin);
        }
        if (error instanceof GeminiError) {
            return errorResponse('GEMINI_ERROR', error.message, 500, origin);
        }

        console.error('Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
        return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500, origin);
    }
};
