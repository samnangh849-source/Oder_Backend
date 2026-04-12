import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import jsQR from 'jsqr';

export interface DetectionResult {
    found: boolean;
    box?: { x: number, y: number, w: number, h: number };
    keypoints?: handPoseDetection.Keypoint[]; 
    stability: number;
    type: 'box' | 'bag' | 'general';
    gesture?: 'none' | 'five_fingers' | 'thumbs_up';
    confidence: number;
    isHand: boolean;
    barcodeBox?: { x: number, y: number, w: number, h: number } | null;
    barcodeValue?: string;
    barcodeFormat?: string;
    candidates?: { x: number, y: number }[];
}

export class PackageDetector {
    private detector: handPoseDetection.HandDetector | null = null;
    private barcodeDetector: any = null;
    private isInitializing: boolean = false;
    
    private lastBox: { x: number, y: number, w: number, h: number } | null = null;
    private smoothingFactor = 0.2; 

    private scanCanvas: HTMLCanvasElement | null = null;
    private scanCtx: CanvasRenderingContext2D | null = null;
    private frameCount = 0;
    private lastBarcodeBox: { x: number, y: number, w: number, h: number } | null = null;
    private lastBarcodeValue = '';
    private lastBarcodeFormat = '';

    private getScanContext(video: HTMLVideoElement) {
        if (!this.scanCanvas) {
            this.scanCanvas = document.createElement('canvas');
            this.scanCtx = this.scanCanvas.getContext('2d', { willReadFrequently: true });
        }
        const scale = 1.0; // Use maximum resolution for QR accuracy
        this.scanCanvas.width = video.videoWidth * scale;
        this.scanCanvas.height = video.videoHeight * scale;
        if (this.scanCtx) {
            this.scanCtx.drawImage(video, 0, 0, this.scanCanvas.width, this.scanCanvas.height);
        }
        return { ctx: this.scanCtx, width: this.scanCanvas.width, height: this.scanCanvas.height, scale };
    }

