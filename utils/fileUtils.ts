
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
export const convertGoogleDriveUrl = (url?: string, type: 'image' | 'audio' = 'image'): string => {
    const fallbackImage = 'https://placehold.co/100x100/1f2937/4b5563?text=N/A';
    if (!url || typeof url !== 'string' || url.trim() === '') {
        return type === 'image' ? fallbackImage : '';
    }

    const trimmedUrl = url.trim();

    // If it's already a direct Google content URL, return it
    if (trimmedUrl.includes('lh3.googleusercontent.com') || 
        trimmedUrl.includes('googleusercontent.com/d/') || 
        (trimmedUrl.includes('drive.google.com') && (trimmedUrl.includes('uc?') || trimmedUrl.includes('thumbnail?')))) {
        
        // Handle Google Auth Profile Pictures (lh3)
        if (trimmedUrl.includes('lh3.googleusercontent.com')) {
            // If it already has a size parameter like =s96-c, don't append another one
            if (trimmedUrl.includes('=s')) return trimmedUrl;
            return `${trimmedUrl}=s1000`;
        }
        return trimmedUrl;
    }

    // Advanced ID Extraction
    let fileId = '';
    
    if (trimmedUrl.includes('drive.google.com') || trimmedUrl.includes('docs.google.com')) {
        // 1. Standard patterns: /d/ID, id=ID, open?id=ID, file/d/ID, uc?id=ID
        const idRegex = /(?:id=|d\/|file\/d\/|open\?id=|thumbnail\?id=|uc\?id=)([^/?&]+)/;
        const match = trimmedUrl.match(idRegex);
        if (match && match[1]) {
            fileId = match[1];
        } else {
            // 2. Fallback: Search for any 25-50 character alphanumeric string containing underscores or hyphens
            // Google Drive IDs are usually exactly 33 chars but can vary
            const genericIdRegex = /[a-zA-Z0-9_-]{25,50}/;
            const genericMatch = trimmedUrl.match(genericIdRegex);
            if (genericMatch) {
                fileId = genericMatch[0];
            }
        }
    } else if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmedUrl)) {
        // 3. Handle pure ID strings
        fileId = trimmedUrl;
    }

    if (fileId) {
        if (type === 'image') {
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        } else {
            return `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
    }

    // Handle non-Google URLs
    if (trimmedUrl.startsWith('http') || trimmedUrl.startsWith('data:')) {
        return trimmedUrl;
    }

    return type === 'image' ? fallbackImage : '';
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
