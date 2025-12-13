import type { GenerateMovie4KomaResponse } from '../../types';

interface MovieResultDisplayProps {
    result: GenerateMovie4KomaResponse;
    onReset: () => void;
}

export function MovieResultDisplay({ result, onReset }: MovieResultDisplayProps) {
    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>生成結果</h2>
                <button className="btn btn-secondary" onClick={onReset}>
                    もう一度生成する
                </button>
            </div>

            {/* Movie summary section */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: 'var(--spacing-sm)', color: 'var(--primary-light)' }}>
                    {result.movieSummary.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {result.movieSummary.summary}
                </p>
            </div>

            {/* Single 4-panel comic image */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <img
                    src={result.imageBase64}
                    alt="4コマ漫画"
                    style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                    }}
                />
            </div>

            {/* Optional: Show storyboard text below for reference */}
            <details style={{ marginTop: 'var(--spacing-lg)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    絵コンテ情報を表示
                </summary>
                <div style={{ marginTop: 'var(--spacing-md)' }}>
                    {result.storyboard.map((panel) => (
                        <div key={panel.panel} style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-sm)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontWeight: '600', color: 'var(--primary-light)' }}>コマ {panel.panel}</span>
                            <p style={{ margin: 'var(--spacing-xs) 0', color: 'var(--text-primary)' }}>「{panel.dialogue}」</p>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{panel.description}</p>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}
