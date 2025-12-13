import { Link } from 'react-router-dom';
import { InputForm } from '../components/InputForm';
import { ResultDisplay } from '../components/ResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { useGenerate4Koma } from '../hooks/useGenerate4Koma';
import { useModelSettings } from '../hooks/useModelSettings';
import type { Generate4KomaRequest } from '../types';

export function BlogPage() {
    const { result, loading, error, generate, reset } = useGenerate4Koma();
    const { settings: modelSettings, ...modelSettingsActions } = useModelSettings();

    const handleGenerate = (data: Generate4KomaRequest) => {
        generate(data);
    };

    return (
        <div className="app">
            <header className="header">
                <nav className="nav-links">
                    <Link to="/" className="nav-link active">ブログ4コマ</Link>
                    <Link to="/movie" className="nav-link">動画4コマ</Link>
                </nav>
                <div className="hero-content">
                    <h1 className="header-title">ブログ4コマメーカー</h1>
                    <p className="header-subtitle">
                        記事URLを貼るだけで、ブログ記事を4コマ漫画に自動変換
                    </p>
                    <p className="header-note">
                        ※現在はNote,Qiita,Zennに対応しております
                    </p>
                </div>
            </header>

            <main className="container">
                {!result && !loading && (
                    <InputForm
                        onSubmit={handleGenerate}
                        loading={loading}
                        modelSettings={modelSettings}
                        onModelSettingsChange={(fullSettings) => {
                            const { storyboardModel, imageModel } = fullSettings;
                            if (modelSettings.storyboardModel !== storyboardModel) {
                                modelSettingsActions.updateStoryboardModel(storyboardModel);
                            }
                            if (modelSettings.imageModel !== imageModel) {
                                modelSettingsActions.updateImageModel(imageModel);
                            }
                        }}
                    />
                )}

                {loading && <LoadingSpinner message="4コマ漫画を生成中..." />}

                {error && !loading && (
                    <ErrorDisplay message={error} onRetry={reset} />
                )}

                {result && !loading && (
                    <ResultDisplay result={result} onReset={reset} />
                )}
            </main>

            <footer className="footer">
                <p>
                    Powered by Gemini API |
                    <a
                        href="https://ai.google.dev/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary)', marginLeft: '4px', fontWeight: 700 }}
                    >
                        Google AI for Developers
                    </a>
                </p>
            </footer>
        </div>
    );
}
