import React, { useState } from 'react';
import { PricingCard } from '../components/PricingCard';
import { NavBar } from '../components/NavBar';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
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
    const { isLoading: isAuthLoading, isAuthenticated, user, login } = useAuth();
    const { language } = useLanguage();
    const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasAgreedToSubscriptionTerms, setHasAgreedToSubscriptionTerms] = useState(false);

    const CONSENT_VERSION = '2025-12-18';

    const currentPlan = user?.plan || 'free';

    const handleSelectPlan = async (planId: string) => {
        if (planId === 'free' || planId === currentPlan) return;

        // If not logged in, redirect to login
        if (!isAuthenticated || !user) {
            login();
            return;
        }

        if (!hasAgreedToSubscriptionTerms) {
            setError('購入前に「自動更新・解約方法・返金ポリシー」の確認に同意してください。');
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
                    consent: {
                        accepted: true,
                        version: CONSENT_VERSION,
                    },
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
                <NavBar active="/pricing" />
                <div className="hero-content">
                    <h1 className="header-title">{t(language, 'nav.pricing')}</h1>
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
                        <>
                            <div className="pricing-precheckout">
                                <h2>購入前の確認</h2>
                                <p className="pricing-precheckout-note">
                                    Lite/Pro はサブスクリプション（月額・自動更新）です。解約やプラン変更は Stripe のポータルから行えます。
                                    返金は原則として受け付けていません（不正利用や重複課金などは個別に確認します）。
                                </p>
                                <label className="pricing-precheckout-consent">
                                    <input
                                        type="checkbox"
                                        checked={hasAgreedToSubscriptionTerms}
                                        onChange={(e) => setHasAgreedToSubscriptionTerms(e.target.checked)}
                                    />
                                    <span>
                                        上記（自動更新・解約方法・返金ポリシー）を確認し、購入手続きを進めます（同意記録: v{CONSENT_VERSION}）。
                                    </span>
                                </label>
                            </div>

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
                                        disabled={
                                            isCheckoutLoading !== null
                                            || plan.id === 'free'
                                            || (
                                                isAuthenticated
                                                && plan.id !== 'free'
                                                && plan.id !== currentPlan
                                                && !hasAgreedToSubscriptionTerms
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    <div className="pricing-faq">
                        <h2>よくある質問</h2>
                        <div className="faq-item">
                            <h3>いつでも解約できますか？</h3>
                            <p>はい。Stripe のプラン管理ページ（ポータル）からいつでも解約できます。解約の反映タイミングはポータルに表示される内容（次回更新で停止/即時停止など）に従います。</p>
                        </div>
                        <div className="faq-item">
                            <h3>プランの変更はできますか？</h3>
                            <p>はい。Stripe のポータルから変更できます。反映タイミング（即時/次回更新）や日割りの有無は Stripe 側の表示に従います。</p>
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
