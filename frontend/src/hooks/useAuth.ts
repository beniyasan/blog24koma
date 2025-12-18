import { useState, useEffect, useCallback } from 'react';

interface User {
    id: string;
    email: string;
    plan: 'free' | 'lite' | 'pro';
    hasStripeCustomer: boolean;
}

interface AuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: User | null;
    error: string | null;
}

interface UseAuthResult extends AuthState {
    login: () => void;
    logout: () => void;
    openPortal: () => Promise<void>;
    refetch: () => void;
}

export function useAuth(): UseAuthResult {
    const [state, setState] = useState<AuthState>({
        isLoading: true,
        isAuthenticated: false,
        user: null,
        error: null,
    });

    const fetchAuth = useCallback(async () => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();

            setState({
                isLoading: false,
                isAuthenticated: data.authenticated,
                user: data.user,
                error: data.error || null,
            });
        } catch (err) {
            setState({
                isLoading: false,
                isAuthenticated: false,
                user: null,
                error: err instanceof Error ? err.message : 'Failed to check auth',
            });
        }
    }, []);

    useEffect(() => {
        fetchAuth();
    }, [fetchAuth]);

    const login = useCallback(() => {
        // Navigate to a protected endpoint to trigger Cloudflare Access login, then return.
        const returnPath = window.location.pathname + window.location.search;
        window.location.href = `/api/auth/login?return=${encodeURIComponent(returnPath)}`;
    }, []);

    const logout = useCallback(() => {
        // Cloudflare Access logout
        window.location.href = '/cdn-cgi/access/logout';
    }, []);

    const openPortal = useCallback(async () => {
        try {
            const response = await fetch('/api/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ returnUrl: window.location.href }),
            });
            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else if (data.error) {
                console.error('Portal error:', data.error);
                alert('プラン管理ページを開けませんでした。');
            }
        } catch (err) {
            console.error('Portal error:', err);
            alert('プラン管理ページを開けませんでした。');
        }
    }, []);

    return {
        ...state,
        login,
        logout,
        openPortal,
        refetch: fetchAuth,
    };
}
