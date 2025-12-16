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
        // Redirect to Cloudflare Access login
        // Access will automatically redirect back after authentication
        window.location.href = '/api/auth/me';
    }, []);

    const logout = useCallback(() => {
        // Cloudflare Access logout
        window.location.href = '/cdn-cgi/access/logout';
    }, []);

    return {
        ...state,
        login,
        logout,
        refetch: fetchAuth,
    };
}
