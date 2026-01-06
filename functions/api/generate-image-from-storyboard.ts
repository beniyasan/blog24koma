import type {
    StoryboardPanel,
    ApiError,
    ErrorCode,
    ModelSettings,
    GenerationMode,
    Language,
} from '../../frontend/src/types';
import { getCorsHeaders, corsPreflightResponse } from './_cors';
import { getUserUsage, recordUsage, getUserFromJwt } from './_usage';
import { normalizeLanguage, getImagePrompt } from './prompts';

// ===== Env Interface =====
interface Env {
    DEMO_LIMITS: KVNamespace;
    DB: D1Database;
    DEMO_GEMINI_API_KEY: string;
    CUSTOM_DEMO_DAILY_LIMIT: string;
}

// ===== Constants =====
const DEFAULT_IMAGE_MODEL = 'gemini-3-pro-image-preview';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ===== Request/Response Types =====
interface GenerateImageFromStoryboardRequest {
    storyboard: StoryboardPanel[];
    geminiApiKey?: string;
    modelSettings?: Pick<ModelSettings, 'imageModel'>;
    language?: Language;
    mode: GenerationMode;
}

interface GenerateImageFromStoryboardResponse {
    imageBase64: string;
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
function validateStoryboardPanel(panel: unknown, index: number): StoryboardPanel {
    if (!panel || typeof panel !== 'object') {
        throw new ValidationError(`Panel ${index + 1} must be an object`);
    }

    const p = panel as Record<string, unknown>;
    const expectedPanel = index + 1;

    if (typeof p.description !== 'string' || !p.description.trim()) {
        throw new ValidationError(`Panel ${expectedPanel}: description is required`);
    }

    if (p.description.length > 500) {
        throw new ValidationError(`Panel ${expectedPanel}: description must be at most 500 characters`);
    }

    if (typeof p.dialogue !== 'string') {
        throw new ValidationError(`Panel ${expectedPanel}: dialogue must be a string`);
    }

    if (p.dialogue.length > 200) {
        throw new ValidationError(`Panel ${expectedPanel}: dialogue must be at most 200 characters`);
    }

    return {
        panel: expectedPanel as 1 | 2 | 3 | 4,
        description: p.description.trim(),
        dialogue: p.dialogue.trim(),
    };
}

function validateRequest(body: unknown): GenerateImageFromStoryboardRequest {
    if (!body || typeof body !== 'object') {
        throw new ValidationError('Request body must be a JSON object');
    }

    const { storyboard, geminiApiKey, modelSettings, mode, language } = body as Record<string, unknown>;

    if (!Array.isArray(storyboard)) {
        throw new ValidationError('storyboard must be an array');
    }

    if (storyboard.length !== 4) {
        throw new ValidationError('storyboard must have exactly 4 panels');
    }

    const validatedStoryboard = storyboard.map((panel, index) => validateStoryboardPanel(panel, index));

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

    if (language !== undefined && typeof language !== 'string') {
        throw new ValidationError('language must be a string');
    }

    if (modelSettings !== undefined) {
        if (typeof modelSettings !== 'object' || modelSettings === null) {
            throw new ValidationError('modelSettings must be an object');
        }

        const { imageModel } = modelSettings as Record<string, unknown>;

        if (imageModel !== undefined) {
            const validModels = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
            if (!validModels.includes(imageModel as string)) {
                throw new ValidationError('Invalid imageModel');
            }
        }
    }

    return {
        storyboard: validatedStoryboard,
        geminiApiKey: (geminiApiKey as string)?.trim(),
        modelSettings: (modelSettings as GenerateImageFromStoryboardRequest['modelSettings']) || {
            imageModel: DEFAULT_IMAGE_MODEL,
        },
        language: normalizeLanguage(language),
        mode: requestMode as GenerationMode,
    };
}

// ===== Gemini API: Image Generation =====
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

// ===== Demo Watermark =====
function addDemoWatermark(imageBase64: string): string {
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
        const body = validateRequest(rawBody);

        const isDemo = body.mode === 'demo';
        const isLite = body.mode === 'lite';
        const isPro = body.mode === 'pro';
        const isSubscription = isLite || isPro;

        let apiKey: string;
        let subscriptionUser: { id: string; email: string } | null = null;

        if (isDemo) {
            if (!env.DEMO_GEMINI_API_KEY) {
                return errorResponse('DEMO_UNAVAILABLE', '現在デモを一時停止しています。BYOKで利用できます。', 503, origin);
            }

            const clientIP = request.headers.get('CF-Connecting-IP') ||
                request.headers.get('X-Forwarded-For')?.split(',')[0] ||
                'unknown';
            const today = new Date().toISOString().split('T')[0];
            const key = `custom-image-demo:${clientIP}:${today}`;

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

            subscriptionUser = getUserFromJwt(request);
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

        let imageBase64 = await generate4KomaImage(
            apiKey,
            body.storyboard,
            body.modelSettings?.imageModel || DEFAULT_IMAGE_MODEL,
            body.language || 'ja'
        );

        if (isDemo) {
            imageBase64 = addDemoWatermark(imageBase64);
        }

        // Record usage for subscription users
        if (isSubscription && subscriptionUser && env.DB) {
            await recordUsage(env.DB, subscriptionUser.id);
        }

        const response: GenerateImageFromStoryboardResponse = { imageBase64 };
        return jsonResponse(response, origin);
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
