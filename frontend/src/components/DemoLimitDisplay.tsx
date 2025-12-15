import type { DemoStatus } from '../types';

interface DemoLimitDisplayProps {
    status: DemoStatus | null;
    onSwitchToByok: () => void;
}

export function DemoLimitDisplay({ status, onSwitchToByok }: DemoLimitDisplayProps) {
    if (!status) {
        return null;
    }

    if (!status.isAvailable) {
        return (
            <div className="demo-limit-warning">
                <span className="demo-limit-icon">⚠️</span>
                <span className="demo-limit-text">
                    {status.message || '本日のデモ回数に達しました。'}
                </span>
                <button
                    type="button"
                    className="demo-limit-link"
                    onClick={onSwitchToByok}
                >
                    BYOKで続ける →
                </button>
            </div>
        );
    }

    return (
        <div className="demo-limit-info">
            <span className="demo-limit-text">
                本日のデモ残り：<strong>{status.remainingCount}回</strong>
            </span>
        </div>
    );
}
