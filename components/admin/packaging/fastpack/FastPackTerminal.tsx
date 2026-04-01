import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
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
    const { currentUser, appData, previewImage: showFullImage, refreshData } = useContext(AppContext);
    const { setOrders } = useOrder();
    
    // Workflow State
    const [step, setStep] = useState<PackStep>('VERIFYING');
    const [verifiedItems, setVerifiedItems] = useState<Record<string, number>>({}); 
    const hasAutoAdvanced = useRef({ verify: false, label: false, photo: false });
    const fileInputRef = useRef<HTMLInputElement>(null);

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
    const { advancedSettings } = useContext(AppContext);
    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [isUndoing, setIsUndoing] = useState(false);
    const maxUndoTimer = advancedSettings.packagingGracePeriod || 5;

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

    const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file, 'balanced');
            const dataUrl = await fileToDataUrl(compressed);
            setPackagePhoto(dataUrl);
            if (order?.['Order ID']) {
                localStorage.setItem(`package_photo_${order['Order ID']}`, dataUrl);
            }
            
            // Auto advance after photo if it's the first time
            if (!hasAutoAdvanced.current.photo) {
                hasAutoAdvanced.current.photo = true;
                setTimeout(() => {
                    handleSubmit();
                }, 1000);
            }
        } catch (err) {
            console.error("Photo processing failed:", err);
            alert("Failed to process photo");
        }
    };

    const capturePhotoFromStream = useCallback(async () => {
        const video = document.querySelector('#fastpack-scanner-container video') as HTMLVideoElement;
        if (!video || isCapturing) return;

        setIsCapturing(true);
        try {
            const canvas = document.createElement('canvas');
            // Set canvas to a standard high-quality size for the final record
            canvas.width = 1280;
            canvas.height = 960; 
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Could not get canvas context");

            // 1. Draw the Video Frame (Centered & Cropped to fit)
            const videoAspect = video.videoWidth / video.videoHeight;
            const canvasAspect = canvas.width / canvas.height;
            let drawWidth, drawHeight, offsetX, offsetY;

            if (videoAspect > canvasAspect) {
                drawHeight = canvas.height;
                drawWidth = canvas.height * videoAspect;
                offsetX = -(drawWidth - canvas.width) / 2;
                offsetY = 0;
            } else {
                drawWidth = canvas.width;
                drawHeight = canvas.width / videoAspect;
                offsetX = 0;
                offsetY = -(drawHeight - canvas.height) / 2;
            }

            ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

            // 2. Add Semi-transparent Overlays for Text Readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            // Left Overlay
            ctx.fillRect(0, 0, 350, canvas.height);
            // Right Overlay
            ctx.fillRect(canvas.width - 350, 0, 350, canvas.height);

            // 3. Draw Order Information
            ctx.fillStyle = '#FFFFFF';
            ctx.textBaseline = 'top';
            
            // Left Side Info
            ctx.font = 'bold 32px Kantumruy Pro, sans-serif';
            ctx.fillText('ORDER DETAILS', 30, 40);
            
            ctx.font = 'bold 48px monospace';
            ctx.fillStyle = '#FCD535';
            ctx.fillText(`#${order?.['Order ID'].substring(0, 12)}`, 30, 90);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 36px Kantumruy Pro, sans-serif';
            ctx.fillText(order?.['Customer Name'] || 'N/A', 30, 160);
            
            ctx.font = '32px monospace';
            ctx.fillText(order?.['Customer Phone'] || 'N/A', 30, 210);

            // Right Side Info
            ctx.textAlign = 'right';
            ctx.font = 'bold 32px Kantumruy Pro, sans-serif';
            ctx.fillText('PAYMENT & LOGS', canvas.width - 30, 40);
            
            ctx.font = 'bold 60px monospace';
            ctx.fillStyle = '#0ECB81';
            ctx.fillText(`$${(Number(order?.['Grand Total']) || 0).toFixed(2)}`, canvas.width - 30, 90);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '28px Kantumruy Pro, sans-serif';
            ctx.fillText(`Packer: ${currentUser?.FullName || 'N/A'}`, canvas.width - 30, 170);
            
            const now = new Date();
            ctx.font = '24px monospace';
            ctx.fillText(now.toLocaleDateString('km-KH'), canvas.width - 30, 220);
            ctx.fillText(now.toLocaleTimeString('km-KH'), canvas.width - 30, 255);

            // 4. Add Bottom Watermark
            ctx.textAlign = 'center';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillText('GENERATED BY FAST PACK TERMINAL v4.3', canvas.width / 2, canvas.height - 30);

            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.85));
            if (!blob) throw new Error("Could not create blob from canvas");

            const file = new File([blob], `Package_${order?.['Order ID'].substring(0,8)}.jpg`, { type: 'image/jpeg' });
            const compressed = await compressImage(file, 'balanced');
            const dataUrl = await fileToDataUrl(compressed);
            
            setPackagePhoto(dataUrl);
            if (order?.['Order ID']) {
                localStorage.setItem(`package_photo_${order['Order ID']}`, dataUrl);
            }
            setAutoCaptureCountdown(null);

            if (!hasAutoAdvanced.current.photo) {
                hasAutoAdvanced.current.photo = true;
                setTimeout(() => {
                    handleSubmit();
                }, 1500); // Slightly longer delay to show the framed photo
            }
        } catch (err) {
            console.error("Capture failed:", err);
        } finally {
            setIsCapturing(false);
        }
    }, [order, isCapturing, setPackagePhoto, currentUser]);

    const onScan = useCallback((decodedText: string) => {
        if (step !== 'PHOTO' || packagePhoto || autoCaptureCountdown !== null || isCapturing) return;
        
        // Prevent multiple triggers for same QR in short time
        if (lastDetectedQR.current === decodedText) return;
        lastDetectedQR.current = decodedText;
        setTimeout(() => { lastDetectedQR.current = null; }, 5000);

        // Start countdown
        setAutoCaptureCountdown(3);
    }, [step, packagePhoto, autoCaptureCountdown, isCapturing]);

    const { 
        isInitializing: isScannerLoading, 
        error: scannerError,
        switchCamera,
        isTorchOn,
        isTorchSupported,
        toggleTorch
    } = useBarcodeScanner("fastpack-scanner-container", onScan, 'single', { 
        fps: 10,
        // ✅ Fix 2: Only start camera when in PHOTO step to save battery/reduce heat
        disableScanner: step !== 'PHOTO' || !!packagePhoto 
    });

    useEffect(() => {
        if (autoCaptureCountdown !== null && autoCaptureCountdown > 0) {
            countdownTimerRef.current = setTimeout(() => {
                setAutoCaptureCountdown(prev => (prev !== null ? prev - 1 : null));
            }, 1000);
        } else if (autoCaptureCountdown === 0) {
            capturePhotoFromStream();
        }
        return () => {
            if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
        };
    }, [autoCaptureCountdown, capturePhotoFromStream]);

    // ✅ Fix 4: Reliable Background Upload with Retry Mechanism
    const uploadPhotoWithRetry = useCallback(async (data: any, token: string, attempt = 1) => {
        const MAX_ATTEMPTS = 3;
        try {
            const response = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                keepalive: true,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            console.log(`✅ Photo upload successful on attempt ${attempt}`);
        } catch (err) {
            console.error(`❌ Photo upload failed (Attempt ${attempt}/${MAX_ATTEMPTS}):`, err);
            if (attempt < MAX_ATTEMPTS) {
                const delay = attempt * 2000; // Exponential backoff: 2s, 4s...
                setTimeout(() => uploadPhotoWithRetry(data, token, attempt + 1), delay);
            }
        }
    }, []);

    const executeFinalSubmit = useCallback(async () => {
        try {
            if (!order) return;
            setUploading(true);

            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            
            const newData = {
                'Fulfillment Status': 'Ready to Ship',
                'Packed By': currentUser?.FullName || 'Packer',
                'Packed Time': new Date().toLocaleString('km-KH')
            };

            // 1. 🚀 STEP 1: Update Status (JSON) - Await this for reliability
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

            // 2. ✅ STEP 2: Close Terminal & Move UI immediately
            onSuccess(packagePhoto || 'manual_sync_ok');
            setOrders(prev => prev.map(o => 
                o['Order ID'] === order['Order ID'] 
                    ? { 
                        ...o, 
                        'Fulfillment Status': 'Ready to Ship',
                        FulfillmentStatus: 'Ready to Ship',
                        'Packed By': currentUser?.FullName || 'Packer',
                        'Packed Time': new Date().toLocaleString('km-KH'),
                        'Package Photo URL': packagePhoto || o['Package Photo URL']
                      } 
                    : o
            ));

            // 3. 📸 STEP 3: Background Photo Upload with Retry
            if (packagePhoto) {
                const base64Data = packagePhoto.includes(',') ? packagePhoto.split(',')[1] : packagePhoto;
                const uploadData = {
                    fileData: base64Data,
                    fileName: `Package_${order['Order ID'].substring(0,8)}_${Date.now()}.jpg`,
                    mimeType: 'image/jpeg',
                    orderId: order['Order ID'],
                    targetColumn: 'Package Photo URL',
                    newData: newData // ✅ Critical: Re-included for Apps Script context
                };
                
                // Trigger retry-enabled upload in background
                uploadPhotoWithRetry(uploadData, token);
            }

            const id = order['Order ID'].substring(0,8);
            const chatMsg = `📦 **[PACKED]** កញ្ចប់ #${id} (${order['Customer Name']}) វេចខ្ចប់រួចរាល់`;

            fetch(`${WEB_APP_URL}/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ UserName: 'System', MessageType: 'Text', Content: chatMsg })
            }).catch(() => {});

        } catch (err: any) {
            console.error("Critical submission error:", err);
            alert("❌ ការបញ្ជូនបរាជ័យ: " + err.message);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    }, [order, currentUser, onSuccess, packagePhoto, setOrders, uploadPhotoWithRetry]);

    const handleSubmit = useCallback(() => {
        setUndoTimer(maxUndoTimer);
    }, [maxUndoTimer]);

    const handleUndo = () => {
        setIsUndoing(true);
        setTimeout(() => {
            setUndoTimer(null);
            setIsUndoing(false);
        }, 500);
    };

    useEffect(() => {
        // No operation needed for step changes
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
                setStep('PHOTO');
                setIsAdvancingLabel(false);
            }, 5000); // 5s wait before auto-advancing
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
        } else if (step === 'PHOTO') {
            msg = `📸 **[PHOTO]** ${user} កំពុងថតរូបកញ្ចប់ #${id}`;
        }

        if (msg) {
            sendStepNotification(msg);
        }
    }, [step, order, currentUser]);

    // Auto-clean removed tracks if any

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
                        if (step === 'LABELING') setStep('VERIFYING');
                        else if (step === 'PHOTO') setStep('LABELING');
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
                <div className="flex-grow flex flex-col bg-[#0B0E11] p-6 overflow-y-auto relative">
                    <div className="w-full h-full flex flex-col max-w-4xl mx-auto">
                        {uploading && undoTimer === null && (
                            <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-6 mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <Spinner size="sm" />
                                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Processing Final Update...</span>
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
                                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Attach label and finalize packing</p>
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

                            <div className={`bg-[#181A20] rounded-sm p-6 sm:p-12 border border-[#2B3139] flex-grow flex-col items-center justify-center gap-6 sm:gap-8 animate-fade-in relative overflow-hidden ${step === 'PHOTO' ? 'flex' : 'hidden'}`}>
                                {/* Camera Section */}
                                <div className="relative group w-full max-w-md aspect-square sm:w-[400px] sm:h-[400px]">
                                    <div className={`w-full h-full bg-[#0B0E11] rounded-sm flex items-center justify-center border-2 transition-all duration-300 overflow-hidden relative ${packagePhoto ? 'border-[#0ECB81]' : autoCaptureCountdown !== null ? 'border-[#FCD535] shadow-[0_0_20px_rgba(252,213,53,0.3)]' : 'border-[#2B3139]'}`}>
                                        {/* Live Scanner Container */}
                                        <div 
                                            id="fastpack-scanner-container" 
                                            className={`absolute inset-0 z-0 ${packagePhoto ? 'opacity-0' : 'opacity-100'}`}
                                        ></div>

                                            {/* Photo Preview Overlay */}
                                            {packagePhoto && (
                                                <img src={packagePhoto} className="absolute inset-0 w-full h-full object-cover z-10" alt="Package" />
                                            )}

                                            {/* Countdown Overlay */}
                                            {autoCaptureCountdown !== null && !packagePhoto && (
                                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
                                                    <div className="text-8xl font-black text-[#FCD535] animate-bounce drop-shadow-[0_0_15px_rgba(252,213,53,0.5)]">
                                                        {autoCaptureCountdown}
                                                    </div>
                                                    <p className="text-[10px] font-black text-[#FCD535] uppercase tracking-[0.3em] mt-4">Capturing...</p>
                                                </div>
                                            )}

                                            {/* Initializing/Error Overlays */}
                                            {!packagePhoto && autoCaptureCountdown === null && (
                                                <>
                                                    {isScannerLoading && (
                                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0B0E11]">
                                                            <Spinner size="lg" />
                                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4">Waking Camera...</p>
                                                        </div>
                                                    )}
                                                    {scannerError && (
                                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0B0E11] p-6 text-center">
                                                            <svg className="w-12 h-12 text-[#F6465D] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                            <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">{scannerError}</p>
                                                        </div>
                                                    )}
                                                </>
                                            )}

                                            {/* Scanning Reticle */}
                                            {!packagePhoto && !isScannerLoading && autoCaptureCountdown === null && (
                                                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                                                    <div className="w-48 h-48 border border-white/20 rounded-2xl relative">
                                                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#FCD535] rounded-tl-lg"></div>
                                                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#FCD535] rounded-tr-lg"></div>
                                                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#FCD535] rounded-bl-lg"></div>
                                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#FCD535] rounded-br-lg"></div>
                                                        <div className="absolute inset-0 bg-[#FCD535]/5 animate-pulse"></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Controls */}
                                        {!packagePhoto && !isScannerLoading && (
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
                                                <button 
                                                    onClick={switchCamera}
                                                    className="p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-[#FCD535] hover:text-black transition-all"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                                </button>
                                                {isTorchSupported && (
                                                    <button 
                                                        onClick={toggleTorch}
                                                        className={`p-3 backdrop-blur-md border border-white/10 rounded-full transition-all ${isTorchOn ? 'bg-[#FCD535] text-black' : 'bg-black/60 text-white'}`}
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {packagePhoto && (
                                            <button 
                                                onClick={() => setPackagePhoto(null)} 
                                                className="absolute -top-3 -right-3 z-30 bg-[#F6465D] text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform border-2 border-[#181A20]"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        )}
                                    </div>

                                    <div className="text-center space-y-2">
                                        <h3 className="text-xl font-bold text-white uppercase tracking-widest">
                                            {packagePhoto ? 'Photo Ready' : autoCaptureCountdown !== null ? 'Keep Steady' : 'Fast Capture'}
                                        </h3>
                                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                                            {packagePhoto ? 'Review and proceed below' : 'Scan any QR Code for 3s Auto-Capture'}
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-center gap-4 w-full">
                                        <button 
                                            onClick={capturePhotoFromStream}
                                            disabled={isCapturing || !!packagePhoto || isScannerLoading}
                                            className="w-full max-w-xs py-4 bg-[#FCD535] hover:bg-[#FCD535]/90 disabled:bg-[#2B3139] disabled:text-gray-600 text-black rounded-sm font-black uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-[0_8px_25px_rgba(252,213,53,0.2)] active:scale-95"
                                        >
                                            {isCapturing ? (
                                                <Spinner size="sm" />
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            )}
                                            {packagePhoto ? 'Captured' : 'Manual Capture'}
                                        </button>
                                        
                                        {!packagePhoto && (
                                            <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#0ECB81] animate-pulse"></span>
                                                AI Vision Enabled
                                            </p>
                                        )}
                                        {packagePhoto && (
                                            <p className="text-[9px] font-bold text-[#0ECB81] uppercase tracking-[0.2em] animate-pulse">Success ✓ Auto-advancing...</p>
                                        )}
                                    </div>

                                    <style>{`
                                        #fastpack-scanner-container video { 
                                            object-fit: cover !important; 
                                            width: 100% !important; 
                                            height: 100% !important; 
                                        }
                                    `}</style>
                                </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer Action Bar */}
            <ActionControls 
                step={step}
                isOrderVerified={isOrderVerified}
                hasGeneratedLabel={hasGeneratedLabel}
                packagePhoto={packagePhoto}
                uploading={uploading}
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
                    title="FINISHING PACKING..."
                    subtitle="System is updating order status. Cancel to halt."
                />
            )}
        </div>
    );
};

export default FastPackTerminal;
