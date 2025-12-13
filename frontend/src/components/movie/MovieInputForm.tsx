import { useState, FormEvent } from 'react';
import { ModelSettingsModal } from '../ModelSettingsModal';
import type { GenerateMovie4KomaRequest, ModelSettings } from '../../types';

interface MovieInputFormProps {
    onSubmit: (data: GenerateMovie4KomaRequest) => void;
    loading: boolean;
    modelSettings?: ModelSettings;
    onModelSettingsChange?: (fullSettings: ModelSettings) => void;
}

export function MovieInputForm({ 
    onSubmit, 
    loading, 
    modelSettings,
    onModelSettingsChange 
}: MovieInputFormProps) {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        const request: GenerateMovie4KomaRequest = {
            youtubeUrl: youtubeUrl.trim(),
            userPrompt: userPrompt.trim() || undefined,
            geminiApiKey: geminiApiKey.trim(),
            modelSettings,
        };

        onSubmit(request);
        setGeminiApiKey('');
    };

    const handleModelSettingsChange = (settingType: string, value: string) => {
        const currentSettings = modelSettings || {
            storyboardModel: 'gemini-2.5-flash' as any,
            imageModel: 'gemini-3-pro-image-preview' as any,
        };
        
        const newSettings = {
            ...currentSettings,
            [settingType]: value as any,
        };
        onModelSettingsChange?.(newSettings);
    };

    const isValid = youtubeUrl.trim() && geminiApiKey.trim();

    return (
        <div className="form-container">
            <div className="form-card">
                <div className="form-header">
                    <h2 className="form-title">動画から4コマ漫画を生成</h2>
                    <p className="form-subtitle">YouTube動画の内容を面白い4コマ漫画に変換します</p>
                </div>

                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label htmlFor="youtubeUrl" className="form-label">
                            YouTube URL <span className="required">*</span>
                        </label>
                        <div className="input-wrapper">
                            <input
                                type="url"
                                id="youtubeUrl"
                                className="form-input"
                                placeholder="https://www.youtube.com/watch?v=xxxxx"
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                        <p className="form-hint">※ youtu.be 形式のURLにも対応しています</p>
                    </div>

                    <div className="form-group">
                        <label htmlFor="userPrompt" className="form-label">
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
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="geminiApiKey" className="form-label">
                            Gemini API キー <span className="required">*</span>
                        </label>
                        <div className="input-group">
                            <div className="input-wrapper" style={{ flex: 1 }}>
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
                                type="button"
                                className="model-settings-btn"
                                onClick={() => setIsModalOpen(true)}
                                disabled={loading}
                                title="モデル設定"
                            >
                                <span className="model-settings-icon">⚙️</span>
                            </button>
                        </div>
                        {modelSettings && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--spacing-xs)' }}>
                                絵コンテ: {modelSettings.storyboardModel}, 画像: {modelSettings.imageModel}
                            </div>
                        )}
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
                            <span>4コマを生成する</span>
                        )}
                    </button>

                    <div className="security-notice">
                        <div className="notice-header">
                            <span className="notice-title">安全なご利用について</span>
                        </div>
                        <div className="notice-content">
                            <div className="notice-item">
                                <span className="notice-check">{'>'}</span>
                                <span>APIキーは処理中のみ使用し、保存しません</span>
                            </div>
                            <div className="notice-item">
                                <span className="notice-check">{'>'}</span>
                                <span>利用料金はご自身のGoogleアカウントに請求</span>
                            </div>
                            <div className="notice-item">
                                <span className="notice-check">{'>'}</span>
                                <span>ツール専用のAPIキー利用を推奨</span>
                            </div>
                        </div>
                    </div>
                </form>
            </div>

            <ModelSettingsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                storyboardModel={modelSettings?.storyboardModel || 'gemini-2.5-flash'}
                imageModel={modelSettings?.imageModel || 'gemini-3-pro-image-preview'}
                onChange={handleModelSettingsChange}
                onReset={() => {
                    handleModelSettingsChange('storyboardModel', 'gemini-2.5-flash');
                    handleModelSettingsChange('imageModel', 'gemini-3-pro-image-preview');
                }}
            />
        </div>
    );
}
