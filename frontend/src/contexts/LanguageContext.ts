import { createContext } from 'react';
import type { Language } from '../i18n';

export type LanguageContextValue = {
    language: Language;
    setLanguage: (language: Language) => void;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);
