import { useState, useEffect } from 'react';
import type { Generate4KomaResponse } from '../types';
import { addWatermarkToImage } from '../utils/watermark';

interface ResultDisplayProps {
    result: Generate4KomaResponse;
    onReset: () => void;
    isDemo?: boolean;
}

export function ResultDisplay({ result, onReset, isDemo = false }: ResultDisplayProps) {
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>生成結果</h2>
                <button className="btn btn-secondary" onClick={onReset}>
                    もう一度生成する
                </button>
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
                        <span>処理中...</span>
                    </div>
                )}
                <img
                    src={displayImage}
                    alt="4コマ漫画"
                    style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                    }}
                />
            </div>

            {isDemo && (
                <p className="demo-result-notice">
                    これはデモ出力です。透かしなしの画像は、BYOKモードでAPIキーを入力してご利用ください。
                </p>
            )}

            {/* Optional: Show storyboard text below for reference */}
            <details style={{ marginTop: 'var(--spacing-lg)' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    絵コンテ情報を表示
                </summary>
                <div style={{ marginTop: 'var(--spacing-md)' }}>
                    {result.storyboard.map((panel) => (
                        <div key={panel.panel} style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-sm)', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                            <span style={{ fontWeight: '600', color: 'var(--primary-light)' }}>コマ {panel.panel}</span>
                            <p style={{ margin: 'var(--spacing-xs) 0', color: 'var(--text-primary)' }}>「{panel.dialogue}」</p>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{panel.description}</p>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}
