import { InputForm } from './components/InputForm';
import { ResultDisplay } from './components/ResultDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorDisplay } from './components/ErrorDisplay';
import { useGenerate4Koma } from './hooks/useGenerate4Koma';
import './App.css';

function App() {
    const { result, loading, error, generate, reset } = useGenerate4Koma();

    return (
        <div className="app">
            <header className="header">
                <div className="hero-content">
                    <h1 className="header-title">4コマ生成</h1>
                    <p className="header-subtitle">
                        ブログ記事から4コマ漫画を自動生成
                    </p>
                </div>
            </header>

            <main className="container">
                {!result && !loading && (
                    <InputForm onSubmit={generate} loading={loading} />
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

export default App;
