import { Link } from 'react-router-dom';
import { NavBar } from '../components/NavBar';
import { useLanguage } from '../hooks/useLanguage';
import { useRuntimeConfig } from '../hooks/useRuntimeConfig';
import { t } from '../i18n';
import './IntroductionPage.css';

export function IntroductionPage() {
    const { language } = useLanguage();
    const { config } = useRuntimeConfig();

    return (
        <div className="app">
            <header className="header">
                <NavBar active="/introduction" />
                <div className="hero-content">
                    <h1 className="header-title">{t(language, 'intro.hero.title')}</h1>
                    <p className="header-subtitle">{t(language, 'intro.hero.subtitle')}</p>
                    <p className="header-note">{t(language, 'intro.hero.note')}</p>
                </div>
            </header>

            <main className="container">
                <div className="intro-page">
                    <section className="notice intro-notice">
                        <h2 className="notice-title">{t(language, 'intro.notice.title')}</h2>
                        <ul className="notice-list">
                            <li>{t(language, 'intro.notice.item1')}</li>
                            <li>{t(language, 'intro.notice.item2')}</li>
                            <li>{t(language, 'intro.notice.item3')}</li>
                        </ul>
                    </section>

                    <section className="intro-section">
                        <h2 className="intro-section-title">{t(language, 'intro.section.features.title')}</h2>
                        <div className="intro-cards">
                            <div className="card intro-card">
                                <h3 className="intro-card-title">{t(language, 'intro.features.blog.title')}</h3>
                                <p className="intro-card-desc">{t(language, 'intro.features.blog.desc')}</p>
                                <Link to="/" className="btn btn-secondary intro-card-cta">{t(language, 'howto.cta.blog')}</Link>
                            </div>

                            <div className="card intro-card">
                                <h3 className="intro-card-title">{t(language, 'intro.features.movie.title')}</h3>
                                <p className="intro-card-desc">{t(language, 'intro.features.movie.desc')}</p>
                                <Link to="/movie" className="btn btn-secondary intro-card-cta">{t(language, 'howto.cta.movie')}</Link>
                            </div>

                            <div className="card intro-card">
                                <h3 className="intro-card-title">{t(language, 'intro.features.howto.title')}</h3>
                                <p className="intro-card-desc">{t(language, 'intro.features.howto.desc')}</p>
                                <Link to="/howto" className="btn btn-secondary intro-card-cta">{t(language, 'nav.howto')}</Link>
                            </div>
                        </div>
                    </section>

                    <section className="intro-section">
                        <h2 className="intro-section-title">{t(language, 'intro.section.sample.title')}</h2>
                        <div className="intro-sample">
                            <div className="intro-sample-image-wrap">
                                <img
                                    className="intro-sample-image"
                                    src="/intro/4koma_sample.png"
                                    alt={t(language, 'intro.sample.alt')}
                                    loading="lazy"
                                />
                            </div>
                            <div className="intro-sample-copy">
                                <p className="intro-sample-caption">{t(language, 'intro.sample.caption')}</p>
                                <ul className="notice-list">
                                    <li>{t(language, 'intro.sample.point1')}</li>
                                    <li>{t(language, 'intro.sample.point2')}</li>
                                    <li>{t(language, 'demo.watermarkNotice')}</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className="intro-section">
                        <h2 className="intro-section-title">{t(language, 'intro.section.steps.title')}</h2>
                        <div className="intro-cards intro-steps">
                            <div className="card intro-card">
                                <div className="intro-step-badge">STEP 1</div>
                                <h3 className="intro-card-title">{t(language, 'intro.steps.step1.title')}</h3>
                                <p className="intro-card-desc">{t(language, 'intro.steps.step1.desc')}</p>
                                <ul className="notice-list">
                                    <li>{t(language, 'blog.hero.note')}</li>
                                    <li>{t(language, 'movie.hero.note')}</li>
                                </ul>
                            </div>

                            <div className="card intro-card">
                                <div className="intro-step-badge">STEP 2</div>
                                <h3 className="intro-card-title">{t(language, 'intro.steps.step2.title')}</h3>
                                <p className="intro-card-desc">{t(language, 'intro.steps.step2.desc')}</p>
                            </div>

                            <div className="card intro-card">
                                <div className="intro-step-badge">STEP 3</div>
                                <h3 className="intro-card-title">{t(language, 'intro.steps.step3.title')}</h3>
                                <p className="intro-card-desc">{t(language, 'intro.steps.step3.desc')}</p>
                                <ul className="notice-list">
                                    <li>{t(language, 'result.alt')}</li>
                                    <li>{t(language, 'result.showStoryboard')}</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className="intro-section">
                        <h2 className="intro-section-title">{t(language, 'intro.section.modes.title')}</h2>
                        <div className="intro-cards">
                            <div className="card intro-card">
                                <h3 className="intro-card-title">{t(language, 'intro.modes.demo.title')}</h3>
                                <p className="intro-card-desc">{t(language, 'mode.demo.description')}</p>
                            </div>
                            <div className="card intro-card">
                                <h3 className="intro-card-title">{t(language, 'intro.modes.byok.title')}</h3>
                                <p className="intro-card-desc">{t(language, 'mode.byok.description')}</p>
                                <p className="intro-card-note">{t(language, 'apiKey.notice')}</p>
                            </div>
                        </div>
                    </section>

                    <section className="intro-cta">
                        <h2 className="intro-section-title">{t(language, 'intro.section.next.title')}</h2>
                        <div className="intro-cta-buttons">
                            <Link to="/" className="btn btn-primary">{t(language, 'intro.cta.blog')}</Link>
                            <Link to="/movie" className="btn btn-secondary">{t(language, 'intro.cta.movie')}</Link>
                            {config.billingEnabled && (
                                <Link to="/pricing" className="btn btn-secondary">{t(language, 'intro.cta.pricing')}</Link>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
