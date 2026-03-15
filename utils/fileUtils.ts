
/**
 * Converts a Blob (like a File) into a Base64 encoded string, without the data URI prefix.
 * @param file The Blob or File to convert.
 * @returns A promise that resolves with the Base64 string.
 */
export const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // The result is "data:mime/type;base64,the_base_64_string"
            // We only need the part after the comma.
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

/**
 * Converts a Blob (like a File) into a Data URL string (e.g., "data:mime/type;base64,...").
 * @param file The Blob or File to convert.
 * @returns A promise that resolves with the Data URL string.
 */
export const fileToDataUrl = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

/**
 * Converts various Google Drive URL formats into a direct, embeddable image URL.
 * Also handles standard image URLs.
 * @param url The original URL from Google Drive or another source.
 * @param type The type of content, 'image' for image URLs, 'audio' for audio download links.
 * @returns A processed, directly usable URL or a fallback for images.
 */
export const convertGoogleDriveUrl = (url?: string, type: 'image' | 'audio' | 'preview' = 'image'): string => {
    const fallbackImage = 'https://placehold.co/100x100/1f2937/4b5563?text=N/A';
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return type === 'image' ? fallbackImage : '';
    }

    const trimmedUrl = url.trim();

    // 1. Handle direct content URLs
    if (trimmedUrl.includes('lh3.googleusercontent.com') || trimmedUrl.includes('googleusercontent.com/d/')) {
        if (type === 'preview') return trimmedUrl; // Direct content is its own preview
        if (trimmedUrl.includes('lh3.googleusercontent.com')) {
            if (trimmedUrl.includes('=s')) return trimmedUrl;
            return `${trimmedUrl}=s1000`;
        }
        return trimmedUrl;
    }

    // 2. Extract File ID
    let fileId = '';
    const idRegex = /(?:id=|d\/|file\/d\/|open\?id=|thumbnail\?id=|uc\?id=)([a-zA-Z0-9_-]{25,45})/;
    const match = trimmedUrl.match(idRegex);
    if (match && match[1]) {
        fileId = match[1];
    } else if (/^[a-zA-Z0-9_-]{28,35}$/.test(trimmedUrl) && !trimmedUrl.includes('/') && !['product_assets', 'order_assets'].includes(trimmedUrl)) {
        fileId = trimmedUrl;
    }

    // 3. Construct URL based on type
    if (fileId) {
        if (type === 'image') {
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        } else if (type === 'preview') {
            return `https://drive.google.com/file/d/${fileId}/preview`;
        } else {
            return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
    }

    return (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) ? trimmedUrl : (type === 'image' ? fallbackImage : '');
};

/**
 * Fetches an image from a URL and converts it to a Base64 string.
 * Useful for embedding images in PDFs.
 * @param url The URL of the image.
 * @returns A promise that resolves to the Base64 string (without prefix) or empty string if failed.
 */
export const imageUrlToBase64 = async (url: string): Promise<string> => {
    try {
        const processedUrl = convertGoogleDriveUrl(url);
        if (!processedUrl || processedUrl.includes('placehold.co')) return '';

        // Try standard CORS fetch first
        let response;
        try {
            response = await fetch(processedUrl, { mode: 'cors' });
        } catch (e) {
            // Some CDNs might block requests with cookies/creds
            response = await fetch(processedUrl, { mode: 'cors', credentials: 'omit' });
        }

        if (!response.ok) throw new Error('Network response was not ok');
        
        const blob = await response.blob();
        return await fileToBase64(blob);
    } catch (error) {
        console.warn("Error converting image to base64 for PDF:", error);
        return '';
    }
};