    async init() {
        if (this.detector || this.isInitializing) return;
        this.isInitializing = true;
        try {
            if ('BarcodeDetector' in window) {
                try {
                    // @ts-ignore
                    this.barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'qr', 'code_128', 'ean_13', 'data_matrix', 'code_39', 'upc_a', 'upc_e'] });
                } catch (e) { console.warn("BarcodeDetector formats unsupported"); }
            }
            console.log("AI: Initializing WebGL backend...");
            await tf.ready();
            await tf.setBackend('webgl');
            
            console.log("AI: Loading HandPose model...");
            const model = handPoseDetection.SupportedModels.MediaPipeHands;
            const detectorConfig: handPoseDetection.MediaPipeHandsMediaPipeModelConfig = {
                runtime: 'mediapipe',
                solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/hands`,
                modelType: 'lite', 
            };
            this.detector = await handPoseDetection.createDetector(model, detectorConfig);
            console.log("AI: Core Ready.");
        } catch (error) {
            console.error("AI Core Error:", error);
        } finally {
            this.isInitializing = false;
        }
    }

    isReady() { return !!this.detector; }

    private smoothBox(newBox: { x: number, y: number, w: number, h: number }) {
        if (!this.lastBox) {
            this.lastBox = newBox;
            return newBox;
        }
        this.lastBox = {
            x: this.lastBox.x + (newBox.x - this.lastBox.x) * this.smoothingFactor,
            y: this.lastBox.y + (newBox.y - this.lastBox.y) * this.smoothingFactor,
            w: this.lastBox.w + (newBox.w - this.lastBox.w) * this.smoothingFactor,
            h: this.lastBox.h + (newBox.h - this.lastBox.h) * this.smoothingFactor,
        };
        return this.lastBox;
    }

    async detect(video: HTMLVideoElement): Promise<DetectionResult> {
        if (!video.videoWidth || video.paused || video.ended) {
            return { found: false, stability: 0, type: 'general', gesture: 'none', confidence: 0, isHand: false };
        }

        let gestureDetected: 'none' | 'five_fingers' | 'thumbs_up' = 'none';
        let rawBox: { x: number, y: number, w: number, h: number } | null = null;
        let keypoints: handPoseDetection.Keypoint[] | undefined = undefined;
        let isHand = false;
        let confidence = 0;

        this.frameCount++;
        
        // Process Barcodes every frame for maximum responsiveness
        let foundBox = null;
        let foundValue = '';
        let foundFormat = '';

        if (this.barcodeDetector) {
            try {
                const barcodes = await this.barcodeDetector.detect(video);
                if (barcodes.length > 0) {
                    const b = barcodes[0];
                    const box = b.boundingBox;
                    foundBox = { x: box.left, y: box.top, w: box.width, h: box.height };
                    foundValue = b.rawValue;
                    // Normalize format
                    const fmt = b.format.toLowerCase();
                    foundFormat = (fmt === 'qr_code' || fmt === 'qr') ? 'qr_code' : fmt;
                }
            } catch (err) {}
        }

        if (!foundBox && jsQR) {
            const { ctx, width, height, scale } = this.getScanContext(video);
            if (ctx) {
                const imageData = ctx.getImageData(0, 0, width, height);
                const code = jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
                if (code) {
                    const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = code.location;
                    const minX = Math.min(topLeftCorner.x, bottomLeftCorner.x) / scale;
                    const minY = Math.min(topLeftCorner.y, topRightCorner.y) / scale;
                    const maxX = Math.max(topRightCorner.x, bottomRightCorner.x) / scale;
                    const maxY = Math.max(bottomLeftCorner.y, bottomRightCorner.y) / scale;
                    foundBox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
                    foundValue = code.data;
                    foundFormat = 'qr_code';
                }
            }
        }

        this.lastBarcodeBox = foundBox;
        this.lastBarcodeValue = foundValue;
        this.lastBarcodeFormat = foundFormat;

        // --- SMART QR CANDIDATE DETECTION (For Auto-Zoom) ---
        let candidates: { x: number, y: number }[] = [];
        if (!foundBox && this.frameCount % 2 === 0) { // Scan for candidates every other frame
            const { ctx, width, height, scale } = this.getScanContext(video);
            if (ctx) {
                const data = ctx.getImageData(0, 0, width, height).data;
                // Look for "finder patterns" heuristic (simplified contrast-based search)
                // In a real scenario, we might use a lightweight ML model or 
                // specialized edge detection. For now, we use a simple grid search
                // for high-variance regions which often indicate barcodes/QR codes.
                const step = Math.floor(width / 20);
                for (let y = step; y < height - step; y += step) {
                    for (let x = step; x < width - step; x += step) {
                        const idx = (y * width + x) * 4;
                        const brightness = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                        // Simplistic "interest point" detection
                        if (brightness < 100) { // Dark pixel (potential QR module)
                            candidates.push({ x: x / scale, y: y / scale });
                            if (candidates.length > 5) break; 
                        }
                    }
                    if (candidates.length > 5) break;
                }
            }
        }

        if (this.detector) {
            try {
                const hands = await this.detector.estimateHands(video, { flipHorizontal: false });
                if (hands.length > 0) {
                    const hand = hands[0];
                    isHand = true;
                    confidence = hand.score || 0.8;
                    keypoints = hand.keypoints; // Capture all 21 keypoints
                    
                    const xs = hand.keypoints.map(kp => kp.x);
                    const ys = hand.keypoints.map(kp => kp.y);
                    const minX = Math.min(...xs); 
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys); 
                    const maxY = Math.max(...ys);
                    
                    rawBox = {
                        x: minX - 40,
                        y: minY - 40,
                        w: (maxX - minX) + 80,
                        h: (maxY - minY) + 80
                    };

                    const k = hand.keypoints;
                    const isExtended = (tip: number, mid: number, base: number) => k[tip].y < k[mid].y && k[mid].y < k[base].y;
                    
                    const openPalm = isExtended(8, 7, 5) && isExtended(12, 11, 9) && isExtended(16, 15, 13) && isExtended(20, 19, 17);
                    const thumbUp = k[4].y < k[3].y && k[4].y < k[2].y && !openPalm;

                    if (openPalm) gestureDetected = 'five_fingers';
                    else if (thumbUp) gestureDetected = 'thumbs_up';
                }
            } catch (err) { /* silent fail */ }
        }

        if (!isHand) {
            rawBox = { x: video.videoWidth * 0.25, y: video.videoHeight * 0.25, w: video.videoWidth * 0.5, h: video.videoHeight * 0.5 };
            confidence = 0.5;
        }

        return {
            found: true,
            isHand: isHand,
            type: isHand ? 'general' : 'box',
            box: rawBox ? this.smoothBox(rawBox) : undefined,
            keypoints,
            stability: isHand ? 0.95 : 0.6,
            gesture: gestureDetected,
            confidence,
            barcodeBox: this.lastBarcodeBox,
            barcodeValue: this.lastBarcodeValue,
            barcodeFormat: this.lastBarcodeFormat,
            candidates: candidates.length > 0 ? candidates : undefined
        };
    }
}

export const packageDetector = new PackageDetector();
