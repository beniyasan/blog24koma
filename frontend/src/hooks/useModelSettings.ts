import { useState, useEffect } from 'react';
import type { ModelSettings, StoryboardModel, ImageModel } from '../types';

export const STORAGE_KEY = 'blog4koma-model-settings';

const DEFAULT_SETTINGS: ModelSettings = {
  storyboardModel: 'gemini-2.5-flash',
  imageModel: 'gemini-3-pro-image-preview',
};

export function useModelSettings() {
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_SETTINGS);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ModelSettings>;
        
        // Validate and merge with defaults
        const validatedSettings: ModelSettings = {
          storyboardModel: validateStoryboardModel(parsed.storyboardModel) || DEFAULT_SETTINGS.storyboardModel,
          imageModel: validateImageModel(parsed.imageModel) || DEFAULT_SETTINGS.imageModel,
        };
        
        setSettings(validatedSettings);
      }
    } catch (error) {
      console.warn('Failed to load model settings from localStorage:', error);
    }
  }, []);

  // Save to localStorage when settings change
  const saveSettings = (newSettings: ModelSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.warn('Failed to save model settings to localStorage:', error);
    }
  };

  const updateStoryboardModel = (model: StoryboardModel) => {
    saveSettings({ ...settings, storyboardModel: model });
  };

  const updateImageModel = (model: ImageModel) => {
    saveSettings({ ...settings, imageModel: model });
  };

  const resetToDefaults = () => {
    saveSettings(DEFAULT_SETTINGS);
  };

  return {
    settings,
    updateStoryboardModel,
    updateImageModel,
    resetToDefaults,
  };
}

function validateStoryboardModel(model: unknown): StoryboardModel | null {
  const validModels: StoryboardModel[] = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-3-pro-preview'];
  return validModels.includes(model as StoryboardModel) ? model as StoryboardModel : null;
}

function validateImageModel(model: unknown): ImageModel | null {
  const validModels: ImageModel[] = ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image'];
  return validModels.includes(model as ImageModel) ? model as ImageModel : null;
}
