import { useState, FormEvent } from 'react';
import { ModelSettingsModal } from '../ModelSettingsModal';
import { ModeSelector } from '../ModeSelector';
import { DemoLimitDisplay } from '../DemoLimitDisplay';
import { ApiKeyModal } from '../ApiKeyModal';
import { analytics, EVENTS } from '../../utils/analytics';
import type { GenerateMovie4KomaRequest, ModelSettings, GenerationMode, DemoStatus } from '../../types';

interface MovieInputFormProps {
    onSubmit: (data: GenerateMovie4KomaRequest) => void;
    loading: boolean;
    modelSettings?: ModelSettings;
    onModelSettingsChange?: (fullSettings: ModelSettings) => void;
    mode: GenerationMode;
    onModeChange: (mode: GenerationMode) => void;
    demoStatus: DemoStatus | null;
    userPlan?: 'free' | 'lite' | 'pro';
    isAuthenticated?: boolean;
}

export function MovieInputForm({
    onSubmit,
    loading,
    modelSettings,
    onModelSettingsChange,
    mode,
    onModeChange,
    demoStatus,
    userPlan,
    isAuthenticated,
}: MovieInputFormProps) {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [isModelModalOpen, setIsModelModalOpen] = useState(false);
    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

    const handleModeChange = (newMode: GenerationMode) => {
        onModeChange(newMode);
        if (newMode === 'demo') {
            analytics.track(EVENTS.MODE_SWITCH_DEMO);
        } else {
            analytics.track(EVENTS.MODE_SWITCH_BYOK);
        }
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

        const request: GenerateMovie4KomaRequest = {
            youtubeUrl: youtubeUrl.trim(),
            userPrompt: userPrompt.trim() || undefined,
            geminiApiKey: apiKey,
            modelSettings,
            mode: 'byok',
        };

        onSubmit(request);
    };

    const submitRequest = (apiKey?: string) => {
        const request: GenerateMovie4KomaRequest = {
            youtubeUrl: youtubeUrl.trim(),
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

    const isValid = youtubeUrl.trim() && (mode === 'demo' ? demoStatus?.isAvailable : true);

    return (
        <div className="form-container">
            <div className="form-card">
                <div className="form-header">
                    <h2 className="form-title">動画から4コマ漫画を生成</h2>
                    <p className="form-subtitle">YouTube動画の内容を面白い4コマ漫画に変換します</p>
                </div>

                {/* Mode Selector */}
                <ModeSelector mode={mode} onModeChange={handleModeChange} disabled={loading} userPlan={userPlan} isAuthenticated={isAuthenticated} />

                {/* Demo Limit Display */}
                {mode === 'demo' && (
                    <DemoLimitDisplay
                        status={demoStatus}
                        onSwitchToByok={() => handleModeChange('byok')}
                    />
                )}

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

                    {/* Model Settings Button - only show in BYOK mode */}
                    {mode === 'byok' && (
                        <div className="form-group">
                            <div className="input-group" style={{ justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="model-settings-btn"
                                    onClick={() => setIsModelModalOpen(true)}
                                    disabled={loading}
                                    title="モデル設定"
                                >
                                    <span className="model-settings-icon">⚙️</span>
                                    <span style={{ marginLeft: '4px' }}>モデル設定</span>
                                </button>
                            </div>
                            {modelSettings && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--spacing-xs)', textAlign: 'right' }}>
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

                    {/* Demo mode notice */}
                    {mode === 'demo' && demoStatus?.isAvailable && (
                        <div className="demo-notice">
                            <p className="demo-notice-text">
                                デモ版のため生成結果に透かしが入ります
                            </p>
                        </div>
                    )}

                    {/* Security notice for BYOK mode */}
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
