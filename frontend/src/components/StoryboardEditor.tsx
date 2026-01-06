import { useCallback } from 'react';
import type { StoryboardPanel } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import './StoryboardEditor.css';

interface StoryboardEditorProps {
    storyboard: StoryboardPanel[];
    onChange: (storyboard: StoryboardPanel[]) => void;
    disabled?: boolean;
}

const PANEL_LABELS = {
    ja: ['起', '承', '転', '結'],
    en: ['Setup', 'Development', 'Twist', 'Conclusion'],
};

export function StoryboardEditor({ storyboard, onChange, disabled }: StoryboardEditorProps) {
    const { language } = useLanguage();
    const labels = PANEL_LABELS[language] || PANEL_LABELS.ja;

    const handlePanelChange = useCallback(
        (index: number, field: 'description' | 'dialogue', value: string) => {
            const newStoryboard = storyboard.map((panel, i) => {
                if (i === index) {
                    return { ...panel, [field]: value };
                }
                return panel;
            });
            onChange(newStoryboard);
        },
        [storyboard, onChange]
    );

    return (
        <div className="storyboard-editor">
            <div className="storyboard-editor-header">
                <h3 className="storyboard-editor-title">{t(language, 'custom.storyboard.title')}</h3>
                <p className="storyboard-editor-subtitle">{t(language, 'custom.storyboard.subtitle')}</p>
            </div>
            <div className="storyboard-panels">
                {storyboard.map((panel, index) => (
                    <div key={panel.panel} className="storyboard-panel">
                        <div className="panel-header">
                            <span className="panel-number">{panel.panel}</span>
                            <span className="panel-label">{labels[index]}</span>
                        </div>
                        <div className="panel-fields">
                            <div className="panel-field">
                                <label className="panel-field-label">
                                    {t(language, 'custom.storyboard.scene')}
                                </label>
                                <textarea
                                    className="panel-field-input"
                                    value={panel.description}
                                    onChange={(e) => handlePanelChange(index, 'description', e.target.value)}
                                    disabled={disabled}
                                    rows={3}
                                    maxLength={500}
                                    placeholder={t(language, 'custom.storyboard.scene.placeholder')}
                                />
                                <span className="panel-field-counter">
                                    {panel.description.length}/500
                                </span>
                            </div>
                            <div className="panel-field">
                                <label className="panel-field-label">
                                    {t(language, 'custom.storyboard.dialogue')}
                                </label>
                                <input
                                    type="text"
                                    className="panel-field-input"
                                    value={panel.dialogue}
                                    onChange={(e) => handlePanelChange(index, 'dialogue', e.target.value)}
                                    disabled={disabled}
                                    maxLength={200}
                                    placeholder={t(language, 'custom.storyboard.dialogue.placeholder')}
                                />
                                <span className="panel-field-counter">
                                    {panel.dialogue.length}/200
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
