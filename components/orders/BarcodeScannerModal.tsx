
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MasterProduct, Product } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import Spinner from '../common/Spinner';
import ScannerOverlay from './scanner/ScannerOverlay';
import HistoryDrawer, { ScannedHistoryItem } from './scanner/HistoryDrawer';
import ScannerHeader from './scanner/ScannerHeader';
import ScannerControls from './scanner/ScannerControls';

interface ProductUIState extends Product {
    discountType: 'percent' | 'amount' | 'custom';
    discountAmountInput: string; 
    discountPercentInput: string; 
    finalPriceInput: string;
    applyDiscountToTotal: boolean;
}

interface BarcodeScannerModalProps {
    onClose: () => void;
    onCodeScanned: (code: string) => void;
    scanMode: 'single' | 'increment';
    setScanMode: (mode: 'single' | 'increment') => void;
    productsInOrder: ProductUIState[];
    masterProducts: MasterProduct[];
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
    onClose,
    onCodeScanned,
    scanMode,
    setScanMode,
    productsInOrder,
    masterProducts,
}) => {
    const [scanHistory, setScanHistory] = useState<ScannedHistoryItem[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [lastScannedInfo, setLastScannedInfo] = useState<{ status: 'success' | 'error' | 'warning', message: string, product?: MasterProduct } | null>(null);
    const [scanSuccessFlash, setScanSuccessFlash] = useState(false);
    
    // Focus Point State
    const [focusPoint, setFocusPoint] = useState<{ x: number, y: number } | null>(null);

    // Gestures
    const touchStartDist = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const touchStartX = useRef<number | null>(null);
    const touchStartTime = useRef<number>(0);
    const startZoom = useRef<number>(1);
    const lastTapTime = useRef<number>(0);

    // Disable Body Scroll when modal is open (Fix for iOS elastic scrolling)
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
        };
    }, []);

    const handleScan = useCallback((decodedText: string) => {
        // Trigger Animations
        setScanSuccessFlash(true);
        setTimeout(() => setScanSuccessFlash(false), 400);

        const foundMasterProduct = masterProducts.find(
            (p: MasterProduct) => p.Barcode && p.Barcode.trim() === decodedText.trim()
        );

        // Update History
        setScanHistory(prev => {
            const existingIndex = prev.findIndex(item => item.code === decodedText);
            const now = Date.now();
            if (existingIndex > -1) {
                const newHistory = [...prev];
                newHistory[existingIndex] = {
                    ...newHistory[existingIndex],
                    count: newHistory[existingIndex].count + 1,
                    timestamp: now
                };
                const item = newHistory.splice(existingIndex, 1)[0];
                return [item, ...newHistory];
            }
            return [{ code: decodedText, product: foundMasterProduct, timestamp: now, count: 1 }, ...prev];
        });

        if (foundMasterProduct) {
            const productInOrder = productsInOrder.find(p => p.name === foundMasterProduct.ProductName);
            if (scanMode === 'single' && productInOrder) {
                setLastScannedInfo({ status: 'warning', message: 'មានក្នុងបញ្ជីរួចហើយ', product: foundMasterProduct });
            } else {
                onCodeScanned(decodedText);
                setLastScannedInfo({ status: 'success', message: 'បានបន្ថែមជោគជ័យ', product: foundMasterProduct });
            }
        } else {
            setLastScannedInfo({ status: 'error', message: `រកមិនឃើញ: ${decodedText}`, product: undefined });
        }

        setTimeout(() => setLastScannedInfo(null), 2000);
    }, [masterProducts, productsInOrder, scanMode, onCodeScanned]);

    const { 
        isInitializing, error, zoom, zoomCapabilities, handleZoomChange, 
        isTorchOn, isTorchSupported, toggleTorch, trackingBox, isAutoZooming,
        triggerFocus, switchCamera, scanFromImage
    } = useBarcodeScanner("barcode-reader-container", handleScan, scanMode, { initialZoom: 1.3 });

    // Touch Event Handlers (Zoom & Swipe & Focus)
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            touchStartDist.current = dist;
            startZoom.current = zoom;
        } else if (e.touches.length === 1) {
            touchStartY.current = e.touches[0].clientY;
            touchStartX.current = e.touches[0].clientX;
            touchStartTime.current = Date.now();
            
            const now = Date.now();
            if (now - lastTapTime.current < 300) {
                if (zoomCapabilities) handleZoomChange(zoomCapabilities.min || 1); 
            }
            lastTapTime.current = now;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && touchStartDist.current !== null && zoomCapabilities) {
            const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
            const scale = dist / touchStartDist.current;
            const range = zoomCapabilities.max - zoomCapabilities.min;
            const delta = (scale - 1) * range * 0.8;
            handleZoomChange(startZoom.current + delta);
        } else if (e.touches.length === 1 && touchStartY.current !== null) {
            const deltaY = e.touches[0].clientY - touchStartY.current;
            if (deltaY < -50 && !isHistoryOpen) {
                setIsHistoryOpen(true);
                touchStartY.current = null; 
            } else if (deltaY > 50 && isHistoryOpen) {
                setIsHistoryOpen(false);
                touchStartY.current = null;
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current !== null && touchStartY.current !== null) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const deltaX = Math.abs(touchEndX - touchStartX.current);
            const deltaY = Math.abs(touchEndY - touchStartY.current);
            const duration = Date.now() - touchStartTime.current;

            if (duration < 300 && deltaX < 15 && deltaY < 15) {
                setFocusPoint({ x: touchEndX, y: touchEndY });
                triggerFocus();
                setTimeout(() => setFocusPoint(null), 1000);
            }
        }
        
        touchStartDist.current = null; 
        touchStartY.current = null;
        touchStartX.current = null;
    };

    const handleFileUpload = async (file: File) => {
        try {
            const decodedText = await scanFromImage(file);
            handleScan(decodedText);
        } catch (e) {
            setLastScannedInfo({ status: 'error', message: 'រកមិនឃើញ Barcode ក្នុងរូបភាព', product: undefined });
            setTimeout(() => setLastScannedInfo(null), 2000);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black z-[100] flex flex-col animate-fade-in touch-none overflow-hidden h-screen"
            style={{ height: '100dvh' }} // Use dynamic viewport height for iOS
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <style>{`
              #barcode-reader-container { width: 100%; height: 100%; background: #000; overflow: hidden; }
              #barcode-reader-container video { object-fit: cover; width: 100%; height: 100%; }
              @keyframes pop-in { 0% { transform: translate(-50%, -40%) scale(0.8); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
              .animate-pop-in { animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>

            <ScannerHeader 
                onClose={onClose}
                onSwitchCamera={switchCamera}
                onToggleTorch={toggleTorch}
                isTorchOn={isTorchOn}
                isTorchSupported={isTorchSupported}
                isAutoZooming={isAutoZooming}
            />

            {/* Main Scanner */}
            <div className="relative flex-grow w-full overflow-hidden bg-black">
                <div id="barcode-reader-container"></div>
                
                <ScannerOverlay 
                    isScanning={isInitializing} 
                    error={error} 
                    scanSuccessFlash={scanSuccessFlash} 
                    zoom={zoom} 
                    useSimulatedZoom={false}
                    trackingBox={trackingBox}
                    focusPoint={focusPoint}
                />
                
                {/* Result Popup */}
                {lastScannedInfo && (
                     <div className="absolute top-1/2 left-1/2 w-[85%] max-w-sm z-50 animate-pop-in transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                        <div className={`
                            bg-gray-900/95 backdrop-blur-2xl border p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-4
                            ${lastScannedInfo.status === 'success' ? 'border-emerald-500 shadow-emerald-900/30' : lastScannedInfo.status === 'warning' ? 'border-yellow-500 shadow-yellow-900/30' : 'border-red-500 shadow-red-900/30'}
                        `}>
                            {lastScannedInfo.product ? (
                                <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 overflow-hidden flex-shrink-0">
                                    <img src={convertGoogleDriveUrl(lastScannedInfo.product.ImageURL)} className="w-full h-full object-cover" alt="" />
                                </div>
                            ) : (
                                <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center text-red-400"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2}/></svg></div>
                            )}
                            <div className="min-w-0 flex-grow">
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${lastScannedInfo.status === 'success' ? 'text-emerald-400' : lastScannedInfo.status === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {lastScannedInfo.status === 'success' ? 'SUCCESS' : lastScannedInfo.status === 'warning' ? 'ALREADY ADDED' : 'ERROR'}
                                </p>
                                <h3 className="text-white font-bold text-sm truncate">{lastScannedInfo.product?.ProductName || 'Unknown Product'}</h3>
                                {lastScannedInfo.product && <p className="text-white font-mono font-black text-lg mt-0.5">${lastScannedInfo.product.Price.toFixed(2)}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6 text-center">
                        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2}/></svg></div>
                        <p className="text-red-400 font-bold text-sm">{error}</p>
                    </div>
                )}

                {isInitializing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-30">
                        <Spinner size="lg" />
                        <p className="text-blue-500 font-black text-[10px] uppercase tracking-widest mt-4 animate-pulse">Initializing...</p>
                    </div>
                )}
            </div>

            {!isHistoryOpen && (
                <ScannerControls 
                    zoom={zoom}
                    zoomCapabilities={zoomCapabilities}
                    handleZoomChange={handleZoomChange}
                    scanMode={scanMode}
                    setScanMode={setScanMode}
                    onOpenHistory={() => setIsHistoryOpen(true)}
                    onUpload={handleFileUpload}
                />
            )}

            <HistoryDrawer 
                history={scanHistory} 
                isOpen={isHistoryOpen} 
                setIsOpen={setIsHistoryOpen} 
                onClear={() => setScanHistory([])} 
            />
        </div>
    );
};

export default BarcodeScannerModal;
