import { STORYBOARD_MODELS, IMAGE_MODELS } from '../types';

interface ModelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  storyboardModel: string;
  imageModel: string;
  onStoryboardModelChange: (model: string) => void;
  onImageModelChange: (model: string) => void;
  onReset: () => void;
}

export function ModelSettingsModal({
  isOpen,
  onClose,
  storyboardModel,
  imageModel,
  onStoryboardModelChange,
  onImageModelChange,
  onReset,
}: ModelSettingsModalProps) {
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

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">モデル設定</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="model-section">
            <h3 className="model-section-title">
              <span className="model-section-icon">📝</span>
              絵コンテ生成モデル
            </h3>
            <div className="model-select-wrapper">
              <select
                value={storyboardModel}
                onChange={(e) => onStoryboardModelChange(e.target.value)}
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
              {STORYBOARD_MODELS[storyboardModel as keyof typeof STORYBOARD_MODELS].description}
            </p>
          </div>

          <div className="model-section">
            <h3 className="model-section-title">
              <span className="model-section-icon">🎨</span>
              画像生成モデル
            </h3>
            <div className="model-select-wrapper">
              <select
                value={imageModel}
                onChange={(e) => onImageModelChange(e.target.value)}
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
              {IMAGE_MODELS[imageModel as keyof typeof IMAGE_MODELS].description}
            </p>
          </div>
        </div>

        <div className="model-footer">
          <button className="model-btn secondary" onClick={handleReset}>
            デフォルトに戻す
          </button>
          <button className="model-btn primary" onClick={onClose}>
            完了
          </button>
        </div>
      </div>
    </div>
  );
}
