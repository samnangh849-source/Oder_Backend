
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
        <tr className={`bg-[#0f172a] border-y-2 border-blue-500/30 sticky top-0 z-30 backdrop-blur-3xl shadow-[0_15px_40px_rgba(0,0,0,0.4)] ${showBorders ? 'divide-x divide-white/5' : ''}`}>
            {showSelection && <td className="px-1 py-5 w-8"></td>}
            
            {check('index') && (
                <td className="px-1 py-5 text-center">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">{t.volume}</span>
                        <span className="font-black text-blue-400 text-base leading-none">
                            {totals.count}
                        </span>
                    </div>
                </td>
            )}
            
            {check('actions') && <td className="px-4 py-5"></td>}
            
            {check('customerName') && (
                <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_#2563eb]"></div>
                        <div className="flex flex-col">
                            <span className="font-black text-white uppercase tracking-widest text-xs leading-tight">
                                {t.grand_total}
                            </span>
                            <span className="font-bold text-blue-400/80 text-[11px] leading-tight">
                                (Summary)
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('productInfo') && <td className="px-6 py-5"></td>}
            {check('location') && <td className="px-6 py-5"></td>}
            {check('pageInfo') && <td className="px-6 py-5"></td>}
            {check('brandSales') && <td className="px-6 py-5"></td>}
            {check('fulfillment') && <td className="px-6 py-5"></td>}
            
            {check('total') && (
                <td className="px-6 py-5">
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t.total_revenue}</span>
                        <span className="font-black text-emerald-400 tracking-tighter drop-shadow-[0_0_8px_rgba(16,185,129,0.3)] text-xl leading-none">
                            ${totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </td>
            )}
            
            {check('shippingService') && <td className="px-6 py-5"></td>}
            {check('driver') && <td className="px-6 py-5"></td>}
            
            {check('shippingCost') && (
                <td className="px-6 py-5">
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t.total_cost}</span>
                        <span className="font-black text-orange-400 font-mono text-lg leading-none">
                            ${totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </td>
            )}
            
            {check('status') && (
                <td className="px-6 py-5">
                    <div className="flex flex-col gap-1.5 items-center justify-center min-w-[100px]">
                        {totals.paidCount > 0 && (
                            <div className="flex items-center gap-3 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-full justify-between shadow-inner">
                                <span className="text-[9px] font-black text-emerald-500/70 uppercase">Paid</span>
                                <span className="font-black text-emerald-400 text-xs">{totals.paidCount}</span>
                            </div>
                        )}
                        {totals.unpaidCount > 0 && (
                            <div className="flex items-center gap-3 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 w-full justify-between shadow-inner">
                                <span className="text-[9px] font-black text-red-500/70 uppercase">Unpaid</span>
                                <span className="font-black text-red-400 text-xs">{totals.unpaidCount}</span>
                            </div>
                        )}
                    </div>
                </td>
            )}

            {check('date') && <td className="px-4 py-5"></td>}
            {check('note') && <td className="px-6 py-5"></td>}
            {check('print') && <td className="px-4 py-5"></td>}
            {check('check') && <td className="px-2 py-5"></td>}
            {check('orderId') && <td className="px-2 py-5"></td>}
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
        <div className="bg-[#0f172a]/80 backdrop-blur-2xl border border-blue-500/30 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden animate-fade-in-up mt-2">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-10 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
                    <div className="flex flex-col">
                        <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none">
                            {t.grand_total}
                        </h3>
                        <span className="text-[10px] font-bold text-blue-400/80 uppercase tracking-widest mt-1.5">Overview Statistics</span>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-2xl shadow-xl">
                    <span className="text-xs font-black text-blue-400">
                        {totals.count} <span className="text-gray-500 ml-1">Orders</span>
                    </span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-black/20 p-4 rounded-3xl border border-white/5 shadow-inner">
                    <p className="text-[10px] text-gray-500 font-black uppercase mb-2 tracking-widest">{t.total_revenue}</p>
                    <p className="text-2xl font-black text-emerald-400 tracking-tighter italic">
                        ${totals.grandTotal.toLocaleString()}
                    </p>
                </div>
                <div className="bg-black/20 p-4 rounded-3xl border border-white/5 shadow-inner">
                    <p className="text-[10px] text-gray-500 font-black uppercase mb-2 tracking-widest">{t.total_cost}</p>
                    <p className="text-xl font-black text-orange-400 tracking-tighter italic">
                        ${totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            <div className="flex gap-3">
                <div className="flex-1 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 flex justify-between items-center px-4 shadow-lg shadow-emerald-900/5">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">PAID</span>
                    <span className="text-sm font-black text-white">{totals.paidCount}</span>
                </div>
                <div className="flex-1 bg-red-500/10 p-3 rounded-2xl border border-red-500/20 flex justify-between items-center px-4 shadow-lg shadow-red-900/5">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">UNPAID</span>
                    <span className="text-sm font-black text-white">{totals.unpaidCount}</span>
                </div>
            </div>
        </div>
    );
};
