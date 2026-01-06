import { useState, useCallback } from 'react';
import { NavBar } from '../components/NavBar';
import { ModeSelector } from '../components/ModeSelector';
import { DemoLimitDisplay } from '../components/DemoLimitDisplay';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { ModelSettingsModal } from '../components/ModelSettingsModal';
import { CharactersEditor } from '../components/CharactersEditor';
import { StoryboardEditor } from '../components/StoryboardEditor';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { useGenerateStoryboard } from '../hooks/useGenerateStoryboard';
import { useGenerateImageFromStoryboard } from '../hooks/useGenerateImageFromStoryboard';
import { useModelSettings } from '../hooks/useModelSettings';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { analytics, EVENTS } from '../utils/analytics';
import { t } from '../i18n';
import type {
    StoryboardPanel,
    GenerationMode,
    ModelSettings,
    DemoStatus,
    CustomStoryboardPanel,
    CustomDialogueLine,
    CustomCharacter,
} from '../types';
import './CustomPage.css';

type CustomStep = 'input' | 'edit' | 'result';

function buildDialogueText(dialogues: CustomDialogueLine[]): string {
    return dialogues
        .map((d) => ({ speaker: d.speaker.trim(), text: d.text.trim() }))
        .filter((d) => d.text)
        .map((d) => (d.speaker ? `${d.speaker}: ${d.text}` : d.text))
        .join('\n');
}

function toApiStoryboard(panels: CustomStoryboardPanel[]): StoryboardPanel[] {
    return panels.map((p) => ({
        panel: p.panel,
        description: p.description,
        dialogue: buildDialogueText(p.dialogues),
    }));
}

const DEFAULT_STORYBOARD: CustomStoryboardPanel[] = [
    { panel: 1, description: '', dialogues: [{ id: 'p1-1', speaker: '', text: '' }] },
    { panel: 2, description: '', dialogues: [{ id: 'p2-1', speaker: '', text: '' }] },
    { panel: 3, description: '', dialogues: [{ id: 'p3-1', speaker: '', text: '' }] },
    { panel: 4, description: '', dialogues: [{ id: 'p4-1', speaker: '', text: '' }] },
];

