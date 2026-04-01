
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
    getColWidth: (key: string) => number;
}

export const DesktopGrandTotalRow: React.FC<DesktopGrandTotalRowProps> = ({ totals, isVisible, showSelection, getColWidth }) => {
    const { language, advancedSettings } = useContext(AppContext);
    const t = translations[language];
    const isBinance = advancedSettings?.uiTheme === 'binance';
    
    if (totals.count === 0) return null;

    const check = isVisible;

    // Theme Variables - Enhanced for a borderless layout
    const rowBg = isBinance 
        ? 'bg-[#1E2329]' 
        : 'bg-[#0f172a]/90 backdrop-blur-3xl';
    
    const greenText = isBinance ? 'text-[#0ECB81]' : 'text-emerald-400';
    const redText = isBinance ? 'text-[#F6465D]' : 'text-red-400';

    const renderCell = (key: string, content: React.ReactNode, extraClasses = "") => {
        if (!check(key)) return null;
        return (
            <div 
                style={{ width: `${getColWidth(key)}px` }} 
                className={`flex-shrink-0 flex items-center px-4 py-3 ${extraClasses}`}
            >
                {content}
            </div>
        );
    };

    return (
        <div className={`flex w-full ${rowBg} transition-all duration-300 group z-10 relative overflow-hidden`}>
            {/* Animated Ambient Light (Default Theme Only) */}
            {!isBinance && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
                    <div className="absolute top-[-50%] left-[-10%] w-[40%] h-[200%] bg-blue-600/10 blur-[100px] rotate-45 animate-pulse"></div>
                    <div className="absolute bottom-[-50%] right-[-10%] w-[40%] h-[200%] bg-emerald-500/5 blur-[100px] rotate-45 animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>
            )}

            {showSelection && <div className="flex-shrink-0 flex items-center justify-center px-0.5" style={{ width: '40px' }}></div>}
            
            {renderCell('index', (
                <div className="flex flex-col items-center justify-center w-full transition-transform group-hover:scale-105">
                    <span className={`text-[7px] font-black uppercase tracking-[0.2em] mb-0.5 ${isBinance ? 'text-[#848E9C]' : 'text-blue-500/50'}`}>
                        {language === 'km' ? 'ចំនួន' : 'COUNT'}
                    </span>
                    <div className={`px-2 py-0.5 rounded-sm ${isBinance ? 'bg-[#2B3139] text-[#EAECEF]' : 'bg-blue-500/10 text-white'} font-black text-[11px] tabular-nums border border-transparent`}>
                        {totals.count}
                    </div>
                </div>
            ), "justify-center")}
            
            {renderCell('actions', (
                <div className="flex flex-col items-center justify-center w-full opacity-60">
                   <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isBinance ? 'text-[#848E9C]' : 'text-gray-500 italic'}`}>
                        {language === 'km' ? 'សរុប' : 'SUMMARY'}
                    </span>
                    {isBinance && <div className="flex items-center gap-1 mt-0.5">
                        <span className="w-1 h-1 bg-[#0ECB81] rounded-full animate-pulse"></span>
                        <span className="text-[6px] font-bold text-[#0ECB81]">LIVE</span>
                    </div>}
                </div>
            ), "justify-center")}
            
            {renderCell('customerName', (
                <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                        <div className={`w-1 h-8 rounded-full relative z-10 ${isBinance ? 'bg-[#FCD535]' : 'bg-gradient-to-b from-blue-400 to-indigo-600 shadow-[0_0_10px_rgba(59,130,246,0.3)]'}`}></div>
                    </div>
                    <div className="flex flex-col">
                        <span className={`text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 ${isBinance ? 'text-[#848E9C]' : 'text-blue-500/60'}`}>SYSTEM TOTALS</span>
                        <h4 className={`font-black uppercase tracking-tight leading-none ${isBinance ? 'text-[14px] text-[#EAECEF]' : 'text-[16px] text-white italic'}`}>
                            {t.grand_total}
                        </h4>
                    </div>
                </div>
            ))}
            
            {renderCell('productInfo', null)}
            {renderCell('location', null)}
            {renderCell('pageInfo', null)}
            {renderCell('brandSales', null)}
            {renderCell('fulfillment', null)}
            
            {renderCell('total', (
                <div className="flex flex-col items-start w-full relative">
                    <span className={`text-[8px] font-black uppercase mb-0.5 tracking-wider ${isBinance ? 'text-[#848E9C]' : 'text-emerald-500/70'}`}>
                        {t.total_revenue}
                    </span>
                    <div className="flex items-baseline gap-0.5">
                        <span className={`font-black ${isBinance ? 'text-[12px] text-[#0ECB81]' : 'text-[12px] text-emerald-500'}`}>$</span>
                        <span className={`font-black tabular-nums tracking-tighter ${isBinance ? 'text-[20px] text-[#EAECEF]' : 'text-[22px] text-white shadow-emerald-500/20'}`}>
                            {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            ))}
            
            {renderCell('shippingService', null)}
            {renderCell('driver', null)}
            
            {renderCell('shippingCost', (
                <div className="flex flex-col items-start w-full opacity-90">
                    <span className={`text-[8px] font-black uppercase mb-0.5 tracking-wider ${isBinance ? 'text-[#848E9C]' : 'text-orange-500/70'}`}>
                        {t.total_cost}
                    </span>
                    <div className="flex items-baseline gap-0.5">
                        <span className={`font-black ${isBinance ? 'text-[11px] text-[#848E9C]' : 'text-[11px] text-orange-500'}`}>$</span>
                        <span className={`font-black tabular-nums tracking-tight ${isBinance ? 'text-[15px] text-[#EAECEF]' : 'text-[17px] text-white/90'}`}>
                            {totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            ))}
            
            {renderCell('status', (
                <div className="flex items-center gap-3 justify-center w-full">
                    <div className="flex flex-col items-center group/stat">
                        <div className={`font-black tabular-nums leading-none ${isBinance ? 'text-[13px]' : 'text-[15px]'} ${greenText} group-hover/stat:scale-110 transition-transform`}>
                            {totals.paidCount}
                        </div>
                        <span className={`font-black uppercase mt-0.5 tracking-widest ${isBinance ? 'text-[6px] text-[#848E9C]' : 'text-[6px] text-gray-500'}`}>{t.paid}</span>
                    </div>
                    <div className={`w-px h-5 ${isBinance ? 'bg-[#2B3139]' : 'bg-white/10'}`}></div>
                    <div className="flex flex-col items-center group/stat">
                        <div className={`font-black tabular-nums leading-none ${isBinance ? 'text-[13px]' : 'text-[15px]'} ${redText} group-hover/stat:scale-110 transition-transform`}>
                            {totals.unpaidCount}
                        </div>
                        <span className={`font-black uppercase mt-0.5 tracking-widest ${isBinance ? 'text-[6px] text-[#848E9C]' : 'text-[6px] text-gray-500'}`}>{t.unpaid}</span>
                    </div>
                </div>
            ), "justify-center")}

            {renderCell('date', null)}
            {renderCell('note', null)}
            {renderCell('print', null)}
            {renderCell('check', null)}
            {renderCell('orderId', null)}
        </div>
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
        <div className={`${cardBg} border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-fade-in-up mt-6 mx-1`}>
            {/* Ambient Background Accents */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
            
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-8 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400/70">
                            {language === 'km' ? 'ស្ថិតិសរុប' : 'SUMMARY STATISTICS'}
                        </span>
                        <h3 className="text-lg font-black text-white uppercase tracking-wider">
                            {totals.count} <span className="text-gray-500 font-bold text-xs">{language === 'km' ? 'ការកម្មង់' : 'Orders'}</span>
                        </h3>
                    </div>
                </div>
                <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-xl">
                   <div className="flex items-center gap-1.5">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-300">Live</span>
                   </div>
                </div>
            </div>
            
            <div className="space-y-4 mb-6">
                <div className="flex flex-col bg-white/[0.02] p-4 rounded-2xl border border-white/5 shadow-inner">
                    <p className="text-[8px] font-black uppercase mb-1.5 tracking-[0.2em] text-gray-400">
                        {language === 'km' ? 'ចំណូលសរុប (REVENUE)' : t.total_revenue}
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className="text-emerald-500 font-black text-sm italic">$</span>
                        <p className="text-3xl font-black tracking-tighter text-white">
                            {totals.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center justify-between bg-white/[0.01] px-4 py-3 rounded-xl border border-white/5">
                        <div className="flex flex-col">
                            <p className="text-[8px] font-black uppercase tracking-widest text-gray-500">
                                {language === 'km' ? 'សេវាដឹកជញ្ជូន' : 'LOGISTICS'}
                            </p>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-orange-400 font-black text-[10px] italic">$</span>
                                <p className="text-base font-black tracking-tighter text-white/80">
                                    {totals.internalCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex gap-2">
                            <div className="flex flex-col items-center px-2 py-1 rounded-lg border border-white/5 bg-white/5 min-w-[40px]">
                                <span className={`text-[11px] font-black ${greenText}`}>{totals.paidCount}</span>
                                <span className="text-[6px] font-black uppercase text-gray-500">Paid</span>
                            </div>
                            <div className="flex flex-col items-center px-2 py-1 rounded-lg border border-white/5 bg-white/5 min-w-[40px]">
                                <span className={`text-[11px] font-black ${redText}`}>{totals.unpaidCount}</span>
                                <span className="text-[6px] font-black uppercase text-gray-500">COD</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[7px] font-black uppercase tracking-widest text-gray-600">Sync Status</span>
                    <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[7px] font-black bg-emerald-500/10 text-emerald-500 uppercase">Synced</span>
                    </div>
                </div>
                <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest italic">
                    ACC MANAGEMENT SYSTEM v2.0
                </div>
            </div>
        </div>
    );
};

