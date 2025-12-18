import React from 'react';
import './UsageDisplay.css';

interface UsageDisplayProps {
    plan: 'free' | 'lite' | 'pro';
    usage: number;
    limit: number;
    onUpgrade?: () => void;
}

export const UsageDisplay: React.FC<UsageDisplayProps> = ({
    plan,
    usage,
    limit,
    onUpgrade,
}) => {
    const remaining = Math.max(0, limit - usage);
    const percentage = limit > 0 ? Math.min(100, (usage / limit) * 100) : 0;
    const isLow = percentage >= 80;
    const isExhausted = remaining === 0;

    if (plan === 'free') {
        return (
            <div className="usage-display free">
                <span className="usage-label">Free プラン</span>
                {onUpgrade && (
                    <button className="upgrade-button" onClick={onUpgrade}>
                        アップグレード
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`usage-display ${isLow ? 'low' : ''} ${isExhausted ? 'exhausted' : ''}`}>
            <div className="usage-info">
                <span className="usage-label">{plan.toUpperCase()}</span>
                <span className="usage-count">
                    残り <strong>{remaining}</strong> / {limit} 回
                </span>
            </div>

            <div className="usage-bar">
                <div
                    className="usage-bar-fill"
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {isExhausted && onUpgrade && (
                <button className="upgrade-button" onClick={onUpgrade}>
                    アップグレード
                </button>
            )}
        </div>
    );
};
