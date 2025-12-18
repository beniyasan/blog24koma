import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MovieInputForm } from '../components/movie/MovieInputForm';
import { MovieResultDisplay } from '../components/movie/MovieResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { useGenerateMovie4Koma } from '../hooks/useGenerateMovie4Koma';
import { useModelSettings } from '../hooks/useModelSettings';
import { useMovieDemoStatus } from '../hooks/useMovieDemoStatus';
import { useAuth } from '../hooks/useAuth';
import type { GenerateMovie4KomaRequest, GenerationMode } from '../types';

export function MoviePage() {
    const [mode, setMode] = useState<GenerationMode>('demo');
    const { result, loading, error, generate, reset } = useGenerateMovie4Koma();
    const { settings: modelSettings, ...modelSettingsActions } = useModelSettings();
    const { status: demoStatus, refresh: refreshDemoStatus } = useMovieDemoStatus();
    const { isAuthenticated, user, login, logout, openPortal } = useAuth();

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
                    <Link to="/pricing" className="nav-link">料金プラン</Link>
                    <Link to="/howto" className="nav-link">使い方</Link>
                    <div className="nav-auth">
                        {isAuthenticated && user ? (
                            <div className="user-menu">
                                <button className="user-menu-trigger">
                                    <span className="user-plan">{user.plan.toUpperCase()}</span>
                                    <span>▼</span>
                                </button>
                                <div className="user-menu-dropdown">
                                    <div className="user-menu-item" style={{ cursor: 'default', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {user.email}
                                    </div>
                                    <div className="user-menu-divider" />
                                    {user.hasStripeCustomer && (
                                        <button onClick={openPortal} className="user-menu-item primary">
                                            プラン管理
                                        </button>
                                    )}
                                    <Link to="/pricing" className="user-menu-item">
                                        料金プラン
                                    </Link>
                                    <div className="user-menu-divider" />
                                    <button onClick={logout} className="user-menu-item danger">
                                        ログアウト
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={login} className="auth-button primary">ログイン</button>
                        )}
                    </div>
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
                        userPlan={user?.plan as 'free' | 'lite' | 'pro' | undefined}
                        isAuthenticated={isAuthenticated}
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
