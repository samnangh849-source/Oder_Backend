
import React from 'react';
import { LabelData } from '../types';
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
  const paymentLower = data.payment.toLowerCase();
  
  const isPaid = paymentLower.includes('paid') && !paymentLower.includes('unpaid');
  const isCOD = !isPaid && totalAmount > 0;
  
  const getPaymentLabel = (text: string) => {
      if (isCOD && !text.toUpperCase().includes('COD')) {
          return `${text} (COD)`;
      }
      return text;
  };
  const paymentLabel = getPaymentLabel(data.payment);

  // Dynamic Font Size logic for Address - Refined to prevent cutoff
  const getAddressBaseSize = (text: string) => {
    const len = text.length;
    if (len > 160) return 5;
    if (len > 130) return 6;
    if (len > 90) return 7;
    if (len > 60) return 8;
    if (len > 30) return 9;
    return 10;
  };

  // Calculate opacity based on watermarkIntensity (0-100)
  // Maps 0-100 directly to 0-1.0 opacity, allowing full black if desired.
  // Standard refined default is around 0.2 - 0.3
  const bgOpacity = watermarkIntensity / 100;

  return (
    <div className="flex flex-col w-full h-full bg-white text-black font-sans relative overflow-hidden box-border p-0.5">
        {/* Background Watermark - Responsive to Watermark Intensity */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <span 
                className="text-[64pt] font-black uppercase rotate-[-25deg] text-black"
                style={{ opacity: bgOpacity }}
            >
                {isPaid ? 'PAID' : (isCOD ? 'C.O.D' : 'ORDER')}
            </span>
        </div>

        <div className="flex-1 border-[2.5px] border-black rounded-lg flex flex-col overflow-hidden relative z-10 bg-transparent">
            {/* Header */}
            <div className="bg-black text-white px-2 py-1 flex justify-between items-center shrink-0">
                <SmartText storageKey="acc_store" isDesignMode={isDesignMode} initialValue={data.store} baseSize={10} bold font="sans" className="text-white" />
                <div className="bg-white text-black px-1 py-0.5 rounded text-[6pt] font-mono font-bold">#{data.id}</div>
            </div>

            {/* Main Info */}
            <div className="flex flex-1 min-h-0">
                <div className="flex-1 p-2 flex flex-col gap-1 min-w-0">
                    <div className="flex justify-between items-center shrink-0">
                         {/* BOLD & BLACK - Recipient Delivery */}
                         <span className="text-[5pt] uppercase tracking-wider text-black font-black block">Recipient Delivery</span>
                         {/* BOLD & BLACK - Date */}
                         <div className="flex items-center gap-1 text-black font-black">
                            <span className="text-[4.5pt] font-black">DATE:</span>
                            <SmartText storageKey="acc_date" isDesignMode={isDesignMode} initialValue={data.date} baseSize={6} font="sans" bold heavy />
                         </div>
                    </div>
                    
                    <div className="flex flex-wrap items-baseline gap-2 shrink-0 border-b border-black/5 pb-1 mb-0.5">
                        <SmartText storageKey="acc_name" isDesignMode={isDesignMode} initialValue={data.name} baseSize={11} bold font="sans" className="text-black" />
                        <span className="text-black/10 text-[9pt]">|</span>
                        <SmartText storageKey="acc_phone" isDesignMode={isDesignMode} initialValue={data.phone} baseSize={11} bold font="sans" className="text-black" />
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-start min-h-0 overflow-hidden pt-1">
                        <div className="leading-tight">
                            {/* Location followed by detail with wrapping */}
                            <SmartText storageKey="acc_location" isDesignMode={isDesignMode} initialValue={data.location} baseSize={13} bold heavy font="sans" className="mr-2 inline-block align-top text-black" />
                            {/* Address - BOLD & BLACK */}
                            <SmartText storageKey="acc_address" isDesignMode={isDesignMode} initialValue={data.address} baseSize={getAddressBaseSize(data.address)} bold heavy font="sans" className="text-black inline-block align-top" />
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-[28mm] border-l-[2px] border-black p-1 flex flex-col items-center text-center shrink-0 bg-white/40">
                    <div className="bg-white p-0.5 rounded border border-black/10 mb-2 shrink-0">
                         <SmartQR storageKey="acc_qr" value={qrValue} baseSize={50} isDesignMode={isDesignMode} />
                    </div>
                    
                    <div className="w-full mb-1 bg-black/5 px-1 py-1 rounded border border-black/10 flex flex-col items-start shrink-0">
                        {/* SHIPPER - BOLD & BLACK */}
                        <span className="text-[4pt] text-black uppercase font-black">SHIPPER:</span>
                        <SmartText storageKey="acc_shipping" isDesignMode={isDesignMode} initialValue={data.shipping} baseSize={6.5} bold heavy font="sans" align="left" block className="text-black" />
                    </div>

                    <div className="w-full mt-auto flex flex-col gap-0.5">
                        {isPaid ? (
                            <div className="bg-white text-black rounded p-1 border-[1.5px] border-black">
                                <div className="flex items-center justify-center gap-0.5 mb-0.5 text-black">
                                    <CheckCircle2 size={7} className="text-black" /><span className="text-[5pt] font-black uppercase">PAID</span>
                                </div>
                                <SmartText storageKey="acc_total_paid" isDesignMode={isDesignMode} initialValue={`$${data.total}`} baseSize={9} bold heavy font="sans" align="center" block className="text-black" />
                            </div>
                        ) : (isCOD ? (
                            <div className="bg-black text-white rounded p-1 border-[1.5px] border-black">
                                <div className="flex items-center justify-center gap-0.5 mb-0.5 bg-white text-black px-0.5 rounded-[1px]">
                                    <AlertTriangle size={6} strokeWidth={4} /><span className="text-[5pt] font-black uppercase tracking-tighter">COD DUE</span>
                                </div>
                                <SmartText storageKey="acc_total_cod" isDesignMode={isDesignMode} initialValue={`$${data.total}`} baseSize={13} bold font="sans" align="center" block className="text-white" />
                            </div>
                        ) : (
                            <div className="bg-white text-black rounded p-1 border border-black/20">
                                <span className="text-[6pt] font-bold">UNSPECIFIED</span>
                            </div>
                        ))}
                        <SmartText storageKey="acc_payment_label" isDesignMode={isDesignMode} initialValue={paymentLabel} baseSize={6} bold font="sans" className="text-black" />
                    </div>
                </div>
            </div>

            {/* Bottom Bar - User/Page BOLD & BLACK */}
            <div className="bg-black/5 border-t-[1.5px] border-black h-[4.5mm] flex items-center justify-between px-2 shrink-0">
                 <div className="flex items-center gap-2">
                    <SmartText storageKey="acc_page" isDesignMode={isDesignMode} initialValue={data.page || "STORE"} baseSize={6} font="sans" bold heavy className="text-black" />
                    <span className="text-[4pt] text-black font-black">|</span>
                    <SmartText storageKey="acc_user" isDesignMode={isDesignMode} initialValue={data.user || "Admin"} baseSize={5.5} font="sans" bold heavy className="text-black" />
                 </div>
                 <span className="text-[4pt] text-black font-black uppercase">PRO DELIVERY SYSTEM</span>
            </div>
        </div>
    </div>
  );
};

export default AccLabel;
