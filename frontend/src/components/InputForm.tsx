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
        <form onSubmit={handleSubmit} className="card">
            <div className="form-group">
                <label htmlFor="articleUrl" className="form-label">
                    記事URL <span style={{ color: 'var(--error)' }}>*</span>
                </label>
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
            </div>

            <div className="form-group">
                <label htmlFor="userPrompt" className="form-label">
                    補足指示（任意）
                </label>
                <textarea
                    id="userPrompt"
                    className="form-input"
                    placeholder="例: ほのぼのした雰囲気で、猫のキャラクターを使ってください"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    disabled={loading}
                />
            </div>

            <div className="form-group">
                <label htmlFor="geminiApiKey" className="form-label">
                    Gemini API キー <span style={{ color: 'var(--error)' }}>*</span>
                </label>
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
            </div>

            <button
                type="submit"
                className="btn btn-primary"
                disabled={!isValid || loading}
                style={{ width: '100%' }}
            >
                {loading ? (
                    <>
                        <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                        生成中...
                    </>
                ) : (
                    '4コマを生成する'
                )}
            </button>

            <div className="notice">
                <div className="notice-title">ご利用にあたって</div>
                <ul className="notice-list">
                    <li>APIキーはこのリクエストの処理中のみ使用し、保存しません</li>
                    <li>API利用料金はユーザーご自身のGoogleアカウントに請求されます</li>
                    <li>安全のため、このツール専用のAPIキーを利用してください</li>
                    <li>対応ドメイン: note.com / qiita.com / zenn.dev</li>
                </ul>
            </div>
        </form>
    );
}
