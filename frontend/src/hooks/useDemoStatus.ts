import { useState, useEffect, useCallback } from 'react';
import type { DemoStatus } from '../types';

export function useDemoStatus() {
    const [status, setStatus] = useState<DemoStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch('/api/demo-status');

            if (!response.ok) {
                throw new Error('Failed to fetch demo status');
            }

            const data = await response.json() as DemoStatus;
            setStatus(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            // Default to unavailable on error
            setStatus({
                remainingCount: 0,
                maxCount: 3,
                isAvailable: false,
                message: 'デモ状態の取得に失敗しました',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    const refresh = useCallback(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    return { status, loading, error, refresh };
}
