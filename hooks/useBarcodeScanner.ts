
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
    const [zoom, setZoom] = useState(2); // 🚀 Default to 2x for easier alignment
    const [zoomCapabilities, setZoomCapabilities] = useState<{ min: number; max: number; step: number } | null>(null);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isTorchSupported, setIsTorchSupported] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);
    const beepSound = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'));

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
            if (constraints.zoom && isIosDevice) {
                try {
                    await track.applyConstraints({ advanced: [{ zoom: constraints.zoom }] } as any);
                } catch (e2) {}
            }
        }
    }, [elementId]);

    // --- Smooth Zoom Logic ---
    const setSmoothZoom = useCallback(async (targetZoom: number) => {
        const track = getActiveTrack();
        
        let z = targetZoom;
        if (zoomCapabilities) {
            z = Math.max(zoomCapabilities.min, Math.min(targetZoom, zoomCapabilities.max));
            setZoom(z);
            await applyConstraints({ zoom: z });
        } else {
            // Virtual Zoom Fallback for Desktop
            const vZoom = Math.max(1, Math.min(4, targetZoom));
            setZoom(vZoom);
            
            const videoEl = document.querySelector(`#${elementId} video`) as HTMLVideoElement;
            if (videoEl) {
                videoEl.style.transform = `scale(${vZoom})`;
                videoEl.style.transformOrigin = 'center center';
                videoEl.style.transition = 'transform 0.2s ease-out';
            }
        }
    }, [zoomCapabilities, applyConstraints, elementId]);

    const { isAutoZooming, notifyManualZoom } = useSmartZoom(
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
        if (!track || isIOS()) return;
        const newStatus = !isTorchOn;
        try {
            await track.applyConstraints({ advanced: [{ torch: newStatus } as any] });
            setIsTorchOn(newStatus);
        } catch (err) {}
    }, [isTorchOn]);

    // --- Focus Logic ---
    const triggerFocus = useCallback(async () => {
        const track = getActiveTrack();
        if (!track) return;
        try {
            // @ts-ignore
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                await applyConstraints({ focusMode: 'continuous' });
            }
        } catch (err) { }
    }, [applyConstraints]);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current && scannerRef.current.isScanning && !isTransitioning.current) {
            isTransitioning.current = true;
            try {
                // @ts-ignore
                if (scannerRef.current._focusInterval) clearInterval(scannerRef.current._focusInterval);
                
                // Explicitly stop tracks before calling scanner.stop() to be sure
                const track = getActiveTrack();
                if (track) {
                    track.stop();
                }
                
                // Also stop any tracks from the video element directly
                const videoElement = document.querySelector(`#${elementId} video`) as HTMLVideoElement;
                if (videoElement && videoElement.srcObject) {
                    const stream = videoElement.srcObject as MediaStream;
                    stream.getTracks().forEach(t => t.stop());
                }

                await scannerRef.current.stop();
                await scannerRef.current.clear();
                scannerRef.current = null;
                trackRef.current = null;
                videoRef.current = null;
            } catch (e) {
                console.error("Error stopping scanner:", e);
            } finally {
                isTransitioning.current = false;
            }
        }
    }, [elementId]);

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
                    } finally {
                        isTransitioning.current = false;
                    }
                }
                return;
            }

            isTransitioning.current = true;
            setIsInitializing(true);
            setIsTorchOn(false);
            
            try {
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

                // *** HIGH-PERFORMANCE DESKTOP OPTIMIZATION ***
                const videoConstraints = isIosDevice 
                    ? {
                        facingMode: "environment",
                        width: { min: 1280, ideal: 1920 }, 
                        height: { min: 720, ideal: 1080 },
                      }
                    : {
                        facingMode: facingMode,
                        // Request 1080p for superior clarity on dense QR codes
                        width: { min: 1280, ideal: 1920 },
                        height: { min: 720, ideal: 1080 },
                        frameRate: { ideal: 30 },
                        focusMode: "continuous"
                      };

                const config: any = { 
                    fps: 30, // Standard smooth FPS
                    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                        // Larger box for high-res scanning
                        const size = Math.floor(minEdge * 0.8); 
                        return { width: size, height: size };
                    },
                    disableFlip: false,
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true // Native Chrome Acceleration
                    },
                    // Focus purely on QR codes to save CPU cycles
                    formatsToSupport: [ 0 ], // 0 = Html5QrcodeSupportedFormats.QR_CODE
                    videoConstraints: videoConstraints
                };

                let lastScanTime = 0;
                const onScanSuccess = (decodedText: string) => {
                    const now = Date.now();
                    // Instant response for first scan
                    if (now - lastScanTime < 500) return; 
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
                    
                    // 🚀 Aggressive focus trigger every 2s during scan
                    const focusInterval = setInterval(() => {
                        if (scannerRef.current?.isScanning) triggerFocus();
                    }, 2000);
                    // @ts-ignore
                    scannerRef.current._focusInterval = focusInterval;
                }

                const track = getActiveTrack();
                if (track) {
                    trackRef.current = track;
                    // @ts-ignore
                    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
                    const settings = track.getSettings();

                    setIsTorchSupported(!isIosDevice && 'torch' in capabilities);

                    if (isIosDevice) {
                        // @ts-ignore
                        const minZ = settings.zoom ? Math.min(settings.zoom, 1) : 1; 
                        setZoomCapabilities({ min: minZ >= 1 ? 1 : 0.5, max: 5, step: 0.1 });
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
                    } else {
                        setZoomCapabilities(null);
                    }
                    
                    // 🚀 Apply initial 2x zoom
                    setSmoothZoom(2);
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
                // @ts-ignore
                if (scannerRef.current._focusInterval) clearInterval(scannerRef.current._focusInterval);
                scannerRef.current.stop().then(() => scannerRef.current.clear()).catch(() => {});
            }
        };
    }, [facingMode, disableScanner, elementId, fps]);

    return {
        isInitializing,
        error,
        zoom,
        zoomCapabilities,
        handleZoomChange: handleManualZoom,
        isTorchOn,
        isTorchSupported,
        toggleTorch,
        isAutoZooming, 
        triggerFocus,
        switchCamera,
        stopScanner,
        facingMode,
        scanFromImage,
        trackingBox: null
    };
};
