import { useState, useCallback } from 'react';
import type {
    Generate4KomaRequest,
    Generate4KomaResponse,
    ApiError,
    ErrorCode,
} from '../types';

interface UseGenerate4KomaReturn {
    result: Generate4KomaResponse | null;
    loading: boolean;
    error: string | null;
    generate: (data: Generate4KomaRequest) => Promise<void>;
    reset: () => void;
}

// Error code to user-friendly message mapping
const ERROR_MESSAGES: Record<ErrorCode, string> = {
    VALIDATION_ERROR: '入力内容に問題があります。URLとAPIキーを確認してください。',
    INVALID_DOMAIN: '対応していないドメインです。note.com、qiita.com、zenn.devのみ対応しています。',
    FETCH_ERROR: '記事の取得に失敗しました。URLが正しいか確認してください。',
    GEMINI_ERROR: 'AIの処理中にエラーが発生しました。APIキーを確認するか、しばらくしてから再試行してください。',
    RATE_LIMIT: 'リクエストが多すぎます。しばらくしてから再試行してください。',
    DEMO_LIMIT_EXCEEDED: '本日のデモ回数に達しました。BYOKモードでAPIキーを入力してお試しください。',
    DEMO_UNAVAILABLE: '現在デモを一時停止しています。BYOKモードでAPIキーを入力してお試しください。',
    INTERNAL_ERROR: '予期しないエラーが発生しました。しばらくしてから再試行してください。',
};

export function useGenerate4Koma(): UseGenerate4KomaReturn {
    const [result, setResult] = useState<Generate4KomaResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(async (data: Generate4KomaRequest) => {
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await fetch('/api/generate-4koma', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const json = await response.json();

            if (!response.ok) {
                // Handle API error response
                const apiError = json as ApiError;
                const errorCode = apiError.error?.code as ErrorCode;
                const message = ERROR_MESSAGES[errorCode] || apiError.error?.message || '不明なエラーが発生しました。';
                setError(message);
                return;
            }

            setResult(json as Generate4KomaResponse);
        } catch (err) {
            // Network error or other exceptions
            if (err instanceof TypeError && err.message.includes('fetch')) {
                setError('ネットワークエラーが発生しました。インターネット接続を確認してください。');
            } else {
                setError('予期しないエラーが発生しました。しばらくしてから再試行してください。');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
        setLoading(false);
    }, []);

    return { result, loading, error, generate, reset };
}
