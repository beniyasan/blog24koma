import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MovieInputForm } from '../components/movie/MovieInputForm';
import { MovieResultDisplay } from '../components/movie/MovieResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { useGenerateMovie4Koma } from '../hooks/useGenerateMovie4Koma';
import { useModelSettings } from '../hooks/useModelSettings';
import { useMovieDemoStatus } from '../hooks/useMovieDemoStatus';
import type { GenerateMovie4KomaRequest, GenerationMode } from '../types';

export function MoviePage() {
    const [mode, setMode] = useState<GenerationMode>('demo');
    const { result, loading, error, generate, reset } = useGenerateMovie4Koma();
    const { settings: modelSettings, ...modelSettingsActions } = useModelSettings();
    const { status: demoStatus, refresh: refreshDemoStatus } = useMovieDemoStatus();

    const handleGenerate = (data: GenerateMovie4KomaRequest) => {
        generate(data);
    };

    const handleReset = () => {
        reset();
        if (mode === 'demo') {
            refreshDemoStatus();
        }
    };

    return (
        <div className="app">
            <header className="header movie-header">
                <nav className="nav-links">
                    <Link to="/" className="nav-link">ブログ4コマ</Link>
                    <Link to="/movie" className="nav-link active">動画4コマ</Link>
                    <Link to="/pricing" className="nav-link nav-pricing">料金プラン</Link>
                </nav>
                <div className="hero-content">
                    <h1 className="header-title">動画4コマメーカー</h1>
                    <p className="header-subtitle">
                        YouTube動画URLを貼るだけで、動画内容を4コマ漫画に自動変換
                    </p>
                    <p className="header-note">
                        ※YouTubeの動画に対応しております
                    </p>
                </div>
            </header>

            <main className="container">
                {!result && !loading && (
                    <MovieInputForm
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
                        mode={mode}
                        onModeChange={setMode}
                        demoStatus={demoStatus}
                    />
                )}

                {loading && <LoadingSpinner message="動画を解析して4コマ漫画を生成中..." />}

                {error && !loading && (
                    <ErrorDisplay message={error} onRetry={handleReset} />
                )}

                {result && !loading && (
                    <MovieResultDisplay result={result} onReset={handleReset} isDemo={mode === 'demo'} />
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
