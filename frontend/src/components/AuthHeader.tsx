import React from 'react';
import { useAuth } from '../hooks/useAuth';
import './AuthHeader.css';

interface AuthHeaderProps {
    onPricingClick?: () => void;
}

export const AuthHeader: React.FC<AuthHeaderProps> = ({ onPricingClick }) => {
    const { isLoading, isAuthenticated, user, login, logout } = useAuth();

    if (isLoading) {
        return (
            <div className="auth-header">
                <div className="auth-loading">...</div>
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        return (
            <div className="auth-header">
                <button className="auth-login-btn" onClick={login}>
                    ログイン
                </button>
            </div>
        );
    }

    return (
        <div className="auth-header">
            <div className="auth-user-info">
                <span className="auth-plan-badge">{user.plan.toUpperCase()}</span>
                <span className="auth-email">{user.email}</span>
            </div>
            <div className="auth-actions">
                {onPricingClick && (
                    <button className="auth-pricing-btn" onClick={onPricingClick}>
                        プラン
                    </button>
                )}
                <button className="auth-logout-btn" onClick={logout}>
                    ログアウト
                </button>
            </div>
        </div>
    );
};
