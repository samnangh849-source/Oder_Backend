
import { useState, useEffect, useRef, useCallback } from 'react';
import { isIOS } from '../utils/platform';
import { useSmartZoom } from './useSmartZoom';

interface ScannerConfig {
    fps: number;
    qrbox: number | { width: number, height: number };
    aspectRatio?: number;
    videoConstraints?: any;
    experimentalFeatures?: any;
    disableFlip?: boolean;
}

export const useBarcodeScanner = (
    elementId: string, 
    onScan: (decodedText: string) => void,
    scanMode: 'single' | 'increment',
    options: { fps?: number, disableScanner?: boolean } = {}
) => {
    const { fps = 30, disableScanner = false } = options;
    const scannerRef = useRef<any>(null);
    const isTransitioning = useRef(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Zoom & Camera Controls
    const [zoom, setZoom] = useState(1);
    const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isTorchSupported, setIsTorchSupported] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);
    const beepSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3')); // Modern Soft Tap for scanner beep

    // --- Core Camera Functions ---

    const switchCamera = useCallback(() => {
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    }, []);

    const getActiveTrack = (): MediaStreamTrack | null => {
        if (trackRef.current && trackRef.current.readyState === 'live') return trackRef.current;
        if (scannerRef.current?.html5QrCode) {
            const track = scannerRef.current.html5QrCode.getRunningTrackCamera?.();
            if (track) return track;
        }
        const videoElement = document.querySelector(`#${elementId} video`) as HTMLVideoElement;
        if (videoElement && videoElement.srcObject) {
            const stream = videoElement.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            if (track) return track;
        }
        return null;
    };

    const applyConstraints = useCallback(async (constraints: any) => {
        const track = getActiveTrack();
        if (!track) return;
        const isIosDevice = isIOS();
        try {
            await track.applyConstraints(constraints);
        } catch (e) {
            // iOS Zoom Fix
            if (constraints.zoom && isIosDevice) {
                try {
                    await track.applyConstraints({ advanced: [{ zoom: constraints.zoom }] } as any);
                } catch (e2) {}
            }
        }
    }, []);

    // --- Smooth Zoom Logic ---
    const setSmoothZoom = useCallback(async (targetZoom: number) => {
        const track = getActiveTrack();
        if (!track) return;
        
        let z = targetZoom;
        if (zoomCapabilities) {
            z = Math.max(zoomCapabilities.min, Math.min(targetZoom, zoomCapabilities.max));
        }
        setZoom(z);
        await applyConstraints({ zoom: z });
    }, [zoomCapabilities, applyConstraints]);

    // --- Custom Smart Zoom Hook (Will auto-disable on iOS internally) ---
    const { trackingBox, isAutoZooming, notifyManualZoom } = useSmartZoom(
        videoRef.current,
        trackRef.current,
        zoom,
        setZoom, 
        (z) => applyConstraints({ zoom: z }) 
    );

    const handleManualZoom = useCallback((z: number) => {
        notifyManualZoom();
        setSmoothZoom(z);
    }, [notifyManualZoom, setSmoothZoom]);

    // --- Torch Logic ---
    const toggleTorch = useCallback(async () => {
        const track = getActiveTrack();
        if (!track) return;
        if (isIOS()) return; 

        const newStatus = !isTorchOn;
        try {
            await track.applyConstraints({ advanced: [{ torch: newStatus } as any] });
            setIsTorchOn(newStatus);
        } catch (err) {
            try {
                await track.applyConstraints({ torch: newStatus } as any);
                setIsTorchOn(newStatus);
            } catch(e2) { }
        }
    }, [isTorchOn]);

    // --- Focus Logic ---
    const triggerFocus = useCallback(async () => {
        const track = getActiveTrack();
        if (!track) return;
        try { await applyConstraints({ focusMode: 'continuous' }); } catch (e) {}
        try {
            // @ts-ignore
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            // @ts-ignore
            if (capabilities.focusMode && capabilities.focusMode.includes('single-shot')) {
                await applyConstraints({ focusMode: 'single-shot' });
            }
        } catch (err) { }
    }, [applyConstraints]);

    // --- File Scan Logic ---
    const scanFromImage = useCallback(async (file: File): Promise<string> => {
        if (!scannerRef.current) throw new Error("Scanner not initialized");
        return await scannerRef.current.scanFile(file, true);
    }, []);

    useEffect(() => {
        // @ts-ignore
        if (!window.Html5Qrcode) {
            setError("Scanner library missing.");
            return;
        }

        const initScanner = async () => {
            if (isTransitioning.current) return;

            if (disableScanner) {
                setIsInitializing(false);
                if (scannerRef.current && scannerRef.current.isScanning) {
                    isTransitioning.current = true;
                    try {
                        await scannerRef.current.stop();
                        await scannerRef.current.clear();
                    } catch (e) {
                        console.warn("Cleanup during disable failed:", e);
                    } finally {
                        isTransitioning.current = false;
                    }
                }
                return;
            }

            isTransitioning.current = true;
            setIsInitializing(true);
            setIsTorchOn(false);
            setZoom(1);
            
            try {
                // Pre-cleanup
                if (scannerRef.current) {
                    if (scannerRef.current.isScanning) {
                        await scannerRef.current.stop();
                    }
                    await scannerRef.current.clear();
                }

                // @ts-ignore
                const html5QrCode = new window.Html5Qrcode(elementId);
                scannerRef.current = html5QrCode;

                const isIosDevice = isIOS();

                // *** CRITICAL IOS CONFIGURATION ***
                const videoConstraints = isIosDevice 
                    ? {
                        facingMode: "environment",
                        width: { min: 1280, ideal: 1920 }, 
                        height: { min: 720, ideal: 1080 },
                      }
                    : {
                        facingMode: facingMode,
                        width: { min: 640, ideal: 1280, max: 1920 },
                        height: { min: 480, ideal: 720, max: 1080 },
                        frameRate: { ideal: 60, min: 30 }, // High FPS for Android
                        aspectRatio: 1.777777778, // 16:9 for Android
                        focusMode: "continuous"
                      };

                const config: ScannerConfig = { 
                    fps: fps,
                    qrbox: { width: 280, height: 280 },
                    ...(isIosDevice ? {} : { aspectRatio: 1.777777778 }),
                    disableFlip: false,
                    experimentalFeatures: {
                        // Force Native BarcodeDetector on non-iOS
                        useBarCodeDetectorIfSupported: !isIosDevice 
                    },
                    videoConstraints: videoConstraints
                };

                let lastScanTime = 0;
                const onScanSuccess = (decodedText: string) => {
                    const now = Date.now();
                    if (now - lastScanTime < 1500) return;
                    lastScanTime = now;
                    
                    beepSound.current.currentTime = 0;
                    beepSound.current.play().catch(() => {});
                    if (navigator.vibrate) navigator.vibrate(50);
                    
                    onScan(decodedText);
                };

                await html5QrCode.start({ facingMode: facingMode }, config, onScanSuccess, undefined);
                
                const videoEl = document.querySelector(`#${elementId} video`) as HTMLVideoElement;
                if (videoEl) {
                    videoRef.current = videoEl;
                    videoEl.setAttribute('playsinline', 'true'); 
                    videoEl.style.objectFit = 'cover'; 
                }

                const track = getActiveTrack();
                if (track) {
                    trackRef.current = track;
                    // @ts-ignore
                    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                    const settings = track.getSettings();

                    if (!isIosDevice && 'torch' in capabilities) {
                        setIsTorchSupported(true);
                    } else {
                        setIsTorchSupported(false);
                    }

                    if (isIosDevice) {
                        // @ts-ignore
                        const minZ = settings.zoom ? Math.min(settings.zoom, 1) : 1; 
                        setZoomCapabilities({ min: minZ >= 1 ? 1 : 0.5, max: 5, step: 0.1 });
                        // @ts-ignore
                        setZoom(settings.zoom || 1);
                    } 
                    // @ts-ignore
                    else if (capabilities.zoom) {
                        setZoomCapabilities({
                            // @ts-ignore
                            min: capabilities.zoom.min, 
                            // @ts-ignore
                            max: capabilities.zoom.max, 
                            // @ts-ignore
                            step: capabilities.zoom.step
                        });
                        // @ts-ignore
                        setZoom(settings.zoom || capabilities.zoom.min);
                    } else {
                        setZoomCapabilities(null);
                    }
                }

                setIsInitializing(false);

            } catch (err: any) {
                console.error("Camera Start Error:", err);
                const errMsg = String(err);
                if (!errMsg.includes("already under transition")) {
                    setError(err.name === 'NotAllowedError' ? "Camera permission denied." : "Camera error.");
                }
                setIsInitializing(false);
            } finally {
                isTransitioning.current = false;
            }
        };

        initScanner();

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning && !isTransitioning.current) {
                scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
            }
        };
    }, [facingMode, disableScanner]);

    return {
        isInitializing,
        error,
        zoom,
        zoomCapabilities,
        handleZoomChange: handleManualZoom,
        isTorchOn,
        isTorchSupported,
        toggleTorch,
        trackingBox, 
        isAutoZooming, 
        triggerFocus,
        switchCamera,
        facingMode,
        scanFromImage
    };
};
