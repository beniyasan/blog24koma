import type { GenerationMode } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';

interface ModeSelectorProps {
    mode: GenerationMode;
    onModeChange: (mode: GenerationMode) => void;
    disabled?: boolean;
    userPlan?: 'free' | 'lite' | 'pro' | null;
    isAuthenticated?: boolean;
}

const MODE_LABEL: Record<GenerationMode, string> = {
    demo: 'Demo',
    lite: 'Lite',
    pro: 'Pro',
    byok: 'BYOK',
};

export function ModeSelector({
    mode,
    onModeChange,
    disabled,
    userPlan,
    isAuthenticated,
}: ModeSelectorProps) {
    const { language } = useLanguage();

    // Determine which modes to show
    const availableModes: GenerationMode[] = ['demo'];

    // Add user's plan mode (only show their current plan, not lower tiers)
    if (isAuthenticated && userPlan) {
        if (userPlan === 'lite') {
            availableModes.push('lite');
        }
        if (userPlan === 'pro') {
            availableModes.push('pro');
        }
    }

    // Always show BYOK
    availableModes.push('byok');

    return (
        <div className="mode-selector">
            <div className="mode-tabs">
                {availableModes.map((m) => (
                    <button
                        key={m}
                        type="button"
                        className={`mode-tab ${mode === m ? 'active' : ''} ${m === 'lite' || m === 'pro' ? 'premium' : ''}`}
                        onClick={() => onModeChange(m)}
                        disabled={disabled}
                    >
                        {MODE_LABEL[m]}
                    </button>
                ))}
            </div>
            <p className="mode-description">{t(language, `mode.${mode}.description`)}</p>
        </div>
    );
}
