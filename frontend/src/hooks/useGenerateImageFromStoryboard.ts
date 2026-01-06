import { useState, useCallback } from 'react';
import type { StoryboardPanel, GenerationMode, ModelSettings, Language, ApiError } from '../types';

interface CharacterInfo {
    name: string;
    description: string;
}

interface GenerateImageParams {
    storyboard: StoryboardPanel[];
    characters?: CharacterInfo[];
    geminiApiKey?: string;
    modelSettings?: Pick<ModelSettings, 'imageModel'>;
    language?: Language;
    mode: GenerationMode;
}

interface GenerateImageResponse {
    imageBase64: string;
}

interface UseGenerateImageFromStoryboardReturn {
    imageBase64: string | null;
    isLoading: boolean;
    error: string | null;
    generate: (params: GenerateImageParams) => Promise<string | null>;
    reset: () => void;
}

export function useGenerateImageFromStoryboard(): UseGenerateImageFromStoryboardReturn {
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(async (params: GenerateImageParams): Promise<string | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/generate-image-from-storyboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            });

            const data = await response.json();

            if (!response.ok) {
                const apiError = data as ApiError;
                throw new Error(apiError.error?.message || 'Failed to generate image');
            }

            const result = data as GenerateImageResponse;
            setImageBase64(result.imageBase64);
            return result.imageBase64;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setImageBase64(null);
        setError(null);
    }, []);

    return {
        imageBase64,
        isLoading,
        error,
        generate,
        reset,
    };
}
