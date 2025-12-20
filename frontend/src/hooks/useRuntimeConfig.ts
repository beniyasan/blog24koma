import { useContext } from 'react';
import { RuntimeConfigContext, type RuntimeConfigContextValue } from '../contexts/RuntimeConfigContext';

export function useRuntimeConfig(): RuntimeConfigContextValue {
    const value = useContext(RuntimeConfigContext);
    if (!value) {
        throw new Error('useRuntimeConfig must be used within RuntimeConfigProvider');
    }
    return value;
}
