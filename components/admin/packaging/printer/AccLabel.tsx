
import React from 'react';
import { LabelData } from './types';
import { SmartText, SmartQR } from './SmartElements';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AccLabelProps {
  data: LabelData;
  qrValue: string;
  isDesignMode: boolean;
  printDensity: number;
  watermarkIntensity: number;
}

const AccLabel: React.FC<AccLabelProps> = ({ data, qrValue, isDesignMode, printDensity, watermarkIntensity }) => {
  const totalAmount = parseFloat(data.total);
  const paymentLower = (data.payment || '').toLowerCase();
  
  const isPaid = paymentLower.includes('paid') && !paymentLower.includes('unpaid');
  const isCOD = !isPaid && totalAmount > 0;
  
  const getPaymentLabel = (text: string) => {
      if (isCOD && !text.toUpperCase().includes('COD')) {
          return `${text} (COD)`;
      }
      return text;
  };
  const paymentLabel = getPaymentLabel(data.payment);

  const getAddressBaseSize = (text: string) => {
    const len = text.length;
    if (len > 150) return 6;
    if (len > 110) return 7;
    if (len > 80) return 8;
    if (len > 50) return 9;
    if (len > 30) return 10;
    return 11;
  };

  const bgOpacity = watermarkIntensity / 100;

  return (
    <div className="flex flex-col w-full h-full bg-white text-black font-sans relative overflow-hidden box-border p-0">
        {/* Background Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span 
                className="text-[72pt] font-black uppercase rotate-[-25deg] text-black tracking-widest"
                style={{ opacity: bgOpacity }}
            >
                {isPaid ? 'PAID' : (isCOD ? 'C.O.D' : 'ORDER')}
            </span>
        </div>

        <div className="flex-1 border-[3px] border-black flex flex-col overflow-hidden relative z-10 bg-transparent m-0.5">
            {/* Header: Logistics Style */}
            <div className="bg-black text-white px-3 py-1.5 flex justify-between items-center shrink-0 border-b-[3px] border-black">
                <SmartText storageKey="acc_store" isDesignMode={isDesignMode} initialValue={data.store} baseSize={12} bold heavy font="sans" className="text-white uppercase tracking-wider" />
                <div className="bg-white text-black px-1.5 py-0.5 rounded-sm text-[8pt] font-mono font-black tracking-tight">#{data.id}</div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 min-h-0">
                {/* Left Column: Delivery Info */}
                <div className="flex-1 p-2.5 flex flex-col gap-1 min-w-0 border-r-[2.5px] border-black">
                    <div className="flex justify-between items-end shrink-0 mb-1">
                         <div className="bg-black text-white px-1.5 py-0.5 inline-block rounded-[1px]">
                             <span className="text-[5pt] uppercase tracking-widest font-black block leading-none">DELIVERY TO</span>
                         </div>
                         <div className="flex items-center gap-1 text-black">
                            <span className="text-[5pt] font-black">DATE:</span>
                            <SmartText storageKey="acc_date" isDesignMode={isDesignMode} initialValue={data.date} baseSize={7} font="sans" bold heavy />
                         </div>
                    </div>
                    
                    <div className="flex flex-col gap-0.5 shrink-0 border-b-2 border-black/10 pb-1.5 mb-1.5">
                        <SmartText storageKey="acc_name" isDesignMode={isDesignMode} initialValue={data.name} baseSize={13} bold heavy font="sans" className="text-black uppercase leading-tight" />
                        <SmartText storageKey="acc_phone" isDesignMode={isDesignMode} initialValue={data.phone} baseSize={12} bold font="mono" className="text-black" />
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-start min-h-0 overflow-hidden">
                        <div className="leading-[1.15]">
                            <SmartText storageKey="acc_location" isDesignMode={isDesignMode} initialValue={data.location} baseSize={14} bold heavy font="sans" className="text-black uppercase block mb-0.5" />
                            <SmartText storageKey="acc_address" isDesignMode={isDesignMode} initialValue={data.address} baseSize={getAddressBaseSize(data.address)} bold font="sans" className="text-black block" />
                        </div>
                    </div>
                </div>

                {/* Right Column: QR & Logistics */}
                <div className="w-[28mm] p-1.5 flex flex-col items-center text-center shrink-0 bg-white">
                    <div className="bg-white p-1 rounded-sm border-[2px] border-black mb-1.5 shrink-0 w-full flex justify-center">
                         <SmartQR storageKey="acc_qr" value={qrValue} baseSize={54} isDesignMode={isDesignMode} />
                    </div>
                    
                    <div className="w-full mb-1.5 px-1 py-1 flex flex-col items-center shrink-0 border-t border-b border-black/20">
                        <span className="text-[4.5pt] text-gray-500 uppercase font-black tracking-widest mb-0.5">SHIPPER</span>
                        <SmartText storageKey="acc_shipping" isDesignMode={isDesignMode} initialValue={data.shipping} baseSize={7} bold heavy font="sans" align="center" block className="text-black uppercase" />
                    </div>

                    <div className="w-full mt-auto flex flex-col justify-end min-h-[14mm]">
                        {isPaid ? (
                            <div className="bg-white text-black border-[2.5px] border-black rounded-sm p-1 w-full flex flex-col items-center justify-center h-full relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-[3px] bg-black"></div>
                                <div className="flex items-center gap-1 mb-0.5 mt-1">
                                    <CheckCircle2 size={8} strokeWidth={3} className="text-black" />
                                    <span className="text-[6.5pt] font-black uppercase tracking-widest">PAID</span>
                                </div>
                                <SmartText storageKey="acc_total_paid" isDesignMode={isDesignMode} initialValue={`$${data.total}`} baseSize={14} bold heavy font="sans" align="center" block className="text-black" />
                            </div>
                        ) : (isCOD ? (
                            <div className="bg-white text-black border-[2.5px] border-black rounded-sm p-1 w-full flex flex-col items-center justify-center h-full relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-[3px] bg-black"></div>
                                <div className="flex items-center gap-1 mb-0.5 mt-1">
                                    <AlertTriangle size={8} strokeWidth={3} /><span className="text-[6.5pt] font-black uppercase tracking-widest">COD DUE</span>
                                </div>
                                <SmartText storageKey="acc_total_cod" isDesignMode={isDesignMode} initialValue={`$${data.total}`} baseSize={14} bold heavy font="sans" align="center" block className="text-black" />
                            </div>
                        ) : (
                            <div className="bg-gray-100 text-black rounded-sm p-1.5 border border-black/20 w-full flex items-center justify-center h-full">
                                <span className="text-[6pt] font-bold uppercase tracking-widest text-gray-500">UNSPECIFIED</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Bar: Routing Info */}
            <div className="bg-black text-white h-[5mm] flex items-center justify-between px-3 shrink-0">
                 <div className="flex items-center gap-2">
                    <SmartText storageKey="acc_page" isDesignMode={isDesignMode} initialValue={data.page || "STORE"} baseSize={6.5} font="sans" bold heavy className="text-white uppercase tracking-wider" />
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-[5pt] font-bold opacity-70 uppercase">BY</span>
                    <SmartText storageKey="acc_user" isDesignMode={isDesignMode} initialValue={data.user || "Admin"} baseSize={6.5} font="sans" bold heavy className="text-white uppercase" />
                 </div>
            </div>
        </div>
    </div>
  );
};

export default AccLabel;
