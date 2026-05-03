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
    const [handBox, setHandBox] = useState<any>(null);
    const [handKeypoints, setHandKeypoints] = useState<any[]>([]);
    const [faceBox, setFaceBox] = useState<any>(null);
    const [detectedGesture, setDetectedGesture] = useState<'none' | 'five_fingers' | 'thumbs_up' | 'fist'>('none');
    const lastManualZoomTime = useRef(0);
    const isActive = useRef(true);
    const targetZoomRef = useRef(currentZoom);
    const smoothedZoomRef = useRef(currentZoom);

    const notifyManualZoom = useCallback(() => {
        lastManualZoomTime.current = Date.now();
        setIsAutoZooming(false);
        targetZoomRef.current = currentZoom;
        smoothedZoomRef.current = currentZoom;
    }, [currentZoom]);

    // Initialize detector on mount
    useEffect(() => {
        packageDetector.init().catch(err => console.error("Vision Init Error:", err));
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
            
            // Set detected gesture and hand tracking box
            setDetectedGesture(result.gesture || 'none');
            setHandBox(result.isHand ? result.box : null);
            setHandKeypoints(result.keypoints || []);
            setFaceBox(result.faceBox || null);
            
            // Priority 1: If Barcode found, calculate optimal zoom to fill ~30% of height
            if (result.barcodeBox) {
                const box = result.barcodeBox;
                const targetFillRatio = 0.35; // Target filling 35% of the screen height
                const currentFillRatio = box.h / videoElement.videoHeight;
                
                // Calculate zoom needed to reach target fill ratio
                const zoomFactor = targetFillRatio / currentFillRatio;
                let idealZoom = currentZoom * zoomFactor;
                
                // Clamp zoom to reasonable limits (1.0 to 5.0)
                idealZoom = Math.max(1, Math.min(5, idealZoom));
                
                targetZoomRef.current = idealZoom;
                setTrackingBox(box);
                setIsAutoZooming(true);
            } 
            // Priority 2: If candidate points found (potential QR), hunt zoom slightly
            else if (result.candidates && result.candidates.length > 0) {
                if (targetZoomRef.current < 2.0) {
                    targetZoomRef.current = 2.2;
                }
            }
            // Priority 3: Slowly reset zoom if nothing found
            else {
                if (targetZoomRef.current > 1.2) {
                    targetZoomRef.current -= 0.02; // Very slow zoom out
                } else {
                    targetZoomRef.current = 1.0;
                    setIsAutoZooming(false);
                }
                setTrackingBox(null);
            }

            // --- SMOOTH INTERPOLATION ---
            const lerpFactor = 0.08; // Adjust for smoothness vs speed
            const diff = targetZoomRef.current - smoothedZoomRef.current;
            
            if (Math.abs(diff) > 0.01) {
                smoothedZoomRef.current += diff * lerpFactor;
                const finalZoom = Number(smoothedZoomRef.current.toFixed(2));
                
                if (finalZoom !== currentZoom) {
                    setZoom?.(finalZoom);
                    applyZoomExternal?.(finalZoom);
                }
            }

            frameId = requestAnimationFrame(processFrame);
        };

        frameId = requestAnimationFrame(processFrame);
        return () => cancelAnimationFrame(frameId);
    }, [videoElement, track, currentZoom, setZoom, applyZoomExternal]);

    return { 
        zoom: currentZoom,
        trackingBox, 
        handBox,
        handKeypoints,
        faceBox,
        isAutoZooming, 
        notifyManualZoom,
        detectedGesture
    };
};