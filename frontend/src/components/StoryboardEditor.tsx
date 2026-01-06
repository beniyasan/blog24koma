import { useCallback } from 'react';
import type { CustomStoryboardPanel, CustomDialogueLine } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import './StoryboardEditor.css';

interface StoryboardEditorProps {
    storyboard: CustomStoryboardPanel[];
    onChange: (storyboard: CustomStoryboardPanel[]) => void;
    characterNames?: string[];
    disabled?: boolean;
}

const PANEL_LABELS = {
    ja: ['起', '承', '転', '結'],
    en: ['Setup', 'Development', 'Twist', 'Conclusion'],
};

const CHARACTER_DATALIST_ID = 'custom-4koma-character-names';
const MAX_DIALOGUE_LINES = 6;
const MAX_DIALOGUE_TOTAL_CHARS = 800;

function makeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function trimOrEmpty(value: string): string {
    return typeof value === 'string' ? value : '';
}

function normalizeDialogueLine(line: CustomDialogueLine): CustomDialogueLine {
    return {
        id: line.id || makeId(),
        speaker: trimOrEmpty(line.speaker),
        text: trimOrEmpty(line.text),
    };
}

export function StoryboardEditor({ storyboard, onChange, characterNames = [], disabled }: StoryboardEditorProps) {
    const { language } = useLanguage();
    const labels = PANEL_LABELS[language] || PANEL_LABELS.ja;

    const updatePanel = useCallback(
        (index: number, updater: (panel: CustomStoryboardPanel) => CustomStoryboardPanel) => {
            const newStoryboard = storyboard.map((panel, i) => {
                if (i !== index) return panel;
                return updater(panel);
            });
            onChange(newStoryboard);
        },
        [storyboard, onChange]
    );

    const handleDescriptionChange = useCallback(
        (index: number, value: string) => {
            updatePanel(index, (panel) => ({ ...panel, description: value }));
        },
        [updatePanel]
    );

    const handleDialogueLineChange = useCallback(
        (panelIndex: number, lineId: string, field: 'speaker' | 'text', value: string) => {
            updatePanel(panelIndex, (panel) => {
                const nextDialogues = (panel.dialogues || []).map((line) => {
                    const normalized = normalizeDialogueLine(line);
                    if (normalized.id !== lineId) return normalized;
                    return { ...normalized, [field]: value };
                });
                return { ...panel, dialogues: nextDialogues };
            });
        },
        [updatePanel]
    );

    const handleAddDialogueLine = useCallback(
        (panelIndex: number) => {
            updatePanel(panelIndex, (panel) => {
                const current = (panel.dialogues || []).map(normalizeDialogueLine);
                if (current.length >= MAX_DIALOGUE_LINES) return { ...panel, dialogues: current };
                return {
                    ...panel,
                    dialogues: [...current, { id: makeId(), speaker: '', text: '' }],
                };
            });
        },
        [updatePanel]
    );

    const handleRemoveDialogueLine = useCallback(
        (panelIndex: number, lineId: string) => {
            updatePanel(panelIndex, (panel) => {
                const current = (panel.dialogues || []).map(normalizeDialogueLine);
                const filtered = current.filter((l) => l.id !== lineId);
                if (filtered.length > 0) return { ...panel, dialogues: filtered };
                return { ...panel, dialogues: [{ id: makeId(), speaker: '', text: '' }] };
            });
        },
        [updatePanel]
    );

    return (
        <div className="storyboard-editor">
            <div className="storyboard-editor-header">
                <h3 className="storyboard-editor-title">{t(language, 'custom.storyboard.title')}</h3>
                <p className="storyboard-editor-subtitle">{t(language, 'custom.storyboard.subtitle')}</p>
            </div>
            {characterNames.length > 0 && (
                <datalist id={CHARACTER_DATALIST_ID}>
                    {characterNames
                        .map((name) => name.trim())
                        .filter(Boolean)
                        .map((name) => (
                            <option key={name} value={name} />
                        ))}
                </datalist>
            )}
            <div className="storyboard-panels">
                {storyboard.map((panel, index) => {
                    const normalizedDialogues = (panel.dialogues || []).map(normalizeDialogueLine);
                    const dialogueText = normalizedDialogues
                        .map((d) => ({ speaker: d.speaker.trim(), text: d.text.trim() }))
                        .filter((d) => d.text)
                        .map((d) => (d.speaker ? `${d.speaker}: ${d.text}` : d.text))
                        .join('\n');
                    const dialogueLength = dialogueText.length;

                    return (
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
                                    onChange={(e) => handleDescriptionChange(index, e.target.value)}
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
                                <div className={`dialogue-total-counter ${dialogueLength > MAX_DIALOGUE_TOTAL_CHARS ? 'warn' : ''}`}>
                                    {dialogueLength}/{MAX_DIALOGUE_TOTAL_CHARS}
                                </div>
                                <div className="dialogue-list">
                                    {normalizedDialogues.map((line) => (
                                        <div key={line.id} className="dialogue-row">
                                            <input
                                                type="text"
                                                className="dialogue-speaker-input"
                                                value={line.speaker}
                                                onChange={(e) => handleDialogueLineChange(index, line.id, 'speaker', e.target.value)}
                                                disabled={disabled}
                                                maxLength={50}
                                                placeholder={t(language, 'custom.storyboard.speaker.placeholder')}
                                                list={characterNames.length > 0 ? CHARACTER_DATALIST_ID : undefined}
                                                aria-label={t(language, 'custom.storyboard.speaker')}
                                            />
                                            <input
                                                type="text"
                                                className="dialogue-text-input"
                                                value={line.text}
                                                onChange={(e) => handleDialogueLineChange(index, line.id, 'text', e.target.value)}
                                                disabled={disabled}
                                                maxLength={200}
                                                placeholder={t(language, 'custom.storyboard.dialogue.placeholder')}
                                            />
                                            <button
                                                type="button"
                                                className="dialogue-remove-btn"
                                                onClick={() => handleRemoveDialogueLine(index, line.id)}
                                                disabled={disabled}
                                                aria-label={t(language, 'custom.storyboard.dialogue.remove')}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="dialogue-add-btn"
                                    onClick={() => handleAddDialogueLine(index)}
                                    disabled={disabled || normalizedDialogues.length >= MAX_DIALOGUE_LINES}
                                >
                                    {t(language, 'custom.storyboard.dialogue.add')}
                                </button>
                            </div>
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );
}
