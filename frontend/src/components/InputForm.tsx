import { useState, FormEvent } from 'react';
import { ModelSettingsModal } from './ModelSettingsModal';
import { ModeSelector } from './ModeSelector';
import { DemoLimitDisplay } from './DemoLimitDisplay';
import { ApiKeyModal } from './ApiKeyModal';
import { analytics, EVENTS } from '../utils/analytics';
import type { Generate4KomaRequest, ModelSettings, GenerationMode, DemoStatus } from '../types';

interface InputFormProps {
    onSubmit: (data: Generate4KomaRequest) => void;
    loading: boolean;
    modelSettings?: ModelSettings;
    onModelSettingsChange?: (fullSettings: ModelSettings) => void;
    mode: GenerationMode;
    onModeChange: (mode: GenerationMode) => void;
    demoStatus: DemoStatus | null;
    userPlan?: 'free' | 'lite' | 'pro';
    isAuthenticated?: boolean;
}

export function InputForm({
    onSubmit,
    loading,
    modelSettings,
    onModelSettingsChange,
    mode,
    onModeChange,
    demoStatus,
    userPlan,
    isAuthenticated,
}: InputFormProps) {
    const [articleUrl, setArticleUrl] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [isModelModalOpen, setIsModelModalOpen] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

    const handleModeChange = (newMode: GenerationMode) => {
        onModeChange(newMode);
        analytics.track(newMode === 'demo' ? EVENTS.MODE_SWITCH_DEMO : EVENTS.MODE_SWITCH_BYOK);
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        analytics.track(EVENTS.CLICK_GENERATE, { mode });

        if (mode === 'byok') {
            // In BYOK mode, show API key modal
            setIsApiKeyModalOpen(true);
            analytics.track(EVENTS.OPEN_BYOK_KEY_PROMPT);
            return;
        }

        // In Demo mode, submit directly
        submitRequest();
    };

    const handleApiKeySubmit = (apiKey: string) => {
        analytics.track(EVENTS.SUBMIT_BYOK_KEY);
        setIsApiKeyModalOpen(false);

        const request: Generate4KomaRequest = {
            articleUrl: articleUrl.trim(),
            userPrompt: userPrompt.trim() || undefined,
            geminiApiKey: apiKey,
            modelSettings,
            mode: 'byok',
        };

        onSubmit(request);
    };

    const submitRequest = (apiKey?: string) => {
        const request: Generate4KomaRequest = {
            articleUrl: articleUrl.trim(),
            userPrompt: userPrompt.trim() || undefined,
            geminiApiKey: apiKey,
            modelSettings,
            mode,
        };

        onSubmit(request);
    };

    const handleModelSettingsChange = (settingType: string, value: string) => {
        const currentSettings: ModelSettings = modelSettings || {
            storyboardModel: 'gemini-2.5-flash',
            imageModel: 'gemini-3-pro-image-preview',
        };

        const newSettings = {
            ...currentSettings,
            [settingType]: value as ModelSettings[keyof ModelSettings],
        } as ModelSettings;
        onModelSettingsChange?.(newSettings);
    };

    const isValid = articleUrl.trim() && (mode === 'demo' ? demoStatus?.isAvailable : true);

    return (
        <div className="form-container">
            <div className="form-card">
                <div className="form-header">
                    <h2 className="form-title">4コマ漫画を生成</h2>
                    <p className="form-subtitle">ブログ記事を面白い4コマ漫画に変換します</p>
                </div>

                <ModeSelector
                    mode={mode}
                    onModeChange={handleModeChange}
                    disabled={loading}
                    userPlan={userPlan}
                    isAuthenticated={isAuthenticated}
                />

                {mode === 'demo' && (
                    <DemoLimitDisplay
                        status={demoStatus}
                        onSwitchToByok={() => handleModeChange('byok')}
                    />
                )}

                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label htmlFor="articleUrl" className="form-label">
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
                        </div>
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

                    {mode === 'byok' && (
                        <div className="form-group">
                            <div className="input-group">
                                <button
                                    type="button"
                                    className="model-settings-btn"
                                    onClick={() => setIsModelModalOpen(true)}
                                    disabled={loading}
                                    title="モデル設定"
                                >
                                    <span className="model-settings-icon">⚙️</span>
                                    <span>モデル設定</span>
                                </button>
                            </div>
                            {modelSettings && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--spacing-xs)' }}>
                                    絵コンテ: {modelSettings.storyboardModel}, 画像: {modelSettings.imageModel}
                                </div>
                            )}
                        </div>
                    )}

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

                    {mode === 'demo' && (
                        <div className="demo-notice">
                            <span className="demo-notice-text">
                                Demo出力には透かしが入ります（BYOKで透かし無し）
                            </span>
                        </div>
                    )}

                    {mode === 'byok' && (
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
                    )}
                </form>
            </div>

            <ModelSettingsModal
                isOpen={isModelModalOpen}
                onClose={() => setIsModelModalOpen(false)}
                storyboardModel={modelSettings?.storyboardModel || 'gemini-2.5-flash'}
                imageModel={modelSettings?.imageModel || 'gemini-3-pro-image-preview'}
                onChange={handleModelSettingsChange}
                onReset={() => {
                    handleModelSettingsChange('storyboardModel', 'gemini-2.5-flash');
                    handleModelSettingsChange('imageModel', 'gemini-3-pro-image-preview');
                }}
            />

            <ApiKeyModal
                isOpen={isApiKeyModalOpen}
                onClose={() => setIsApiKeyModalOpen(false)}
                onSubmit={handleApiKeySubmit}
            />
        </div>
    );
}
