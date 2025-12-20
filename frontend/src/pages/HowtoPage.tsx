import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRuntimeConfig } from '../hooks/useRuntimeConfig';
import { NavBar } from '../components/NavBar';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import './HowtoPage.css';

type HowtoStepProps = {
    title: string;
    description: string;
    imageSrc: string;
    imageAlt: string;
};

const HowtoStep: React.FC<HowtoStepProps> = ({ title, description, imageSrc, imageAlt }) => {
    return (
        <div className="howto-step">
            <div className="howto-step-header">
                <h3 className="howto-step-title">{title}</h3>
                <p className="howto-step-desc">{description}</p>
            </div>
            <div className="howto-step-image-wrap">
                <img className="howto-step-image" src={imageSrc} alt={imageAlt} loading="lazy" />
            </div>
        </div>
    );
};

export const HowtoPage: React.FC = () => {
    const { isLoading: isAuthLoading, isAuthenticated, user } = useAuth();
    const { config } = useRuntimeConfig();
    const { language } = useLanguage();

    return (
        <div className="app">
            <header className="header">
                <NavBar active="/howto" />
                <div className="hero-content">
                    <h1 className="header-title">{t(language, 'nav.howto')}</h1>
                    <p className="header-subtitle">{t(language, 'howto.hero.subtitle')}</p>
                    {!isAuthLoading && isAuthenticated && user && (
                        <p className="header-note">
                            ログイン中: {user.email} ({user.plan.toUpperCase()})
                        </p>
                    )}
                </div>
            </header>

            <main className="container">
                <div className="howto-page">
                    <section className="howto-section">
                        <h2 className="howto-section-title">{t(language, 'howto.section.menu.title')}</h2>
                        <HowtoStep
                            title={t(language, 'howto.section.menu.step.title')}
                            description={t(language, 'howto.section.menu.step.desc')}
                            imageSrc="/howto/common_top.png"
                            imageAlt={t(language, 'howto.section.menu.step.alt')}
                        />
                    </section>

                    <section className="howto-section">
                        <h2 className="howto-section-title">{t(language, 'howto.section.login.title')}</h2>
                        <HowtoStep
                            title={t(language, 'howto.section.login.step.title')}
                            description={t(language, 'howto.section.login.step.desc')}
                            imageSrc="/howto/common_login.png"
                            imageAlt={t(language, 'howto.section.login.step.alt')}
                        />
                    </section>

                    <section className="howto-section">
                        <h2 className="howto-section-title">{t(language, 'howto.section.blog.title')}</h2>
                        <div className="howto-steps">
                            <HowtoStep
                                title={t(language, 'howto.section.blog.step1.title')}
                                description={t(language, 'howto.section.blog.step1.desc')}
                                imageSrc="/howto/blog_inp_url.png"
                                imageAlt={t(language, 'howto.section.blog.step1.alt')}
                            />
                            <HowtoStep
                                title={t(language, 'howto.section.blog.step2.title')}
                                description={t(language, 'howto.section.blog.step2.desc')}
                                imageSrc="/howto/blog_making.png"
                                imageAlt={t(language, 'howto.section.blog.step2.alt')}
                            />
                            <HowtoStep
                                title={t(language, 'howto.section.blog.step3.title')}
                                description={t(language, 'howto.section.blog.step3.desc')}
                                imageSrc="/howto/blog_result.png"
                                imageAlt={t(language, 'howto.section.blog.step3.alt')}
                            />
                        </div>
                    </section>

                    <section className="howto-section">
                        <h2 className="howto-section-title">{t(language, 'howto.section.movie.title')}</h2>
                        <div className="howto-steps">
                            <HowtoStep
                                title={t(language, 'howto.section.movie.step1.title')}
                                description={t(language, 'howto.section.movie.step1.desc')}
                                imageSrc="/howto/movie_inp_url.png"
                                imageAlt={t(language, 'howto.section.movie.step1.alt')}
                            />
                            <HowtoStep
                                title={t(language, 'howto.section.movie.step2.title')}
                                description={t(language, 'howto.section.movie.step2.desc')}
                                imageSrc="/howto/movie_making.png"
                                imageAlt={t(language, 'howto.section.movie.step2.alt')}
                            />
                            <HowtoStep
                                title={t(language, 'howto.section.movie.step3.title')}
                                description={t(language, 'howto.section.movie.step3.desc')}
                                imageSrc="/howto/movie_result.png"
                                imageAlt={t(language, 'howto.section.movie.step3.alt')}
                            />
                        </div>
                    </section>

                    {config.billingEnabled && (
                        <section className="howto-section">
                            <h2 className="howto-section-title">{t(language, 'howto.section.pricing.title')}</h2>
                            <HowtoStep
                                title={t(language, 'howto.section.pricing.step.title')}
                                description={t(language, 'howto.section.pricing.step.desc')}
                                imageSrc="/howto/pricing.png"
                                imageAlt={t(language, 'howto.section.pricing.step.alt')}
                            />
                        </section>
                    )}

                    <section className="howto-cta">
                        <Link to="/" className="howto-cta-button primary">{t(language, 'howto.cta.blog')}</Link>
                        <Link to="/movie" className="howto-cta-button secondary">{t(language, 'howto.cta.movie')}</Link>
                        {config.billingEnabled && (
                            <Link to="/pricing" className="howto-cta-button secondary">{t(language, 'howto.cta.pricing')}</Link>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
};
