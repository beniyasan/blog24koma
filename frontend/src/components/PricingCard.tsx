import React from 'react';
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
    return (
        <div className={`pricing-card ${isPopular ? 'popular' : ''} ${isCurrentPlan ? 'current' : ''}`}>
            {isPopular && <div className="popular-badge">おすすめ</div>}
            {isCurrentPlan && <div className="current-badge">現在のプラン</div>}

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
                {isCurrentPlan ? '現在のプラン' : '選択する'}
            </button>
        </div>
    );
};
