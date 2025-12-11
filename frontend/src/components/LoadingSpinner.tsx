
interface LoadingSpinnerProps {
    message?: string;
}

export function LoadingSpinner({ message = '生成中...' }: LoadingSpinnerProps) {
    return (
        <div className="loading-container card">
            <div className="spinner" />
            <p className="loading-text">{message}</p>
            <p className="loading-text" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                4コマの生成には1〜2分かかる場合があります
            </p>
        </div>
    );
}
