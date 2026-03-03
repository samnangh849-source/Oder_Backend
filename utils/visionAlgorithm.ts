import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

export interface DetectionResult {
    found: boolean;
    box?: { x: number, y: number, w: number, h: number };
    stability: number;
    type: 'box' | 'bag' | 'general';
    gesture?: 'none' | 'five_fingers' | 'thumbs_up';
}

export class PackageDetector {
    private detector: handPoseDetection.HandDetector | null = null;
    private isInitializing: boolean = false;

    /**
     * Initializes the MediaPipe Hands detector.
     */
    async init() {
        if (this.detector || this.isInitializing) return;
        this.isInitializing = true;
        try {
            console.log("AI: Initializing Hand Tracking Model...");
            const model = handPoseDetection.SupportedModels.MediaPipeHands;
            const detectorConfig: handPoseDetection.MediaPipeHandsMediaPipeConfig = {
                runtime: 'mediapipe',
                solutionPath: `https://cdn.jsdelivr.net/npm/@mediapipe/hands`,
                modelType: 'full',
            };
            this.detector = await handPoseDetection.createDetector(model, detectorConfig);
            console.log("AI: Hand Tracking Model Ready.");
        } catch (error) {
            console.error("AI Initialization Failed:", error);
        } finally {
            this.isInitializing = false;
        }
    }

    isReady() {
        return !!this.detector;
    }

    /**
     * Analyzes video frame to find objects of interest and hand gestures.
     */
    async detect(video: HTMLVideoElement): Promise<DetectionResult> {
        if (!video.videoWidth || video.paused || video.ended) {
            return { found: false, stability: 0, type: 'general', gesture: 'none' };
        }

        let gestureDetected: 'none' | 'five_fingers' | 'thumbs_up' = 'none';
        let handBox: { x: number, y: number, w: number, h: number } | undefined = undefined;

        // 1. Hand Gesture & Position Detection
        if (this.detector) {
            try {
                const hands = await this.detector.estimateHands(video, { flipHorizontal: false });
                if (hands.length > 0) {
                    const hand = hands[0];
                    
                    // Calculate real bounding box from keypoints
                    const xs = hand.keypoints.map(kp => kp.x);
                    const ys = hand.keypoints.map(kp => kp.y);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    
                    // Add padding to the box
                    handBox = {
                        x: minX - 20,
                        y: minY - 20,
                        w: (maxX - minX) + 40,
                        h: (maxY - minY) + 40
                    };

                    if (hand.keypoints.length >= 20) {
                        const k = hand.keypoints;
                        
                        // Detect Five Fingers (Open Palm)
                        const isIndexUp = k[8].y < k[5].y;
                        const isMiddleUp = k[12].y < k[9].y;
                        const isRingUp = k[16].y < k[13].y;
                        const isPinkyUp = k[20].y < k[17].y;
                        const isThumbUp = k[4].y < k[2].y; // Vertical thumb check

                        if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
                            gestureDetected = 'five_fingers';
                        } 
                        // Detect Thumbs Up (Confirmation)
                        else if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
                            // Ensure thumb is significantly higher than other fingers
                            if (k[4].y < k[5].y - 30) {
                                gestureDetected = 'thumbs_up';
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn("Hand estimation failed:", err);
            }
        } else if (!this.isInitializing) {
            this.init();
        }

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        
        return {
            found: !!handBox,
            type: 'general',
            box: handBox || {
                x: vw * 0.2,
                y: vh * 0.2,
                w: vw * 0.6,
                h: vh * 0.6
            },
            stability: handBox ? 0.95 : 0.5,
            gesture: gestureDetected
        };
    }
}

export const packageDetector = new PackageDetector();