import { useState, useEffect } from 'react';
import type { GenerateMovie4KomaResponse } from '../../types';
import { addWatermarkToImage } from '../../utils/watermark';
import { useLanguage } from '../../hooks/useLanguage';
import { t } from '../../i18n';

interface MovieResultDisplayProps {
    result: GenerateMovie4KomaResponse;
    onReset: () => void;
    isDemo?: boolean;
}

export function MovieResultDisplay({ result, onReset, isDemo = false }: MovieResultDisplayProps) {
    const { language } = useLanguage();
    const [displayImage, setDisplayImage] = useState<string>(result.imageBase64);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isDemo && result.imageBase64) {
            setIsProcessing(true);
            addWatermarkToImage(result.imageBase64)
                .then((watermarkedImage) => {
                    setDisplayImage(watermarkedImage);
                    setIsProcessing(false);
                })
                .catch((error) => {
                    console.error('Failed to add watermark:', error);
                    setDisplayImage(result.imageBase64);
                    setIsProcessing(false);
                });
        } else {
            setDisplayImage(result.imageBase64);
        }
    }, [isDemo, result.imageBase64]);

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>{t(language, 'result.title')}</h2>
                <button className="btn btn-secondary" onClick={onReset}>
                    {t(language, 'result.regenerate')}
                </button>
            </div>

            {/* Movie summary section */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)', padding: 'var(--spacing-md)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: 'var(--spacing-sm)', color: 'var(--primary-light)' }}>
                    {result.movieSummary.title}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                    {result.movieSummary.summary}
                </p>
            </div>

            {/* Single 4-panel comic image with embedded watermark for demo */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
                {isProcessing && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.8)',
                        zIndex: 1
                    }}>
                        <span>{t(language, 'result.processing')}</span>
                    </div>
                )}
                <img
                    src={displayImage}
                    alt={t(language, 'result.alt')}
                    style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                    }}
                />
            </div>

            {isDemo && (
                <p className="demo-result-notice">
                    {t(language, 'result.demoNotice')}
                </p>
            )}

            {/* Optional: Show storyboard text below for reference */}
            <details style={{ marginTop: 'var(--spacing-lg)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {t(language, 'result.showStoryboard')}
                </summary>
                <div style={{ marginTop: 'var(--spacing-md)' }}>
                    {result.storyboard.map((panel) => (
                        <div key={panel.panel} style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-sm)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontWeight: '600', color: 'var(--primary-light)' }}>{t(language, 'result.panel')} {panel.panel}</span>
                            <p style={{ margin: 'var(--spacing-xs) 0', color: 'var(--text-primary)' }}>「{panel.dialogue}」</p>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{panel.description}</p>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}
