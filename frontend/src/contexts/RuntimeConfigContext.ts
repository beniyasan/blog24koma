import { createContext } from 'react';

export type RuntimeConfig = {
    billingEnabled: boolean;
};

export type RuntimeConfigContextValue = {
    config: RuntimeConfig;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
};

export const RuntimeConfigContext = createContext<RuntimeConfigContextValue | null>(null);
