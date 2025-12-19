import { useState } from 'react';
import { InputForm } from '../components/InputForm';
import { ResultDisplay } from '../components/ResultDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { NavBar } from '../components/NavBar';
import { useGenerate4Koma } from '../hooks/useGenerate4Koma';
import { useModelSettings } from '../hooks/useModelSettings';
import { useDemoStatus } from '../hooks/useDemoStatus';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import type { Generate4KomaRequest, GenerationMode } from '../types';

export function BlogPage() {
    const [mode, setMode] = useState<GenerationMode>('demo');
    const { result, loading, error, generate, reset } = useGenerate4Koma();
    const { settings: modelSettings, ...modelSettingsActions } = useModelSettings();
    const { status: demoStatus, refresh: refreshDemoStatus } = useDemoStatus();
    const { isAuthenticated, user } = useAuth();
    const { language } = useLanguage();

    const handleGenerate = (data: Generate4KomaRequest) => {
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
            <header className="header">
                <NavBar active="/" />
                <div className="hero-content">
                    <h1 className="header-title">{t(language, 'blog.hero.title')}</h1>
                    <p className="header-subtitle">{t(language, 'blog.hero.subtitle')}</p>
                    <p className="header-note">{t(language, 'blog.hero.note')}</p>
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
                        mode={mode}
                        onModeChange={setMode}
                        demoStatus={demoStatus}
                        userPlan={user?.plan as 'free' | 'lite' | 'pro' | undefined}
                        isAuthenticated={isAuthenticated}
                    />
                )}

                {loading && <LoadingSpinner message={t(language, 'blog.loading')} />}

                {error && !loading && (
                    <ErrorDisplay message={error} onRetry={handleReset} />
                )}

                {result && !loading && (
                    <ResultDisplay result={result} onReset={handleReset} isDemo={mode === 'demo'} />
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
