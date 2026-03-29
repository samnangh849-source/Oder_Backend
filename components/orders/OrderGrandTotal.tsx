
import React, { useMemo, useContext } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';

// --- Hook for Calculation ---
export const useOrderTotals = (orders: ParsedOrder[]) => {
    return useMemo(() => {
        return orders.reduce((acc, curr) => ({
            grandTotal: acc.grandTotal + (Number(curr['Grand Total']) || 0),
            internalCost: acc.internalCost + (Number(curr['Internal Cost']) || 0),
            count: acc.count + 1,
            paidCount: acc.paidCount + (curr['Payment Status'] === 'Paid' ? 1 : 0),
            unpaidCount: acc.unpaidCount + (curr['Payment Status'] === 'Unpaid' ? 1 : 0)
        }), { grandTotal: 0, internalCost: 0, count: 0, paidCount: 0, unpaidCount: 0 });
    }, [orders]);
};

// --- Desktop Row Component ---
interface DesktopGrandTotalRowProps {
    totals: { grandTotal: number; internalCost: number; count: number; paidCount: number; unpaidCount: number };
    isVisible: (key: string) => boolean;
    showSelection: boolean;
    showBorders?: boolean;
}

export const DesktopGrandTotalRow: React.FC<DesktopGrandTotalRowProps> = ({ totals, isVisible, showSelection, showBorders = false }) => {
    const { language, advancedSettings } = useContext(AppContext);
    const t = translations[language];
    const isBinance = advancedSettings?.uiTheme === 'binance';
    
    if (totals.count === 0) return null;

    const check = isVisible;

    // Theme Variables
    const rowBg = isBinance ? 'bg-[#1E2329]' : 'bg-[#0f172a]/95 backdrop-blur-3xl';
    const rowBorder = isBinance ? 'border-b-2 border-[#FCD535]/30' : 'border-y border-blue-500/20';
    const accentColor = isBinance ? 'text-[#FCD535]' : 'text-blue-400';
    const accentBg = isBinance ? 'bg-[#FCD535]/10 border-[#FCD535]/20' : 'bg-blue-500/10 border-blue-500/20';
    const greenText = isBinance ? 'text-[#0ECB81]' : 'text-emerald-400';
    const redText = isBinance ? 'text-[#F6465D]' : 'text-red-400';

    return (
        <tr className={`${rowBg} ${rowBorder} shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all duration-500 ${showBorders ? 'divide-x divide-white/5' : ''}`}>
            {showSelection && <td className="px-1 py-3 w-8"></td>}
            
            {check('index') && (
                <td className="px-1 py-3 text-center">
                    <div className="flex flex-col items-center justify-center h-full">
                        <span className={`text-[7px] font-black uppercase tracking-[0.3em] mb-1 ${isBinance ? 'text-[#848E9C]' : 'text-blue-500/50'}`}>
                            {language === 'km' ? 'ចំនួន' : 'Vol'}
                        </span>
                        <div className={`${accentBg} px-2 py-0.5 rounded-lg border`}>
                            <span className={`font-black text-[11px] tabular-nums ${accentColor}`}>
                                {totals.count}
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('actions') && <td className="px-4 py-3 text-center">
                <span className={`text-[8px] font-black uppercase tracking-widest italic ${isBinance ? 'text-[#707A8A]' : 'text-gray-700'}`}>
                    {language === 'km' ? 'សរុបបញ្ចូលគ្នា' : 'Aggregate'}
                </span>
            </td>}
            
            {check('customerName') && (
                <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                        <div className={`w-1 h-8 rounded-full ${isBinance ? 'bg-[#FCD535]' : 'bg-gradient-to-b from-blue-600 via-indigo-400 to-transparent'}`}></div>
                        <div className="flex flex-col">
                            <h4 className={`font-black uppercase tracking-widest text-[14px] italic leading-none ${isBinance ? 'text-[#EAECEF]' : 'text-white'}`}>
                                {t.grand_total}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <span className={`w-1 h-1 rounded-full ${isBinance ? 'bg-[#FCD535]' : 'bg-emerald-500 shadow-[0_0_5px_#10b981]'}`}></span>
                                <span className={`font-bold text-[8px] uppercase tracking-widest ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'}`}>Live Flow</span>
                            </div>
                        </div>
                    </div>
                </td>
            )}
            
            {check('productInfo') && <td className="px-6 py-3"></td>}
            {check('location') && <td className="px-6 py-3"></td>}
            {check('pageInfo') && <td className="px-6 py-3"></td>}
            {check('brandSales') && <td className="px-6 py-3"></td>}
            {check('fulfillment') && <td className="px-6 py-3"></td>}
            
            {check('total') && (
                <td className="px-6 py-3">
                    <div className="flex flex-col items-start">
                        <span className={`text-[8px] font-black uppercase tracking-widest leading-none mb-1.5 opacity-60 ${isBinance ? 'text-[#0ECB81]' : 'text-emerald-500'}`}>
                            {language === 'km' ? 'ចំណូល' : 'Revenue'}
                        </span>
                        <div className="flex items-baseline gap-0.5">
                            <span className={`font-black text-[10px] italic ${isBinance ? 'text-[#0ECB81]' : 'text-emerald-500'}`}>$</span>
                            <span className={`font-black tracking-tighter text-[22px] leading-none tabular-nums italic drop-shadow-[0_0_10px_rgba(16,185,129,0.2)] ${isBinance ? 'text-[#EAECEF]' : 'text-white'}`}>
                                {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('shippingService') && <td className="px-6 py-3"></td>}
            {check('driver') && <td className="px-6 py-3"></td>}
            
            {check('shippingCost') && (
                <td className="px-6 py-3">
                    <div className="flex flex-col items-start opacity-80">
                        <span className={`text-[8px] font-black uppercase tracking-widest leading-none mb-1.5 opacity-60 ${isBinance ? 'text-[#FCD535]' : 'text-orange-500'}`}>
                            {language === 'km' ? 'សេវាដឹក' : 'Logistics'}
                        </span>
                        <div className="flex items-baseline gap-0.5">
                            <span className={`font-black text-[10px] italic ${isBinance ? 'text-[#FCD535]' : 'text-orange-500'}`}>$</span>
                            <span className={`font-black tracking-tighter text-[18px] leading-none tabular-nums italic ${isBinance ? 'text-[#EAECEF]' : 'text-white'}`}>
                                {totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('status') && (
                <td className="px-6 py-3">
                    <div className="flex items-center gap-3 justify-center">
                        <div className={`flex flex-col items-center px-3 py-1.5 rounded-2xl border ${isBinance ? 'bg-[#1E2329] border-[#2B3139]' : 'bg-white/[0.02] border-white/5'}`}>
                            <span className={`font-black text-[13px] tabular-nums leading-none ${greenText}`}>{totals.paidCount}</span>
                            <span className={`text-[6px] font-black uppercase mt-1 tracking-widest ${isBinance ? 'text-[#848E9C]' : 'text-gray-600'}`}>{t.paid}</span>
                        </div>
                        <div className={`flex flex-col items-center px-3 py-1.5 rounded-2xl border ${isBinance ? 'bg-[#1E2329] border-[#2B3139]' : 'bg-white/[0.02] border-white/5'}`}>
                            <span className={`font-black text-[13px] tabular-nums leading-none ${redText}`}>{totals.unpaidCount}</span>
                            <span className={`text-[6px] font-black uppercase mt-1 tracking-widest ${isBinance ? 'text-[#848E9C]' : 'text-gray-600'}`}>{t.unpaid}</span>
                        </div>
                    </div>
                </td>
            )}

            {check('date') && <td className="px-4 py-3"></td>}
            {check('note') && <td className="px-6 py-3"></td>}
            {check('print') && <td className="px-4 py-3"></td>}
            {check('check') && <td className="px-2 py-3"></td>}
            {check('orderId') && <td className="px-2 py-3"></td>}
        </tr>
    );
};

// --- Mobile Card Component ---
interface MobileGrandTotalCardProps {
    totals: { grandTotal: number; internalCost: number; count: number; paidCount: number; unpaidCount: number };
}

export const MobileGrandTotalCard: React.FC<MobileGrandTotalCardProps> = ({ totals }) => {
    const { language, advancedSettings } = useContext(AppContext);
    const t = translations[language];
    const isBinance = advancedSettings?.uiTheme === 'binance';
    
    if (totals.count === 0) return null;

    // Theme Variables
    const cardBg = isBinance ? 'bg-[#1E2329]' : 'bg-[#0f172a]/95 backdrop-blur-3xl';
    const cardBorder = isBinance ? 'border-[#2B3139]' : 'border-white/10';
    const accentColor = isBinance ? 'text-[#FCD535]' : 'text-blue-400';
    const greenText = isBinance ? 'text-[#0ECB81]' : 'text-emerald-500';
    const redText = isBinance ? 'text-[#F6465D]' : 'text-red-500';

    return (
        <div className={`${cardBg} border ${cardBorder} rounded-[2rem] p-6 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden animate-fade-in-up mt-4`}>
            {/* Ambient Background Accents */}
            {!isBinance && (
                <>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                </>
            )}
            
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-10 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.2)] ${isBinance ? 'bg-[#FCD535]' : 'bg-gradient-to-b from-blue-600 to-indigo-600'}`}></div>
                    <div className="flex flex-col">
                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isBinance ? 'text-[#848E9C]' : 'text-blue-400/60'}`}>{language === 'km' ? 'ស្ថិតិសរុប' : 'Summary Statistics'}</span>
                        <h3 className="text-base font-black text-white uppercase tracking-widest mt-0.5">
                            {totals.count} <span className={`${isBinance ? 'text-[#848E9C]' : 'text-gray-500'} font-bold`}>{language === 'km' ? 'ការកម្មង់' : 'Orders'}</span>
                        </h3>
                    </div>
                </div>
                <div className={`${isBinance ? 'bg-[#2B3139]' : 'bg-white/5'} px-3 py-1.5 rounded-xl border ${cardBorder} backdrop-blur-md`}>
                   <span className={`text-[9px] font-black uppercase tracking-widest ${isBinance ? 'text-[#FCD535]' : 'text-gray-400'}`}>Live</span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col">
                    <p className={`text-[9px] font-black uppercase mb-1.5 tracking-[0.15em] ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'}`}>{t.total_revenue}</p>
                    <div className="flex items-baseline gap-1">
                        <span className={`${greenText} font-black text-xs`}>$</span>
                        <p className={`text-2xl font-black tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.2)] ${isBinance ? 'text-[#EAECEF]' : 'text-white'}`}>
                            {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col">
                    <p className={`text-[9px] font-black uppercase mb-1.5 tracking-[0.15em] ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'}`}>{t.total_cost}</p>
                    <div className="flex items-baseline gap-1">
                        <span className={`${isBinance ? 'text-[#FCD535]' : 'text-orange-500'} font-black text-xs`}>$</span>
                        <p className={`text-xl font-black tracking-tighter ${isBinance ? 'text-[#EAECEF]' : 'text-white/90'}`}>
                            {totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            <div className={`flex gap-6 border-t pt-5 ${cardBorder}`}>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isBinance ? 'bg-[#0ECB81]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`}></div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isBinance ? 'text-[#0ECB81]' : 'text-emerald-500/70'}`}>{t.paid}</span>
                    </div>
                    <span className="text-lg font-black text-white">{totals.paidCount}</span>
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isBinance ? 'bg-[#F6465D]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isBinance ? 'text-[#F6465D]' : 'text-red-500/70'}`}>{t.unpaid}</span>
                    </div>
                    <span className="text-lg font-black text-white">{totals.unpaidCount}</span>
                </div>
            </div>
        </div>
    );
};
