import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRuntimeConfig } from '../hooks/useRuntimeConfig';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';

type NavPath = '/' | '/movie' | '/pricing' | '/howto';

interface NavBarProps {
    active?: NavPath;
}

export function NavBar({ active }: NavBarProps) {
    const { isAuthenticated, user, login, logout, openPortal } = useAuth();
    const { config } = useRuntimeConfig();
    const { language, setLanguage } = useLanguage();

    return (
        <nav className="nav-links">
            <Link to="/" className={`nav-link ${active === '/' ? 'active' : ''}`}>{t(language, 'nav.blog')}</Link>
            <Link to="/movie" className={`nav-link ${active === '/movie' ? 'active' : ''}`}>{t(language, 'nav.movie')}</Link>
            {config.billingEnabled && (
                <Link to="/pricing" className={`nav-link ${active === '/pricing' ? 'active' : ''}`}>{t(language, 'nav.pricing')}</Link>
            )}
            <Link to="/howto" className={`nav-link ${active === '/howto' ? 'active' : ''}`}>{t(language, 'nav.howto')}</Link>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                    className="auth-button primary language-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'ja')}
                    aria-label={t(language, 'nav.language')}
                >
                    <option value="ja">{t(language, 'nav.language.ja')}</option>
                    <option value="en">{t(language, 'nav.language.en')}</option>
                </select>

                <div className="nav-auth">
                    {isAuthenticated && user ? (
                        <div className="user-menu">
                            <button className="user-menu-trigger">
                                <span className="user-plan">{user.plan.toUpperCase()}</span>
                                <span>▼</span>
                            </button>
                            <div className="user-menu-dropdown">
                                <div
                                    className="user-menu-item"
                                    style={{ cursor: 'default', fontSize: '0.75rem', color: 'var(--text-muted)' }}
                                >
                                    {user.email}
                                </div>
                                <div className="user-menu-divider" />
                                {config.billingEnabled && user.hasStripeCustomer && (
                                    <button onClick={openPortal} className="user-menu-item primary">
                                        {t(language, 'auth.managePlan')}
                                    </button>
                                )}
                                {config.billingEnabled && (
                                    <Link to="/pricing" className="user-menu-item">
                                        {t(language, 'nav.pricing')}
                                    </Link>
                                )}
                                <div className="user-menu-divider" />
                                <button onClick={logout} className="user-menu-item danger">
                                    {t(language, 'auth.logout')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={login} className="auth-button primary">{t(language, 'auth.login')}</button>
                    )}
                </div>
            </div>
        </nav>
    );
}
