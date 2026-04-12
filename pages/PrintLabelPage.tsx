import React, { useState, useEffect } from 'react';
import { LabelData, Margins, ThemeType } from '../components/admin/packaging/printer/types';
import LabelPreview from '../components/admin/packaging/printer/LabelPreview';
import Controls from '../components/admin/packaging/printer/Controls';
import { Printer, MapPin, Box, Command, Menu, X, ArrowLeft } from 'lucide-react';

interface PrintLabelPageProps {
  initialData?: Partial<LabelData>;
  onClose?: () => void;
  standalone?: boolean;
}

const PrintLabelPage: React.FC<PrintLabelPageProps> = ({ initialData, onClose, standalone = true }) => {
  const [data, setData] = useState<LabelData>({
    id: 'ORD-001',
    name: 'Customer Name',
    phone: '012 345 678',
    location: 'Phnom Penh',
    address: '#123, Street ABC, Khan XYZ',
    store: 'ACC Store',
    page: 'FB Page',
    user: 'Admin',
    total: '0.00',
    shipping: 'N/A',
    payment: 'Unpaid',
    note: '',
    mapLink: '',
    date: new Date().toLocaleDateString('en-GB')
  });

  const [theme, setTheme] = useState<ThemeType>(ThemeType.ACC);
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [margins, setMargins] = useState<Margins>({
    top: 0, right: 0, bottom: 0, left: 0, lineLeft: 0, lineRight: 2
  });
  const [printDensity, setPrintDensity] = useState(100);
  const [watermarkIntensity, setWatermarkIntensity] = useState(20);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (initialData) {
        setData(prev => ({ ...prev, ...initialData }));
        return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.toString() === '') return; 

    const safeGet = (key: string, def: string = '') => {
        const val = params.get(key);
        if (!val) return def;
        try {
            return decodeURIComponent(val);
        } catch (e) {
            return val;
        }
    };

    let mapLink = safeGet('map');
    const note = safeGet('note');
    
    if (!mapLink || mapLink === 'undefined' || mapLink === 'null') {
      const fullText = `${safeGet('address')} ${safeGet('location')} ${note}`;
      const match = fullText.match(/(https?:\/\/[^\s]+)/g);
      if (match) mapLink = match[0];
    }

    let address = safeGet('address');
    if (mapLink && address) {
        address = address.replace(mapLink, '').trim();
    }

    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
    const storeName = safeGet('store', 'ACC Store');

    setData({
      id: safeGet('id', '...'),
      name: safeGet('name', '...'),
      phone: safeGet('phone', '...'),
      location: safeGet('location', '...'),
      address: address || '...',
      store: storeName !== 'Unknown' && storeName !== 'undefined' ? storeName : 'ACC Store',
      page: safeGet('page', 'N/A'),
      user: safeGet('user', 'N/A'),
      total: params.get('total') ? parseFloat(params.get('total')!).toFixed(2) : '0.00',
      shipping: safeGet('shipping', 'N/S'),
      payment: safeGet('payment', 'Unpaid'),
      note: note,
      mapLink: mapLink,
      date: formattedDate
    });
  }, [initialData]);

  useEffect(() => {
    if (data.store === 'Flexi Gear') setTheme(ThemeType.FLEXI);
    else setTheme(ThemeType.ACC);
  }, [data.store]);

  useEffect(() => {
    const loadMargin = (key: keyof Margins) => {
      const saved = localStorage.getItem(`label_${key}`);
      return saved ? parseFloat(saved) : 0;
    };
    setMargins({
      top: loadMargin('top'),
      right: loadMargin('right'),
      bottom: loadMargin('bottom'),
      left: loadMargin('left'),
      lineLeft: loadMargin('lineLeft'),
      lineRight: localStorage.getItem('label_lineRight') ? parseFloat(localStorage.getItem('label_lineRight')!) : 2
    });

    const savedDensity = localStorage.getItem('label_density');
    if (savedDensity) setPrintDensity(parseInt(savedDensity));
    
    const savedWatermark = localStorage.getItem('label_watermark');
    if (savedWatermark) setWatermarkIntensity(parseInt(savedWatermark));
  }, []);

  const handleMarginChange = (key: keyof Margins, value: number) => {
    setMargins(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(`label_${key}`, value.toString());
  };

  const handleDensityChange = (val: number) => {
    setPrintDensity(val);
    localStorage.setItem('label_density', val.toString());
  };

  const handleWatermarkChange = (val: number) => {
    setWatermarkIntensity(val);
    localStorage.setItem('label_watermark', val.toString());
  };

  const handlePrint = (target: 'label' | 'qr') => {
    document.body.classList.remove('print-mode-label', 'print-mode-qr');
    document.body.classList.add(target === 'label' ? 'print-mode-label' : 'print-mode-qr');
    setIsMobileMenuOpen(false);
    
    // Dispatch event so parent window (FastPackTerminal) can advance steps
    const event = new CustomEvent('print-success', { detail: { target } });
    window.dispatchEvent(event);
    try {
        if (window.parent && window.parent !== window) {
            window.parent.dispatchEvent(event);
        }
    } catch (e) {}
    
    setTimeout(() => {
        window.focus();
        window.print();
    }, 150);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoPrint') === 'true') {
      const timer = setTimeout(() => {
        handlePrint('label');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Update original App state on edit if it's integrated
  useEffect(() => {
      if (!standalone) {
         const handleDesignAction = (e: any) => {
             // For a basic edit, we trust LabelPreview's internal LiveEdit. 
             // But if we want back button, we handle it here.
         };
         window.addEventListener('design-action', handleDesignAction);
         return () => window.removeEventListener('design-action', handleDesignAction);
      }
  }, [standalone]);

  return (
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-[#0B0E11] font-sans text-gray-300 overflow-hidden selection:bg-[#FCD535]/30 selection:text-[#FCD535] relative z-[9999]">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none no-print">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#FCD535]/5 blur-[120px]"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#FCD535]/5 blur-[120px]"></div>
      </div>

      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside 
        id="design-sidebar" 
        className={`
            fixed lg:relative inset-y-0 left-0 z-40
            w-[85vw] max-w-[320px] lg:w-80 
            bg-[#181A20]
            border-r border-[#2B3139] 
            flex flex-col shadow-2xl
            transform transition-transform duration-300 ease-in-out no-print
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#2B3139] bg-[#0B0E11] shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-[#FCD535]/10 border border-[#FCD535]/30 flex items-center justify-center">
                    <Box className="w-5 h-5 text-[#FCD535]" />
                </div>
                <span className="font-bold text-lg tracking-widest uppercase text-white">ACC <span className="text-[#FCD535]">OPS</span></span>
            </div>
            <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden p-2 text-gray-400 hover:text-white"
            >
                <X size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
             <Controls 
                margins={margins}
                onMarginChange={handleMarginChange}
                currentTheme={theme}
                onThemeChange={setTheme}
                isDesignMode={isDesignMode}
                onDesignModeToggle={setIsDesignMode}
                printDensity={printDensity}
                onPrintDensityChange={handleDensityChange}
                watermarkIntensity={watermarkIntensity}
                onWatermarkChange={handleWatermarkChange}
            />
        </div>

        <div className="p-5 border-t border-[#2B3139] bg-[#0B0E11] space-y-3 shrink-0 safe-area-bottom">
             <button onClick={() => handlePrint('label')} className="w-full flex items-center justify-center gap-3 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black font-bold uppercase text-xs tracking-widest py-4 rounded-sm transition-colors cursor-pointer">
                <Printer className="w-5 h-5" />
                <span>Print Label</span>
            </button>
            <button onClick={() => handlePrint('qr')} className="w-full flex items-center justify-center gap-3 bg-[#2B3139] hover:bg-gray-700 border border-[#2B3139] text-gray-300 font-bold uppercase text-xs tracking-widest py-4 rounded-sm transition-colors cursor-pointer">
                <MapPin className="w-5 h-5 text-gray-400" /> Driver QR Code
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden z-10 w-full">
        {/* HEADER */}
        <header className="h-16 border-b border-[#2B3139] bg-[#181A20] flex items-center justify-between px-4 lg:px-8 no-print shrink-0">
            <div className="flex items-center gap-3 lg:gap-4">
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden p-2 -ml-2 text-gray-300 hover:text-white hover:bg-[#2B3139] rounded-sm transition-colors"
                >
                    <Menu size={24} />
                </button>

                {onClose && (
                    <button 
                        onClick={onClose}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#0B0E11] hover:bg-[#2B3139] border border-[#2B3139] text-gray-300 transition-colors"
                    >
                        <ArrowLeft size={16} /> 
                        <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest">Back</span>
                    </button>
                )}

                <div className="hidden sm:flex items-center gap-2 text-gray-500 text-[10px] uppercase tracking-widest font-bold ml-2">
                    <Command className="w-3 h-3" /> System Status
                </div>
                <div className="hidden sm:block h-4 w-px bg-[#2B3139]"></div>
                <div className="flex items-center gap-2 bg-[#FCD535]/10 border border-[#FCD535]/20 px-2 py-1 rounded-sm text-[#FCD535] text-[10px] font-bold tracking-widest uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FCD535] animate-pulse"></span> READY
                </div>
            </div>
            
            <div className="text-right">
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Order ID</div>
                <div className="text-sm font-mono text-white font-bold">{data.id}</div>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto relative bg-[#0B0E11] touch-pan-y">
            <div className="min-h-full flex flex-col items-center justify-start lg:justify-center p-4 py-8 lg:p-8 lg:pb-24">
                <div className="absolute inset-0 bg-[#0B0E11] opacity-50" style={{ backgroundImage: 'linear-gradient(#181A20 1px, transparent 1px), linear-gradient(90deg, #181A20 1px, #0B0E11 1px)', backgroundSize: '40px 40px' }}></div>
                <div className="w-full max-w-6xl relative z-10">
                    <LabelPreview 
                        data={data}
                        theme={theme}
                        margins={margins}
                        isDesignMode={isDesignMode}
                        printDensity={printDensity}
                        watermarkIntensity={watermarkIntensity}
                    />
                </div>
            </div>
        </div>
      </main>

      <style>{`
        .safe-area-bottom {
            padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        @media print {
            @page { 
                size: 80mm 60mm; 
                margin: 0; 
            }
            html, body { 
                width: 80mm !important; 
                height: 60mm !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                overflow: hidden !important; 
                background: white !important;
            }
            
            /* Force exact color printing */
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }

            .no-print { display: none !important; }
            /* Don't hide the overlay! */
            #root, #root > div { display: block !important; height: auto !important; }
            
            .printable-label { 
              position: fixed !important;
              top: 50% !important;
              left: 50% !important;
              margin: 0 !important; 
              padding: 0;
              border: none !important;
              box-shadow: none !important;
              z-index: 9999 !important;
              page-break-after: always;
              border-radius: 0 !important;
              transform-origin: center center !important;
            }

            .theme-flexi-gear {
                width: 60mm !important;
                height: 80mm !important;
                transform: translate(-50%, -50%) rotate(-90deg) !important;
            }

            .theme-acc-store {
                width: 80mm !important;
                height: 60mm !important;
                transform: translate(-50%, -50%) !important;
            }

            body.print-mode-label .qr-preview-container { display: none !important; }
            body.print-mode-qr .label-preview-container { display: none !important; }
            
            body.print-mode-label .label-preview-container { display: block !important; position: absolute; top:0; left:0; }
            body.print-mode-qr .qr-preview-container { display: block !important; position: absolute; top:0; left:0; }
        }
      `}</style>
    </div>
  );
};

export default PrintLabelPage;
