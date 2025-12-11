
interface ErrorDisplayProps {
    message: string;
    onRetry: () => void;
}

export function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
    return (
        <div className="error-box fade-in">
            <div className="error-title">エラーが発生しました</div>
            <p style={{ marginBottom: 'var(--spacing-md)' }}>{message}</p>
            <button className="btn btn-secondary" onClick={onRetry}>
                もう一度試す
            </button>
        </div>
    );
}
