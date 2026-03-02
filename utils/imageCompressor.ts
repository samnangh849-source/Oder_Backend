
/**
 * Compresses an image file iteratively to meet a target size.
 * @param {File} file - The image file to compress.
 * @param {number} targetKB - The target size in KB.
 * @param {number} maxWidth - Starting maximum width.
 * @returns {Promise<Blob>} A promise that resolves with the compressed image as a Blob.
 */
export const compressImage = async (file: File, quality = 0.6, maxWidth = 800): Promise<Blob> => {
    const targetSize = 50 * 1024; // 50KB in bytes
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = async () => {
                let currentQuality = quality;
                let currentWidth = maxWidth;
                let blob: Blob | null = null;

                // Simple iterative approach: if it's too big, shrink it
                // We'll try at most 3 times to avoid hanging the UI
                for (let i = 0; i < 3; i++) {
                    const canvas = document.createElement('canvas');
                    const scaleRatio = currentWidth / img.width;
                    canvas.width = currentWidth;
                    canvas.height = img.height * scaleRatio;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Failed to get canvas context'));
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', currentQuality));
                    
                    if (blob && blob.size < targetSize) {
                        break;
                    }
                    
                    // Reduce quality and size for next iteration
                    currentQuality -= 0.15;
                    currentWidth -= 150;
                }

                if (blob) resolve(blob);
                else reject(new Error('Compression failed'));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
