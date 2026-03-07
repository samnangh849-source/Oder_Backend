import { useState, useCallback, useRef } from 'react';

export const useSmartZoom = (
    videoElement?: HTMLVideoElement | null,
    track?: MediaStreamTrack | null,
    currentZoom?: number,
    setZoom?: (z: number) => void,
    applyZoomExternal?: (z: number) => void
) => {
    const [isAutoZooming, setIsAutoZooming] = useState(false);
    const [trackingBox, setTrackingBox] = useState<any>(null);
    const [internalZoom, setInternalZoom] = useState(1);

    const notifyManualZoom = useCallback(() => {
        // Manual zoom notification logic
    }, []);

    const applyZoom = useCallback(async (videoTrack: MediaStreamTrack, level: number) => {
        try {
            const caps = videoTrack.getCapabilities() as any;
            if (caps.zoom) {
                const min = caps.zoom.min || 1;
                const max = caps.zoom.max || 10;
                const clamped = Math.max(min, Math.min(max, level));
                
                await videoTrack.applyConstraints({
                    advanced: [{ zoom: clamped } as any]
                });
                setInternalZoom(clamped);
            }
        } catch (e) {
            console.warn("Hardware zoom not supported or failed", e);
        }
    }, []);

    return { 
        zoom: currentZoom ?? internalZoom,
        applyZoom,
        trackingBox, 
        isAutoZooming, 
        notifyManualZoom 
    };
};