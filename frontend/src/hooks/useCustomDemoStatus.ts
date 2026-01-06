import { useState, useEffect, useCallback } from 'react';
import type { DemoStatus } from '../types';

export function useCustomDemoStatus() {
    const [status, setStatus] = useState<DemoStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/custom-demo-status');
            if (!response.ok) {
                throw new Error('Failed to fetch custom demo status');
            }
            const data = await response.json() as DemoStatus;
            setStatus(data);
        } catch (err) {
            console.error('Failed to fetch custom demo status:', err);
            setStatus({
                remainingCount: 0,
                maxCount: 3,
                isAvailable: false,
                message: 'ステータスの取得に失敗しました',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    return { status, loading, refresh: fetchStatus };
}
