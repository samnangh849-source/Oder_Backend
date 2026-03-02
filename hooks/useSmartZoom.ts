import { useState, useCallback, useRef } from 'react';

export const useSmartZoom = () => {
    const [zoom, setZoom] = useState(1);
    const [capabilities, setCapabilities] = useState<any>(null);

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
                setZoom(clamped);
                setCapabilities(caps);
            }
        } catch (e) {
            console.warn("Hardware zoom not supported or failed", e);
        }
    }, []);

    return { zoom, capabilities, applyZoom };
};