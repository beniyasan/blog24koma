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

    const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
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

function parseStoryboardJson(text: string): GenerateStoryboardResponse {
    // Clean up the text - remove markdown code blocks if present
    let cleanText = text.trim();
    
    // Remove markdown code block markers more aggressively
    // Handle various formats: ```json, ``` json, ```JSON, etc.
    cleanText = cleanText.replace(/^`{3,}\s*(?:json)?\s*/gi, '');
    cleanText = cleanText.replace(/\s*`{3,}\s*$/gi, '');
    cleanText = cleanText.trim();

    console.log('Cleaned text (first 300 chars):', cleanText.substring(0, 300));

    // Try to parse the whole thing first if it looks like valid JSON
    let parseError = '';
    try {
        const directParsed = JSON.parse(cleanText);
        if (directParsed.storyboard && Array.isArray(directParsed.storyboard)) {
            console.log('Direct parse succeeded');
            return parseEnhancedFormat(directParsed);
        }
        parseError = 'Parsed but no storyboard array found';
    } catch (e) {
        parseError = `Direct parse error: ${e instanceof Error ? e.message : String(e)}`;
        console.log(parseError);
    }

    // Try to parse as new format (object with characters and storyboard)
    const objectMatch = cleanText.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try {
            const parsed = JSON.parse(objectMatch[0]);
            // New enhanced format with characters and storyboard
            if (parsed.storyboard && Array.isArray(parsed.storyboard)) {
                console.log('Object match parse succeeded');
                return parseEnhancedFormat(parsed);
            }
            parseError += '; Object match: no storyboard array';
        } catch (e) {
            parseError += `; Object match error: ${e instanceof Error ? e.message : String(e)}`;
            console.error('Failed to parse object JSON:', e);
            // Fall through to legacy format
        }
    } else {
        parseError += '; No object match found';
    }

    // Legacy format: array of panels
    // Find array that looks like storyboard panels
    const arrayMatches = cleanText.match(/\[[\s\S]*?\]/g);
    let parsed: unknown[] | null = null;
    
    if (arrayMatches) {
        for (const match of arrayMatches) {
            try {
                const arr = JSON.parse(match);
                if (Array.isArray(arr) && arr.length === 4 && arr[0]?.panel !== undefined) {
                    parsed = arr;
                    break;
                }
            } catch {
                continue;
            }
        }
    }

    // If no array found, try parsing the whole cleaned text
    if (!parsed) {
        try {
            const fullParsed = JSON.parse(cleanText);
            if (Array.isArray(fullParsed) && fullParsed.length === 4) {
                parsed = fullParsed;
            } else if (fullParsed.storyboard && Array.isArray(fullParsed.storyboard)) {
                return parseEnhancedFormat(fullParsed);
            }
        } catch {
            // Continue to error
        }
    }

    if (!parsed || !Array.isArray(parsed) || parsed.length !== 4) {
        console.error('Failed to parse storyboard. Raw text:', text.substring(0, 1000));
        // Include parse error and snippet in error message
        const preview = cleanText.substring(0, 150).replace(/\n/g, ' ');
        throw new GeminiError(`絵コンテのJSONを取得できませんでした。(${parseError}) [${preview}...]`);
    }

    // Convert legacy format to new format
    const storyboard: EnhancedStoryboardPanel[] = parsed.map((panel, index) => {
        const expectedPanel = index + 1;
        if (panel.panel !== expectedPanel) {
            panel.panel = expectedPanel;
        }
        // Handle both old format (dialogue) and new format (dialogues)
        let dialogues: DialogueLine[] = [];
        if (Array.isArray(panel.dialogues)) {
            dialogues = panel.dialogues.map((d: unknown) => {
                const dl = d as Record<string, unknown>;
                return {
                    speaker: typeof dl.speaker === 'string' ? dl.speaker.trim() : '',
                    text: typeof dl.text === 'string' ? dl.text.trim() : '',
                };
            }).filter((d: DialogueLine) => d.text);
        } else if (typeof panel.dialogue === 'string' && panel.dialogue) {
            dialogues = [{ speaker: '', text: panel.dialogue }];
        }
        return {
            panel: expectedPanel as 1 | 2 | 3 | 4,
            description: typeof panel.description === 'string' ? panel.description : '',
            dialogues,
        };
    });

    // Try to extract characters from the original parsed object if present
    let characters: CharacterInfo[] = [];
    if (objectMatch) {
        try {
            const fullParsed = JSON.parse(objectMatch[0]);
            if (Array.isArray(fullParsed.characters)) {
                characters = fullParsed.characters.map((c: unknown) => {
                    const char = c as Record<string, unknown>;
                    return {
                        name: typeof char.name === 'string' ? char.name.trim() : '',
                        description: typeof char.description === 'string' ? char.description.trim() : '',
                    };
                }).filter((c: CharacterInfo) => c.name);
            }
        } catch {
            // Ignore character parsing errors
        }
    }

    return { characters, storyboard };
}

function parseEnhancedFormat(parsed: { characters?: unknown[]; storyboard?: unknown[] }): GenerateStoryboardResponse {
    const characters: CharacterInfo[] = (parsed.characters || []).map((c: unknown) => {
        const char = c as Record<string, unknown>;
        return {
            name: typeof char.name === 'string' ? char.name.trim() : '',
            description: typeof char.description === 'string' ? char.description.trim() : '',
        };
    }).filter(c => c.name);

    const storyboard: EnhancedStoryboardPanel[] = (parsed.storyboard || []).map((panel: unknown, index: number) => {
        const p = panel as Record<string, unknown>;
        const expectedPanel = index + 1;
        const dialoguesRaw = Array.isArray(p.dialogues) ? p.dialogues : [];
        const dialogues: DialogueLine[] = dialoguesRaw.map((d: unknown) => {
            const dl = d as Record<string, unknown>;
            return {
                speaker: typeof dl.speaker === 'string' ? dl.speaker.trim() : '',
                text: typeof dl.text === 'string' ? dl.text.trim() : '',
            };
        }).filter(d => d.text);

        return {
            panel: expectedPanel as 1 | 2 | 3 | 4,
            description: typeof p.description === 'string' ? p.description : '',
            dialogues,
        };
    });

    // Ensure we have exactly 4 panels
    if (storyboard.length < 4) {
        // Pad with empty panels if needed
        while (storyboard.length < 4) {
            const panelNum = storyboard.length + 1;
            storyboard.push({
                panel: panelNum as 1 | 2 | 3 | 4,
                description: '',
                dialogues: [],
            });
        }
    } else if (storyboard.length > 4) {
        // Truncate to 4 panels
        storyboard.length = 4;
    }

    return { characters, storyboard };
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
