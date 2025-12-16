import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PricingCard } from '../components/PricingCard';
import { useAuth } from '../hooks/useAuth';
import './PricingPage.css';

const PLANS = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        period: '無料',
        features: [
            'ブログ4コマ: 5回/日',
            '動画4コマ: 3回/日',
            'デモ透かし付き',
        ],
    },
    {
        id: 'lite',
        name: 'Lite',
        price: 480,
        period: '月',
        features: [
            '月30回まで生成',
            'ブログ・動画共通',
            '透かしなし',
            'メールサポート',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 980,
        period: '月',
        features: [
            '月100回まで生成',
            'ブログ・動画共通',
            '透かしなし',
            '優先サポート',
            '新機能早期アクセス',
        ],
        isPopular: true,
    },
];

export const PricingPage: React.FC = () => {
    const { isLoading: isAuthLoading, isAuthenticated, user, login, logout, openPortal } = useAuth();
    const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const currentPlan = user?.plan || 'free';

    const handleSelectPlan = async (planId: string) => {
        if (planId === 'free' || planId === currentPlan) return;

        // If not logged in, redirect to login
        if (!isAuthenticated || !user) {
            login();
            return;
        }

        setIsCheckoutLoading(planId);
        setError(null);

        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: planId,
                    userId: user.id,
                    userEmail: user.email,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'チェックアウトに失敗しました');
            }

            // Redirect to Stripe Checkout
            window.location.href = data.url;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
        } finally {
            setIsCheckoutLoading(null);
        }
    };

    return (
        <div className="app">
            <header className="header">
                <nav className="nav-links">
                    <Link to="/" className="nav-link">ブログ4コマ</Link>
                    <Link to="/movie" className="nav-link">動画4コマ</Link>
                    <Link to="/pricing" className="nav-link active">料金プラン</Link>
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
                    <h1 className="header-title">料金プラン</h1>
                    <p className="header-subtitle">
                        あなたのニーズに合ったプランを選んでください
                    </p>
                    {isAuthenticated && user && (
                        <p className="header-note">
                            ログイン中: {user.email} ({user.plan.toUpperCase()})
                        </p>
                    )}
                </div>
            </header>

            <main className="container">
                <div className="pricing-page">

                    {error && (
                        <div className="pricing-error">
                            {error}
                        </div>
                    )}

                    {isAuthLoading ? (
                        <div className="pricing-loading">読み込み中...</div>
                    ) : (
                        <div className="pricing-cards">
                            {PLANS.map((plan) => (
                                <PricingCard
                                    key={plan.id}
                                    name={plan.name}
                                    price={plan.price}
                                    period={plan.period}
                                    features={plan.features}
                                    isPopular={plan.isPopular}
                                    isCurrentPlan={plan.id === currentPlan}
                                    onSelect={() => handleSelectPlan(plan.id)}
                                    disabled={isCheckoutLoading !== null || plan.id === 'free'}
                                />
                            ))}
                        </div>
                    )}

                    <div className="pricing-faq">
                        <h2>よくある質問</h2>
                        <div className="faq-item">
                            <h3>いつでも解約できますか？</h3>
                            <p>はい、いつでもキャンセル可能です。次の請求日まで利用できます。</p>
                        </div>
                        <div className="faq-item">
                            <h3>プランの変更はできますか？</h3>
                            <p>はい、いつでもアップグレード・ダウングレードが可能です。</p>
                        </div>
                        <div className="faq-item">
                            <h3>回数はどのようにカウントされますか？</h3>
                            <p>ブログ4コマと動画4コマの合計で月間回数がカウントされます。</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
