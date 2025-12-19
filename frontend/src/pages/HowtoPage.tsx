import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
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
    const { language } = useLanguage();

    return (
        <div className="app">
            <header className="header">
                <NavBar active="/howto" />
                <div className="hero-content">
                    <h1 className="header-title">{t(language, 'nav.howto')}</h1>
                    <p className="header-subtitle">
                        URLを貼るだけで、ブログ記事や動画を4コマ漫画に変換できます
                    </p>
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
                        <h2 className="howto-section-title">まずはメニューを確認</h2>
                        <HowtoStep
                            title="メニューから機能を選ぶ"
                            description="上部メニューから「ブログ4コマ」「動画4コマ」「料金プラン」「使い方」へ移動できます。"
                            imageSrc="/howto/common_top.png"
                            imageAlt="上部メニューが表示されたトップ画面"
                        />
                    </section>

                    <section className="howto-section">
                        <h2 className="howto-section-title">ログイン（必要な場合）</h2>
                        <HowtoStep
                            title="ログイン状態を確認"
                            description="右上のログインボタン、またはプラン表示からログイン状態を確認できます。"
                            imageSrc="/howto/common_login.png"
                            imageAlt="ログイン状態が表示された画面"
                        />
                    </section>

                    <section className="howto-section">
                        <h2 className="howto-section-title">ブログ4コマの作り方</h2>
                        <div className="howto-steps">
                            <HowtoStep
                                title="1. 記事URLを入力"
                                description="対象の記事URLを貼り付けて、生成を開始します。"
                                imageSrc="/howto/blog_inp_url.png"
                                imageAlt="ブログ4コマのURL入力フォーム"
                            />
                            <HowtoStep
                                title="2. 生成中はしばらく待つ"
                                description="記事内容を解析して、4コマ漫画を生成します。"
                                imageSrc="/howto/blog_making.png"
                                imageAlt="ブログ4コマの生成中画面"
                            />
                            <HowtoStep
                                title="3. 結果を確認・保存"
                                description="生成された4コマを確認し、必要に応じて保存します。"
                                imageSrc="/howto/blog_result.png"
                                imageAlt="ブログ4コマの生成結果画面"
                            />
                        </div>
                    </section>

                    <section className="howto-section">
                        <h2 className="howto-section-title">動画4コマの作り方</h2>
                        <div className="howto-steps">
                            <HowtoStep
                                title="1. YouTube動画URLを入力"
                                description="YouTubeのURLを貼り付けて、生成を開始します。"
                                imageSrc="/howto/movie_inp_url.png"
                                imageAlt="動画4コマのURL入力フォーム"
                            />
                            <HowtoStep
                                title="2. 生成中はしばらく待つ"
                                description="動画内容を解析して、4コマ漫画を生成します。"
                                imageSrc="/howto/movie_making.png"
                                imageAlt="動画4コマの生成中画面"
                            />
                            <HowtoStep
                                title="3. 結果を確認"
                                description="生成された4コマを確認し、必要に応じて保存します。"
                                imageSrc="/howto/movie_result.png"
                                imageAlt="動画4コマの生成結果画面"
                            />
                        </div>
                    </section>

                    <section className="howto-section">
                        <h2 className="howto-section-title">料金プラン</h2>
                        <HowtoStep
                            title="プランを選択してアップグレード"
                            description="Lite/Pro を選ぶとチェックアウトに進みます。必要に応じてプラン管理（Stripeポータル）から変更・解約できます。"
                            imageSrc="/howto/pricing.png"
                            imageAlt="料金プラン画面"
                        />
                    </section>

                    <section className="howto-cta">
                        <Link to="/" className="howto-cta-button primary">ブログ4コマを試す</Link>
                        <Link to="/movie" className="howto-cta-button secondary">動画4コマを試す</Link>
                        <Link to="/pricing" className="howto-cta-button secondary">料金プランを見る</Link>
                    </section>
                </div>
            </main>
        </div>
    );
};
