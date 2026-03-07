
/**
 * Compresses an image file efficiently to meet quality and size standards.
 * @param {File} file - The image file to compress.
 * @param {number} quality - Initial quality (0.1 to 1.0).
 * @param {number} maxWidth - Starting maximum width.
 * @returns {Promise<Blob>} A promise that resolves with the compressed image as a Blob.
 */
export const compressImage = async (file: File, quality = 0.8, maxWidth = 1280): Promise<Blob> => {
    // Increased target size to 250KB for better quality
    const targetSize = 250 * 1024; 
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = async () => {
                let currentQuality = quality;
                let currentWidth = maxWidth;
                
                // Calculate new dimensions
                if (img.width > maxWidth) {
                    currentWidth = maxWidth;
                } else {
                    currentWidth = img.width;
                }
                
                const canvas = document.createElement('canvas');
                const scaleRatio = currentWidth / img.width;
                canvas.width = currentWidth;
                canvas.height = img.height * scaleRatio;

                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Failed to get canvas context'));
                
                // Use better image smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // One-shot compression if possible
                let blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', currentQuality));
                
                // If still too large, do ONE more pass at lower quality instead of a loop
                if (blob && blob.size > targetSize) {
                    blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', currentQuality * 0.7));
                }

                if (blob) resolve(blob);
                else reject(new Error('Compression failed'));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
