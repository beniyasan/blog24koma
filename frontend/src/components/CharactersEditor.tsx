import { useCallback } from 'react';
import type { CustomCharacter } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import './CharactersEditor.css';

interface CharactersEditorProps {
    characters: CustomCharacter[];
    onChange: (characters: CustomCharacter[]) => void;
    disabled?: boolean;
}

const MAX_CHARACTERS = 8;

function makeId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function CharactersEditor({ characters, onChange, disabled }: CharactersEditorProps) {
    const { language } = useLanguage();

    const handleAdd = useCallback(() => {
        if (characters.length >= MAX_CHARACTERS) return;
        onChange([
            ...characters,
            { id: makeId(), name: '', description: '' },
        ]);
    }, [characters, onChange]);

    const handleRemove = useCallback((id: string) => {
        onChange(characters.filter((c) => c.id !== id));
    }, [characters, onChange]);

    const handleChange = useCallback(
        (id: string, field: 'name' | 'description', value: string) => {
            onChange(
                characters.map((c) => (c.id === id ? { ...c, [field]: value } : c))
            );
        },
        [characters, onChange]
    );

    return (
        <div className="characters-editor">
            <div className="characters-editor-header">
                <h3 className="characters-editor-title">{t(language, 'custom.characters.title')}</h3>
                <p className="characters-editor-subtitle">{t(language, 'custom.characters.subtitle')}</p>
            </div>

            <div className="characters-list">
                {characters.length === 0 && (
                    <div className="characters-empty">
                        {t(language, 'custom.characters.empty')}
                    </div>
                )}

                {characters.map((character) => (
                    <div key={character.id} className="character-card">
                        <div className="character-card-header">
                            <input
                                type="text"
                                className="character-name-input"
                                value={character.name}
                                onChange={(e) => handleChange(character.id, 'name', e.target.value)}
                                disabled={disabled}
                                maxLength={50}
                                placeholder={t(language, 'custom.characters.name.placeholder')}
                                aria-label={t(language, 'custom.characters.name')}
                            />
                            <button
                                type="button"
                                className="character-remove-btn"
                                onClick={() => handleRemove(character.id)}
                                disabled={disabled}
                                aria-label={t(language, 'custom.characters.remove')}
                                title={t(language, 'custom.characters.remove')}
                            >
                                ×
                            </button>
                        </div>

                        <textarea
                            className="character-desc-input"
                            value={character.description}
                            onChange={(e) => handleChange(character.id, 'description', e.target.value)}
                            disabled={disabled}
                            rows={3}
                            maxLength={200}
                            placeholder={t(language, 'custom.characters.description.placeholder')}
                            aria-label={t(language, 'custom.characters.description')}
                        />
                        <div className="character-counter">
                            {character.description.length}/200
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="button"
                className="characters-add-btn"
                onClick={handleAdd}
                disabled={disabled || characters.length >= MAX_CHARACTERS}
            >
                {t(language, 'custom.characters.add')}
            </button>
        </div>
    );
}
