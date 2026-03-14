
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
    const { language } = useContext(AppContext);
    const t = translations[language];
    
    if (totals.count === 0) return null;

    const check = isVisible;

    return (
        <tr className={`bg-[#0f172a]/95 backdrop-blur-3xl border-y border-blue-500/20 shadow-[0_15px_40px_rgba(0,0,0,0.4)] transition-all duration-500 ${showBorders ? 'divide-x divide-white/5' : ''}`}>
            {showSelection && <td className="px-1 py-3 w-8"></td>}
            
            {check('index') && (
                <td className="px-1 py-3 text-center">
                    <div className="flex flex-col items-center justify-center h-full">
                        <span className="text-[7px] font-black text-blue-500/50 uppercase tracking-[0.3em] mb-1">Vol</span>
                        <div className="bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
                            <span className="font-black text-blue-400 text-[11px] tabular-nums">
                                {totals.count}
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('actions') && <td className="px-4 py-3 text-center">
                <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest italic">Aggregate</span>
            </td>}
            
            {check('customerName') && (
                <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-8 bg-gradient-to-b from-blue-600 via-indigo-400 to-transparent rounded-full"></div>
                        <div className="flex flex-col">
                            <h4 className="font-black text-white uppercase tracking-widest text-[14px] italic leading-none">
                                {t.grand_total}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></span>
                                <span className="font-bold text-gray-500 text-[8px] uppercase tracking-widest">Live Flow</span>
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
                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1.5 opacity-60">Revenue</span>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-emerald-500 font-black text-[10px] italic">$</span>
                            <span className="font-black text-white tracking-tighter text-[22px] leading-none tabular-nums drop-shadow-[0_0_10px_rgba(16,185,129,0.2)] italic">
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
                        <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest leading-none mb-1.5 opacity-60">Logistics</span>
                        <div className="flex items-baseline gap-0.5">
                            <span className="text-orange-500 font-black text-[10px] italic">$</span>
                            <span className="font-black text-white tracking-tighter text-[18px] leading-none tabular-nums italic">
                                {totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('status') && (
                <td className="px-6 py-3">
                    <div className="flex items-center gap-3 justify-center">
                        <div className="flex flex-col items-center bg-white/[0.02] px-3 py-1.5 rounded-2xl border border-white/5">
                            <span className="font-black text-emerald-400 text-[13px] tabular-nums leading-none">{totals.paidCount}</span>
                            <span className="text-[6px] font-black text-gray-600 uppercase mt-1 tracking-widest">Paid</span>
                        </div>
                        <div className="flex flex-col items-center bg-white/[0.02] px-3 py-1.5 rounded-2xl border border-white/5">
                            <span className="font-black text-red-400 text-[13px] tabular-nums leading-none">{totals.unpaidCount}</span>
                            <span className="text-[6px] font-black text-gray-600 uppercase mt-1 tracking-widest">Unpaid</span>
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
    const { language } = useContext(AppContext);
    const t = translations[language];
    
    if (totals.count === 0) return null;

    return (
        <div className="bg-[#0f172a]/95 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-7 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden animate-fade-in-up mt-4">
            {/* Ambient Background Accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-2.5 h-12 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)]"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-[0.2em]">Summary Statistics</span>
                        <h3 className="text-lg font-black text-white uppercase tracking-widest mt-0.5">
                            {totals.count} <span className="text-gray-500 font-bold">Orders</span>
                        </h3>
                    </div>
                </div>
                <div className="bg-white/5 px-3 py-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live</span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex flex-col">
                    <p className="text-[9px] text-gray-500 font-black uppercase mb-2 tracking-[0.15em]">{t.total_revenue}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-emerald-500 font-black text-sm">$</span>
                        <p className="text-3xl font-black text-white tracking-tighter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col">
                    <p className="text-[9px] text-gray-500 font-black uppercase mb-2 tracking-[0.15em]">{t.total_cost}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-orange-500 font-black text-sm">$</span>
                        <p className="text-2xl font-black text-white/90 tracking-tighter">
                            {totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex gap-8 border-t border-white/5 pt-6">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                        <span className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">PAID</span>
                    </div>
                    <span className="text-xl font-black text-white">{totals.paidCount}</span>
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
                        <span className="text-[10px] font-black text-red-500/70 uppercase tracking-widest">UNPAID</span>
                    </div>
                    <span className="text-xl font-black text-white">{totals.unpaidCount}</span>
                </div>
            </div>
        </div>
    );
};
