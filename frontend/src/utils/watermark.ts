// Canvas-based watermark utility
// Embeds watermark directly into image data so it persists when saved

export async function addWatermarkToImage(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // Add watermark text
            const watermarkText = 'DEMO';
            const fontSize = Math.max(40, Math.min(img.width, img.height) / 8);

            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = '#ff3232';
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Draw multiple watermarks in a diagonal pattern
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            ctx.translate(centerX, centerY);
            ctx.rotate(-30 * Math.PI / 180);

            // Main center watermark
            ctx.fillText(watermarkText, 0, 0);

            // Additional watermarks for coverage
            const spacing = fontSize * 3;
            ctx.fillText(watermarkText, -spacing * 1.5, -spacing);
            ctx.fillText(watermarkText, spacing * 1.5, -spacing);
            ctx.fillText(watermarkText, -spacing * 1.5, spacing);
            ctx.fillText(watermarkText, spacing * 1.5, spacing);

            ctx.restore();

            // Convert back to base64
            const watermarkedBase64 = canvas.toDataURL('image/png');
            resolve(watermarkedBase64);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = base64Image;
    });
}
