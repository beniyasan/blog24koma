import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './SubscriptionSuccessPage.css';

export function SubscriptionSuccessPage() {
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        // Auto redirect to home after countdown
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    window.location.href = '/';
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="app">
            <header className="header">
                <nav className="nav-links">
                    <Link to="/" className="nav-link">ブログ4コマ</Link>
                    <Link to="/movie" className="nav-link">動画4コマ</Link>
                    <Link to="/pricing" className="nav-link">料金プラン</Link>
                    <Link to="/howto" className="nav-link">使い方</Link>
                </nav>
                <div className="hero-content">
                    <h1 className="header-title">サブスクリプション完了！</h1>
                    <p className="header-subtitle">
                        ご登録ありがとうございます
                    </p>
                </div>
            </header>

            <main className="container">
                <div className="success-page">
                    <div className="success-card">
                        <div className="success-icon">✓</div>
                        <h2>お支払いが完了しました</h2>
                        <p>プランが有効化されました。4コマ生成をお楽しみください！</p>

                        <div className="success-actions">
                            <Link to="/" className="success-button primary">
                                4コマを生成する
                            </Link>
                            <Link to="/pricing" className="success-button secondary">
                                プランを確認する
                            </Link>
                        </div>

                        <p className="redirect-notice">
                            {countdown}秒後にトップページへ移動します...
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
