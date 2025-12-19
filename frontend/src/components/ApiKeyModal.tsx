import { useState, FormEvent } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (apiKey: string) => void;
}

export function ApiKeyModal({ isOpen, onClose, onSubmit }: ApiKeyModalProps) {
    const { language } = useLanguage();
    const [apiKey, setApiKey] = useState('');

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (apiKey.trim()) {
            onSubmit(apiKey.trim());
            setApiKey('');
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal-content api-key-modal">
                <button
                    type="button"
                    className="modal-close"
                    onClick={onClose}
                    aria-label={t(language, 'apiKey.close')}
                >
                    ×
                </button>

                <h3 className="modal-title">{t(language, 'apiKey.title')}</h3>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <input
                            type="password"
                            className="form-input"
                            placeholder="AIzaSy..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            autoFocus
                            autoComplete="off"
                        />
                    </div>

                    <p className="api-key-notice">{t(language, 'apiKey.notice')}</p>

                    <button
                        type="submit"
                        className="submit-btn active"
                        disabled={!apiKey.trim()}
                    >
                        {t(language, 'apiKey.start')}
                    </button>
                </form>

                <div className="api-key-help">
                    <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t(language, 'apiKey.howto')}
                    </a>
                </div>
            </div>
        </div>
    );
}
