import { useState, useEffect } from 'react';
import { STORYBOARD_MODELS, IMAGE_MODELS } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';

interface ModelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyboardModel: string;
  imageModel: string;
  onChange: (settingType: 'storyboardModel' | 'imageModel', value: string) => void;
  onReset: () => void;
}

export function ModelSettingsModal({
  isOpen,
  onClose,
  storyboardModel,
  imageModel,
  onChange,
  onReset,
}: ModelSettingsModalProps) {
  const { language } = useLanguage();

  // モーダル内のローカル状態を管理
  const [localStoryboardModel, setLocalStoryboardModel] = useState(storyboardModel);
  const [localImageModel, setLocalImageModel] = useState(imageModel);

  // 親からの変更を反映
  useEffect(() => {
    setLocalStoryboardModel(storyboardModel);
  }, [storyboardModel]);

  useEffect(() => {
    setLocalImageModel(imageModel);
  }, [imageModel]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  const storyboardSelectHandler = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    // ローカル状態を即時更新
    setLocalStoryboardModel(newValue);
    // 親コンポーネントに通知
    onChange('storyboardModel', newValue);
  };

  const imageSelectHandler = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    // ローカル状態を即時更新
    setLocalImageModel(newValue);
    // 親コンポーネントに通知
    onChange('imageModel', newValue);
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">{t(language, 'modelSettings.title')}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="model-section">
            <h3 className="model-section-title">
              <span className="model-section-icon">📝</span>
              {t(language, 'modelSettings.storyboard')}
            </h3>
            <div className="model-select-wrapper">
              <select
                value={localStoryboardModel}
                onChange={storyboardSelectHandler}
                className="model-select"
              >
                {Object.entries(STORYBOARD_MODELS).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.name}
                  </option>
                ))}
              </select>
              <span className="model-select-arrow">▼</span>
            </div>
            <p className="model-description">
              {STORYBOARD_MODELS[localStoryboardModel as keyof typeof STORYBOARD_MODELS].description}
            </p>
          </div>

          <div className="model-section">
            <h3 className="model-section-title">
              <span className="model-section-icon">🎨</span>
              {t(language, 'modelSettings.image')}
            </h3>
            <div className="model-select-wrapper">
              <select
                value={localImageModel}
                onChange={imageSelectHandler}
                className="model-select"
              >
                {Object.entries(IMAGE_MODELS).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.name}
                  </option>
                ))}
              </select>
              <span className="model-select-arrow">▼</span>
            </div>
            <p className="model-description">
              {IMAGE_MODELS[localImageModel as keyof typeof IMAGE_MODELS].description}
            </p>
          </div>
        </div>

        <div className="model-footer">
          <button className="model-btn secondary" onClick={handleReset}>
            {t(language, 'modelSettings.reset')}
          </button>
          <button className="model-btn primary" onClick={onClose}>
            {t(language, 'modelSettings.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
