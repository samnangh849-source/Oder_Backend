
import { useState, useCallback } from 'react';
import { compressImage } from '../utils/imageCompressor';
import { localDbService } from '../services/localDbService';
import { CacheService, CACHE_KEYS } from '../services/cacheService';
import { WEB_APP_URL } from '../constants';

interface UseOptimisticImageProps {
    onUploadSuccess?: (id: string, driveUrl: string) => void;
    onUploadError?: (id: string, error: any) => void;
}

export const useOptimisticImage = (props?: UseOptimisticImageProps) => {
    const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());

    /**
     * Prepare an image for optimistic display and upload.
     * Returns a unique ID and a local preview URL.
     */
    const prepareImage = useCallback(async (file: File, mode: 'balanced' | 'high-detail' = 'balanced') => {
        const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 1. Compress
        const blob = await compressImage(file, mode);
        
        // 2. Store in local IndexedDB for persistence
        await localDbService.saveImage(id, blob);
        
        // 3. Create preview URL
        const previewUrl = URL.createObjectURL(blob);
        
        return { id, previewUrl, blob };
    }, []);

    /**
     * Start the actual background upload to the Go Backend (Proxy to Apps Script)
     */
    const startUpload = useCallback(async (
        id: string,
        blob: Blob,
        fileName: string,
        metadata: {
            orderId?: string;
            targetColumn?: string;
            userName?: string;
            movieId?: string;
            sheetName?: string;
            primaryKey?: any;
            newData?: Record<string, any>;
        }
    ) => {
        setUploadingIds(prev => new Set(prev).add(id));

        try {
            // Convert blob to base64 (Backend expects base64 in HandleImageUploadProxy)
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                    const base64String = reader.result as string;
                    // Remove "data:image/jpeg;base64," prefix
                    const base64Content = base64String.split(',')[1];
                    resolve(base64Content);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            const base64Data = await base64Promise;

            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';

            // Call the Go Backend Proxy
            const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'uploadImage',
                    fileData: base64Data,
                    fileName: fileName,
                    mimeType: blob.type || 'image/jpeg',
                    ...metadata
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                if (props?.onUploadSuccess) {
                    props.onUploadSuccess(id, result.url);
                }
                return result.url as string;
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload Error:', error);
            if (props?.onUploadError) {
                props.onUploadError(id, error);
            }
        } finally {
            setUploadingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [props]);

    return {
        prepareImage,
        startUpload,
        isUploading: (id: string) => uploadingIds.has(id),
    };
};
