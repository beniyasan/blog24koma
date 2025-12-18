import type { GenerationMode } from '../types';

interface ModeSelectorProps {
    mode: GenerationMode;
    onModeChange: (mode: GenerationMode) => void;
    disabled?: boolean;
    userPlan?: 'free' | 'lite' | 'pro' | null;
    isAuthenticated?: boolean;
}

const MODE_INFO: Record<GenerationMode, { label: string; description: string; requiresPlan?: string }> = {
    demo: {
        label: 'Demo',
        description: 'キー不要（回数制限あり・透かしあり）',
    },
    lite: {
        label: 'Lite',
        description: '月30回まで（透かしなし）',
        requiresPlan: 'lite',
    },
    pro: {
        label: 'Pro',
        description: '月100回まで（透かしなし・優先）',
        requiresPlan: 'pro',
    },
    byok: {
        label: 'BYOK',
        description: 'あなたのAPIキーで実行（キーは保存しません）',
    },
};

export function ModeSelector({
    mode,
    onModeChange,
    disabled,
    userPlan,
    isAuthenticated,
}: ModeSelectorProps) {
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
                        {MODE_INFO[m].label}
                    </button>
                ))}
            </div>
            <p className="mode-description">{MODE_INFO[mode].description}</p>
        </div>
    );
}
