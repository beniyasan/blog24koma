import type { DemoStatus } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';

interface DemoLimitDisplayProps {
    status: DemoStatus | null;
    onSwitchToByok: () => void;
}

export function DemoLimitDisplay({ status, onSwitchToByok }: DemoLimitDisplayProps) {
    const { language } = useLanguage();

    if (!status) {
        return null;
    }

    if (!status.isAvailable) {
        return (
            <div className="demo-limit-warning">
                <span className="demo-limit-icon">⚠️</span>
                <span className="demo-limit-text">
                    {status.message || t(language, 'demo.exceeded.default')}
                </span>
                <button
                    type="button"
                    className="demo-limit-link"
                    onClick={onSwitchToByok}
                >
                    {t(language, 'demo.switchToByok')}
                </button>
            </div>
        );
    }

    return (
        <div className="demo-limit-info">
            <span className="demo-limit-text">
                {t(language, 'demo.remaining')}<strong>{status.remainingCount}{t(language, 'demo.remaining.suffix')}</strong>
            </span>
        </div>
    );
}
