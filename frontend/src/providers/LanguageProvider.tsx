import React, { useEffect, useMemo, useState } from 'react';
import type { Language } from '../i18n';
import { LanguageContext } from '../contexts/LanguageContext';

const STORAGE_ITEM = 'blog4koma-language';

function detectDefaultLanguage(): Language {
    try {
        const stored = localStorage.getItem(STORAGE_ITEM);
        if (stored === 'ja' || stored === 'en') return stored;
    } catch {
        // ignore
    }

    const candidates: string[] = [];
    if (typeof navigator !== 'undefined') {
        if (Array.isArray(navigator.languages)) {
            candidates.push(...navigator.languages);
        }
        if (typeof navigator.language === 'string') {
            candidates.push(navigator.language);
        }
    }

    const isJapanese = candidates.some((lang) => lang?.toLowerCase().startsWith('ja'));
    return isJapanese ? 'ja' : 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => detectDefaultLanguage());

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

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