export function CustomPage() {
    const { language } = useLanguage();
    const { isAuthenticated, user } = useAuth();
    const { settings: modelSettings, ...modelSettingsActions } = useModelSettings();

    const [mode, setMode] = useState<GenerationMode>('demo');
    const [step, setStep] = useState<CustomStep>('input');
    const [inputText, setInputText] = useState('');
    const [userPrompt, setUserPrompt] = useState('');
    const [storyboard, setStoryboard] = useState<CustomStoryboardPanel[]>(DEFAULT_STORYBOARD);
    const [characters, setCharacters] = useState<CustomCharacter[]>([]);
    const [imageBase64, setImageBase64] = useState<string | null>(null);

    const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
    const [isModelModalOpen, setIsModelModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<'storyboard' | 'image' | null>(null);

    const {
        isLoading: isStoryboardLoading,
        error: storyboardError,
        generate: generateStoryboard,
        reset: resetStoryboard,
    } = useGenerateStoryboard();

    const {
        isLoading: isImageLoading,
        error: imageError,
        generate: generateImage,
        reset: resetImage,
    } = useGenerateImageFromStoryboard();

    // Demo status (placeholder - would need a new hook for custom demo status)
    const demoStatus: DemoStatus = {
        remainingCount: 3,
        maxCount: 3,
        isAvailable: true,
    };

    const handleModeChange = (newMode: GenerationMode) => {
        setMode(newMode);
        analytics.track(newMode === 'demo' ? EVENTS.MODE_SWITCH_DEMO : EVENTS.MODE_SWITCH_BYOK);
    };

    const handleGenerateStoryboard = useCallback(async (apiKey?: string) => {
        if (!inputText.trim()) return;

        analytics.track(EVENTS.CLICK_GENERATE, { mode, step: 'storyboard' });

        const result = await generateStoryboard({
            inputText: inputText.trim(),
            userPrompt: userPrompt.trim() || undefined,
            geminiApiKey: apiKey,
            modelSettings: { storyboardModel: modelSettings.storyboardModel },
            language,
            mode,
        });

        if (result) {
            setStoryboard(result.storyboard);
            setCharacters(result.characters);
            setStep('edit');
        }
    }, [inputText, userPrompt, modelSettings.storyboardModel, language, mode, generateStoryboard]);

    const handleGenerateImage = useCallback(async (apiKey?: string) => {
        analytics.track(EVENTS.CLICK_GENERATE, { mode, step: 'image' });

        const apiStoryboard = toApiStoryboard(storyboard);
        const apiCharacters = characters
            .map((c) => ({ name: c.name.trim(), description: c.description.trim() }))
            .filter((c) => c.name);

        const result = await generateImage({
            storyboard: apiStoryboard,
            characters: apiCharacters.length > 0 ? apiCharacters : undefined,
            geminiApiKey: apiKey,
            modelSettings: { imageModel: modelSettings.imageModel },
            language,
            mode,
        });

        if (result) {
            setImageBase64(result);
            setStep('result');
            analytics.track(EVENTS.GENERATION_SUCCESS);
        }
    }, [storyboard, characters, modelSettings.imageModel, language, mode, generateImage]);

    const handleStoryboardSubmit = () => {
        if (mode === 'byok') {
            setPendingAction('storyboard');
            setIsApiKeyModalOpen(true);
            analytics.track(EVENTS.OPEN_BYOK_KEY_PROMPT);
        } else {
            handleGenerateStoryboard();
        }
    };

    const handleImageSubmit = () => {
        if (mode === 'byok') {
            setPendingAction('image');
            setIsApiKeyModalOpen(true);
            analytics.track(EVENTS.OPEN_BYOK_KEY_PROMPT);
        } else {
            handleGenerateImage();
        }
    };

    const handleApiKeySubmit = (apiKey: string) => {
        analytics.track(EVENTS.SUBMIT_BYOK_KEY);
        setIsApiKeyModalOpen(false);

        if (pendingAction === 'storyboard') {
            handleGenerateStoryboard(apiKey);
        } else if (pendingAction === 'image') {
            handleGenerateImage(apiKey);
        }
        setPendingAction(null);
    };

    const handleModelSettingsChange = (settingType: string, value: string) => {
        if (settingType === 'storyboardModel') {
            modelSettingsActions.updateStoryboardModel(value as ModelSettings['storyboardModel']);
        } else if (settingType === 'imageModel') {
            modelSettingsActions.updateImageModel(value as ModelSettings['imageModel']);
        }
    };

    const handleReset = () => {
        setStep('input');
        setInputText('');
        setUserPrompt('');
        setStoryboard(DEFAULT_STORYBOARD);
        setCharacters([]);
        setImageBase64(null);
        resetStoryboard();
        resetImage();
    };

    const handleBackToEdit = () => {
        setStep('edit');
        setImageBase64(null);
        resetImage();
    };

    const handleDownload = () => {
        if (!imageBase64) return;
        const link = document.createElement('a');
        link.href = imageBase64;
        link.download = `custom-4koma-${Date.now()}.png`;
        link.click();
    };

    const isLoading = isStoryboardLoading || isImageLoading;
    const error = storyboardError || imageError;
    const isInputValid = inputText.trim().length >= 10;

    return (
        <div className="app">
            <header className="header">
                <NavBar active="/custom" />
                <div className="hero-content">
                    <h1 className="header-title">{t(language, 'custom.hero.title')}</h1>
                    <p className="header-subtitle">{t(language, 'custom.hero.subtitle')}</p>
                </div>
            </header>

            <main className="container">
                {/* Step indicator */}
                <div className="custom-steps">
                    <div className={`custom-step ${step === 'input' ? 'active' : 'done'}`}>
                        <span className="step-number">1</span>
                        <span className="step-label">{t(language, 'custom.step.input')}</span>
                    </div>
                    <div className="step-connector" />
                    <div className={`custom-step ${step === 'edit' ? 'active' : step === 'result' ? 'done' : ''}`}>
                        <span className="step-number">2</span>
                        <span className="step-label">{t(language, 'custom.step.edit')}</span>
                    </div>
                    <div className="step-connector" />
                    <div className={`custom-step ${step === 'result' ? 'active' : ''}`}>
                        <span className="step-number">3</span>
                        <span className="step-label">{t(language, 'custom.step.result')}</span>
                    </div>
                </div>

                {/* Step 1: Input */}
                {step === 'input' && !isLoading && (
                    <div className="form-container">
                        <div className="form-card">
                            <div className="form-header">
                                <h2 className="form-title">{t(language, 'custom.input.title')}</h2>
                                <p className="form-subtitle">{t(language, 'custom.input.subtitle')}</p>
                            </div>

                            <ModeSelector
                                mode={mode}
                                onModeChange={handleModeChange}
                                disabled={isLoading}
                                userPlan={user?.plan as 'free' | 'lite' | 'pro' | undefined}
                                isAuthenticated={isAuthenticated}
                            />

                            {mode === 'demo' && (
                                <DemoLimitDisplay
                                    status={demoStatus}
                                    onSwitchToByok={() => handleModeChange('byok')}
                                />
                            )}

                            <div className="form">
                                <div className="form-group">
                                    <label htmlFor="inputText" className="form-label">
                                        {t(language, 'custom.input.text')} <span className="required">*</span>
                                    </label>
                                    <div className="input-wrapper">
                                        <textarea
                                            id="inputText"
                                            className="form-input textarea custom-textarea"
                                            placeholder={t(language, 'custom.input.text.placeholder')}
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            disabled={isLoading}
                                            rows={8}
                                            maxLength={10000}
                                        />
                                        <span className="input-counter">{inputText.length}/10000</span>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="userPrompt" className="form-label">
                                        {t(language, 'form.userPrompt')}
                                        <span className="optional">{t(language, 'form.optional')}</span>
                                    </label>
                                    <div className="input-wrapper">
                                        <textarea
                                            id="userPrompt"
                                            className="form-input textarea"
                                            placeholder={t(language, 'form.userPrompt.placeholder')}
                                            value={userPrompt}
                                            onChange={(e) => setUserPrompt(e.target.value)}
                                            disabled={isLoading}
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
                                                disabled={isLoading}
                                                title={t(language, 'form.modelSettings')}
                                            >
                                                <span className="model-settings-icon">⚙️</span>
                                                <span>{t(language, 'form.modelSettings')}</span>
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
                                    type="button"
                                    className={`submit-btn ${isInputValid && !isLoading ? 'active' : 'disabled'}`}
                                    disabled={!isInputValid || isLoading}
                                    onClick={handleStoryboardSubmit}
                                >
                                    <span>{t(language, 'custom.input.generate')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Edit Storyboard */}
                {step === 'edit' && !isLoading && (
                    <div className="custom-edit-container">
                        <div className="custom-edit-layout">
                            <div className="custom-edit-main">
                                <StoryboardEditor
                                    storyboard={storyboard}
                                    onChange={setStoryboard}
                                    characterNames={characters.map((c) => c.name).filter((n) => n.trim())}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="custom-edit-sidebar">
                                <CharactersEditor
                                    characters={characters}
                                    onChange={setCharacters}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>

                        <div className="custom-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleReset}
                                disabled={isLoading}
                            >
                                {t(language, 'custom.edit.back')}
                            </button>
                            <button
                                type="button"
                                className="submit-btn active"
                                onClick={handleImageSubmit}
                                disabled={isLoading}
                            >
                                <span>{t(language, 'custom.edit.generate')}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Result */}
                {step === 'result' && !isLoading && imageBase64 && (
                    <div className="custom-result-container">
                        <div className="result-card">
                            <h3 className="result-title">{t(language, 'custom.result.title')}</h3>
                            <div className="result-image-container">
                                <img
                                    src={imageBase64}
                                    alt={t(language, 'result.alt')}
                                    className="result-image"
                                />
                            </div>
                            <div className="result-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleBackToEdit}
                                >
                                    {t(language, 'custom.result.backToEdit')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={handleDownload}
                                >
                                    {t(language, 'result.download')}
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleReset}
                                >
                                    {t(language, 'custom.result.newCreate')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading */}
                {isLoading && (
                    <LoadingSpinner
                        message={
                            isStoryboardLoading
                                ? t(language, 'custom.loading.storyboard')
                                : t(language, 'custom.loading.image')
                        }
                    />
                )}

                {/* Error */}
                {error && !isLoading && (
                    <ErrorDisplay
                        message={error}
                        onRetry={() => {
                            if (step === 'edit') {
                                resetImage();
                            } else {
                                resetStoryboard();
                            }
                        }}
                    />
                )}
            </main>

            <footer className="footer">
                <p>
                    Powered by Gemini API |
                    <a
                        href="https://ai.google.dev/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary)', marginLeft: '4px', fontWeight: 700 }}
                    >
                        Google AI for Developers
                    </a>
                </p>
            </footer>

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
                onClose={() => {
                    setIsApiKeyModalOpen(false);
                    setPendingAction(null);
                }}
                onSubmit={handleApiKeySubmit}
            />
        </div>
    );
}
