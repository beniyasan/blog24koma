import { useState, useEffect, useCallback } from 'react';

interface SubscriptionData {
    plan: 'free' | 'lite' | 'pro';
    limits: {
        monthly: number;
    };
    usage: {
        blog: number;
        movie: number;
        total: number;
    };
    remaining: {
        total: number;
    };
    user: {
        email: string;
        hasStripeCustomer: boolean;
    } | null;
}

interface UseSubscriptionResult {
    subscription: SubscriptionData | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

export function useSubscription(userId?: string): UseSubscriptionResult {
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSubscription = useCallback(async () => {
        if (!userId) {
            setSubscription(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/subscription?userId=${encodeURIComponent(userId)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'サブスクリプション情報の取得に失敗しました');
            }

            setSubscription(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchSubscription();
    }, [fetchSubscription]);

    return {
        subscription,
        isLoading,
        error,
        refetch: fetchSubscription,
    };
}
