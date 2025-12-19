import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';

interface ErrorDisplayProps {
    message: string;
    onRetry: () => void;
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
    const { language } = useLanguage();
    return (
        <div className="error-box fade-in">
            <div className="error-title">{t(language, 'error.title')}</div>
            <p style={{ marginBottom: 'var(--spacing-md)' }}>{message}</p>
            <button className="btn btn-secondary" onClick={onRetry}>
                {t(language, 'error.retry')}
            </button>
        </div>
    );
}
