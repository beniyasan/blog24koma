import React, { useState } from 'react';
import { PricingCard } from '../components/PricingCard';
import './PricingPage.css';

interface PricingPageProps {
    userId?: string;
    userEmail?: string;
    currentPlan?: 'free' | 'lite' | 'pro';
}

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

export const PricingPage: React.FC<PricingPageProps> = ({
    userId,
    userEmail,
    currentPlan = 'free',
}) => {
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSelectPlan = async (planId: string) => {
        if (planId === 'free' || planId === currentPlan) return;

        if (!userId || !userEmail) {
            setError('ログインが必要です');
            return;
        }

        setIsLoading(planId);
        setError(null);

        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: planId,
                    userId,
                    userEmail,
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
            setIsLoading(null);
        }
    };

    return (
        <div className="pricing-page">
            <div className="pricing-header">
                <h1>料金プラン</h1>
                <p>あなたに合ったプランを選んでください</p>
            </div>

            {error && (
                <div className="pricing-error">
                    {error}
                </div>
            )}

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
                        disabled={isLoading !== null || plan.id === 'free'}
                    />
                ))}
            </div>

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
    );
};
