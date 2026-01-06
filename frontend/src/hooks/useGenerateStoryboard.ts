import { useState, useCallback } from 'react';
import type { StoryboardPanel, GenerationMode, ModelSettings, Language, ApiError } from '../types';

interface GenerateStoryboardParams {
    inputText: string;
    userPrompt?: string;
    geminiApiKey?: string;
    modelSettings?: Pick<ModelSettings, 'storyboardModel'>;
    language?: Language;
    mode: GenerationMode;
}

interface GenerateStoryboardResponse {
    storyboard: StoryboardPanel[];
}

interface UseGenerateStoryboardReturn {
    storyboard: StoryboardPanel[] | null;
    isLoading: boolean;
    error: string | null;
    generate: (params: GenerateStoryboardParams) => Promise<StoryboardPanel[] | null>;
    reset: () => void;
}

export function useGenerateStoryboard(): UseGenerateStoryboardReturn {
    const [storyboard, setStoryboard] = useState<StoryboardPanel[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(async (params: GenerateStoryboardParams): Promise<StoryboardPanel[] | null> => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/generate-storyboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            });

            const data = await response.json();

            if (!response.ok) {
                const apiError = data as ApiError;
                throw new Error(apiError.error?.message || 'Failed to generate storyboard');
            }

            const result = data as GenerateStoryboardResponse;
            setStoryboard(result.storyboard);
            return result.storyboard;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setStoryboard(null);
        setError(null);
    }, []);

    return {
        storyboard,
        isLoading,
        error,
        generate,
        reset,
    };
}
