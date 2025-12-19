import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';

function getTitleKey(pathname: string): string {
    if (pathname === '/' || pathname === '') return 'title.blog';
    if (pathname.startsWith('/movie')) return 'title.movie';
    if (pathname.startsWith('/pricing')) return 'title.pricing';
    if (pathname.startsWith('/howto')) return 'title.howto';
    if (pathname.startsWith('/subscription/success')) return 'title.subscriptionSuccess';
    return 'title.app';
}

export function TitleManager() {
    const { pathname } = useLocation();
    const { language } = useLanguage();

    useEffect(() => {
        const pageTitle = t(language, getTitleKey(pathname));
        const appTitle = t(language, 'title.app');
        document.title = pageTitle === appTitle ? appTitle : `${pageTitle} | ${appTitle}`;
    }, [language, pathname]);

    return null;
}
