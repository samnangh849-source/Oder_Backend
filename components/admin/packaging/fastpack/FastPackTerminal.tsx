import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactQRCode from 'react-qr-code';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { convertGoogleDriveUrl, fileToBase64, fileToDataUrl, getOptimisticPackagePhoto } from '@/utils/fileUtils';
import { compressImage } from '@/utils/imageCompressor';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import OrderGracePeriod from '@/components/orders/OrderGracePeriod';
import { printViaIframe } from '@/utils/printUtils';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useOrder } from '@/context/OrderContext';

import OrderSummaryPanel from './OrderSummaryPanel';
import ActionControls from './ActionControls';
import PrintLabelPage from '@/pages/PrintLabelPage';

type PackStep = 'VERIFYING' | 'LABELING' | 'PHOTO';

interface FastPackTerminalProps {
    order: ParsedOrder | null;
    onClose: () => void;
    onSuccess: (photoUrl?: string) => void;
}

const FastPackTerminal: React.FC<FastPackTerminalProps> = ({ order, onClose, onSuccess }) => {
    const { currentUser, appData, previewImage: showFullImage, refreshData, advancedSettings } = useContext(AppContext);
    const { setOrders } = useOrder();
    
    // Workflow State
    const [step, setStep] = useState<PackStep>('VERIFYING');
    const [verifiedItems, setVerifiedItems] = useState<Record<string, number>>({}); 
    const hasAutoAdvanced = useRef({ verify: false, label: false, photo: false });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qrCodeRef = useRef<HTMLDivElement>(null);

    const isOrderVerified = useMemo(() => {
        if (!order) return false;
        return order.Products.every(p => (verifiedItems[p.name] || 0) >= p.quantity);
    }, [order, verifiedItems]);
    
    // UI State
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [hasGeneratedLabel, setHasGeneratedLabel] = useState(false);
    const [packagePhoto, setPackagePhoto] = useState<string | null>(null);
    const [showLabelEditor, setShowLabelEditor] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isAdvancingLabel, setIsAdvancingLabel] = useState(false);
    const [advancementProgress, setAdvancementProgress] = useState(0);

    // Auto Capture State
    const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const lastDetectedQR = useRef<string | null>(null);
    const countdownTimerRef = useRef<any>(null);
    
    // Grace Period / Undo State
    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [isUndoing, setIsUndoing] = useState(false);
    const maxUndoTimer = advancedSettings.packagingGracePeriod || 5;
    const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const submitIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const MAX_ATTEMPTS = 5;

    const executeFinalSubmit = useCallback(async () => {
        try {
            if (!order) return;
            setUploading(true);
            setUploadProgress(5); 

            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            
            const packTime = new Date().toLocaleString('km-KH');
            const newData = {
                'Fulfillment Status': 'Ready to Ship',
                'Packed By': currentUser?.FullName || 'Packer',
                'Packed Time': packTime
            };

            setUploadProgress(20);

            let driveUrl = '';
            if (packagePhoto) {
                const base64Data = packagePhoto.includes(',') ? packagePhoto.split(',')[1] : packagePhoto;
                const uploadData = {
                    action: 'uploadImage',
                    fileData: base64Data,
                    fileName: `Package_${order['Order ID'].substring(0,8)}_${Date.now()}.jpg`,
                    mimeType: 'image/jpeg',
                    orderId: order['Order ID'],
                    team: order.Team,
                    targetColumn: 'Package Photo',
                    newData: newData
                };

                setUploadProgress(40);

                const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(uploadData)
                });

                if (!response.ok) {
                    const errResult = await response.json().catch(() => ({}));
                    throw new Error(errResult.message || `Server responded with ${response.status}`);
                }

                const result = await response.json();
                if (result.status !== 'success') throw new Error(result.message || 'Upload failed');
                driveUrl = result.url;
                setUploadProgress(85);
            } else {
                const statusResponse = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        orderId: order['Order ID'],
                        team: order.Team,
                        userName: currentUser?.FullName || 'System',
                        newData: newData
                    })
                });
                if (!statusResponse.ok) throw new Error("Status update failed");
                setUploadProgress(85);
            }

            // Apply optimistic update with EXACT same packTime
            setOrders(prev => prev.map(o =>
                o['Order ID'] === order['Order ID']
                    ? {
                        ...o,
                        'Fulfillment Status': 'Ready to Ship',
                        FulfillmentStatus: 'Ready to Ship',
                        'Packed By': currentUser?.FullName || 'Packer',
                        'Packed Time': packTime,
                        'Package Photo': driveUrl || o['Package Photo']
                      }
                    : o
            ));

            setUploadProgress(100);

            // Trigger success
            onSuccess(driveUrl || packagePhoto || 'manual_sync_ok');

            // Send Chat Notification with correct keys: Sender, Message, Type, Team
            const id = order['Order ID'].substring(0,8);
            const chatMsg = `📦 **[PACKED]** កញ្ចប់ #${id} (${order['Customer Name']}) វេចខ្ចប់រួចរាល់`;
            fetch(`${WEB_APP_URL}/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    Sender: 'System', 
                    Type: 'text', 
                    Message: chatMsg, 
                    Team: order.Team 
                })
            }).catch(() => {});

        } catch (err: any) {
            console.error("Critical submission error:", err);
            alert("❌ ការបញ្ជូនបរាជ័យ: " + err.message);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    }, [order, currentUser, onSuccess, packagePhoto, setOrders, refreshData]);

    const handleSubmit = useCallback(() => {
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);

        const gracePeriod = advancedSettings.packagingGracePeriod || 5;
        setUndoTimer(gracePeriod);
        let secondsLeft = gracePeriod;

        submitIntervalRef.current = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);
                submitIntervalRef.current = null;
                setUndoTimer(null);
                executeFinalSubmit();
            } else {
                setUndoTimer(secondsLeft);
            }
        }, 1000);
    }, [advancedSettings.packagingGracePeriod, maxUndoTimer, executeFinalSubmit]);

    const handleUndo = () => {
        if (submitTimeoutRef.current) {
            clearTimeout(submitTimeoutRef.current);
            submitTimeoutRef.current = null;
        }
        if (submitIntervalRef.current) {
            clearInterval(submitIntervalRef.current);
            submitIntervalRef.current = null;
        }

        setIsUndoing(true);
        setTimeout(() => {
            setUndoTimer(null);
            setIsUndoing(false);
        }, 500);
    };

    useEffect(() => {
        const handlePrintSuccess = (e: any) => {
            if (e.detail?.target === 'label') {
                setHasGeneratedLabel(true);
                // Automatically move to PHOTO step after a short delay
                setTimeout(() => {
                    setStep('PHOTO');
                }, 1500);
            }
        };
        window.addEventListener('print-success', handlePrintSuccess);
        return () => window.removeEventListener('print-success', handlePrintSuccess);
    }, []);

    useEffect(() => {
        return () => {
            if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
            if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);
        };
    }, []);

    const verifyItem = (name: string) => {
        if (!name) return; // Guard against products with missing name (legacy data)
        setVerifiedItems(prev => {
            const product = order?.Products.find(p => p.name === name);
            const current = prev[name] || 0;
            const max = Number(product?.quantity) || 1;
            if (current >= max) return prev;
            return { ...prev, [name]: current + 1 };
        });
    };

    const capturePhotoFromStream = useCallback(async () => {
        const video = document.querySelector('#fastpack-scanner-container video') as HTMLVideoElement;
        if (!video || isCapturing || !order) return;

        setIsCapturing(true);
        try {
            const canvas = document.createElement('canvas');
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            const videoAspect = videoWidth / videoHeight;

            const targetMax = 2560;
            if (videoWidth > videoHeight) {
                canvas.width = targetMax;
                canvas.height = targetMax / videoAspect;
            } else {
                canvas.height = targetMax;
                canvas.width = targetMax * videoAspect;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const marginX = canvas.width * 0.08; 
            const marginY = canvas.height * 0.12; 
            const headerHeight = canvas.height * 0.35;
            const footerHeight = canvas.height * 0.35;
            const safeWidth = canvas.width - (marginX * 2);

            const headGrad = ctx.createLinearGradient(0, 0, 0, headerHeight);
            headGrad.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
            headGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = headGrad;
            ctx.fillRect(0, 0, canvas.width, headerHeight);

            const footGrad = ctx.createLinearGradient(0, canvas.height - footerHeight, 0, canvas.height);
            footGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            footGrad.addColorStop(1, 'rgba(0, 0, 0, 0.98)');
            ctx.fillStyle = footGrad;
            ctx.fillRect(0, canvas.height - footerHeight, canvas.width, footerHeight);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.font = `bold ${Math.round(canvas.width * 0.014)}px Kantumruy Pro, sans-serif`;
            ctx.fillStyle = 'rgba(252, 213, 53, 0.9)';
            ctx.fillText('CONSIGNMENT VERIFICATION PROOF', marginX, marginY);

            ctx.font = `900 ${Math.round(canvas.width * 0.038)}px monospace`;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(`#${order['Order ID']}`, marginX, marginY + (canvas.height * 0.04), safeWidth * 0.6);

            ctx.font = `bold ${Math.round(canvas.width * 0.024)}px Kantumruy Pro, sans-serif`;
            ctx.fillStyle = '#FCD535';
            ctx.fillText(`${order['Customer Name']}`, marginX, marginY + (canvas.height * 0.11), safeWidth * 0.6);

            ctx.textAlign = 'right';
            const statusLabel = 'SECURELY PACKED';
            ctx.font = `bold ${Math.round(canvas.width * 0.015)}px Kantumruy Pro, sans-serif`;
            const labelWidth = ctx.measureText(statusLabel).width + 60;
            ctx.fillStyle = 'rgba(14, 203, 129, 0.98)';
            const bx = canvas.width - labelWidth - marginX;
            const by = marginY;
            const bw = labelWidth;
            const bh = canvas.height * 0.05;
            ctx.beginPath();
            ctx.roundRect(bx, by, bw, bh, 10);
            ctx.fill();
            ctx.fillStyle = '#000000';
            ctx.fillText(statusLabel, canvas.width - marginX - 30, marginY + (canvas.height * 0.012));

            const bottomTextX = marginX;
            const bottomTextY = canvas.height - marginY;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.font = `900 ${Math.round(canvas.width * 0.03)}px monospace`;
            ctx.fillStyle = '#0ECB81';
            ctx.fillText(`តម្លៃ: $${(Number(order['Grand Total']) || 0).toFixed(2)}`, bottomTextX, bottomTextY, safeWidth * 0.5);

            ctx.font = `bold ${Math.round(canvas.width * 0.015)}px Kantumruy Pro, sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText(`អ្នកវេចខ្ចប់: ${currentUser?.FullName || order.User || 'System'}`, bottomTextX, bottomTextY - (canvas.height * 0.07), safeWidth * 0.5);

            ctx.font = `bold ${Math.round(canvas.width * 0.015)}px Kantumruy Pro, sans-serif`;
            ctx.fillStyle = '#FCD535';
            ctx.fillText(`លេខទូរស័ព្ទ: ${order['Customer Phone']}`, bottomTextX, bottomTextY - (canvas.height * 0.12), safeWidth * 0.5);
            
            ctx.font = `bold ${Math.round(canvas.width * 0.017)}px Kantumruy Pro, sans-serif`;
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(`ទីតាំង: ${order.Location}`, bottomTextX, bottomTextY - (canvas.height * 0.17), safeWidth * 0.5);

            const qrSize = Math.round(canvas.width * 0.11);
            const qrX = canvas.width - qrSize - marginX;
            const qrY = canvas.height - qrSize - marginY;

            try {
                const qrSvg = qrCodeRef.current?.querySelector('svg');
                if (qrSvg) {
                    const svgData = new XMLSerializer().serializeToString(qrSvg);
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const svgUrl = URL.createObjectURL(svgBlob);
                    const qrImg = new Image();
                    qrImg.src = svgUrl;
                    await new Promise((resolve, reject) => { 
                        qrImg.onload = resolve; 
                        qrImg.onerror = reject;
                        setTimeout(() => reject(new Error("QR Load Timeout")), 3000);
                    });
                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 10);
                    ctx.fill();
                    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
                    URL.revokeObjectURL(svgUrl);
                }
            } catch (qrErr) { console.warn("QR Watermark failed", qrErr); }

            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.font = `bold ${Math.round(canvas.width * 0.018)}px monospace`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillText(new Date().toLocaleString('km-KH'), qrX - 20, canvas.height - marginY);
            ctx.fillText('SCAN TO VERIFY', qrX - 20, canvas.height - marginY - 40);

            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
            if (!blob) throw new Error("Could not create blob");

            const file = new File([blob], `Proof_${order['Order ID']}.jpg`, { type: 'image/jpeg' });
            const compressed = await compressImage(file, 'high-detail');
            const dataUrl = await fileToDataUrl(compressed);
            
            setPackagePhoto(dataUrl);
            localStorage.setItem(`package_photo_${order['Order ID']}`, dataUrl);
            setAutoCaptureCountdown(null);
        } catch (err) {
            console.error("Capture failed:", err);
            alert("❌ ការថតរូបមានបញ្ហា (Capture Error)");
        } finally {
            setIsCapturing(false);
        }
    }, [order, currentUser, isCapturing]);

    const {
        isInitializing: isScannerLoading, error: scannerError, switchCamera, toggleTorch, isTorchOn, isTorchSupported, handleZoomChange, stopScanner
    } = useBarcodeScanner('fastpack-scanner-container', (decoded) => {
        if (step !== 'PHOTO' || packagePhoto || autoCaptureCountdown !== null || isCapturing) return;
        if (decoded === lastDetectedQR.current) return;
        lastDetectedQR.current = decoded;
        setAutoCaptureCountdown(3);
    }, 'single', { disableScanner: step !== 'PHOTO' || !!packagePhoto });

    useEffect(() => {
        if (autoCaptureCountdown === null) return;
        if (autoCaptureCountdown === 0) {
            capturePhotoFromStream();
            return;
        }
        countdownTimerRef.current = setTimeout(() => {
            setAutoCaptureCountdown(prev => (prev !== null ? prev - 1 : null));
        }, 1000);
        return () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); };
    }, [autoCaptureCountdown, capturePhotoFromStream]);

    // Speed up final submit after auto-capture (Reduce from 2s to 0.5s)
    useEffect(() => {
        if (packagePhoto && !hasAutoAdvanced.current.photo && step === 'PHOTO') {
            hasAutoAdvanced.current.photo = true;
            // Immediate stop of camera stream with safety check
            try {
                stopScanner();
            } catch (e) {
                console.warn("Scanner stop suppressed:", e);
            }
            // Start submission process sooner
            const timer = setTimeout(() => { handleSubmit(); }, 800);
            return () => clearTimeout(timer);
        }
    }, [packagePhoto, step, handleSubmit, stopScanner]);

    useEffect(() => {
        if (step === 'VERIFYING' && isOrderVerified && !hasAutoAdvanced.current.verify) {
            hasAutoAdvanced.current.verify = true;
            const timer = setTimeout(() => { setStep('LABELING'); }, 600);
            return () => clearTimeout(timer);
        }
    }, [step, isOrderVerified]);

    useEffect(() => { if (step === 'PHOTO') handleZoomChange(1); }, [step, handleZoomChange]);

    if (!order) return null;

    const qrValue = `${window.location.origin}${window.location.pathname}?view=order_metadata&id=${encodeURIComponent(order['Order ID'])}`;
    
    // Use import.meta.env.BASE_URL (always '/Order_System/') so the URL is correct
    // even if window.location.pathname is temporarily wrong (e.g. assets/ sub-path).
    const baseUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const fullPrinterURL = `${baseUrl}?view=print_label&id=${encodeURIComponent(order['Order ID'])}&name=${encodeURIComponent(order['Customer Name'])}&phone=${encodeURIComponent(order['Customer Phone'])}&location=${encodeURIComponent(order.Location)}&address=${encodeURIComponent(order['Address Details'] || '')}&total=${order['Grand Total']}&store=${encodeURIComponent(order['Fulfillment Store'] || '')}&page=${encodeURIComponent(order.Page || '')}&user=${encodeURIComponent(order.User || '')}&shipping=${encodeURIComponent(order['Internal Shipping Method'] || '')}&payment=${encodeURIComponent(order['Payment Status'] || '')}&note=${encodeURIComponent(order.Note || '')}&autoPrint=true`;

    return (
        <div className="fixed inset-0 z-[200] bg-[#0B0E11] flex flex-col animate-fade-in font-sans text-[#EAECEF]">
            {/* Hidden QR for Watermark */}
            <div ref={qrCodeRef} className="fixed -top-[1000px] -left-[1000px] opacity-0 pointer-events-none">
                <ReactQRCode value={qrValue} size={512} level="H" />
            </div>

            {showLabelEditor && (
                <div className="fixed inset-0 z-[300] bg-[#0B0E11] overflow-hidden">
                    <PrintLabelPage 
                        standalone={false}
                        onClose={() => setShowLabelEditor(false)}
                        initialData={{
                            id: order['Order ID'], name: order['Customer Name'], phone: order['Customer Phone'],
                            location: order.Location, address: order['Address Details'] || '',
                            total: String(order['Grand Total']), payment: order['Payment Status'] || '',
                            shipping: order['Internal Shipping Method'] || '', user: order.User,
                            page: order.Page, store: order['Fulfillment Store'], note: order.Note || ''
                        }}
                    />
                </div>
            )}

            {/* Header */}
            <header className="relative z-30 px-6 py-4 bg-[#181A20] border-b border-white/10 flex justify-between items-center flex-shrink-0 shadow-md">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-[#FCD535] transition-colors p-2 -ml-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-white tracking-tight leading-none">Pack System</h1>
                        <p className="text-xs font-medium text-gray-500 mt-1">Fulfillment Node: {order.Team}</p>
                    </div>

                    <div className="hidden lg:flex items-center gap-8 ml-8 border-l border-white/10 pl-8">
                        <div className="flex flex-col">
                            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Order Reference</span>
                            <span className="text-sm font-mono font-bold text-[#0ECB81] mt-0.5">#{order['Order ID'].substring(0, 16)}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0ECB81]/10 rounded-lg border border-[#0ECB81]/20">
                            <div className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse"></div>
                            <span className="text-xs font-bold text-[#0ECB81] uppercase tracking-wider">System Online</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                        <div className="w-6 h-6 rounded-lg bg-[#FCD535] flex items-center justify-center text-xs font-black text-black">
                            {currentUser?.FullName?.charAt(0) || 'P'}
                        </div>
                        <span className="text-sm font-bold text-white">{currentUser?.FullName || 'Packer'}</span>
                    </div>
                </div>
            </header>

            <main className="flex-grow flex flex-col xl:flex-row overflow-hidden relative z-10 w-full">
                <OrderSummaryPanel order={order} appData={appData} step={step} verifiedItems={verifiedItems} isOrderVerified={isOrderVerified} verifyItem={verifyItem} showFullImage={showFullImage} />

                <div className="flex-grow flex flex-col bg-[#0B0E11] relative">
                    {/* Info Ticker */}
                    <div className="px-8 py-4 bg-[#1e2329] border-b border-white/10 flex items-center gap-12 flex-shrink-0 overflow-x-auto no-scrollbar">
                        <div className="flex flex-col">
                            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Total Collection</span>
                            <span className="text-lg font-mono font-bold text-[#0ECB81]">${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Customer Name</span>
                            <span className="text-base font-bold text-white">{order['Customer Name']}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Contact Number</span>
                            <span className="text-base font-mono font-bold text-[#FCD535]">{order['Customer Phone']}</span>
                        </div>
                        <div className="flex flex-col max-w-xs">
                            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Shipping Method</span>
                            <span className="text-sm font-bold text-white truncate">{order['Internal Shipping Method'] || 'Standard'}</span>
                        </div>
                    </div>

                    <div className="flex-grow flex flex-col p-8 overflow-y-auto">
                        <div className="w-full h-full flex flex-col max-w-5xl mx-auto">
                            {uploading && undoTimer === null && (
                                <div className="bg-[#1E2329] border border-white/10 rounded-2xl p-6 mb-8 shadow-xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#FCD535] animate-pulse"></div>
                                            <span className="text-sm font-bold text-white">Uploading Packaging Evidence...</span>
                                        </div>
                                        <span className="text-base font-mono font-bold text-[#FCD535]">{uploadProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#FCD535] transition-all duration-300 shadow-[0_0_10px_rgba(252,213,53,0.5)]" style={{ width: `${uploadProgress}%` }}></div>
                                    </div>
                                </div>
                            )}

                            <div className="flex-grow flex flex-col">
                                {step === 'VERIFYING' && (
                                    <div className="bg-[#181A20] border border-white/5 rounded-3xl flex-grow flex flex-col overflow-hidden shadow-2xl">
                                        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                                            <h3 className="text-base font-bold text-white tracking-tight">Order Verification</h3>
                                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Awaiting Manual Pack</span>
                                        </div>
                                        
                                        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-8">
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Shipping Service</span>
                                                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex items-center justify-between">
                                                        <span className="text-base font-bold text-white">{order?.['Internal Shipping Method'] || 'Regular'}</span>
                                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Customer Details</span>
                                                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs text-gray-500 font-bold">Name</span>
                                                            <span className="text-base text-white font-bold">{order?.['Customer Name']}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs text-gray-500 font-bold">Phone</span>
                                                            <span className="text-base text-[#FCD535] font-mono font-bold">{order?.['Customer Phone']}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-8">
                                                <div className="flex flex-col gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Financial Summary</span>
                                                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs text-gray-500 font-bold uppercase">Payment Mode</span>
                                                            <span className="text-sm text-white font-bold bg-white/5 px-3 py-1 rounded-lg uppercase">{order?.['Payment Info'] || 'Cash'}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-3 border-t border-white/10">
                                                            <span className="text-sm text-gray-500 font-bold uppercase">Grand Total</span>
                                                            <span className="text-2xl font-mono font-bold text-[#0ECB81]">${(Number(order?.['Grand Total']) || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {order.Note && (
                                                    <div className="bg-red-500/10 border border-red-500/20 p-5 rounded-2xl">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="w-1.5 h-4 bg-red-500 rounded-full"></div>
                                                            <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Instruction</span>
                                                        </div>
                                                        <p className="text-sm text-red-100/80 font-medium italic leading-relaxed">"{order.Note}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-auto bg-white/[0.03] px-10 py-6 border-t border-white/5 flex items-center justify-center gap-4">
                                            <div className="w-2 h-2 rounded-full bg-[#FCD535] animate-ping"></div>
                                            <span className="text-sm font-bold text-gray-400">Please pack items and verify counts on the left...</span>
                                        </div>
                                    </div>
                                )}

                                {step === 'LABELING' && (
                                    <div className="bg-[#181A20] rounded-[2.5rem] p-20 border border-white/5 flex-grow flex flex-col items-center justify-center gap-12 shadow-2xl relative">
                                        <div className="w-28 h-28 bg-white/5 rounded-3xl flex items-center justify-center text-[#FCD535] shadow-inner border border-white/10">
                                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2-2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                                        </div>
                                        <div className="text-center space-y-2">
                                            <h3 className="text-3xl font-bold text-white tracking-tight">Generate Shipping Label</h3>
                                            <p className="text-sm text-gray-500 font-medium">Connect thermal printer for best results</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center gap-6 w-full max-w-xl">
                                            <button 
                                                onClick={() => { printViaIframe(fullPrinterURL || ''); setHasGeneratedLabel(true); }} 
                                                className={`relative overflow-hidden w-full py-6 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-4 ${
                                                    hasGeneratedLabel ? 'bg-[#0ECB81] text-white shadow-xl shadow-[#0ECB81]/20' : 
                                                    'bg-[#FCD535] text-black shadow-xl shadow-[#FCD535]/20'
                                                }`}
                                            >
                                                <span className="relative z-10 flex items-center gap-3">
                                                    {hasGeneratedLabel ? 'Label Printed ✓' : 'Print Thermal Label'}
                                                </span>
                                            </button>
                                            <button 
                                                onClick={() => setShowLabelEditor(true)} 
                                                className="w-full py-6 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-lg transition-all border border-white/10 flex items-center justify-center gap-3"
                                            >
                                                Edit Details
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className={`bg-[#181A20] rounded-[2.5rem] p-8 sm:p-12 flex-grow flex flex-col items-center justify-center gap-10 animate-fade-in border border-white/5 shadow-2xl relative overflow-hidden ${step === 'PHOTO' ? 'flex' : 'hidden'}`}>
                                    <div className="relative group w-full max-w-4xl aspect-video">
                                        <div className={`w-full h-full bg-black rounded-3xl flex items-center justify-center border-[3px] transition-all duration-500 overflow-hidden relative ${packagePhoto ? 'border-[#0ECB81]' : autoCaptureCountdown !== null ? 'border-[#FCD535]' : 'border-white/10'}`}>
                                            <div id="fastpack-scanner-container" className={`absolute inset-0 z-0 transition-opacity duration-700 ${packagePhoto ? 'opacity-0' : 'opacity-100'}`}></div>
                                            
                                            {packagePhoto && (
                                                <div className="absolute inset-0 z-10 animate-in zoom-in-105 duration-500 bg-[#0B0E11]">
                                                    <img src={packagePhoto} className="w-full h-full object-contain" alt="Package" />
                                                </div>
                                            )}

                                            {autoCaptureCountdown !== null && !packagePhoto && (
                                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
                                                    <div className="text-[12rem] font-black text-[#FCD535] animate-pulse drop-shadow-[0_0_50px_rgba(252,213,53,0.5)]">
                                                        {autoCaptureCountdown}
                                                    </div>
                                                    <p className="text-xs font-bold text-[#FCD535] uppercase tracking-[0.5em] mt-4 animate-pulse">Capturing Evidence...</p>
                                                </div>
                                            )}

                                            {!packagePhoto && !isScannerLoading && autoCaptureCountdown === null && (
                                                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                                                    <div className="w-full h-full max-w-[400px] max-h-[400px] relative">
                                                        <div className="absolute top-0 left-0 w-12 h-12 border-t-[4px] border-l-[4px] border-[#FCD535]/50 rounded-tl-2xl"></div>
                                                        <div className="absolute top-0 right-0 w-12 h-12 border-t-[4px] border-r-[4px] border-[#FCD535]/50 rounded-tr-2xl"></div>
                                                        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[4px] border-l-[4px] border-[#FCD535]/50 rounded-bl-2xl"></div>
                                                        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[4px] border-r-[4px] border-[#FCD535]/50 rounded-br-2xl"></div>
                                                        <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#FCD535]/40 to-transparent animate-scan-line z-20"></div>
                                                    </div>
                                                </div>
                                            )}

                                            {!packagePhoto && !isScannerLoading && (
                                                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-6 p-3 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl">
                                                    <button onClick={switchCamera} className="p-4 bg-white/10 hover:bg-[#FCD535] text-white hover:text-black rounded-2xl transition-all active:scale-90 group">
                                                        <svg className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                    </button>
                                                    {isTorchSupported && (
                                                        <button onClick={toggleTorch} className={`p-4 rounded-2xl transition-all active:scale-90 flex items-center justify-center border-2 ${isTorchOn ? 'bg-[#FCD535] text-black border-[#FCD535]' : 'bg-white/10 text-white border-white/10'}`}>
                                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {packagePhoto && (
                                                <button onClick={() => setPackagePhoto(null)} className="absolute top-6 right-6 z-30 bg-red-500 text-white p-4 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center gap-8 w-full relative">
                                        <button 
                                            onClick={capturePhotoFromStream}
                                            disabled={isCapturing || !!packagePhoto || isScannerLoading}
                                            className={`w-full max-w-xl py-6 rounded-3xl font-bold text-lg transition-all duration-300 active:scale-95 shadow-2xl flex items-center justify-center gap-4 ${
                                                packagePhoto ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-2 border-[#0ECB81]/20 cursor-default' : 
                                                'bg-[#FCD535] hover:shadow-[0_20px_40px_rgba(252,213,53,0.3)] text-black'
                                            }`}
                                        >
                                            {isCapturing ? (
                                                <><Spinner size="sm" />Capturing...</>
                                            ) : packagePhoto ? (
                                                <><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Photo Saved Successfully</>
                                            ) : (
                                                <><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>Capture Evidence Photo</>
                                            )}
                                        </button>
                                        
                                        <div className="flex items-center gap-10 px-8 py-4 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${packagePhoto ? 'bg-gray-600' : 'bg-[#0ECB81] animate-pulse'}`}></div><span className="text-xs font-bold text-gray-400">Camera Active</span></div>
                                            <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${packagePhoto ? 'bg-gray-600' : 'bg-[#FCD535] animate-pulse'}`}></div><span className="text-xs font-bold text-gray-400">QR Auto-Scan</span></div>
                                        </div>
                                    </div>

                                    <style>{`
                                        #fastpack-scanner-container video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
                                        @keyframes scan-line { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
                                        .animate-scan-line { position: absolute; animation: scan-line 3.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
                                    `}</style>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <ActionControls step={step} isOrderVerified={isOrderVerified} hasGeneratedLabel={hasGeneratedLabel} packagePhoto={packagePhoto} uploading={uploading} undoTimer={undoTimer} onClose={onClose} setStep={setStep} handleSubmit={handleSubmit} />

            {undoTimer !== null && (
                <OrderGracePeriod timer={undoTimer} maxTimer={maxUndoTimer} onUndo={handleUndo} isUndoing={isUndoing} accentColor="yellow" title="BROADCASTING TRANSACTION..." subtitle="Metadata is being committed to the system. Undo to halt." />
            )}
        </div>
    );
};

export default FastPackTerminal;
