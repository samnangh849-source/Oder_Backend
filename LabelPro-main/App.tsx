
import React, { useState, useEffect } from 'react';
import { LabelData, Margins, ThemeType } from './types';
import LabelPreview from './components/LabelPreview';
import Controls from './components/Controls';
import { Printer, MapPin, Box, Command, Menu, X } from 'lucide-react';

const useLabelData = () => {
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

  useEffect(() => {
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
  }, []);

  return data;
};

const App: React.FC = () => {
  const data = useLabelData();
  const [theme, setTheme] = useState<ThemeType>(ThemeType.ACC);
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [margins, setMargins] = useState<Margins>({
    top: 0, right: 0, bottom: 0, left: 0, lineLeft: 0, lineRight: 2
  });
  const [printDensity, setPrintDensity] = useState(100);
  const [watermarkIntensity, setWatermarkIntensity] = useState(20);
  
  // Mobile Sidebar State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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
    // Close mobile menu if open before printing
    setIsMobileMenuOpen(false);
    setTimeout(() => window.print(), 100);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoPrint') === 'true') {
      const timer = setTimeout(() => {
        handlePrint('label');
      }, 800); // Allow render time for iframe
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    // Responsive container: Use h-dvh for mobile browsers to handle address bar
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] bg-dark-950 font-sans text-slate-300 overflow-hidden selection:bg-brand-cyan/30 selection:text-brand-cyan">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none no-print">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-purple/10 blur-[120px]"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-cyan/10 blur-[120px]"></div>
      </div>

      {/* MOBILE OVERLAY BACKDROP */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR - Responsive: Fixed drawer on mobile, static sidebar on desktop */}
      <aside 
        id="design-sidebar" 
        className={`
            fixed lg:relative inset-y-0 left-0 z-40
            w-[85vw] max-w-[320px] lg:w-80 
            bg-slate-900/95 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none
            border-r border-white/5 
            flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.5)] lg:shadow-[4px_0_24px_rgba(0,0,0,0.2)]
            transform transition-transform duration-300 ease-in-out no-print
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            glass-panel lg:border-r lg:border-white/5
        `}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gradient-to-tr from-brand-cyan to-brand-purple flex items-center justify-center shadow-lg shadow-brand-cyan/20">
                    <Box className="w-5 h-5 text-white" />
                </div>
                <span className="font-display font-bold text-xl tracking-wide text-white">Label<span className="text-brand-cyan">Ultra</span></span>
            </div>
            {/* Close button for Mobile */}
            <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden p-2 text-slate-400 hover:text-white"
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

        <div className="p-5 border-t border-white/5 bg-black/20 space-y-3 backdrop-blur-md shrink-0 safe-area-bottom">
             <button onClick={() => handlePrint('label')} className="group relative w-full overflow-hidden rounded-xl bg-brand-cyan p-[1px] shadow-lg shadow-brand-cyan/20 transition-all hover:shadow-brand-cyan/40 active:scale-[0.98]">
                <div className="relative flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 transition-all group-hover:bg-opacity-0">
                    <Printer className="w-4 h-4 text-brand-cyan group-hover:text-white" />
                    <span className="font-bold text-sm text-white uppercase tracking-wider">Print Label</span>
                </div>
            </button>
            <button onClick={() => handlePrint('qr')} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium py-3 px-4 rounded-xl transition-colors active:scale-[0.98]">
                <MapPin className="w-4 h-4 text-brand-purple" /> Driver QR Code
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden z-10 w-full">
        {/* HEADER */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 lg:px-8 no-print glass-panel bg-transparent shrink-0">
            <div className="flex items-center gap-3 lg:gap-4">
                {/* Mobile Menu Toggle */}
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden p-2 -ml-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                    <Menu size={24} />
                </button>

                <div className="hidden sm:flex items-center gap-2 text-slate-400 text-xs uppercase tracking-widest font-bold">
                    <Command className="w-3 h-3" /> System Status
                </div>
                <div className="hidden sm:block h-4 w-px bg-white/10"></div>
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-emerald-400 text-xs font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> READY
                </div>
            </div>
            
            <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Order ID</div>
                <div className="text-sm font-mono text-brand-cyan font-bold">{data.id}</div>
            </div>
        </header>

        {/* Improved Scroll Container Structure */}
        <div className="flex-1 overflow-y-auto relative bg-dark-950/50 touch-pan-y">
            {/* The min-h-full wrapper ensures vertical centering when content is small */}
            <div className="min-h-full flex flex-col items-center justify-start lg:justify-center p-4 py-8 lg:p-8 lg:pb-24">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
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
            
            /* Force exact color printing (important for QR and black headers) */
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
            }

            .no-print { display: none !important; }
            #root, #root > div { display: block !important; height: auto !important; }
            
            /* Global reset for the label container */
            .printable-label { 
              position: fixed !important;
              top: 50% !important;
              left: 50% !important;
              margin: 0 !important; 
              padding: 0; /* Margins are handled via inline-style padding */
              border: none !important;
              box-shadow: none !important;
              z-index: 9999 !important;
              page-break-after: always;
              border-radius: 0 !important;
              transform-origin: center center !important;
            }

            /* Theme: Flexi Gear (60x80) */
            /* ROTATE -90deg to fit onto 80x60 paper */
            .theme-flexi-gear {
                width: 60mm !important;
                height: 80mm !important;
                /* Translate to center, then rotate. Since 60 becomes height and 80 becomes width, it fits 80x60 perfectly */
                transform: translate(-50%, -50%) rotate(-90deg) !important;
            }

            /* Theme: ACC Store (80x60) */
            /* No rotation needed, just center */
            .theme-acc-store {
                width: 80mm !important;
                height: 60mm !important;
                transform: translate(-50%, -50%) !important;
            }

            /* Toggle visibility based on print mode */
            body.print-mode-label .qr-preview-container { display: none !important; }
            body.print-mode-qr .label-preview-container { display: none !important; }
            
            /* Ensure the hidden container doesn't take up layout space */
            body.print-mode-label .label-preview-container { display: block !important; position: absolute; top:0; left:0; }
            body.print-mode-qr .qr-preview-container { display: block !important; position: absolute; top:0; left:0; }
        }
      `}</style>
    </div>
  );
};

export default App;
