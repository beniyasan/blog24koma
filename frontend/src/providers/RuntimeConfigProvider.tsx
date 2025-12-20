import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { RuntimeConfigContext, type RuntimeConfig } from '../contexts/RuntimeConfigContext';

const DEFAULT_CONFIG: RuntimeConfig = {
    billingEnabled: false,
};

export function RuntimeConfigProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<RuntimeConfig>(DEFAULT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/config', { cache: 'no-store' });
            if (!response.ok) {
                throw new Error('Failed to load config');
            }
            const data = await response.json();
            setConfig({
                billingEnabled: Boolean(data?.billingEnabled),
            });
        } catch (e) {
            setConfig(DEFAULT_CONFIG);
            setError(e instanceof Error ? e.message : 'Failed to load config');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const value = useMemo(
        () => ({ config, isLoading, error, refetch: fetchConfig }),
        [config, isLoading, error, fetchConfig]
    );

    return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}
