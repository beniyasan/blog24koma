import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PricingCard } from '../components/PricingCard';
import { NavBar } from '../components/NavBar';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useRuntimeConfig } from '../hooks/useRuntimeConfig';
import { t, type Language } from '../i18n';
import './PricingPage.css';

function getPlans(language: Language) {
    return [
        {
            id: 'free',
            name: 'Free',
            price: 0,
            period: t(language, 'pricing.period.free'),
            features: [
                t(language, 'pricing.plan.free.feature.blog'),
                t(language, 'pricing.plan.free.feature.movie'),
                t(language, 'pricing.plan.free.feature.watermark'),
            ],
        },
        {
            id: 'lite',
            name: 'Lite',
            price: 480,
            period: t(language, 'pricing.period.month'),
            features: [
                t(language, 'pricing.plan.lite.feature.limit'),
                t(language, 'pricing.plan.lite.feature.common'),
                t(language, 'pricing.plan.lite.feature.nowatermark'),
                t(language, 'pricing.plan.lite.feature.support'),
            ],
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 980,
            period: t(language, 'pricing.period.month'),
            features: [
                t(language, 'pricing.plan.pro.feature.limit'),
                t(language, 'pricing.plan.pro.feature.common'),
                t(language, 'pricing.plan.pro.feature.nowatermark'),
                t(language, 'pricing.plan.pro.feature.priority'),
                t(language, 'pricing.plan.pro.feature.early'),
            ],
            isPopular: true,
        },
    ];
}

export const PricingPage: React.FC = () => {
    const { config, isLoading: isConfigLoading } = useRuntimeConfig();
    const { isLoading: isAuthLoading, isAuthenticated, user, login } = useAuth();
    const { language } = useLanguage();
    const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasAgreedToSubscriptionTerms, setHasAgreedToSubscriptionTerms] = useState(false);

    const CONSENT_VERSION = '2025-12-18';

    const currentPlan = user?.plan || 'free';
    const plans = getPlans(language);

    if (!isConfigLoading && !config.billingEnabled) {
        return <Navigate to="/" replace />;
    }

    const handleSelectPlan = async (planId: string) => {
        if (planId === 'free' || planId === currentPlan) return;

        // If not logged in, redirect to login
        if (!isAuthenticated || !user) {
            login();
            return;
        }

        if (!hasAgreedToSubscriptionTerms) {
            setError(t(language, 'pricing.error.consentRequired'));
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
                throw new Error(data.error || t(language, 'pricing.error.checkoutFailed'));
            }

            // Redirect to Stripe Checkout
            window.location.href = data.url;
        } catch (err) {
            setError(err instanceof Error ? err.message : t(language, 'pricing.error.generic'));
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
                    <p className="header-subtitle">{t(language, 'pricing.subtitle')}</p>
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

                    {isAuthLoading || isConfigLoading ? (
                        <div className="pricing-loading">{t(language, 'pricing.loading')}</div>
                    ) : (
                        <>
                            <div className="pricing-precheckout">
                                <h2>{t(language, 'pricing.precheckout.title')}</h2>
                                <p className="pricing-precheckout-note">{t(language, 'pricing.precheckout.note')}</p>
                                <label className="pricing-precheckout-consent">
                                    <input
                                        type="checkbox"
                                        checked={hasAgreedToSubscriptionTerms}
                                        onChange={(e) => setHasAgreedToSubscriptionTerms(e.target.checked)}
                                    />
                                    <span>
                                        {t(language, 'pricing.precheckout.consent').replace('{version}', CONSENT_VERSION)}
                                    </span>
                                </label>
                            </div>

                            <div className="pricing-cards">
                                {plans.map((plan) => (
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
                        <h2>{t(language, 'pricing.faq.title')}</h2>
                        <div className="faq-item">
                            <h3>{t(language, 'pricing.faq.q1')}</h3>
                            <p>{t(language, 'pricing.faq.a1')}</p>
                        </div>
                        <div className="faq-item">
                            <h3>{t(language, 'pricing.faq.q2')}</h3>
                            <p>{t(language, 'pricing.faq.a2')}</p>
                        </div>
                        <div className="faq-item">
                            <h3>{t(language, 'pricing.faq.q3')}</h3>
                            <p>{t(language, 'pricing.faq.a3')}</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
