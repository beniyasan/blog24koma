import React, { useEffect, useMemo, useState } from 'react';
import type { Language } from '../i18n';
import { LanguageContext } from '../contexts/LanguageContext';

const STORAGE_ITEM = 'blog4koma-language';
const DEFAULT_LANGUAGE: Language = 'ja';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_ITEM);
            if (stored === 'ja' || stored === 'en') {
                setLanguageState(stored);
            }
        } catch {
            // ignore
        }
    }, []);

    const setLanguage = (next: Language) => {
        setLanguageState(next);
        try {
            localStorage.setItem(STORAGE_ITEM, next);
        } catch {
            // ignore
        }
    };

    const value = useMemo(() => ({ language, setLanguage }), [language]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
