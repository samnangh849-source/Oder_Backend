
import React from 'react';
import { LabelData, Margins, ThemeType } from '../types';
import LabelContent from './LabelContent';
import QRCode from './QRCode';
import { Eye, Printer, MousePointer2, User, Phone, MapPin, Navigation } from 'lucide-react';

interface LabelPreviewProps {
  data: LabelData;
  theme: ThemeType;
  margins: Margins;
  isDesignMode: boolean;
  printDensity: number;
  watermarkIntensity: number;
}

const LabelPreview: React.FC<LabelPreviewProps> = ({ data, theme, margins, isDesignMode, printDensity, watermarkIntensity }) => {
  const baseUrl = "https://oder-backend-2.onrender.com/CustomerAction.html";
  const mapParam = data.mapLink ? encodeURIComponent(data.mapLink) : "";
  const qrValue = `${baseUrl}?id=${encodeURIComponent(data.id)}&name=${encodeURIComponent(data.name)}&phone=${encodeURIComponent(data.phone)}&map=${mapParam}`;

  const getQrFooter = () => {
    const features = [];
    if (data.mapLink) features.push("Map");
    if (data.phone) { features.push("Call"); }
    return features.length > 0 ? `Include: ${features.join(" & ")}` : "Scan for Details";
  };

  const isFlexi = theme === ThemeType.FLEXI;
  const sheetStyle: React.CSSProperties = {
    width: isFlexi ? '60mm' : '80mm',
    height: isFlexi ? '80mm' : '60mm',
    paddingTop: `${margins.top}mm`,
    paddingRight: `${margins.right}mm`,
    paddingBottom: `${margins.bottom}mm`,
    paddingLeft: `${margins.left}mm`,
    // Removed filter: contrast() to allow precise opacity control for watermark via AccLabel logic
  };

  const renderDriverCardContent = () => {
    if (isFlexi) {
        // VERTICAL LAYOUT (60mm x 80mm) - Flexi Style
        // Adjusted padding and sizing to prevent truncation of QR/Badge
        return (
            <div className="w-full h-full flex flex-col bg-white border border-black/5 box-border font-sans">
                {/* Header - Compacted */}
                <div className="flex justify-between items-start px-4 pt-2 pb-1.5 bg-gray-50 shrink-0">
                    <div>
                        <div className="text-[7pt] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Store</div>
                        <div className="text-[11pt] font-black uppercase leading-none tracking-tight">{data.store}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[7pt] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Order</div>
                        <div className="text-[11pt] font-mono font-bold leading-none text-black">{data.id}</div>
                    </div>
                </div>

                {/* Customer Info - Compacted */}
                <div className="px-4 py-2 border-b border-black/5 bg-white shrink-0">
                    <div className="flex items-center gap-3 mb-1.5">
                        <div className="w-5 h-5 rounded-full bg-black/5 text-black flex items-center justify-center shrink-0 shadow-sm">
                             <User size={10} />
                        </div>
                        <span className="text-[10pt] font-bold uppercase truncate leading-none text-slate-800 w-[40mm]">{data.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-black/5 text-black flex items-center justify-center shrink-0 shadow-sm">
                             <Phone size={10} />
                        </div>
                        <span className="text-[11pt] font-mono font-bold leading-none text-slate-800">{data.phone}</span>
                    </div>
                </div>

                {/* QR Code Area - Flexible with min-height safety */}
                <div className="flex-1 flex flex-col items-center justify-center p-1 relative bg-white overflow-hidden min-h-0">
                     {/* QR Container */}
                     <div className="flex flex-col items-center gap-1.5 z-10">
                         {/* Reduced border padding */}
                         <div className="border-[3px] border-black p-1 rounded-xl bg-white shadow-lg">
                            {/* Adjusted Size */}
                            <QRCode value={qrValue} size={90} />
                         </div>
                         {/* Prominent Driver Scan Badge */}
                         <div className="flex items-center gap-1.5 bg-black text-white px-3 py-1 rounded-full">
                            <MapPin size={10} className="text-brand-cyan" />
                            <span className="text-[8pt] font-black uppercase tracking-[0.15em] leading-none pt-[1px]">Driver Scan</span>
                         </div>
                     </div>
                     
                     {/* Background Pattern */}
                     <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                </div>

                {/* Footer - Compacted */}
                <div className="bg-gray-100 text-center py-1 border-t border-gray-200 shrink-0">
                     <div className="text-[6pt] text-gray-400 font-mono uppercase tracking-widest">{getQrFooter()}</div>
                </div>
            </div>
        );
    } else {
        // LANDSCAPE LAYOUT (80mm x 60mm) - Acc Style
        return (
            <div className="w-full h-full flex bg-white p-3 gap-3 box-border font-sans">
                 {/* Left Column: Info */}
                 <div className="w-[30mm] flex flex-col justify-between shrink-0 py-1">
                     <div className="border-l-[3px] border-black pl-2.5 pt-1 pb-2">
                        <div className="text-[6pt] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Identity</div>
                        <div className="text-[9pt] font-black uppercase leading-none mb-1">{data.store}</div>
                        <div className="text-[10pt] font-mono font-bold text-gray-800 leading-none">#{data.id}</div>
                     </div>
                     
                     <div className="space-y-3 pl-1">
                        <div>
                            <span className="text-[6pt] text-gray-400 font-bold uppercase block mb-0.5">Customer</span>
                            <div className="flex items-center gap-1.5">
                                <User size={12} className="text-black" />
                                <span className="text-[9pt] font-bold uppercase leading-tight truncate block w-[24mm]">{data.name}</span>
                            </div>
                        </div>
                        <div>
                            <span className="text-[6pt] text-gray-400 font-bold uppercase block mb-0.5">Contact</span>
                            <div className="flex items-center gap-1.5">
                                <Phone size={12} className="text-black" />
                                <span className="text-[9pt] font-mono font-bold leading-none">{data.phone}</span>
                            </div>
                        </div>
                     </div>

                     <div className="mt-auto pl-1">
                        <div className="text-[6pt] text-gray-400 font-bold uppercase tracking-wider">Features</div>
                        <div className="flex gap-1 mt-0.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
                             <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
                             <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
                        </div>
                     </div>
                 </div>

                 {/* Right Column: QR - Enhanced */}
                 <div className="flex-1 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-2 relative overflow-hidden">
                      <div className="z-10 bg-white p-1.5 rounded-lg border border-black/5 shadow-sm mb-2">
                        <QRCode value={qrValue} size={90} />
                      </div>
                      
                      <div className="z-10 flex items-center gap-1.5 bg-black text-white px-3 py-1 rounded-full">
                        <Navigation size={10} className="text-white fill-current" />
                        <span className="text-[7pt] font-black uppercase tracking-wider leading-none pt-[1px]">Driver Scan</span>
                      </div>

                      {/* Decorative Corner */}
                      <div className="absolute top-0 right-0 w-8 h-8 bg-black/5 rounded-bl-3xl -mr-4 -mt-4"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 bg-black/5 rounded-tr-3xl -ml-4 -mb-4"></div>
                 </div>
            </div>
        );
    }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-12 items-center justify-center w-full min-h-[600px]">
      <div className="flex flex-col gap-6 items-center label-preview-container flex-1 w-full max-w-[420px]">
        <div className={`relative group transition-all duration-300 w-full flex justify-center ${isDesignMode ? 'scale-100' : 'hover:scale-[1.02]'}`}>
            <div className={`absolute -inset-1 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500 ${isFlexi ? 'bg-gradient-to-r from-amber-500 to-orange-600' : 'bg-gradient-to-r from-brand-cyan to-brand-purple'}`}></div>
            <div className="relative w-full bg-slate-900 border border-white/10 p-6 rounded-xl flex flex-col items-center shadow-2xl overflow-hidden">
                 {isDesignMode && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-2 z-20 animate-pulse">
                        <MousePointer2 className="w-3 h-3" /> Click to Edit
                    </div>
                 )}
                 <div className={`relative bg-white transition-all duration-300 ${isDesignMode ? 'ring-2 ring-brand-cyan ring-offset-4 ring-offset-slate-900 cursor-text shadow-none' : 'shadow-[0_0_30px_rgba(255,255,255,0.1)]'}`}>
                    <div className={`printable-label overflow-hidden bg-white text-black ${isFlexi ? 'theme-flexi-gear' : 'theme-acc-store'}`} style={sheetStyle}>
                        <LabelContent data={data} theme={theme} lineLeft={margins.lineLeft} lineRight={margins.lineRight} qrValue={qrValue} isDesignMode={isDesignMode} printDensity={printDensity} watermarkIntensity={watermarkIntensity} />
                    </div>
                 </div>
                 <div className="mt-6 w-full flex justify-between items-center text-xs font-mono text-slate-500 no-print">
                    <div className="flex items-center gap-1"><Printer className="w-3 h-3" /><span>{isFlexi ? '60x80mm' : '80x60mm'}</span></div>
                    <div className={isFlexi ? 'text-amber-500' : 'text-brand-cyan'}>{isFlexi ? 'VERTICAL' : 'LANDSCAPE'}</div>
                 </div>
            </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 items-center qr-preview-container flex-1 w-full max-w-[420px]">
        <div className={`relative group transition-all duration-300 w-full flex justify-center ${isDesignMode ? 'scale-100' : 'hover:scale-[1.02]'}`}>
             <div className="absolute -inset-1 bg-gradient-to-r from-brand-purple to-brand-pink rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
            <div className="relative w-full bg-slate-900 border border-white/10 p-6 rounded-xl flex flex-col items-center shadow-2xl">
                <div className={`relative bg-white transition-all duration-300 ${isDesignMode ? 'ring-2 ring-brand-purple ring-offset-4 ring-offset-slate-900' : 'shadow-[0_0_30px_rgba(255,255,255,0.1)]'}`}>
                    <div className={`printable-label bg-white text-black overflow-hidden flex flex-col ${isFlexi ? 'theme-flexi-gear' : 'theme-acc-store'}`} style={sheetStyle}>
                        {renderDriverCardContent()}
                    </div>
                </div>
                 <div className="mt-6 w-full flex justify-between items-center text-xs font-mono text-slate-500 no-print">
                    <div className="flex items-center gap-1"><Eye className="w-3 h-3" /><span>Driver Card</span></div>
                    <div className="text-brand-purple">ACTIVE</div>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LabelPreview;
