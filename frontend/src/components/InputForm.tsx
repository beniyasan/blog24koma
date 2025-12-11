import { useState, FormEvent } from 'react';
import type { Generate4KomaRequest } from '../types';

interface InputFormProps {
    onSubmit: (data: Generate4KomaRequest) => void;
    loading: boolean;
}

export function InputForm({ onSubmit, loading }: InputFormProps) {
    const [articleUrl, setArticleUrl] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [geminiApiKey, setGeminiApiKey] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Create request object
        const request: Generate4KomaRequest = {
            articleUrl: articleUrl.trim(),
            userPrompt: userPrompt.trim() || undefined,
            geminiApiKey: geminiApiKey.trim(),
        };

        onSubmit(request);

        // Clear API key after submission for security
        setGeminiApiKey('');
    };

    const isValid = articleUrl.trim() && geminiApiKey.trim();

    return (
        <div className="form-container">
            <div className="form-card">
                <div className="form-header">
                    <div className="form-icon">🚀</div>
                    <h2 className="form-title">4コマ漫画を生成</h2>
                    <p className="form-subtitle">ブログ記事を面白い4コマ漫画に変換します</p>
                </div>

                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label htmlFor="articleUrl" className="form-label">
                            <span className="label-icon">🔗</span>
                            記事URL <span className="required">*</span>
                        </label>
                        <div className="input-wrapper">
                            <input
                                type="url"
                                id="articleUrl"
                                className="form-input"
                                placeholder="https://note.com/username/n/xxxxx"
                                value={articleUrl}
                                onChange={(e) => setArticleUrl(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <div className="input-icon">📄</div>
                        </div>
                        <div className="supported-sites">
                            <span className="supported-label">対応サイト:</span>
                            <div className="site-badges">
                                <span className="site-badge">note.com</span>
                                <span className="site-badge">qiita.com</span>
                                <span className="site-badge">zenn.dev</span>
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="userPrompt" className="form-label">
                            <span className="label-icon">💡</span>
                            補足指示<span className="optional">（任意）</span>
                        </label>
                        <div className="input-wrapper">
                            <textarea
                                id="userPrompt"
                                className="form-input textarea"
                                placeholder="例: ほのぼのした雰囲気で、猫のキャラクターを使ってください"
                                value={userPrompt}
                                onChange={(e) => setUserPrompt(e.target.value)}
                                disabled={loading}
                                rows={3}
                            />
                            <div className="input-icon textarea-icon">✏️</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="geminiApiKey" className="form-label">
                            <span className="label-icon">🔑</span>
                            Gemini API キー <span className="required">*</span>
                        </label>
                        <div className="input-wrapper">
                            <input
                                type="password"
                                id="geminiApiKey"
                                className="form-input"
                                placeholder="AIzaSy..."
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="off"
                            />
                            <div className="input-icon">🔐</div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className={`submit-btn ${isValid && !loading ? 'active' : 'disabled'}`}
                        disabled={!isValid || loading}
                    >
                        {loading ? (
                            <>
                                <div className="loading-spinner"></div>
                                <span>生成中...</span>
                            </>
                        ) : (
                            <>
                                <span className="btn-icon">✨</span>
                                <span>4コマを生成する</span>
                                <span className="btn-arrow">→</span>
                            </>
                        )}
                    </button>

                    <div className="security-notice">
                        <div className="notice-header">
                            <span className="notice-icon">🛡️</span>
                            <span className="notice-title">安全なご利用について</span>
                        </div>
                        <div className="notice-content">
                            <div className="notice-item">
                                <span className="notice-check">✓</span>
                                <span>APIキーは処理中のみ使用し、保存しません</span>
                            </div>
                            <div className="notice-item">
                                <span className="notice-check">✓</span>
                                <span>利用料金はご自身のGoogleアカウントに請求</span>
                            </div>
                            <div className="notice-item">
                                <span className="notice-check">✓</span>
                                <span>ツール専用のAPIキー利用を推奨</span>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
