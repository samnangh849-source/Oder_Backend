
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
    const rowBorder = isBinance ? 'border-b border-[#2B3139]' : 'border-y border-blue-500/20';
    const accentColor = isBinance ? 'text-[#FCD535]' : 'text-blue-400';
    const accentBg = isBinance ? 'bg-[#2B3139] border-[#474D57]' : 'bg-blue-500/10 border-blue-500/20';
    const greenText = isBinance ? 'text-[#0ECB81]' : 'text-emerald-400';
    const redText = isBinance ? 'text-[#F6465D]' : 'text-red-400';

    return (
        <tr className={`${rowBg} ${rowBorder} ${isBinance ? '' : 'shadow-[0_15px_40px_rgba(0,0,0,0.4)]'} transition-all duration-300 ${showBorders ? 'divide-x divide-[#2B3139]' : ''} group`}>
            {showSelection && <td className="px-1 py-2 w-8"></td>}
            
            {check('index') && (
                <td className="px-1 py-2 text-center">
                    <div className="flex flex-col items-center justify-center h-full">
                        <span className={`text-[9px] font-medium uppercase mb-0.5 ${isBinance ? 'text-[#848E9C]' : 'text-blue-500/50'}`}>
                            {language === 'km' ? 'សរុប' : 'Total'}
                        </span>
                        <div className={`${isBinance ? 'bg-[#2B3139] px-2 py-0.5 rounded' : accentBg + ' px-3 py-1 rounded-xl border-2 shadow-[0_0_15px_rgba(59,130,246,0.1)]'}`}>
                            <span className={`font-bold ${isBinance ? 'text-[12px]' : 'text-[13px]'} tabular-nums ${isBinance ? 'text-[#EAECEF]' : accentColor}`}>
                                {totals.count}
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('actions') && <td className="px-4 py-2 text-center">
                <div className="flex flex-col">
                   <span className={`text-[9px] font-medium uppercase tracking-tight ${isBinance ? 'text-[#848E9C]' : 'text-gray-500 italic'}`}>
                        {language === 'km' ? 'សង្ខេប' : 'Summary'}
                    </span>
                    {isBinance && <span className="text-[8px] font-medium text-[#0ECB81] mt-0.5">LIVE</span>}
                </div>
            </td>}
            
            {check('customerName') && (
                <td className="px-6 py-2">
                    <div className="flex items-center gap-3">
                        {isBinance ? (
                            <div className="w-1 h-6 bg-[#FCD535] rounded-sm"></div>
                        ) : (
                            <div className="w-1.5 h-10 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)] bg-gradient-to-b from-blue-600 via-indigo-500 to-transparent"></div>
                        )}
                        <div className="flex flex-col">
                            <h4 className={`font-bold uppercase tracking-tight ${isBinance ? 'text-[13px] text-[#EAECEF]' : 'text-[16px] italic text-white'}`}>
                                {t.grand_total}
                            </h4>
                            {!isBinance && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="flex w-1.5 h-1.5 rounded-full animate-pulse bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                                    <span className="font-bold text-[9px] uppercase tracking-widest text-gray-500">Processing Stats</span>
                                </div>
                            )}
                        </div>
                    </div>
                </td>
            )}
            
            {check('productInfo') && <td className="px-6 py-2"></td>}
            {check('location') && <td className="px-6 py-2"></td>}
            {check('pageInfo') && <td className="px-6 py-2"></td>}
            {check('brandSales') && <td className="px-6 py-2"></td>}
            {check('fulfillment') && <td className="px-6 py-2"></td>}
            
            {check('total') && (
                <td className="px-6 py-2">
                    <div className="flex flex-col items-start">
                        <span className={`text-[10px] font-medium uppercase mb-0.5 ${isBinance ? 'text-[#848E9C]' : 'text-emerald-500 font-black'}`}>
                            {t.total_revenue}
                        </span>
                        <div className={`flex items-baseline gap-1 ${isBinance ? '' : 'bg-white/[0.02] px-3 py-1.5 rounded-2xl border border-white/5 shadow-inner'}`}>
                            <span className={`font-bold ${isBinance ? 'text-[14px] text-[#0ECB81]' : 'text-[12px] italic text-emerald-500'}`}>$</span>
                            <span className={`font-bold tabular-nums ${isBinance ? 'text-[20px] text-[#EAECEF]' : 'text-[28px] italic text-white'}`}>
                                {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('shippingService') && <td className="px-6 py-2"></td>}
            {check('driver') && <td className="px-6 py-2"></td>}
            
            {check('shippingCost') && (
                <td className="px-6 py-2">
                    <div className="flex flex-col items-start">
                        <span className={`text-[10px] font-medium uppercase mb-0.5 ${isBinance ? 'text-[#848E9C]' : 'text-orange-500 font-black'}`}>
                            {t.total_cost}
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className={`font-bold ${isBinance ? 'text-[12px] text-[#848E9C]' : 'text-[12px] italic text-orange-500'}`}>$</span>
                            <span className={`font-bold tabular-nums ${isBinance ? 'text-[16px] text-[#EAECEF]' : 'text-[20px] italic text-white/90'}`}>
                                {totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </td>
            )}
            
            {check('status') && (
                <td className="px-6 py-2">
                    <div className="flex items-center gap-4 justify-center">
                        <div className={`flex flex-col items-center ${isBinance ? 'px-3 py-1 bg-[#2B3139] rounded' : 'px-4 py-2 rounded-2xl border-2 bg-white/[0.03] border-white/5'}`}>
                            <span className={`font-bold tabular-nums leading-none ${isBinance ? 'text-[14px]' : 'text-[15px]'} ${greenText}`}>{totals.paidCount}</span>
                            <span className={`font-medium uppercase mt-1 tracking-tight ${isBinance ? 'text-[8px] text-[#848E9C]' : 'text-[7px] text-gray-500 font-black'}`}>{t.paid}</span>
                        </div>
                        <div className={`flex flex-col items-center ${isBinance ? 'px-3 py-1 bg-[#2B3139] rounded' : 'px-4 py-2 rounded-2xl border-2 bg-white/[0.03] border-white/5'}`}>
                            <span className={`font-bold tabular-nums leading-none ${isBinance ? 'text-[14px]' : 'text-[15px]'} ${redText}`}>{totals.unpaidCount}</span>
                            <span className={`font-medium uppercase mt-1 tracking-tight ${isBinance ? 'text-[8px] text-[#848E9C]' : 'text-[7px] text-gray-500 font-black'}`}>{t.unpaid}</span>
                        </div>
                    </div>
                </td>
            )}

            {check('date') && <td className="px-4 py-4"></td>}
            {check('note') && <td className="px-6 py-4"></td>}
            {check('print') && <td className="px-4 py-4"></td>}
            {check('check') && <td className="px-2 py-4"></td>}
            {check('orderId') && <td className="px-2 py-4"></td>}
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

    if (isBinance) {
        return (
            <div className="bg-[#1E2329] border border-[#2B3139] rounded p-4 shadow-lg mt-6 mx-1">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#2B3139]">
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-[#FCD535] rounded-sm"></div>
                        <span className="text-[12px] font-bold text-[#EAECEF] uppercase tracking-tight">
                            {language === 'km' ? 'ស្ថិតិសរុប' : 'Order Summary'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-[#0ECB81] rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-medium text-[#848E9C]">LIVE</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[#0B0E11] p-3 rounded">
                        <p className="text-[10px] font-medium text-[#848E9C] uppercase mb-1">{language === 'km' ? 'ចំនួនការកម្មង់' : 'Total Orders'}</p>
                        <p className="text-xl font-bold text-[#EAECEF] tabular-nums">{totals.count}</p>
                    </div>
                    <div className="bg-[#0B0E11] p-3 rounded">
                        <p className="text-[10px] font-medium text-[#848E9C] uppercase mb-1">{t.paid}</p>
                        <p className="text-xl font-bold text-[#0ECB81] tabular-nums">{totals.paidCount}</p>
                    </div>
                </div>

                <div className="bg-[#0B0E11] p-4 rounded mb-3">
                    <p className="text-[10px] font-medium text-[#848E9C] uppercase mb-1">{t.total_revenue}</p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[#0ECB81] font-bold text-sm">$</span>
                        <p className="text-3xl font-bold text-[#EAECEF] tabular-nums tracking-tight">
                            {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-[#2B3139]/30 px-3 py-2 rounded">
                    <div className="flex flex-col">
                        <p className="text-[9px] font-medium text-[#848E9C] uppercase">{t.total_cost}</p>
                        <p className="text-[14px] font-bold text-[#EAECEF] tabular-nums">${totals.internalCost.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-medium text-[#848E9C] uppercase">Unpaid</p>
                        <p className="text-[14px] font-bold text-[#F6465D] tabular-nums">{totals.unpaidCount}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${cardBg} border-2 ${cardBorder} rounded-[2.5rem] p-7 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.6)] relative overflow-hidden animate-fade-in-up mt-6 mx-1`}>
            {/* Ambient Background Accents */}
            {!isBinance && (
                <>
                    <div className="absolute top-0 right-0 w-72 h-72 bg-blue-600/15 rounded-full blur-[110px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[90px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
                </>
            )}
            
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-12 rounded-full shadow-[0_0_25px_rgba(37,99,235,0.3)] ${isBinance ? 'bg-[#FCD535]' : 'bg-gradient-to-b from-blue-600 to-indigo-600'}`}></div>
                    <div className="flex flex-col">
                        <span className={`text-[10px] font-black uppercase tracking-[0.25em] ${isBinance ? 'text-[#848E9C]' : 'text-blue-400/70'}`}>
                            {language === 'km' ? 'ស្ថិតិសរុប' : 'Summary Statistics'}
                        </span>
                        <h3 className="text-xl font-black text-white uppercase tracking-wider mt-1">
                            {totals.count} <span className={`${isBinance ? 'text-[#848E9C]' : 'text-gray-500'} font-bold text-sm`}>{language === 'km' ? 'ការកម្មង់' : 'Orders'}</span>
                        </h3>
                    </div>
                </div>
                <div className={`${isBinance ? 'bg-[#2B3139]' : 'bg-white/5'} px-4 py-2 rounded-2xl border ${cardBorder} backdrop-blur-xl shadow-lg`}>
                   <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isBinance ? 'text-[#FCD535]' : 'text-gray-300'}`}>Live</span>
                   </div>
                </div>
            </div>
            
            <div className="space-y-6 mb-8">
                <div className="flex flex-col bg-white/[0.02] p-5 rounded-3xl border border-white/5 shadow-inner">
                    <p className={`text-[10px] font-black uppercase mb-2 tracking-[0.2em] ${isBinance ? 'text-[#848E9C]' : 'text-gray-400'}`}>
                        {language === 'km' ? 'ចំណូលសរុប (REVENUE)' : t.total_revenue}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                        <span className={`${greenText} font-black text-lg italic`}>$</span>
                        <p className={`text-4xl font-black tracking-tighter drop-shadow-[0_0_20px_rgba(16,185,129,0.4)] ${isBinance ? 'text-[#EAECEF]' : 'text-white font-mono'}`}>
                            {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between bg-white/[0.01] px-5 py-4 rounded-2xl border border-white/5">
                        <div className="flex flex-col">
                            <p className={`text-[9px] font-black uppercase tracking-widest ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'}`}>
                                {language === 'km' ? 'សេវាដឹកជញ្ជូន' : 'Total Logistics'}
                            </p>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className={`${isBinance ? 'text-[#FCD535]' : 'text-orange-400'} font-black text-xs italic`}>$</span>
                                <p className={`text-lg font-black tracking-tighter ${isBinance ? 'text-[#EAECEF]' : 'text-white/80'}`}>
                                    {totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center px-3 py-1.5 rounded-xl border border-white/5 bg-white/5">
                                <span className={`text-[12px] font-black ${greenText}`}>{totals.paidCount}</span>
                                <span className="text-[6px] font-black uppercase text-gray-500">Paid</span>
                            </div>
                            <div className="flex flex-col items-center px-3 py-1.5 rounded-xl border border-white/5 bg-white/5">
                                <span className={`text-[12px] font-black ${redText}`}>{totals.unpaidCount}</span>
                                <span className="text-[6px] font-black uppercase text-gray-500">COD</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`flex items-center justify-between border-t pt-6 ${cardBorder}`}>
                <div className="flex flex-col gap-1">
                    <span className={`text-[8px] font-black uppercase tracking-widest ${isBinance ? 'text-[#848E9C]' : 'text-gray-600'}`}>Account Status</span>
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black bg-blue-500/10 ${accentColor}`}>VERIFIED</span>
                    </div>
                </div>
                <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                        <div key={i} className={`w-8 h-8 rounded-full border-2 ${cardBorder} ${cardBg} flex items-center justify-center`}>
                            <span className="text-[10px] text-gray-500">👤</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
