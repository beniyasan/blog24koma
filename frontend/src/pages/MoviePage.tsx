import { useState } from 'react';
import { MovieInputForm } from '../components/movie/MovieInputForm';
import { MovieResultDisplay } from '../components/movie/MovieResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { NavBar } from '../components/NavBar';
import { useGenerateMovie4Koma } from '../hooks/useGenerateMovie4Koma';
import { useModelSettings } from '../hooks/useModelSettings';
import { useMovieDemoStatus } from '../hooks/useMovieDemoStatus';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import type { GenerateMovie4KomaRequest, GenerationMode } from '../types';

export function MoviePage() {
    const [mode, setMode] = useState<GenerationMode>('demo');
    const { result, loading, error, generate, reset } = useGenerateMovie4Koma();
    const { settings: modelSettings, ...modelSettingsActions } = useModelSettings();
    const { status: demoStatus, refresh: refreshDemoStatus } = useMovieDemoStatus();
    const { isAuthenticated, user } = useAuth();
    const { language } = useLanguage();

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
                <NavBar active="/movie" />
                <div className="hero-content">
                    <h1 className="header-title">{t(language, 'movie.hero.title')}</h1>
                    <p className="header-subtitle">{t(language, 'movie.hero.subtitle')}</p>
                    <p className="header-note">{t(language, 'movie.hero.note')}</p>
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

                {loading && <LoadingSpinner message={t(language, 'movie.loading')} />}

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
