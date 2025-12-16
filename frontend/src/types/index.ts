// ===== API Request/Response Types =====

export type GenerationMode = 'demo' | 'lite' | 'pro' | 'byok';

export interface DemoStatus {
  remainingCount: number;
  maxCount: number;
  isAvailable: boolean;
  message?: string;
}

export interface Generate4KomaRequest {
  articleUrl: string;
  userPrompt?: string;
  geminiApiKey?: string;  // Optional for Demo mode
  modelSettings?: ModelSettings;
  mode: GenerationMode;   // Required
}

export interface GenerateMovie4KomaRequest {
  youtubeUrl: string;
  userPrompt?: string;
  geminiApiKey?: string;  // Optional for Demo mode
  modelSettings?: ModelSettings;
  mode: GenerationMode;   // Required
}

export interface MovieSummary {
  title: string;
  summary: string;
}

export interface GenerateMovie4KomaResponse {
  movieSummary: MovieSummary;
  storyboard: StoryboardPanel[];
  imageBase64: string;
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

// ===== Model Selection Types =====

export interface ModelSettings {
  storyboardModel: StoryboardModel;
  imageModel: ImageModel;
}

export type StoryboardModel = 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-3-pro-preview';

export type ImageModel = 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image';

export const STORYBOARD_MODELS: Record<StoryboardModel, { name: string; description: string }> = {
  'gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    description: '最も高速・低コスト。シンプルな構成に最適です。'
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    description: 'バランス型。速度と品質の両立を目指します。'
  },
  'gemini-3-pro-preview': {
    name: 'Gemini 3 Pro Preview',
    description: '最も高性能。複雑な記事・創造的な表現に適しています。'
  }
};

export const IMAGE_MODELS: Record<ImageModel, { name: string; description: string }> = {
  'gemini-3-pro-image-preview': {
    name: 'Gemini 3 Pro Image Preview',
    description: '最高品質の画像生成。詳細な表現に優れています。'
  },
  'gemini-2.5-flash-image': {
    name: 'Gemini 2.5 Flash Image',
    description: '高速な画像生成。シンプルなコマに適しています。'
  }
};

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_DOMAIN'
  | 'FETCH_ERROR'
  | 'GEMINI_ERROR'
  | 'RATE_LIMIT'
  | 'DEMO_LIMIT_EXCEEDED'
  | 'DEMO_UNAVAILABLE'
  | 'USAGE_LIMIT_EXCEEDED'
  | 'AUTH_REQUIRED'
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
