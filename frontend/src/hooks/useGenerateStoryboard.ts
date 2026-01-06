import { useState, useCallback } from 'react';
import type { GenerationMode, ModelSettings, Language, ApiError, CustomStoryboardPanel, CustomCharacter } from '../types';

interface GenerateStoryboardParams {
    inputText: string;
    userPrompt?: string;
    geminiApiKey?: string;
    modelSettings?: Pick<ModelSettings, 'storyboardModel'>;
    language?: Language;
    mode: GenerationMode;
}

interface DialogueLine {
    speaker: string;
    text: string;
}

interface ApiStoryboardPanel {
    panel: 1 | 2 | 3 | 4;
    description: string;
    dialogues: DialogueLine[];
}

interface ApiCharacter {
    name: string;
    description: string;
}

interface GenerateStoryboardResponse {
    characters: ApiCharacter[];
    storyboard: ApiStoryboardPanel[];
}

interface GenerateStoryboardResult {
    characters: CustomCharacter[];
    storyboard: CustomStoryboardPanel[];
}

function makeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function convertResponse(data: GenerateStoryboardResponse): GenerateStoryboardResult {
    const characters: CustomCharacter[] = (data.characters || []).map((c) => ({
        id: makeId(),
        name: c.name || '',
        description: c.description || '',
    }));

    const storyboard: CustomStoryboardPanel[] = (data.storyboard || []).map((panel) => ({
        panel: panel.panel,
        description: panel.description || '',
        dialogues: (panel.dialogues || []).map((d) => ({
            id: makeId(),
            speaker: d.speaker || '',
            text: d.text || '',
        })),
    }));

    // Ensure each panel has at least one dialogue entry
    for (const panel of storyboard) {
        if (panel.dialogues.length === 0) {
            panel.dialogues.push({ id: makeId(), speaker: '', text: '' });
        }
    }

    return { characters, storyboard };
}

interface UseGenerateStoryboardReturn {
    isLoading: boolean;
    error: string | null;
    generate: (params: GenerateStoryboardParams) => Promise<GenerateStoryboardResult | null>;
    reset: () => void;
}

export function useGenerateStoryboard(): UseGenerateStoryboardReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(async (params: GenerateStoryboardParams): Promise<GenerateStoryboardResult | null> => {
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

            const result = convertResponse(data as GenerateStoryboardResponse);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An unexpected error occurred';
            setError(message);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setError(null);
    }, []);

    return {
        isLoading,
        error,
        generate,
        reset,
    };
}
