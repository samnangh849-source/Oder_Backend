import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactQRCode from 'react-qr-code';
import { AppContext } from '@/context/AppContext';
import { useUI } from '@/context/UIContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { fileToDataUrl, convertGoogleDriveUrl } from '@/utils/fileUtils';
import { compressImage } from '@/utils/imageCompressor';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import OrderGracePeriod from '@/components/orders/OrderGracePeriod';
import { printViaIframe } from '@/utils/printUtils';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { useOrder } from '@/context/OrderContext';
import { translations } from '@/translations';
import UserAvatar from '@/components/common/UserAvatar';
import { useSoundEffects } from '@/hooks/useSoundEffects';

import { Printer, Edit3, MapPin } from 'lucide-react';
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
    const { currentUser, appData, advancedSettings, language } = useContext(AppContext);
    const { showNotification } = useUI();
    const { playNotify } = useSoundEffects();
    const t = translations[language as 'km' | 'en'];
    const { setOrders } = useOrder();
    
    const [step, setStep] = useState<PackStep>('VERIFYING');
    const prevStepRef = useRef<PackStep>('VERIFYING');

    const formattedPhone = useMemo(() => {
        if (!order?.['Customer Phone']) return '';
        const phone = order['Customer Phone'].trim();
        return phone.startsWith('0') ? phone : '0' + phone;
    }, [order]);

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        showNotification(`${label} Copied`, 'success');
    };
    
    // Update prevStepRef whenever step changes
    useEffect(() => {
        return () => {
            prevStepRef.current = step;
        };
    }, [step]);

    const [verifiedItems, setVerifiedItems] = useState<Record<string, number>>({}); 
    const hasAutoAdvanced = useRef({ verify: false, label: false, photo: false });
    const qrCodeRef = useRef<HTMLDivElement>(null);

    const isOrderVerified = useMemo(() => {
        if (!order) return false;
        return order.Products.every(p => (verifiedItems[p.name] || 0) >= p.quantity);
    }, [order, verifiedItems]);

    const isFlexiGear = useMemo(() => {
        const store = order?.['Fulfillment Store']?.toLowerCase() || '';
        return store.includes('flexi');
    }, [order]);

    const isACCStore = useMemo(() => {
        const store = order?.['Fulfillment Store']?.toLowerCase() || '';
        return store.includes('acc');
    }, [order]);
    
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [hasGeneratedLabel, setHasGeneratedLabel] = useState(false);
    const [packagePhoto, setPackagePhoto] = useState<string | null>(null);
    const [showLabelEditor, setShowLabelEditor] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [printTarget, setPrintTarget] = useState<'label' | 'qr'>('label');

    // Automatically trigger print when entering LABELING step ONLY if coming from VERIFYING
    useEffect(() => {
        if (step === 'LABELING' && prevStepRef.current === 'VERIFYING') {
            const timer = setTimeout(() => {
                handleDirectPrint('label');
            }, 800); // Small delay to allow Step 2 UI to animate in
            return () => clearTimeout(timer);
        }
    }, [step]);

    const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [palmDetected, setPalmDetected] = useState(false);
    const lastDetectedQR = useRef<string | null>(null);
    const lastGestureTime = useRef<number>(0);
    const countdownTimerRef = useRef<any>(null);
    
    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [isUndoing, setIsUndoing] = useState(false);
    const maxUndoTimer = advancedSettings.packagingGracePeriod || 2;
    const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const submitIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const barcodeBuffer = useRef<string>('');
    const lastKeyTime = useRef<number>(0);

    const verifyItem = useCallback((name: string) => {
        if (!name) return;
        setVerifiedItems(prev => {
            const product = order?.Products.find(p => p.name === name);
            const current = prev[name] || 0;
            const max = Number(product?.quantity) || 1;
            if (current >= max) return prev;
            return { ...prev, [name]: current + 1 };
        });
    }, [order]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (step !== 'VERIFYING') return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            const now = Date.now();
            const diff = now - lastKeyTime.current;
            lastKeyTime.current = now;
            if (diff > 100) barcodeBuffer.current = '';
            if (e.key === 'Enter') {
                const finalBarcode = barcodeBuffer.current.trim();
                if (finalBarcode) {
                    const product = appData.products?.find(p => p.Barcode === finalBarcode || p.ProductName === finalBarcode);
                    if (product) {
                        const orderItem = order?.Products.find(op => op.name === product.ProductName);
                        if (orderItem) verifyItem(orderItem.name);
                    } else {
                        const orderItem = order?.Products.find(op => op.name === finalBarcode);
                        if (orderItem) verifyItem(orderItem.name);
                    }
                }
                barcodeBuffer.current = '';
                e.preventDefault();
            } else if (e.key.length === 1) barcodeBuffer.current += e.key;
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [step, appData.products, order, verifyItem]);

    const executeFinalSubmit = useCallback(async () => {
        try {
            if (!order) return;
            setUploading(true); setUploadProgress(5); 
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const packTime = new Date().toLocaleString('km-KH');
            const newData = { 'Fulfillment Status': 'Ready to Ship', 'Packed By': currentUser?.FullName || 'Packer', 'Packed Time': packTime };
            
            setUploadProgress(20);
            
            // 1. ALWAYS update status synchronously first to ensure it appears in "Ready for Dispatch" immediately
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
            
            if (!statusResponse.ok) {
                const errorData = await statusResponse.json().catch(() => ({}));
                throw new Error(errorData.message || "Status update failed");
            }
            
            setUploadProgress(60);

            // 2. Start Image Upload in background (if photo exists) - do NOT wait for this to finish
            if (packagePhoto) {
                const base64Data = packagePhoto.includes(',') ? packagePhoto.split(',')[1] : packagePhoto;
                // Note: We don't pass newData here because we already updated it above
                const uploadData = { 
                    action: 'uploadImage', 
                    fileData: base64Data, 
                    fileName: `Package_${order['Order ID'].substring(0,8)}_${Date.now()}.jpg`, 
                    mimeType: 'image/jpeg', 
                    orderId: order['Order ID'], 
                    team: order.Team, 
                    targetColumn: 'Package Photo', 
                    isAsync: true 
                };
                
                fetch(`${WEB_APP_URL}/api/upload-image`, { 
                    method: 'POST', 
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${token}` 
                    }, 
                    body: JSON.stringify(uploadData) 
                }).catch(err => console.error("Background upload failed:", err));
            }
            
            setUploadProgress(90);

            // 3. Update local state and trigger success
            setOrders(prev => prev.map(o => o['Order ID'] === order['Order ID'] ? { 
                ...o, 
                'Fulfillment Status': 'Ready to Ship', 
                FulfillmentStatus: 'Ready to Ship', 
                'Packed By': currentUser?.FullName || 'Packer', 
                'Packed Time': packTime, 
                'Package Photo': packagePhoto || o['Package Photo'] 
            } : o));
            
            setUploadProgress(100);
            onSuccess(packagePhoto || 'manual_sync_ok');
        } catch (err: any) { 
            alert("❌ បញ្ជូនបរាជ័យ: " + err.message); 
        } finally { 
            setUploading(false); 
            setUploadProgress(0); 
        }
    }, [order, currentUser, onSuccess, packagePhoto, setOrders]);

    const handleSubmit = useCallback(() => {
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);
        const gracePeriod = advancedSettings.packagingGracePeriod || 2;
        setUndoTimer(gracePeriod);
        let secondsLeft = gracePeriod;
        submitIntervalRef.current = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft <= 0) {
                if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);
                submitIntervalRef.current = null; setUndoTimer(null); executeFinalSubmit();
            } else setUndoTimer(secondsLeft);
        }, 1000);
    }, [advancedSettings.packagingGracePeriod, executeFinalSubmit]);

    const handleUndo = () => {
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);
        setIsUndoing(true); setTimeout(() => { setUndoTimer(null); setIsUndoing(false); }, 500);
    };

    useEffect(() => {
        const handlePrintSuccess = (e: any) => { 
            if (e.detail?.target) {
                setPrintTarget(e.detail.target);
                if (e.detail.target === 'label') {
                    setHasGeneratedLabel(true); 
                    // Automatically advance to PHOTO step after a short delay if not in editor
                    if (!showLabelEditor) {
                        setTimeout(() => setStep('PHOTO'), 1500); 
                    }
                }
            }
        };
        window.addEventListener('print-success', handlePrintSuccess);
        return () => window.removeEventListener('print-success', handlePrintSuccess);
    }, [showLabelEditor]);

    const capturePhotoFromStream = useCallback(async () => {
        const video = document.querySelector('#fastpack-scanner-container video') as HTMLVideoElement;
        if (!video || isCapturing || !order) return;
        setIsCapturing(true);
        try {
            const canvas = document.createElement('canvas');
            const videoWidth = video.videoWidth; 
            const videoHeight = video.videoHeight;
            const targetMax = 2560; // Keep high resolution for detail
            
            // Maintain aspect ratio
            if (videoWidth > videoHeight) { 
                canvas.width = targetMax; 
                canvas.height = targetMax / (videoWidth / videoHeight); 
            } else { 
                canvas.height = targetMax; 
                canvas.width = targetMax * (videoWidth / videoHeight); 
            }
            
            const ctx = canvas.getContext('2d'); 
            if (!ctx) throw new Error("Canvas Error");

            // 1. Draw Video Frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // 2. Setup styles
            const paddingX = canvas.width * 0.06;
            const paddingY = canvas.height * 0.07;

            // Helper for text with shadow
            const drawTextWithShadow = (text: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', baseline: CanvasTextBaseline = 'top') => {
                ctx.save();
                ctx.textAlign = align;
                ctx.textBaseline = baseline;
                ctx.font = font;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 12;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;
                ctx.fillStyle = color;
                ctx.fillText(text, x, y);
                ctx.restore();
            };

            // --- TOP LEFT INFO ---
            // "CONSIGNMENT VERIFICATION PROOF"
            drawTextWithShadow('CONSIGNMENT VERIFICATION PROOF', paddingX, paddingY, `bold ${Math.round(canvas.height * 0.02)}px Kantumruy Pro, Kantumruy, sans-serif`, '#FCD535');

            // "#ORDER_ID"
            const orderIdShort = order['Order ID'].substring(0, 8).toUpperCase();
            drawTextWithShadow(`#${orderIdShort}`, paddingX, paddingY + (canvas.height * 0.035), `bold ${Math.round(canvas.height * 0.075)}px Kantumruy Pro, Kantumruy, sans-serif`, '#FFFFFF');

            // Customer Name
            drawTextWithShadow(order['Customer Name'], paddingX, paddingY + (canvas.height * 0.12), `bold ${Math.round(canvas.height * 0.045)}px Kantumruy Pro, Kantumruy, sans-serif`, '#FCD535');


            // --- TOP RIGHT BADGE ---
            const badgeText = 'SECURELY PACKED';
            ctx.font = `bold ${Math.round(canvas.height * 0.025)}px Kantumruy Pro, Kantumruy, sans-serif`;
            const textMetrics = ctx.measureText(badgeText);
            const badgeW = textMetrics.width + 60;
            const badgeH = canvas.height * 0.06;
            const badgeX = canvas.width - paddingX - badgeW;
            const badgeY = paddingY;

            // Draw rounded rectangle for badge
            ctx.fillStyle = '#0ECB81'; // Green
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
            ctx.fill();
            
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `bold ${Math.round(canvas.height * 0.025)}px Kantumruy Pro, Kantumruy, sans-serif`;
            ctx.fillText(badgeText, badgeX + badgeW/2, badgeY + badgeH/2);


            // --- BOTTOM LEFT INFO ---
            const botLeftY = canvas.height - paddingY;
            const lineSpacing = canvas.height * 0.06;

            // Value formatting
            const priceStr = `$${(Number(order['Grand Total']) || 0).toFixed(2)}`;

            // 4th line (bottom): "តម្លៃ: $Price"
            drawTextWithShadow(`តម្លៃ:   ${priceStr}`, paddingX, botLeftY, `bold ${Math.round(canvas.height * 0.055)}px Kantumruy Pro, Kantumruy, sans-serif`, '#0ECB81', 'left', 'bottom');

            // 3rd line: "អ្នកវេចខ្ចប់: Name"
            drawTextWithShadow(`អ្នកវេចខ្ចប់: ${currentUser?.FullName || 'Admin'}`, paddingX, botLeftY - lineSpacing - 15, `bold ${Math.round(canvas.height * 0.03)}px Kantumruy Pro, Kantumruy, sans-serif`, '#FFFFFF', 'left', 'bottom');

            // 2nd line: "លេខទូរស័ព្ទ: Phone"
            drawTextWithShadow(`លេខទូរស័ព្ទ: ${formattedPhone}`, paddingX, botLeftY - (lineSpacing * 2) - 30, `bold ${Math.round(canvas.height * 0.03)}px Kantumruy Pro, Kantumruy, sans-serif`, '#FCD535', 'left', 'bottom');

            // 1st line: "ទីតាំង: Location"
            drawTextWithShadow(`ទីតាំង: ${order.Location}`, paddingX, botLeftY - (lineSpacing * 3) - 45, `bold ${Math.round(canvas.height * 0.03)}px Kantumruy Pro, Kantumruy, sans-serif`, '#FFFFFF', 'left', 'bottom');


            // --- BOTTOM RIGHT QR & TIMESTAMP ---
            const qrSize = Math.round(canvas.height * 0.22);
            const qrX = canvas.width - paddingX - qrSize;
            const qrY = canvas.height - paddingY - qrSize;

            // Draw QR Code from hidden element
            const svg = qrCodeRef.current?.querySelector('svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const img = new Image();
                img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                await img.decode();
                
                // Draw white background for QR
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.roundRect(qrX - 15, qrY - 15, qrSize + 30, qrSize + 30, 10);
                ctx.fill();
                ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
            }

            // "SCAN TO VERIFY" and Timestamp (to the left of QR)
            const textX = qrX - 40;
            const textYOffset = qrY + (qrSize / 2);
            
            drawTextWithShadow('SCAN TO VERIFY', textX, textYOffset + 10, `bold ${Math.round(canvas.height * 0.022)}px Kantumruy Pro, Kantumruy, sans-serif`, 'rgba(255, 255, 255, 0.8)', 'right', 'bottom');
            
            const timestamp = new Date().toLocaleString('en-US', { hour12: true });
            drawTextWithShadow(timestamp, textX, textYOffset + 40, `${Math.round(canvas.height * 0.022)}px Kantumruy Pro, Kantumruy, sans-serif`, 'rgba(255, 255, 255, 0.7)', 'right', 'bottom');

            // Finalize
            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95)); 
            if (!blob) throw new Error("Blob Error");
            const compressed = await compressImage(new File([blob], 'proof.jpg', { type: 'image/jpeg' }), 'high-detail');
            setPackagePhoto(await fileToDataUrl(compressed)); 
            setAutoCaptureCountdown(null);
        } catch (err) { 
            console.error(err); 
        } finally { 
            setIsCapturing(false); 
        }
    }, [order, currentUser, isCapturing, formattedPhone]);

    const { 
        isInitializing: isScannerLoading, 
        switchCamera, 
        toggleTorch, 
        isTorchOn, 
        isTorchSupported, 
        stopScanner, 
        trackingBox,
        handBox,
        handKeypoints,
        faceBox,
        detectedGesture,
        activeVideo
    } = useBarcodeScanner('fastpack-scanner-container', (decoded) => {
        if (step !== 'PHOTO' || packagePhoto || autoCaptureCountdown !== null || isCapturing) return;
        if (decoded === lastDetectedQR.current) return;
        lastDetectedQR.current = decoded; setAutoCaptureCountdown(2);
    }, 'single', { disableScanner: step !== 'PHOTO' || (step === 'PHOTO' && !!packagePhoto) });

    useEffect(() => {
        if (step !== 'PHOTO' || packagePhoto || autoCaptureCountdown !== null || isCapturing) return;
        
        const now = Date.now();
        
        // 1. Detect Open Palm (Five Fingers)
        if (detectedGesture === 'five_fingers' && !palmDetected) {
            if (now - lastGestureTime.current > 2000) {
                setPalmDetected(true);
                playNotify(); // Confirmation sound for palm
                lastGestureTime.current = now;
            }
        }
        
        // 2. Detect Closed Fist AFTER Palm
        if (detectedGesture === 'fist' && palmDetected) {
            if (now - lastGestureTime.current > 500) { // Small buffer
                setPalmDetected(false);
                lastGestureTime.current = now;
                playNotify(); // Sound for countdown start
                setAutoCaptureCountdown(2);
            }
        }

        // 3. Reset palm detection if no action for 5 seconds
        if (palmDetected && now - lastGestureTime.current > 5000) {
            setPalmDetected(false);
        }

    }, [detectedGesture, step, packagePhoto, autoCaptureCountdown, isCapturing, playNotify, palmDetected]);

    useEffect(() => {
        if (autoCaptureCountdown === null) return;
        if (autoCaptureCountdown === 0) { capturePhotoFromStream(); return; }
        countdownTimerRef.current = setTimeout(() => setAutoCaptureCountdown(prev => (prev !== null ? prev - 1 : null)), 1000);
        return () => { if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current); };
    }, [autoCaptureCountdown, capturePhotoFromStream]);

    useEffect(() => {
        if (packagePhoto && !hasAutoAdvanced.current.photo && step === 'PHOTO') {
            hasAutoAdvanced.current.photo = true; try { stopScanner(); } catch (e) {} 
            // Give 3 seconds to preview the captured proof before initiating auto-submit
            setTimeout(() => handleSubmit(), 3000);
        }
    }, [packagePhoto, step, handleSubmit, stopScanner]);



    const handleDirectPrint = (target: 'label' | 'qr') => {
        setPrintTarget(target);
        // We need to wait a tiny bit for React to update the hidden component's prop
        setTimeout(() => {
            window.print();
            if (target === 'label') {
                setHasGeneratedLabel(true);
                // Automatically advance to PHOTO step after a short delay
                setTimeout(() => setStep('PHOTO'), 1000);
            }
        }, 50);
    };

    if (!order) return null;
    const qrValue = `${window.location.origin}${window.location.pathname}?view=order_metadata&id=${encodeURIComponent(order['Order ID'])}`;
    
    return (
        <div className="fixed inset-0 z-[200] bg-[#08090a] flex flex-col animate-fade-in font-sans text-[#EAECEF] overflow-hidden">
            {/* Main Terminal UI with no-print class */}
            <div className="flex flex-col h-full no-print">
                {/* Background elements */}
                <div className="absolute inset-0 bg-[#08090a] z-0"></div>
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#FCD535]/5 to-transparent z-0 pointer-events-none"></div>

                <div ref={qrCodeRef} className="fixed -top-[1000px] -left-[1000px] opacity-0 pointer-events-none"><ReactQRCode value={qrValue} size={512} level="H" /></div>
                
                {showLabelEditor && (
                    <div className="fixed inset-0 z-[300] bg-[#08090a] overflow-hidden">
                        <PrintLabelPage 
                            standalone={false} 
                            onClose={() => {
                                setShowLabelEditor(false);
                                setRefreshKey(prev => prev + 1);
                            }} 
                            initialData={{ id: order['Order ID'], name: order['Customer Name'], phone: formattedPhone, location: order.Location, address: order['Address Details'] || '', total: String(order['Grand Total']), payment: order['Payment Status'] || '', shipping: order['Internal Shipping Method'] || '', user: order.User, page: order.Page, store: order['Fulfillment Store'], note: order.Note || '' }} 
                        />
                    </div>
                )}

                {/* HEADER - COMPACT PREMIUM SQUARED STYLE */}
                <header className="relative z-30 bg-[#0B0E11] border-b border-white/10 px-8 py-3.5 flex justify-between items-center shadow-xl">
                <div className="flex items-center gap-6 group cursor-pointer" onClick={onClose}>
                    {/* Minimal Squared Back Button */}
                    <div className="w-10 h-10 border border-white/20 flex items-center justify-center transition-all group-hover:bg-[#FCD535] group-hover:border-[#FCD535] active:scale-90">
                        <svg className="w-5 h-5 text-white group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    </div>
                    
                    <div className="flex items-baseline gap-3">
                        <h1 className="text-2xl font-black text-white tracking-tight uppercase">
                            FASTPACK
                        </h1>
                        <span className="text-[#FCD535] font-light tracking-[0.4em] text-sm uppercase border-l border-white/20 pl-3">
                            TERMINAL
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden sm:flex flex-col items-end border-r border-white/10 pr-5">
                        <span className="text-[9px] font-black text-[#FCD535] uppercase tracking-[0.3em] opacity-60">Operator</span>
                        <span className="text-sm font-black text-white uppercase tracking-tighter">{currentUser?.FullName || 'Admin'}</span>
                    </div>
                    
                    {/* Clean Squared Avatar */}
                    <div className="w-10 h-10 bg-white/5 border border-white/10 p-0.5 relative">
                        <UserAvatar 
                            avatarUrl={currentUser?.ProfilePictureURL} 
                            name={currentUser?.FullName || 'P'} 
                            size="sm" 
                            className="!rounded-none w-full h-full object-cover"
                        />
                        {/* Status corner accent */}
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#FCD535]"></div>
                    </div>
                </div>
            </header>

            {/* SUB-HEADER: STEP PROGRESS BAR */}
            <nav className="relative z-20 bg-[#0B0E11] border-b border-white/5 px-8 py-4 flex items-center overflow-hidden">
                {/* Radial Gradient Background (Subtle) */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(252,213,53,0.05)_0%,_transparent_75%)] pointer-events-none"></div>
                
                <div className="flex items-center justify-between w-full relative z-10">
                    {[
                        { id: 'VERIFYING', label: '01. Verification' },
                        { id: 'LABELING', label: '02. Thermal Label' },
                        { id: 'PHOTO', label: '03. Visual Evidence' }
                    ].map((s, idx, arr) => {
                        const stepOrder = { 'VERIFYING': 0, 'LABELING': 1, 'PHOTO': 2 };
                        const currentIdx = stepOrder[step as keyof typeof stepOrder] ?? 0;
                        const isCompleted = idx < currentIdx;
                        const isActive = idx === currentIdx;
                        const isPending = idx > currentIdx;

                        return (
                            <React.Fragment key={s.id}>
                                <div className={`relative flex items-center gap-4 transition-all duration-500 ${(isActive || isCompleted) ? 'opacity-100' : 'opacity-25'}`}>
                                    <div className={`w-10 h-10 flex items-center justify-center border-2 transition-all duration-500 ${(isActive || isCompleted) ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'border-white/10 text-white/30'}`}>
                                        <span className="text-sm font-black">{isCompleted ? "✓" : idx + 1}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-[12px] font-black uppercase tracking-[0.2em] ${(isActive || isCompleted) ? 'text-[#FCD535]' : 'text-white/30'}`}>{s.label}</span>
                                        {isActive && <span className="text-[9px] text-[#FCD535] font-bold tracking-widest mt-0.5">ACTIVE</span>}
                                        {isCompleted && <span className="text-[9px] text-[#FCD535]/60 font-bold tracking-widest mt-0.5">COMPLETED</span>}
                                    </div>
                                </div>
                                {idx < arr.length - 1 && (
                                    <div className="flex-grow flex items-center justify-center px-4">
                                        <div className={`h-[1px] flex-grow transition-colors duration-700 ${idx < currentIdx ? 'bg-[#FCD535]' : 'bg-white/10'}`}></div>
                                        <svg className={`w-4 h-4 mx-3 transition-colors duration-700 ${idx < currentIdx ? 'text-[#FCD535]' : 'text-white/10'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                                        <div className="h-[1px] flex-grow bg-white/10"></div>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </nav>

            <main className="flex-grow flex flex-col lg:flex-row overflow-hidden relative z-10 w-full">
                {/* LEFT SIDE: PACKING CHECKLIST - BINANCE THEME */}
                <div className="w-full lg:w-[550px] xl:w-[620px] shrink-0 flex flex-col bg-[#181A20] p-6 lg:p-8 border-r border-[#2B3139] z-20 overflow-hidden">
                    <OrderSummaryPanel order={order} appData={appData} verifiedItems={verifiedItems} verifyItem={verifyItem} />
                </div>

                {/* RIGHT SIDE: CONTENT AREA */}
                <div className="flex-grow flex flex-col relative overflow-hidden bg-[#08090a]">
                    
                    <div className="flex-grow flex flex-col relative p-6 lg:p-10 overflow-hidden">
                        <div className="bg-[#0B0E11] border border-white/5 rounded-none flex-grow flex flex-col overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.5)] relative">
                            <div className="flex-grow flex flex-col relative overflow-hidden">
                                {uploading && (
                                    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#08090a]/98 backdrop-blur-2xl animate-in fade-in duration-300">
                                        <div className="w-40 h-40 rounded-none border-[3px] border-[#FCD535]/10 flex items-center justify-center relative mb-10 overflow-hidden">
                                            <div className="absolute bottom-0 left-0 w-full bg-[#FCD535] transition-all duration-300 shadow-[0_0_30px_#FCD535]" style={{ height: `${uploadProgress}%` }}></div>
                                            <span className="text-5xl font-black text-white mix-blend-difference">{uploadProgress}%</span>
                                        </div>
                                        <h3 className="text-2xl font-black text-white tracking-widest uppercase mb-2">Syncing Data</h3>
                                        <p className="text-xs font-bold text-gray-600 uppercase tracking-[0.6em] animate-pulse">Updating Central Logistics Ledger</p>
                                    </div>
                                )}

                                {(step === 'VERIFYING' || step === 'LABELING') && (
                                    <div className="h-full flex flex-col p-6 lg:p-8 animate-in fade-in zoom-in-95 duration-700 overflow-hidden bg-[#181A20]">
                                        <div className="flex-grow flex flex-col gap-6 overflow-hidden">
                                            {/* --- Header matching Check List --- */}
                                            <div className="shrink-0 space-y-4 px-1">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                                            Order Information <span className="text-xs font-normal text-[#848E9C] px-2 py-0.5 bg-[#2B3139] rounded">DETAILS</span>
                                                        </h2>
                                                        <span className="text-[11px] font-medium text-[#848E9C] mt-1">Order Logistics & Entity Data</span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span 
                                                            onClick={() => handleCopy(order['Order ID'], 'Order ID')}
                                                            className="text-sm font-mono font-bold text-[#FCD535] bg-[#2B3139] px-3 py-1 rounded tracking-widest cursor-pointer hover:bg-[#363C44] transition-colors"
                                                        >
                                                            #{order['Order ID'].substring(0, 12)}
                                                        </span>
                                                        <span className="text-[11px] text-[#848E9C] mt-1">Reference ID</span>
                                                    </div>
                                                </div>
                                                <div className="w-full h-px bg-[#2B3139]"></div>
                                            </div>

                                            {/* --- List Content --- */}
                                            <div className="flex-grow overflow-y-auto custom-scrollbar-terminal space-y-1 pr-2">
                                                {/* 2. CUSTOMER & LOGISTICS ROW */}
                                                <div className="flex items-center gap-4 px-4 py-5 hover:bg-[#1E2329] transition-colors border-b border-white/5">
                                                    <div className="w-12 h-12 shrink-0 bg-[#2B3139] rounded-full flex items-center justify-center border border-[#363C44]">
                                                        <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    </div>
                                                    <div className="flex-grow min-w-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                        <div>
                                                            <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Customer Information | ព័ត៌មានអតិថិជន</span>
                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-1">
                                                                <h4 
                                                                    onClick={() => handleCopy(order['Customer Name'], 'Customer Name')}
                                                                    className="text-xl font-black text-white truncate leading-tight cursor-pointer hover:text-[#FCD535] transition-colors"
                                                                >
                                                                    {order['Customer Name']}
                                                                </h4>
                                                                <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
                                                                <div className="flex items-center gap-3">
                                                                    <span 
                                                                        onClick={() => handleCopy(formattedPhone, 'Phone Number')}
                                                                        className="text-xl font-mono font-black text-[#FCD535] tracking-[0.05em] cursor-pointer hover:text-white transition-colors"
                                                                    >
                                                                        {formattedPhone}
                                                                    </span>
                                                                    {(() => {
                                                                        const carrier = appData.phoneCarriers?.find(c =>
                                                                            String(c.Prefixes || '').split(',').map(p => p.trim()).filter(Boolean).some(prefix => formattedPhone?.startsWith(prefix))
                                                                        );
                                                                        if (!carrier) return null;
                                                                        return (
                                                                            <div className="w-6 h-6 flex items-center justify-center">
                                                                                <img 
                                                                                    src={convertGoogleDriveUrl(carrier.CarrierLogoURL || '')} 
                                                                                    className="w-full h-full object-contain" 
                                                                                    alt="Carrier"
                                                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Operational Source integrated on the right */}
                                                        <div className="flex items-center gap-5 lg:border-l lg:border-white/10 lg:pl-6 h-full">
                                                            <div className="w-12 h-12 shrink-0 flex items-center justify-center bg-white/5 rounded-none border border-white/10 p-1.5 shadow-inner">
                                                                <img 
                                                                    src={convertGoogleDriveUrl(appData.pages?.find(p => p.PageName === order.Page)?.PageLogoURL || '')} 
                                                                    className="w-full h-full object-contain" 
                                                                    alt="Page"
                                                                    onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(order.Page || 'P'))}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col justify-center">
                                                                <span className="text-[9px] font-black text-[#848E9C] uppercase tracking-[0.3em] mb-1 leading-none">Source & Dispatch Team</span>
                                                                <div className="flex items-center gap-4">
                                                                    <h4 className="text-xl font-black text-white truncate uppercase tracking-tighter leading-none">{order.Page || 'Direct'}</h4>
                                                                    <span className="px-5 py-2 bg-[#FCD535] text-black text-lg font-black uppercase rounded shadow-[0_0_20px_rgba(252,213,53,0.2)] border-2 border-black/5 flex items-center justify-center">
                                                                        <span className="leading-none pt-0.5">TEAM-{order.Team || 'GENERAL'}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 2.5 LOCATION & ADDRESS ROW */}
                                                <div className="flex items-center gap-4 px-4 py-5 hover:bg-[#1E2329] transition-colors border-b border-white/5">
                                                    <div className="w-12 h-12 shrink-0 bg-[#2B3139] rounded-full flex items-center justify-center border border-[#363C44]">
                                                        <MapPin className="w-6 h-6 text-white/60" />
                                                    </div>
                                                    <div className="flex-grow min-w-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                        <div>
                                                            <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Delivery Address | អាសយដ្ឋានដឹកជញ្ជូន</span>
                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-1">
                                                                <h4 
                                                                    onClick={() => handleCopy(order.Location, 'Location')}
                                                                    className="text-lg font-black text-white truncate leading-tight cursor-pointer hover:text-[#FCD535] transition-colors"
                                                                >
                                                                    {order.Location || 'N/A'}
                                                                </h4>
                                                                <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
                                                                <div className="flex items-center gap-3">
                                                                    <span 
                                                                        onClick={() => handleCopy(order['Address Details'], 'Address Details')}
                                                                        className="text-sm font-medium text-[#848E9C] cursor-pointer hover:text-white transition-colors"
                                                                    >
                                                                        {order['Address Details'] || 'No specific address details'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* User integrated on the right */}
                                                        <div className="flex items-center gap-3 lg:border-l lg:border-white/10 lg:pl-6">
                                                            <div className="w-10 h-10 shrink-0 bg-[#2B3139] rounded-full flex items-center justify-center border border-[#363C44] overflow-hidden">
                                                                <UserAvatar avatarUrl="" name={order.User || 'U'} size="sm" className="w-full h-full !rounded-none" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Order Submitter</span>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <h4 className="text-sm font-black text-white truncate uppercase">{order.User || 'System'}</h4>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 3. LOGISTICS & DISPATCH PROTOCOL */}
                                                <div className="border border-white/5 bg-[#1E2329]/30 rounded-none overflow-hidden mt-2">
                                                    <div className="flex flex-col lg:flex-row items-stretch gap-0 border-b border-white/5">
                                                        {/* Logistics Method */}
                                                        <div className="flex-1 flex items-center gap-4 px-5 py-6 border-r border-white/5 hover:bg-[#1E2329] transition-colors group">
                                                            <div className="w-11 h-11 shrink-0 flex items-center justify-center">
                                                                <img 
                                                                    src={convertGoogleDriveUrl(appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method'])?.LogoURL || '')} 
                                                                    className="w-full h-full object-contain" 
                                                                    alt="Shipping" 
                                                                    onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(order['Internal Shipping Method'] || 'S'))}
                                                                />
                                                            </div>
                                                            <div className="flex-grow min-w-0">
                                                                <span className="text-[9px] font-black text-[#848E9C] uppercase tracking-[0.2em] mb-1 block">Logistics Method</span>
                                                                <h4 className="text-[15px] font-black text-white uppercase truncate tracking-tight">{order['Internal Shipping Method']}</h4>
                                                                <span className="text-[10px] text-[#848E9C] font-bold truncate block mt-0.5">Authorized Carrier</span>
                                                            </div>
                                                        </div>

                                                        {/* Field Driver & Pay Protocol */}
                                                        <div className="flex-[2] flex items-center justify-between gap-4 px-5 py-6 hover:bg-[#1E2329] transition-colors group">
                                                            {(() => {
                                                                const driverName = order['Internal Shipping Details'] || order['Driver Name'];
                                                                const driverInfo = appData.drivers?.find(d => d.DriverName === driverName);
                                                                return (
                                                                    <>
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-11 h-11 shrink-0 bg-[#1E2329] border border-[#363C44] overflow-hidden flex items-center justify-center shadow-lg">
                                                                                {driverInfo?.ImageURL ? (
                                                                                    <img 
                                                                                        src={convertGoogleDriveUrl(driverInfo.ImageURL)} 
                                                                                        className="w-full h-full object-cover" 
                                                                                        alt="Driver" 
                                                                                    />
                                                                                ) : (
                                                                                    <span className="text-[10px] font-black text-[#848E9C] tracking-widest">{driverName ? driverName.substring(0,2).toUpperCase() : 'N/A'}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-grow min-w-0 flex flex-col justify-center">
                                                                                <span className="text-[9px] font-black text-[#848E9C] uppercase tracking-[0.2em] mb-1 block">Field Driver</span>
                                                                                <h4 className="text-[15px] font-black text-white uppercase truncate tracking-tight">{driverName || 'Not Assigned'}</h4>
                                                                                {driverName ? (
                                                                                    <span className="text-[9px] text-[#FCD535] font-black uppercase tracking-widest mt-0.5">Verified Agent</span>
                                                                                ) : (
                                                                                    <span className="text-[9px] text-[#848E9C]/70 font-black uppercase tracking-widest mt-0.5">Pending Assignment</span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Integrated Pay Info on the right of the cell */}
                                                                        <div className="flex flex-col items-end pl-6 border-l border-white/5">
                                                                            <span className="text-[9px] font-black text-[#848E9C] uppercase tracking-[0.2em] mb-1 block text-right">Internal Cost<br/>(ថ្លៃសេវាអ្នកដឹក)</span>
                                                                            <div className="flex items-baseline gap-1">
                                                                                <span className="text-xl font-mono font-black text-[#FCD535]">${(Number(order['Internal Cost']) || 0).toFixed(2)}</span>
                                                                                <span className="text-[9px] font-black text-[#848E9C] tracking-tighter uppercase">USD</span>
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 4. PAYMENT METHOD ROW */}
                                                <div className="flex items-center justify-between gap-4 px-4 py-5 hover:bg-[#1E2329] transition-colors border-b border-white/5">
                                                    {(() => {
                                                        const bankName = order['Payment Info']?.split(' ')[0];
                                                        const bank = appData.bankAccounts?.find(b => b.BankName.includes(bankName || 'Unknown'));
                                                        const isPaid = order['Payment Status']?.toUpperCase() === 'PAID';
                                                        return (
                                                            <>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                                                                        <img 
                                                                            src={convertGoogleDriveUrl(bank?.LogoURL || '')} 
                                                                            className="w-full h-full object-contain" 
                                                                            alt="Bank" 
                                                                            onError={(e) => (e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(bankName || 'B'))}
                                                                        />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Payment Info | ព័ត៌មានការបង់ប្រាក់</span>
                                                                        <h4 className="text-lg font-black text-white mt-1 truncate">
                                                                            {order['Payment Info'] || (isPaid ? 'ការទូទាត់ត្រូវបានបញ្ជាក់ (Confirmed)' : 'កំពុងរង់ចាំការបង់ប្រាក់ (Pending)')}
                                                                        </h4>
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* Integrated Status Badge - Enlarged */}
                                                                <div className={`flex items-center gap-2.5 px-5 py-2.5 rounded-sm text-[12px] font-black border ${isPaid ? 'text-[#02C076] bg-[#02C076]/10 border-[#02C076]/20' : 'text-red-500 bg-red-500/10 border-red-500/20 animate-pulse'}`}>
                                                                    <div className={`w-2 h-2 rounded-full ${isPaid ? 'bg-[#02C076]' : 'bg-red-500'}`}></div>
                                                                    {isPaid ? 'បង់ប្រាក់រួចរាល់ (PAID)' : 'មិនទាន់បង់ប្រាក់ (UNPAID)'}
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* --- Action Buttons Contextual to Step --- */}
                                            {step === 'VERIFYING' ? (
                                                <div className="shrink-0 pt-2">
                                                    <button 
                                                        onClick={() => setStep('LABELING')}
                                                        disabled={!isOrderVerified}
                                                        className={`w-full py-6 rounded-xl font-black text-xl uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-4 shadow-2xl ${
                                                            isOrderVerified 
                                                                ? 'bg-[#FCD535] text-black hover:scale-[1.02] active:scale-95 shadow-[0_0_50px_rgba(252,213,53,0.3)]' 
                                                                : 'bg-[#2B3139] text-[#848E9C]/30 border border-white/5 cursor-not-allowed opacity-50'
                                                        }`}
                                                    >
                                                        {isOrderVerified ? (
                                                            <>
                                                                <span>Verify & Proceed</span>
                                                                <svg className="w-7 h-7 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                                                            </>
                                                        ) : (
                                                            <span>Awaiting Checklist Completion</span>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="shrink-0 pt-2 flex flex-col gap-4">
                                                    <div className="flex gap-4">
                                                        {/* Print Label Button */}
                                                        <button 
                                                            onClick={() => handleDirectPrint('label')}
                                                            className="flex-[2] py-6 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black rounded-xl font-black text-xl uppercase tracking-[0.2em] transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-4"
                                                        >
                                                            <Printer className="w-7 h-7" />
                                                            <span>Print Label</span>
                                                        </button>

                                                        {/* Order Information (QR) Button */}
                                                        <button 
                                                            onClick={() => handleDirectPrint('qr')}
                                                            className="flex-1 py-6 bg-[#2B3139] hover:bg-gray-700 text-white rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 border border-white/5 flex items-center justify-center gap-3"
                                                        >
                                                            <MapPin className="w-5 h-5 text-[#FCD535]" />
                                                            <span>Order Info</span>
                                                        </button>
                                                    </div>

                                                    {/* Edit Label Button */}
                                                    <button 
                                                        onClick={() => setShowLabelEditor(true)}
                                                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-[#848E9C] rounded-lg font-bold text-[11px] uppercase tracking-[0.3em] transition-all border border-white/10 flex items-center justify-center gap-3"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                        <span>Edit Label Metadata</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {step === 'PHOTO' && (
                                    <div className="h-full w-full animate-in fade-in zoom-in-95 duration-700 relative overflow-hidden flex flex-col items-center justify-center bg-black">
                                        {/* Main Camera/Photo Canvas Area - 1:1 Constraint */}
                                        <div className="relative aspect-square w-full max-h-full flex items-center justify-center overflow-hidden bg-[#08090a] shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                                            <div id="fastpack-scanner-container" className="absolute inset-0 z-0 transition-opacity duration-700"></div>

                                            {/* POSITIONING REMINDER OVERLAY */}
                                            {!packagePhoto && !isCapturing && (
                                                <div className="absolute top-6 inset-x-0 z-[60] flex justify-center pointer-events-none px-4">
                                                    <div className="bg-black/60 backdrop-blur-xl border border-[#FCD535]/30 px-6 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-top-4 duration-1000">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-[#FCD535] text-lg font-black tracking-tight uppercase">
                                                                សូមដាក់កញ្ចប់ឱ្យចំកណ្ដាល និងកៀកកាមេរ៉ា
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1 h-1 bg-[#FCD535] rounded-full animate-pulse"></div>
                                                                <span className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                                                                    Center & Proximity Alignment
                                                                </span>
                                                                <div className="w-1 h-1 bg-[#FCD535] rounded-full animate-pulse"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* LABEL PLACEMENT GUIDE OVERLAY */}
                                            {!packagePhoto && !isCapturing && (
                                                <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
                                                    {isFlexiGear ? (
                                                        <div className="w-[60%] h-[80%] border-2 border-dashed border-[#FCD535]/40 bg-[#FCD535]/5 flex items-center justify-center relative">
                                                            <div className="absolute -top-6 left-0 bg-[#FCD535] text-black text-[10px] font-black px-2 py-0.5 uppercase tracking-widest whitespace-nowrap">
                                                                Flexi Gear (60x80mm Vertical)
                                                            </div>
                                                            <div className="h-[80%] w-px bg-[#FCD535]/20"></div>
                                                            <div className="w-[80%] h-px bg-[#FCD535]/20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0"></div>
                                                        </div>
                                                    ) : isACCStore ? (
                                                        <div className="w-[80%] h-[60%] border-2 border-dashed border-[#FCD535]/40 bg-[#FCD535]/5 flex items-center justify-center relative">
                                                            <div className="absolute -top-6 left-0 bg-[#FCD535] text-black text-[10px] font-black px-2 py-0.5 uppercase tracking-widest whitespace-nowrap">
                                                                ACC Store (80x60mm Horizontal)
                                                            </div>
                                                            <div className="w-[80%] h-px bg-[#FCD535]/20"></div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )}

                                            {/* DIGITAL TRACKING OVERLAY */}
                                            {trackingBox && !packagePhoto && (
                                                <div 
                                                    className="absolute border-2 border-[#FCD535]/60 z-30 pointer-events-none transition-all duration-300"
                                                    style={{
                                                        left: `${(trackingBox.x / (activeVideo?.videoWidth || 1)) * 100}%`,
                                                        top: `${(trackingBox.y / (activeVideo?.videoHeight || 1)) * 100}%`,
                                                        width: `${(trackingBox.w / (activeVideo?.videoWidth || 1)) * 100}%`,
                                                        height: `${(trackingBox.h / (activeVideo?.videoHeight || 1)) * 100}%`,
                                                        boxShadow: '0 0 20px rgba(252, 213, 53, 0.3), inset 0 0 20px rgba(252, 213, 53, 0.3)'
                                                    }}
                                                >
                                                    {/* Corner Accents */}
                                                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-[#FCD535]"></div>
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-[#FCD535]"></div>
                                                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-[#FCD535]"></div>
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-[#FCD535]"></div>

                                                    {/* Tracking Label */}
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#FCD535] text-black text-[10px] font-black px-2 py-0.5 uppercase tracking-widest whitespace-nowrap">
                                                        Tracking QR
                                                    </div>
                                                </div>
                                            )}

                                            {/* HAND TRACKING OVERLAY */}
                                            {handBox && !packagePhoto && (
                                                <div 
                                                    className="absolute border-2 border-green-500/60 z-30 pointer-events-none transition-all duration-100"
                                                    style={{
                                                        left: `${(handBox.x / (activeVideo?.videoWidth || 1)) * 100}%`,
                                                        top: `${(handBox.y / (activeVideo?.videoHeight || 1)) * 100}%`,
                                                        width: `${(handBox.w / (activeVideo?.videoWidth || 1)) * 100}%`,
                                                        height: `${(handBox.h / (activeVideo?.videoHeight || 1)) * 100}%`,
                                                        boxShadow: `0 0 20px ${detectedGesture === 'five_fingers' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.2)'}`
                                                    }}
                                                >
                                                    {/* Corner Accents */}
                                                    <div className={`absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 ${detectedGesture === 'five_fingers' ? 'border-green-400' : 'border-green-500/40'}`}></div>
                                                    <div className={`absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 ${detectedGesture === 'five_fingers' ? 'border-green-400' : 'border-green-500/40'}`}></div>
                                                    <div className={`absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 ${detectedGesture === 'five_fingers' ? 'border-green-400' : 'border-green-500/40'}`}></div>
                                                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 ${detectedGesture === 'five_fingers' ? 'border-green-400' : 'border-green-500/40'}`}></div>

                                                    {/* Status Label */}
                                                    <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 ${detectedGesture === 'five_fingers' || palmDetected ? 'bg-green-500' : detectedGesture === 'fist' ? 'bg-[#FCD535] text-black' : 'bg-gray-800/80'} text-white text-[9px] font-black px-2 py-0.5 uppercase tracking-widest whitespace-nowrap transition-colors`}>
                                                        {palmDetected ? 'Palm Locked: Close Fist to Capture' : detectedGesture === 'five_fingers' ? 'Open Palm Detected' : detectedGesture === 'fist' ? 'Fist Detected' : 'Hand Detected'}
                                                    </div>
                                                </div>
                                            )}

                                            {/* HAND SKELETON (DIGITAL FINGERS) */}
                                            {handKeypoints && handKeypoints.length > 0 && !packagePhoto && (
                                                <svg className="absolute inset-0 z-40 pointer-events-none w-full h-full">
                                                    {(() => {
                                                        const vw = activeVideo?.videoWidth || 1;
                                                        const vh = activeVideo?.videoHeight || 1;
                                                        
                                                        // Helper to map video coordinates to screen %
                                                        const mapX = (x: number) => (x / vw) * 100;
                                                        const mapY = (y: number) => (y / vh) * 100;

                                                        // Hand Connections (Skeleton)
                                                        const fingerPaths = [
                                                            [0, 1, 2, 3, 4],    // Thumb
                                                            [0, 5, 6, 7, 8],    // Index
                                                            [0, 9, 10, 11, 12], // Middle
                                                            [0, 13, 14, 15, 16], // Ring
                                                            [0, 17, 18, 19, 20], // Pinky
                                                            [5, 9, 13, 17, 0]    // Palm base
                                                        ];

                                                        const isAction = detectedGesture === 'five_fingers' || detectedGesture === 'fist' || palmDetected;

                                                        return (
                                                            <>
                                                                {/* Lines (Bones) */}
                                                                {fingerPaths.map((path, i) => (
                                                                    <polyline 
                                                                        key={`path-${i}`}
                                                                        points={path.map(idx => `${mapX(handKeypoints[idx].x)}%,${mapY(handKeypoints[idx].y)}%`).join(' ')}
                                                                        fill="none"
                                                                        stroke={palmDetected || detectedGesture === 'five_fingers' ? '#4ade80' : detectedGesture === 'fist' ? '#FCD535' : 'rgba(74, 222, 128, 0.6)'}
                                                                        strokeWidth="6"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        className="transition-all duration-100 opacity-40"
                                                                        style={{ filter: 'blur(1px)' }}
                                                                    />
                                                                ))}
                                                                {/* Inner Core Lines */}
                                                                {fingerPaths.map((path, i) => (
                                                                    <polyline 
                                                                        key={`core-path-${i}`}
                                                                        points={path.map(idx => `${mapX(handKeypoints[idx].x)}%,${mapY(handKeypoints[idx].y)}%`).join(' ')}
                                                                        fill="none"
                                                                        stroke={isAction ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'}
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        className="transition-all duration-100"
                                                                    />
                                                                ))}
                                                                {/* Dots (Joints & Tips) */}
                                                                {handKeypoints.map((kp, i) => {
                                                                    const isTip = [4, 8, 12, 16, 20].includes(i);
                                                                    return (
                                                                        <circle 
                                                                            key={`kp-${i}`}
                                                                            cx={`${mapX(kp.x)}%`}
                                                                            cy={`${mapY(kp.y)}%`}
                                                                            r={isTip ? "5" : "3"}
                                                                            fill={isTip ? (palmDetected || detectedGesture === 'five_fingers' ? '#4ade80' : detectedGesture === 'fist' ? '#FCD535' : 'white') : 'white'}
                                                                            className="transition-all duration-100"
                                                                            style={{ 
                                                                                filter: isTip ? 'drop-shadow(0 0 8px rgba(252, 213, 53, 0.8))' : 'none',
                                                                                opacity: isTip ? 1 : 0.7
                                                                            }}
                                                                        />
                                                                    );
                                                                })}
                                                            </>
                                                        );
                                                    })()}
                                                </svg>
                                            )}

                                            {/* FACE TRACKING OVAL (PURELY VISUAL) */}
                                            {faceBox && !packagePhoto && (
                                                <div 
                                                    className="absolute z-30 pointer-events-none transition-all duration-200 border-[3px] border-white/40"
                                                    style={{
                                                        left: `${(faceBox.x / (activeVideo?.videoWidth || 1)) * 100}%`,
                                                        top: `${(faceBox.y / (activeVideo?.videoHeight || 1)) * 100}%`,
                                                        width: `${(faceBox.w / (activeVideo?.videoWidth || 1)) * 100}%`,
                                                        height: `${(faceBox.h / (activeVideo?.videoHeight || 1)) * 100}%`,
                                                        borderRadius: '100% 100% 95% 95%', // More defined face oval
                                                        boxShadow: '0 0 50px rgba(255, 255, 255, 0.1), inset 0 0 30px rgba(255, 255, 255, 0.1)',
                                                        background: 'radial-gradient(circle at 50% 40%, transparent 60%, rgba(255, 255, 255, 0.05) 100%)'
                                                    }}
                                                >
                                                    {/* Digital Face Accents */}
                                                    <div className="absolute top-[30%] left-[25%] w-3 h-1.5 bg-white/30 rounded-full blur-[1px] rotate-[-5deg]"></div>
                                                    <div className="absolute top-[30%] right-[25%] w-3 h-1.5 bg-white/30 rounded-full blur-[1px] rotate-[5deg]"></div>
                                                    <div className="absolute bottom-[25%] left-1/2 -translate-x-1/2 w-[40%] h-[2px] bg-white/20 rounded-full"></div>
                                                    
                                                    {/* Scanning Line Effect */}
                                                    <div className="absolute inset-x-0 h-[2px] bg-white/10 top-1/2 animate-scan-slow shadow-[0_0_15px_white]"></div>

                                                    {/* Label */}
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-3 py-0.5 border border-white/20">
                                                        <span className="text-[8px] font-black text-white uppercase tracking-[0.4em] whitespace-nowrap">
                                                            Target Lock: Human
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* PROCESSING OVERLAY */}
                                            {isCapturing && (
                                                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                                                    <div className="w-20 h-20 border-4 border-[#FCD535]/20 border-t-[#FCD535] rounded-none animate-spin mb-6"></div>
                                                    <span className="text-xl font-black text-white uppercase tracking-[0.3em]">Processing Proof</span>
                                                    <span className="text-[10px] text-[#FCD535] font-bold mt-2 animate-pulse uppercase tracking-[0.5em]">Optimizing Visual Details</span>
                                                </div>
                                            )}

                                            {/* PHOTO PREVIEW */}
                                            {packagePhoto && (
                                                <div className="absolute inset-0 z-20 bg-[#08090a] animate-in zoom-in-105 duration-700">
                                                    <img src={packagePhoto} className="w-full h-full object-contain" alt="Package" />
                                                </div>
                                            )}

                                            {/* CAMERA VIEW - CLEAR & MINIMAL */}
                                            {!packagePhoto && (
                                                <div className="absolute inset-0 z-10 pointer-events-none">
                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_transparent_50%,_rgba(0,0,0,0.3)_100%)]"></div>
                                                </div>
                                            )}

                                            {/* COUNTDOWN */}
                                            {autoCaptureCountdown !== null && !packagePhoto && (
                                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                                    <div className="text-[22rem] font-black text-white drop-shadow-[0_0_80px_rgba(252,213,53,0.5)]">
                                                        {autoCaptureCountdown}
                                                    </div>
                                                </div>
                                            )}

                                            {/* CAMERA CONTROLS - Perfectly centered relative to the preview panel */}
                                            {!packagePhoto && !isScannerLoading && !isCapturing && (
                                                <div className="absolute bottom-12 inset-x-0 flex justify-center z-40 pointer-events-auto">
                                                    <div className="flex items-center gap-12 p-5 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-none shadow-[0_40px_80px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 duration-700 pointer-events-auto">
                                                        {/* Switch Camera */}
                                                        <button onClick={switchCamera} className="w-14 h-14 rounded-none text-white/40 hover:text-white flex items-center justify-center transition-all hover:bg-white/5 group border border-white/5">
                                                            <svg className="w-7 h-7 group-hover:rotate-180 transition-transform duration-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                                                        </button>

                                                        {/* MAIN CAPTURE BUTTON - SQUARED & YELLOW */}
                                                        <button 
                                                            onClick={capturePhotoFromStream} 
                                                            className="w-24 h-24 bg-[#FCD535] hover:bg-[#FCD535]/90 flex items-center justify-center transition-all active:scale-95 shadow-[0_0_40px_rgba(252,213,53,0.4)] group border-4 border-black/10"
                                                        >
                                                            <div className="w-16 h-16 border-[4px] border-black/80 flex items-center justify-center">
                                                                <div className="w-4 h-4 bg-black/80"></div>
                                                            </div>
                                                        </button>

                                                        {/* Torch Toggle */}
                                                        {isTorchSupported ? (
                                                            <button onClick={toggleTorch} className={`w-14 h-14 rounded-none flex items-center justify-center transition-all border border-white/5 ${isTorchOn ? 'text-[#FCD535] bg-[#FCD535]/10' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                                                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                                                            </button>
                                                        ) : <div className="w-14 h-14"></div>}
                                                    </div>
                                                </div>
                                            )}

                                            {/* RETAKE - Integrated into preview */}
                                            {packagePhoto && (
                                                <button onClick={() => setPackagePhoto(null)} className="absolute top-8 right-8 z-40 bg-red-600/80 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-black text-xs uppercase tracking-[0.2em] shadow-2xl backdrop-blur-md transition-all active:scale-95 flex items-center gap-3">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    <span>Retake Photo</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/5 overflow-hidden"><div className={`h-full transition-all duration-1000 ${step === 'VERIFYING' ? 'w-1/3 bg-[#FCD535] shadow-[0_0_15px_#FCD535]' : step === 'LABELING' ? 'w-2/3 bg-[#FCD535] shadow-[0_0_15px_#FCD535]' : 'w-full bg-[#0ECB81] shadow-[0_0_15px_#0ECB81]'}`}></div></div>
                        </div>
                    </div>
                </div>
            </main>

            <ActionControls step={step} isOrderVerified={isOrderVerified} hasGeneratedLabel={hasGeneratedLabel} packagePhoto={packagePhoto} uploading={uploading} undoTimer={undoTimer} onClose={onClose} setStep={setStep} handleSubmit={handleSubmit} />
            {undoTimer !== null && (
                <OrderGracePeriod timer={undoTimer} maxTimer={maxUndoTimer} onUndo={handleUndo} isUndoing={isUndoing} accentColor="yellow" title="SECURITY BROADCAST IN PROGRESS..." subtitle="Metadata is being permanently committed. Use UNDO to abort immediately." />
            )}

            <style>{`
                /* Hide built-in library scanner UI elements */
                #fastpack-scanner-container div[style*="position: absolute"] {
                    display: none !important;
                }
                #fastpack-scanner-container #qr-shaded-region {
                    display: none !important;
                }
                #fastpack-scanner-container video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                    transform: scale(1.3) !important;
                    transform-origin: center center !important;
                }
                
                @keyframes scan-slow {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 0.4; }
                    90% { opacity: 0.4; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan-slow {
                    position: absolute;
                    animation: scan-slow 3s linear infinite;
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin-slow {
                    animation: spin-slow 4s linear infinite;
                }
                .custom-scrollbar-terminal::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar-terminal::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-terminal::-webkit-scrollbar-thumb { background: #2B3139; border-radius: 10px; }
                .custom-scrollbar-terminal::-webkit-scrollbar-thumb:hover { background: #FCD535; }
            `}</style>
            </div>

            {/* Hidden Print Content - Only visible to printer */}
            {/* We hide this background printer if the interactive editor is open, to prevent collisions */}
            {!showLabelEditor && (
                <div className="hidden print:block">
                    <PrintLabelPage 
                        key={refreshKey}
                        printOnly 
                        printTarget={printTarget}
                        initialData={{ 
                            id: order['Order ID'], 
                            name: order['Customer Name'], 
                            phone: formattedPhone, 
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
        </div>
    );
};

export default FastPackTerminal;
