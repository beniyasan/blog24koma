import type { GenerationMode } from '../types';

interface ModeSelectorProps {
    mode: GenerationMode;
    onModeChange: (mode: GenerationMode) => void;
    disabled?: boolean;
}

const MODE_INFO = {
    demo: {
        label: 'Demo',
        description: 'キー不要（回数制限あり・透かしあり）',
    },
    byok: {
        label: 'BYOK',
        description: 'あなたのAPIキーで実行（キーは保存しません）',
    },
};

export function ModeSelector({ mode, onModeChange, disabled }: ModeSelectorProps) {
    return (
        <div className="mode-selector">
            <div className="mode-tabs">
                {(['demo', 'byok'] as GenerationMode[]).map((m) => (
                    <button
                        key={m}
                        type="button"
                        className={`mode-tab ${mode === m ? 'active' : ''}`}
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
