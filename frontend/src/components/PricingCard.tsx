import React from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import './PricingCard.css';

interface PricingCardProps {
    name: string;
    price: number;
    period: string;
    features: string[];
    isPopular?: boolean;
    isCurrentPlan?: boolean;
    onSelect: () => void;
    disabled?: boolean;
}

export const PricingCard: React.FC<PricingCardProps> = ({
    name,
    price,
    period,
    features,
    isPopular = false,
    isCurrentPlan = false,
    onSelect,
    disabled = false,
}) => {
    const { language } = useLanguage();

    return (
        <div className={`pricing-card ${isPopular ? 'popular' : ''} ${isCurrentPlan ? 'current' : ''}`}>
            {isPopular && <div className="popular-badge">{t(language, 'pricing.card.popularBadge')}</div>}
            {isCurrentPlan && <div className="current-badge">{t(language, 'pricing.card.currentBadge')}</div>}

            <h3 className="pricing-name">{name}</h3>

            <div className="pricing-price">
                <span className="price-amount">¥{price.toLocaleString()}</span>
                <span className="price-period">/{period}</span>
            </div>

            <ul className="pricing-features">
                {features.map((feature, index) => (
                    <li key={index}>
                        <span className="feature-check">✓</span>
                        {feature}
                    </li>
                ))}
            </ul>

            <button
                className={`pricing-button ${isCurrentPlan ? 'current' : ''}`}
                onClick={onSelect}
                disabled={disabled || isCurrentPlan}
            >
                {isCurrentPlan ? t(language, 'pricing.card.button.current') : t(language, 'pricing.card.button.select')}
            </button>
        </div>
    );
};
