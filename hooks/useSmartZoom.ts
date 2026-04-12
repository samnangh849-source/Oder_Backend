import { useState, useCallback, useRef, useEffect } from 'react';
import { packageDetector } from '../utils/visionAlgorithm';

export const useSmartZoom = (
    videoElement?: HTMLVideoElement | null,
    track?: MediaStreamTrack | null,
    currentZoom: number = 1,
    setZoom?: (z: number) => void,
    applyZoomExternal?: (z: number) => void
) => {
    const [isAutoZooming, setIsAutoZooming] = useState(false);
    const [trackingBox, setTrackingBox] = useState<any>(null);
    const lastManualZoomTime = useRef(0);
    const isActive = useRef(true);

    const notifyManualZoom = useCallback(() => {
        lastManualZoomTime.current = Date.now();
        setIsAutoZooming(false);
    }, []);

    // --- AUTO ZOOM LOGIC ---
    useEffect(() => {
        if (!videoElement || !track || !isActive.current) return;

        let frameId: number;
        const processFrame = async () => {
            // Pause auto-zoom if user recently touched manual controls (5s cooldown)
            if (Date.now() - lastManualZoomTime.current < 5000) {
                frameId = requestAnimationFrame(processFrame);
                return;
            }

            const result = await packageDetector.detect(videoElement);
            
            // Priority 1: If Barcode found but too small, zoom in
            if (result.barcodeBox) {
                const box = result.barcodeBox;
                const videoArea = videoElement.videoWidth * videoElement.videoHeight;
                const boxArea = box.w * box.h;
                const ratio = boxArea / videoArea;

                if (ratio < 0.05) { // Too small (less than 5% of screen)
                    const newZoom = Math.min(currentZoom + 0.5, 5);
                    if (newZoom !== currentZoom) {
                        setIsAutoZooming(true);
                        setZoom?.(newZoom);
                        applyZoomExternal?.(newZoom);
                    }
                }
                setTrackingBox(box);
            } 
            // Priority 2: If candidate points found (potential QR), zoom in slightly to "hunt"
            else if (result.candidates && result.candidates.length > 0) {
                if (currentZoom < 2.5) { // Hunt zoom
                    setIsAutoZooming(true);
                    const nextZoom = currentZoom + 0.2;
                    setZoom?.(nextZoom);
                    applyZoomExternal?.(nextZoom);
                }
            }
            // Priority 3: Reset zoom if nothing found for a while
            else {
                if (currentZoom > 2 && !result.barcodeBox) {
                    // Slow reset
                    const nextZoom = currentZoom - 0.05;
                    setZoom?.(nextZoom);
                    applyZoomExternal?.(nextZoom);
                }
                setTrackingBox(null);
                if (currentZoom <= 2.1) setIsAutoZooming(false);
            }

            frameId = requestAnimationFrame(processFrame);
        };

        frameId = requestAnimationFrame(processFrame);
        return () => cancelAnimationFrame(frameId);
    }, [videoElement, track, currentZoom, setZoom, applyZoomExternal]);

    return { 
        zoom: currentZoom,
        trackingBox, 
        isAutoZooming, 
        notifyManualZoom 
    };
};