// ===== API Request/Response Types =====

export interface Generate4KomaRequest {
  articleUrl: string;
  userPrompt?: string;
  geminiApiKey: string;
}

export interface StoryboardPanel {
  panel: 1 | 2 | 3 | 4;
  description: string;
  dialogue: string;
}

export interface ImagePanel {
  panel: 1 | 2 | 3 | 4;
  imageBase64: string;
}

export interface Generate4KomaResponse {
  storyboard: StoryboardPanel[];
  imageBase64: string; // Single 4-panel comic image
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_DOMAIN'
  | 'FETCH_ERROR'
  | 'GEMINI_ERROR'
  | 'RATE_LIMIT'
  | 'INTERNAL_ERROR';

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
  };
}

// ===== Constants =====

export const ALLOWED_DOMAINS = [
  'note.com',
  'qiita.com',
  'zenn.dev'
] as const;

export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number];

// ===== Gemini API Types =====

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

export interface GeminiResponse {
  candidates: {
    content: {
      parts: GeminiPart[];
      role: string;
    };
    finishReason: string;
  }[];
}
