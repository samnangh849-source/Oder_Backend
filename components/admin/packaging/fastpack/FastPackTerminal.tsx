import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { useOptimisticImage } from '@/hooks/useOptimisticImage';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { useSmartZoom } from '@/hooks/useSmartZoom';
import { packageDetector, DetectionResult } from '@/utils/visionAlgorithm';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import OrderGracePeriod from '@/components/orders/OrderGracePeriod';
import { compressImage } from '@/utils/imageCompressor';
import { printViaIframe } from '@/utils/printUtils';

import OrderSummaryPanel from './OrderSummaryPanel';
import CameraViewport from './CameraViewport';
import ActionControls from './ActionControls';
import PrintLabelPage from '@/pages/PrintLabelPage';

type PackStep = 'VERIFYING' | 'LABELING' | 'CAPTURING';

interface FastPackTerminalProps {
    order: ParsedOrder | null;
    onClose: () => void;
    onSuccess: (tempUrl?: string) => void;
}

const FastPackTerminal: React.FC<FastPackTerminalProps> = ({ order, onClose, onSuccess }) => {
    const { currentUser, appData, previewImage: showFullImage, refreshData } = useContext(AppContext);
    
    // Workflow State
    const [step, setStep] = useState<PackStep>('VERIFYING');
    const [verifiedItems, setVerifiedItems] = useState<Record<string, number>>({}); 
    const hasAutoAdvanced = useRef({ verify: false, label: false });

    // Optimistic Image Hook
    const { prepareImage, startUpload } = useOptimisticImage({
        onUploadSuccess: (id, tempUrl) => {
            console.log("Packaging photo upload started:", id, tempUrl);
        },
        onUploadError: (id, err) => {
            alert("រូបភាពកញ្ចប់បញ្ជូនមិនបានជោគជ័យ: " + (err.message || err));
        }
    });

    const isOrderVerified = useMemo(() => {
        if (!order) return false;
        return order.Products.every(p => (verifiedItems[p.name] || 0) >= p.quantity);
    }, [order, verifiedItems]);
    
    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const countdownRef = useRef<number | null>(null);
    const countdownIntervalRef = useRef<any>(null);
    const aiLoopRef = useRef<number | null>(null);
    const isAiEnabledRef = useRef(true);
    const qrStabilityRef = useRef(0);
    const lastActionTime = useRef(0);
    const previewImageRef = useRef<string | null>(null);
    const uploadingRef = useRef(false);

    // AI & Camera State
    const [isAiEnabled, setIsAiEnabled] = useState(true);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [detection, setDetection] = useState<DetectionResult | null>(null);
    const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [zoom, setZoom] = useState(1.0);
    const [aiFrameCount, setAiFrameCount] = useState(0);

    // UI State
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [rawFile, setRawFile] = useState<File | null>(null);
    const [hasGeneratedLabel, setHasGeneratedLabel] = useState(false);
    const [showLabelEditor, setShowLabelEditor] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isAdvancingLabel, setIsAdvancingLabel] = useState(false);
    const [advancementProgress, setAdvancementProgress] = useState(0);
    
    // Grace Period / Undo State
    const { advancedSettings } = useContext(AppContext);
    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [isUndoing, setIsUndoing] = useState(false);
    const maxUndoTimer = advancedSettings.packagingGracePeriod || 5;

    useEffect(() => { isAiEnabledRef.current = isAiEnabled; }, [isAiEnabled]);
    useEffect(() => { uploadingRef.current = uploading; }, [uploading]);

    const verifyItem = (name: string) => {
        setVerifiedItems(prev => {
            const product = order?.Products.find(p => p.name === name);
            const current = prev[name] || 0;
            const max = product?.quantity || 0;
            if (current >= max) return prev;
            return {
                ...prev,
                [name]: current + 1
            };
        });
    };

    const executeFinalSubmit = useCallback(async () => {
        try {
            if (!rawFile || !order) return;
            setUploading(true);

            const { blob } = await prepareImage(rawFile, 'high-detail');
            const fileName = `Package_${order['Order ID']}_${Date.now()}.jpg`;

            // Trigger background upload with metadata for final update
            const tempUrl = await startUpload(
                `pack_${order['Order ID']}`,
                blob,
                fileName,
                {
                    orderId: order['Order ID'],
                    targetColumn: 'Package Photo URL',
                    newData: {
                        'Fulfillment Status': 'Ready to Ship',
                        'Packed By': currentUser?.FullName || 'Packer',
                        'Packed Time': new Date().toLocaleString('km-KH')
                    }
                }
            );

            if (!tempUrl) {
                alert("❌ ការបញ្ជូនបរាជ័យ: មិនទទួលបាន URL ពី Server");
                return;
            }

            onSuccess(tempUrl);

            const id = order['Order ID'].substring(0,8);
            const chatMsg = `📦 **[PACKED]** កញ្ចប់ #${id} (${order['Customer Name']}) វេចខ្ចប់រួចរាល់ (កំពុង Upload រូបភាព)`;

            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';

            fetch(`${WEB_APP_URL}/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ UserName: 'System', MessageType: 'Text', Content: chatMsg })
            }).catch(() => {});

        } catch (err: any) {
            alert("❌ ការបញ្ជូនបរាជ័យ: " + err.message);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    }, [rawFile, order, currentUser, prepareImage, startUpload, onSuccess]);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0);

            // ── Overlay helper ─────────────────────────────────────────────
            const truncateText = (c: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
                if (c.measureText(text).width <= maxWidth) return text;
                let t = text;
                while (t.length > 0 && c.measureText(t + '...').width > maxWidth) t = t.slice(0, -1);
                return t + '...';
            };

            const padding = 20;
            const maxTextWidth = canvas.width - padding * 2;

            const shortId    = order?.['Order ID']?.substring(0, 15) ?? '';
            const page       = order?.Page ?? '';
            const store      = order?.['Fulfillment Store'] ?? '';
            const location   = order?.Location ?? 'N/A';
            const custName   = order?.['Customer Name'] ?? 'N/A';
            const custPhone  = order?.['Customer Phone'] ?? 'N/A';
            const grandTotal = (Number(order?.['Grand Total']) || 0).toFixed(2);
            const payment    = order?.['Payment Status'] ?? 'Unpaid';
            const packedBy   = currentUser?.FullName ?? 'Packer';
            const logTime    = new Date().toLocaleString('km-KH');
            const rawProducts = (order?.Products ?? []).map(p => `${p.name} x${p.quantity}`).join(', ');

            // ── TOP BAR — Order ID, Page, Store ──────────────────────────
            const topBarH = 52;
            ctx.fillStyle = 'rgba(11, 14, 17, 0.92)';
            ctx.fillRect(0, 0, canvas.width, topBarH);
            // yellow accent at bottom of top bar
            ctx.fillStyle = '#FCD535';
            ctx.fillRect(0, topBarH - 3, canvas.width, 3);
            ctx.fillStyle = '#EAECEF';
            ctx.font = 'bold 20px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText(truncateText(ctx, `ORDER: #${shortId}  |  PAGE: ${page}  |  STORE: ${store}`, maxTextWidth), padding, 34);

            // ── BOTTOM BAR — Customer, Products, Meta ────────────────────
            const botBarH = 115;
            ctx.fillStyle = 'rgba(11, 14, 17, 0.92)';
            ctx.fillRect(0, canvas.height - botBarH, canvas.width, botBarH);
            // yellow accent at top of bottom bar
            ctx.fillStyle = '#FCD535';
            ctx.fillRect(0, canvas.height - botBarH, canvas.width, 3);

            // Line 1 — Location, Customer Name, Phone (13px)
            ctx.fillStyle = '#B7BDC6';
            ctx.font = '500 13px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText(truncateText(ctx, `\u{1F4CD} ${location}  |  \u{1F464} ${custName}  |  \u{1F4F1} ${custPhone}`, maxTextWidth), padding, canvas.height - 80);

            // Line 2 — Products, Grand Total, Payment (13px)
            const productsForLine = truncateText(ctx, rawProducts, maxTextWidth - 220);
            ctx.fillText(truncateText(ctx, `\u{1F6CD} ${productsForLine}  |  \u{1F4B0} $${grandTotal}  |  ${payment}`, maxTextWidth), padding, canvas.height - 55);

            // Line 3 — Packed By, Time (11px muted)
            ctx.fillStyle = '#848E9C';
            ctx.font = '500 11px "Inter", "Helvetica Neue", sans-serif';
            ctx.fillText(truncateText(ctx, `PACKED: ${packedBy}  |  TIME: ${logTime}`, maxTextWidth), padding, canvas.height - 30);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setPreviewImage(dataUrl);
            previewImageRef.current = dataUrl;
            
            // Convert dataUrl to File for submission
            fetch(dataUrl)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
                    setRawFile(file);
                });
        }
    }, [order, currentUser]);

    const startCountdown = useCallback((seconds: number = 3) => {
        if (countdownRef.current !== null) return;
        countdownRef.current = seconds;
        setCountdown(seconds);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        let count = seconds;
        countdownIntervalRef.current = setInterval(() => {
            count -= 1;
            setCountdown(count);
            if (count <= 0) {
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                setCountdown(null);
                countdownRef.current = null;
                capturePhoto();
            }
        }, 1000);
    }, [capturePhoto]);

    const applyZoom = useCallback(async (track: MediaStreamTrack, value: number) => {
        const capabilities = track.getCapabilities() as any;
        if (!capabilities.zoom) return;
        const min = capabilities.zoom.min || 1;
        const max = capabilities.zoom.max || 3;
        const clamped = Math.max(min, Math.min(max, value));
        try {
            await track.applyConstraints({ advanced: [{ zoom: clamped }] } as any);
            setZoom(clamped);
        } catch (e) {
            console.warn("Zoom not supported on this device/browser");
        }
    }, []);

    const handleSubmit = useCallback(() => {
        if (!previewImage) return;
        setUndoTimer(maxUndoTimer);
    }, [previewImage]);

    const handleUndo = () => {
        setIsUndoing(true);
        setTimeout(() => {
            setUndoTimer(null);
            setIsUndoing(false);
        }, 500);
    };

    const stopCamera = useCallback(() => {
        setIsCameraActive(false);
        if (aiLoopRef.current) cancelAnimationFrame(aiLoopRef.current);
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    }, []);

    const runAiLoop = useCallback(async () => {
        if (!videoRef.current || !isCameraActive || previewImageRef.current) return;
        
        const result = await packageDetector.detect(videoRef.current);
        setDetection(result);
        setAiFrameCount(prev => (prev + 1) % 100);

        if (isAiEnabledRef.current) {
            const isQRCode = result.barcodeFormat === 'qr_code' || result.barcodeFormat === 'qr' || result.barcodeFormat?.toLowerCase().includes('qr');
            
            if (result.barcodeBox && isQRCode) {
                qrStabilityRef.current += 1;
            } else {
                qrStabilityRef.current = 0;
            }

            if (qrStabilityRef.current >= 2 && countdownRef.current === null && !previewImageRef.current) {
                const track = (videoRef.current.srcObject as MediaStream)?.getVideoTracks()[0];
                if (track && Date.now() - lastActionTime.current > 1500) {
                    const videoArea = videoRef.current.videoWidth * videoRef.current.videoHeight;
                    const objectArea = result.barcodeBox!.w * result.barcodeBox!.h;
                    const areaRatio = objectArea / videoArea;
                    const minThreshold = 0.05;
                    const maxThreshold = 0.25;
                    if (areaRatio < minThreshold) applyZoom(track, zoom + 0.5);
                    else if (areaRatio > maxThreshold) applyZoom(track, zoom - 0.5);
                    lastActionTime.current = Date.now();
                }
                startCountdown(2);
            } else if (result.gesture === 'five_fingers' && countdownRef.current === null) {
                startCountdown(3);
            }

            if (result.gesture === 'thumbs_up' && previewImageRef.current && !uploadingRef.current) handleSubmit();

            if (result.found && result.box && !result.barcodeBox) {
                const track = (videoRef.current.srcObject as MediaStream)?.getVideoTracks()[0];
                if (track && Date.now() - lastActionTime.current > 1200) {
                    const videoArea = videoRef.current.videoWidth * videoRef.current.videoHeight;
                    const objectArea = result.box.w * result.box.h;
                    const areaRatio = objectArea / videoArea;
                    const minThreshold = result.isHand ? 0.35 : 0.25;
                    const maxThreshold = result.isHand ? 0.80 : 0.70;
                    if (areaRatio < minThreshold) applyZoom(track, zoom + 0.5);
                    else if (areaRatio > maxThreshold) applyZoom(track, zoom - 0.5);
                    lastActionTime.current = Date.now();
                }
                
                if (countdownRef.current === null && result.stability > 0.95 && !previewImageRef.current && !result.isHand) {
                    setAutoCaptureProgress(prev => {
                        const next = prev + 3;
                        if (next >= 100) { capturePhoto(); return 0; }
                        return next;
                    });
                } else setAutoCaptureProgress(0);
            }
        }
        aiLoopRef.current = requestAnimationFrame(runAiLoop);
    }, [isCameraActive, zoom, applyZoom, capturePhoto, startCountdown, handleSubmit]);

    const startCamera = async (overrideFacingMode?: 'environment' | 'user') => {
        const modeToUse = overrideFacingMode || facingMode;
        if (overrideFacingMode) setFacingMode(overrideFacingMode);

        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }

        setIsCameraActive(true);
        setPreviewImage(null);
        previewImageRef.current = null;
        if (!packageDetector.isReady()) {
            setIsAiLoading(true);
            await packageDetector.init();
            setIsAiLoading(false);
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: modeToUse, width: { ideal: 1280 }, height: { ideal: 720 } }, 
                audio: false 
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => { runAiLoop(); };
            }
        } catch (err) {
            alert("Unable to open camera.");
            setIsCameraActive(false);
            setIsAiLoading(false);
        }
    };

    useEffect(() => {
        if (step === 'CAPTURING') {
            startCamera();
        } else {
            stopCamera();
        }
    }, [step]);

    useEffect(() => {
        if (step === 'VERIFYING' && isOrderVerified && !hasAutoAdvanced.current.verify) {
            hasAutoAdvanced.current.verify = true;
            const timer = setTimeout(() => {
                setStep('LABELING');
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [step, isOrderVerified]);

    useEffect(() => {
        if (step === 'LABELING' && hasGeneratedLabel && !hasAutoAdvanced.current.label) {
            hasAutoAdvanced.current.label = true;
            setIsAdvancingLabel(true);
            const timer = setTimeout(() => {
                setStep('CAPTURING');
                setIsAdvancingLabel(false);
            }, 5000); // Wait 5 seconds to give user time to physically pack/label
            return () => { clearTimeout(timer); setIsAdvancingLabel(false); };
        }
    }, [step, hasGeneratedLabel]);

    useEffect(() => {
        if (isAdvancingLabel) {
            setAdvancementProgress(0);
            const start = Date.now();
            const duration = 5000;
            const interval = setInterval(() => {
                const elapsed = Date.now() - start;
                if (elapsed >= duration) {
                    setAdvancementProgress(100);
                    clearInterval(interval);
                } else {
                    setAdvancementProgress((elapsed / duration) * 100);
                }
            }, 50);
            return () => clearInterval(interval);
        } else {
            setAdvancementProgress(0);
        }
    }, [isAdvancingLabel]);

    // Broadcast operation steps to All Users
    useEffect(() => {
        if (!order) return;
        
        const sendStepNotification = async (message: string) => {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            fetch(`${WEB_APP_URL}/api/chat/send`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ UserName: 'System', MessageType: 'Text', Content: message })
            }).catch(() => {});
        };

        const id = order['Order ID'].substring(0, 8);
        const user = currentUser?.FullName || 'Packer';
        let msg = '';

        if (step === 'VERIFYING') {
            msg = `🛂 **[VERIFYING]** ${user} កំពុងផ្ទៀងផ្ទាត់កញ្ចប់ #${id} (${order['Customer Name']})`;
        } else if (step === 'LABELING') {
            msg = `🖨️ **[LABELING]** ${user} កំពុងបោះពុម្ពស្លាកបញ្ជូន (Label) សម្រាប់កញ្ចប់ #${id}`;
        } else if (step === 'CAPTURING') {
            msg = `📸 **[CAPTURING]** កញ្ចប់ #${id} ត្រៀមថតរូបបញ្ជាក់ការវេចខ្ចប់ដោយ ${user}`;
        }

        if (msg) {
            sendStepNotification(msg);
        }
    }, [step, order, currentUser]);

    useEffect(() => { return () => stopCamera(); }, [stopCamera]);

    useEffect(() => {
        let interval: any;
        if (undoTimer !== null && undoTimer > 0 && !isUndoing) {
            interval = setInterval(() => {
                setUndoTimer(prev => (prev !== null ? prev - 1 : null));
            }, 1000);
        } else if (undoTimer === 0) {
            setUndoTimer(null);
            executeFinalSubmit();
        }
        return () => clearInterval(interval);
    }, [undoTimer, isUndoing, executeFinalSubmit]);

    const fulfillmentStore = appData.stores?.find(s => s.StoreName === order?.['Fulfillment Store']);

    const getFullPrinterURL = () => {
        if (!order) return '';
        const params = new URLSearchParams({
            view: 'print_label',
            id: order['Order ID'],
            name: order['Customer Name'],
            phone: order['Customer Phone'],
            location: order.Location,
            address: order['Address Details'] || '',
            total: String(order['Grand Total']),
            payment: order['Payment Status'] || '',
            shipping: order['Internal Shipping Method'] || '',
            user: order.User,
            page: order.Page,
            store: order['Fulfillment Store'],
            note: order.Note || ''
        });
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    };

    const fullPrinterURL = getFullPrinterURL();

    const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order?.['Internal Shipping Method']);
    const driver = appData.drivers?.find(d => d.DriverName === (order?.['Driver Name'] || order?.['Internal Shipping Details']));
    const bank = appData.bankAccounts?.find(b => b.BankName === order?.['Payment Info']);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRawFile(file);
            try {
                const compressedBlob = await compressImage(file, 'balanced');
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviewImage(reader.result as string);
                    previewImageRef.current = reader.result as string;
                };
                reader.readAsDataURL(compressedBlob);
            } catch (error) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreviewImage(reader.result as string);
                    previewImageRef.current = reader.result as string;
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopiedField(label);
            setTimeout(() => setCopiedField(null), 2000);
        });
    };

    const getTelecomBadge = (phone: string) => {
        if (!phone) return null;
        const cleanPhone = phone.replace(/\D/g, '');
        let prefix = cleanPhone.substring(0, 3);
        if (cleanPhone.startsWith('855')) prefix = '0' + cleanPhone.substring(3, 5);

        const smart = ['010','015','016','069','070','081','086','087','093','096','098'];
        const cellcard = ['011','012','014','017','076','077','078','085','089','092','095','099'];
        const metfone = ['031','060','066','067','068','071','088','090','097'];

        if (smart.includes(prefix)) return <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[2px] bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 text-[8px] font-black uppercase tracking-wider ml-2 relative -top-0.5">SMART</span>;
        if (cellcard.includes(prefix)) return <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[2px] bg-[#F28C28]/10 text-[#F28C28] border border-[#F28C28]/20 text-[8px] font-black uppercase tracking-wider ml-2 relative -top-0.5">CELLCARD</span>;
        if (metfone.includes(prefix)) return <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-[2px] bg-[#E50914]/10 text-[#E50914] border border-[#E50914]/20 text-[8px] font-black uppercase tracking-wider ml-2 relative -top-0.5">METFONE</span>;
        
        return null;
    };

    if (!order) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-[#0B0E11] flex flex-col animate-fade-in font-sans text-gray-300">
            {/* LABEL EDITOR MODAL */}
            {showLabelEditor && (
                <div className="fixed inset-0 z-[300] bg-[#0B0E11] overflow-hidden">
                    <PrintLabelPage 
                        standalone={false}
                        onClose={() => setShowLabelEditor(false)}
                        initialData={{
                            id: order['Order ID'],
                            name: order['Customer Name'],
                            phone: order['Customer Phone'],
                            location: order.Location,
                            address: order['Address Details'] || '',
                            total: String(order['Grand Total']),
                            payment: order['Payment Status'] || '',
                            shipping: order['Internal Shipping Method'] || '',
                            user: order.User,
                            page: order.Page,
                            store: order['Fulfillment Store'],
                            note: order.Note || ''
                        }}
                    />
                </div>
            )}

            {/* Header */}
            <header className="relative z-30 px-6 py-4 bg-[#181A20] border-b border-[#2B3139] flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => {
                        if (step === 'CAPTURING') setStep('LABELING');
                        else if (step === 'LABELING') setStep('VERIFYING');
                        else onClose();
                    }} className="px-4 py-2 bg-[#0B0E11] hover:bg-gray-800 text-gray-400 hover:text-white rounded-sm flex items-center gap-2 transition-colors border border-[#2B3139]">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        <span className="font-bold text-xs tracking-widest uppercase">
                            BACK
                        </span>
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 uppercase tracking-widest leading-none">Fast Pack Terminal</h1>
                            <span className="px-1.5 py-0.5 bg-[#FCD535]/10 text-[#FCD535] text-[9px] font-black rounded-sm uppercase tracking-widest border border-[#FCD535]/30">v4.3</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[#0ECB81] font-mono text-xs sm:text-sm font-bold tracking-widest drop-shadow-[0_0_8px_rgba(14,203,129,0.3)]">#{order['Order ID'].substring(0, 15)}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest border-l border-[#2B3139] pl-3">PG: {order.Page} <span className="mx-1">•</span> TM: <span className={order.Team === 'A' ? 'text-blue-400' : 'text-purple-400'}>{order.Team}</span></span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center bg-[#0B0E11] px-4 py-2 rounded-sm border border-[#2B3139]">
                        {bank && (
                            <div className="flex items-center pr-3">
                                <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-5 h-5 object-contain" title={bank.BankName} alt="" />
                            </div>
                        )}
                        {shippingMethod && (
                            <div className="flex items-center gap-2 border-l border-[#2B3139] pl-3 pr-3">
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Shipping:</span>
                                <img src={convertGoogleDriveUrl(shippingMethod.LogoURL)} className="w-6 h-6 object-contain" title={shippingMethod.MethodName} alt="" />
                                <span className="text-xs font-bold text-gray-200 uppercase tracking-widest whitespace-nowrap">{shippingMethod.MethodName}</span>
                            </div>
                        )}
                        {driver && (
                            <div className="flex items-center gap-2 border-l border-[#2B3139] pl-3">
                                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">Driver:</span>
                                <img 
                                    src={convertGoogleDriveUrl(driver.ImageURL)} 
                                    className="w-6 h-6 object-cover rounded-sm ring-1 ring-[#2B3139] cursor-pointer hover:opacity-80 transition-opacity" 
                                    title={driver.DriverName} 
                                    alt="" 
                                    onClick={() => showFullImage(convertGoogleDriveUrl(driver.ImageURL))}
                                />
                                <span className="text-xs font-bold text-gray-200 uppercase tracking-widest whitespace-nowrap">{driver.DriverName}</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Split View Container */}
            <main className="flex-grow flex overflow-hidden relative z-10 w-full">
                {/* LEFT: Order Items */}
                <OrderSummaryPanel 
                    order={order}
                    appData={appData}
                    step={step}
                    verifiedItems={verifiedItems}
                    isOrderVerified={isOrderVerified}
                    verifyItem={verifyItem}
                    showFullImage={showFullImage}
                />

                {/* RIGHT: Dynamic Execution Stage */}
                <div className="flex-grow flex flex-col bg-[#0B0E11] p-6 overflow-y-auto">
                    <div className="w-full h-full flex flex-col max-w-4xl mx-auto">
                        {uploading && undoTimer === null && (
                            <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-6 mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <Spinner size="sm" />
                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Uploading Photo...</span>
                                    </div>
                                    <span className="text-sm font-mono text-[#FCD535]">{uploadProgress}%</span>
                                </div>
                                <div className="w-full h-1 bg-[#2B3139] rounded-sm overflow-hidden">
                                    <div className="h-full bg-[#FCD535] transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            </div>
                        )}

                        <div className="flex-grow flex flex-col">
                            {step === 'VERIFYING' && (
                                <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-6 flex-grow flex flex-col overflow-y-auto custom-scrollbar shadow-sm">
                                    <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#2B3139]">
                                        <h3 className="text-xl font-bold text-gray-200 uppercase tracking-widest">Order Summary</h3>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-[#0B0E11] border border-[#2B3139] rounded-sm">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Prep Ops:</span>
                                            <span className="text-xs font-mono text-gray-300">{order?.User || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="mb-8 space-y-4">
                                        <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest">Customer Details</p>
                                        <div className="bg-[#0B0E11] p-5 rounded-sm border border-[#2B3139] grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Name</p>
                                                    {copiedField === 'Name' && <span className="text-[8px] font-bold text-[#0ECB81] uppercase tracking-widest bg-[#0ECB81]/10 px-1.5 py-0.5 rounded-sm animate-fade-in">Copied ✓</span>}
                                                </div>
                                                <p 
                                                    className="text-sm font-bold text-white leading-tight cursor-pointer hover:text-blue-400 transition-colors"
                                                    onClick={() => handleCopy(order?.['Customer Name'] || '', 'Name')}
                                                    title="Click to copy"
                                                >
                                                    {order?.['Customer Name'] || 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Contact</p>
                                                    {copiedField === 'Phone' && <span className="text-[8px] font-bold text-[#0ECB81] uppercase tracking-widest bg-[#0ECB81]/10 px-1.5 py-0.5 rounded-sm animate-fade-in">Copied ✓</span>}
                                                </div>
                                                <div className="flex items-center">
                                                    <p 
                                                        className="text-sm font-mono text-[#FCD535] leading-tight cursor-pointer hover:text-white transition-colors"
                                                        onClick={() => handleCopy(order?.['Customer Phone'] || '', 'Phone')}
                                                        title="Click to copy"
                                                    >
                                                        {order?.['Customer Phone'] || 'N/A'}
                                                    </p>
                                                    {getTelecomBadge(order?.['Customer Phone'] || '')}
                                                </div>
                                            </div>
                                            <div className="col-span-1 md:col-span-2 space-y-3 pt-4 border-t border-[#2B3139]">
                                                <div className="flex gap-4">
                                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest whitespace-nowrap pt-1">Location</span>
                                                    <p className="text-sm text-gray-300 leading-relaxed">{order?.Location || 'N/A'}</p>
                                                </div>
                                                {order?.['Address Details'] && (
                                                    <div className="flex gap-4">
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-widest whitespace-nowrap pt-1">Address </span>
                                                        <p className="text-xs text-gray-400 italic leading-relaxed">{order['Address Details']}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-bold text-[#FCD535] uppercase tracking-widest">Logistics</p>
                                            <div className="bg-[#0B0E11] p-5 rounded-sm border border-[#2B3139] space-y-4">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500">Method</span>
                                                    <div className="flex items-center gap-2">
                                                        {shippingMethod && <img src={convertGoogleDriveUrl(shippingMethod.LogoURL)} className="w-5 h-5 object-contain" alt="" title={shippingMethod.MethodName} />}
                                                        <span className="font-bold text-white uppercase">{order?.['Internal Shipping Method'] || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500">Driver</span>
                                                    <div className="flex items-center gap-2">
                                                        {driver && <img src={convertGoogleDriveUrl(driver.ImageURL)} className="w-5 h-5 object-cover rounded-sm ring-1 ring-[#2B3139] cursor-pointer" alt="" title={driver.DriverName} onClick={() => showFullImage(convertGoogleDriveUrl(driver.ImageURL))} />}
                                                        <span className="font-bold text-white uppercase">{order?.['Driver Name'] || order?.['Internal Shipping Details'] || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center pt-4 border-t border-[#2B3139]">
                                                    <span className="text-gray-500 uppercase text-[10px] tracking-widest">Est Cost</span>
                                                    <span className="text-lg font-mono text-white">${(Number(order?.['Internal Cost']) || 0).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <p className="text-[10px] font-bold text-[#0ECB81] uppercase tracking-widest">Financial</p>
                                            <div className="bg-[#0B0E11] p-5 rounded-sm border border-[#2B3139] space-y-4">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500">Method</span>
                                                    <div className="flex items-center gap-2">
                                                        {bank && <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-5 h-5 object-contain" title={bank.BankName} alt="" />}
                                                        <span className="font-bold text-white uppercase">{order?.['Payment Info'] || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500">Status</span>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-widest border ${order?.['Payment Status'] === 'Paid' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/20' : 'bg-[#FCD535]/10 text-[#FCD535] border-[#FCD535]/20'}`}>
                                                        {order?.['Payment Status'] || 'Unpaid'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center pt-4 border-t border-[#2B3139]">
                                                    <span className="text-gray-500 uppercase text-[10px] tracking-widest">Gross Total</span>
                                                    <span className="text-2xl font-mono text-[#0ECB81]">${(Number(order?.['Grand Total']) || 0).toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {order?.Note && (
                                        <div className="mt-6 space-y-3">
                                            <p className="text-[10px] font-bold text-[#F6465D] uppercase tracking-widest">Special Note</p>
                                            <div className="bg-[#0B0E11] p-5 rounded-sm border-l-[4px] border-[#F6465D] border-y border-r border-[#2B3139]">
                                                <p className="text-sm text-gray-300 font-mono">"{order.Note}"</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-6 text-center">
                                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Verify contents to proceed...</p>
                                    </div>
                                </div>
                            )}

                            {step === 'LABELING' && (
                                <div className="bg-[#181A20] rounded-sm p-12 border border-[#2B3139] flex-grow flex flex-col items-center justify-center gap-8">
                                    <div className="w-32 h-32 bg-[#0B0E11] rounded-sm flex items-center justify-center text-[#FCD535] border border-[#2B3139]">
                                        <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth={1.5}/></svg>
                                    </div>
                                    <div className="text-center space-y-4">
                                        <h3 className="text-2xl font-bold text-white uppercase tracking-widest">Print Label</h3>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Attach label before taking photo</p>
                                    </div>
                                    {fullPrinterURL && (
                                        <div className="flex items-center gap-4">
                                            <button 
                                                onClick={() => { printViaIframe(fullPrinterURL); setHasGeneratedLabel(true); }} 
                                                disabled={isAdvancingLabel}
                                                className={`relative overflow-hidden px-10 py-4 rounded-sm font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-3 transition-colors min-w-[240px] ${
                                                    isAdvancingLabel ? 'bg-[#2B3139] text-[#FCD535] cursor-default' : 
                                                    hasGeneratedLabel ? 'bg-[#0ECB81]/10 text-[#0ECB81] border border-[#0ECB81]/30 hover:bg-[#0ECB81]/20' : 
                                                    'bg-[#FCD535] hover:bg-[#FCD535]/90 text-black'
                                                }`}
                                            >
                                                {isAdvancingLabel && (
                                                    <div 
                                                        className="absolute inset-y-0 left-0 bg-[#FCD535]/15" 
                                                        style={{ width: `${advancementProgress}%` }}
                                                    ></div>
                                                )}
                                                
                                                <span className="relative z-10 flex items-center gap-2">
                                                    {isAdvancingLabel ? (
                                                        <>
                                                            <Spinner size="sm" />
                                                            Auto Advancing...
                                                        </>
                                                    ) : hasGeneratedLabel ? (
                                                        <>
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                            Label Generated
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                                            Generate Label
                                                        </>
                                                    )}
                                                </span>
                                            </button>
                                            <button onClick={() => setShowLabelEditor(true)} className="px-10 py-4 bg-[#2B3139] hover:bg-[#2B3139]/80 text-[#EAECEF] rounded-sm font-bold uppercase text-xs tracking-widest flex items-center gap-3 transition-colors">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                Edit Label
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 'CAPTURING' && (
                                <CameraViewport 
                                    videoRef={videoRef}
                                    canvasRef={canvasRef}
                                    fileInputRef={fileInputRef}
                                    isCameraActive={isCameraActive}
                                    isAiEnabled={isAiEnabled}
                                    setIsAiEnabled={setIsAiEnabled}
                                    isAiLoading={isAiLoading}
                                    detection={detection}
                                    autoCaptureProgress={autoCaptureProgress}
                                    countdown={countdown}
                                    previewImage={previewImage}
                                    setPreviewImage={setPreviewImage}
                                    showFullImage={showFullImage}
                                    stopCamera={stopCamera}
                                    capturePhoto={capturePhoto}
                                    startCamera={startCamera}
                                    zoom={zoom}
                                    handleFileChange={handleFileChange}
                                    toggleCamera={() => startCamera(facingMode === 'environment' ? 'user' : 'environment')}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer Action Bar */}
            <ActionControls 
                step={step}
                isOrderVerified={isOrderVerified}
                hasGeneratedLabel={hasGeneratedLabel}
                uploading={uploading}
                previewImage={previewImage}
                undoTimer={undoTimer}
                onClose={onClose}
                setStep={setStep}
                handleSubmit={handleSubmit}
            />

            {undoTimer !== null && (
                <OrderGracePeriod 
                    timer={undoTimer}
                    maxTimer={maxUndoTimer}
                    onUndo={handleUndo}
                    isUndoing={isUndoing}
                    accentColor="yellow"
                    title="UPLOADING PHOTO..."
                    subtitle="System is uploading the photo and finishing the task. Cancel to halt."
                />
            )}
        </div>
    );
};

export default FastPackTerminal;
