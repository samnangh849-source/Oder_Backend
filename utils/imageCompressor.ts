
/**
 * Smart Image Compressor
 * Modes: 
 * - 'balanced': For Chat (Smaller size, good quality)
 * - 'high-detail': For Labels/Packaging (Large size, high clarity)
 */
export const compressImage = async (
    file: File, 
    mode: 'balanced' | 'high-detail' = 'balanced'
): Promise<Blob> => {
    const settings = {
        balanced: { maxWidth: 1024, quality: 0.6, targetSize: 150 * 1024 },
        'high-detail': { maxWidth: 1440, quality: 0.85, targetSize: 400 * 1024 }
    };

    const { maxWidth, quality, targetSize } = settings[mode];

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas Context Error'));
                
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                let currentQuality = quality;
                let blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', currentQuality));

                // Iterative compression if still too large (max 2 passes for speed)
                if (blob && blob.size > targetSize) {
                    currentQuality *= 0.7;
                    blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', currentQuality));
                }

                if (blob) resolve(blob);
                else reject(new Error('Compression Failed'));
            };
        };
        reader.onerror = (e) => reject(e);
    });
};
