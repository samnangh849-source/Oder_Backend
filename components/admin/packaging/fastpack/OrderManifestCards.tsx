import React from 'react';
import { ParsedOrder, AppData } from '@/types';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

interface OrderManifestCardsProps {
    order: ParsedOrder;
    appData: AppData;
    verifiedItems: Record<string, number>;
}

const OrderManifestCards: React.FC<OrderManifestCardsProps> = ({ order, appData, verifiedItems }) => {
    const isPaid = order['Payment Status']?.toUpperCase() === 'PAID';

    return (
        <div className="w-full flex flex-col gap-8 p-8 lg:p-10 bg-[#0B0E11]/60 backdrop-blur-2xl border-b border-white/5">
            {/* TOP ROW: LOGO & STATUS */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex items-center gap-8">
                    <div className="w-20 h-20 flex items-center justify-center">
                        <img src={convertGoogleDriveUrl(appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method'])?.LogoURL || '')} className="w-full h-full object-contain" alt="Carrier" />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-1 h-3 bg-[#FCD535]"></div>
                            <span className="text-[10px] font-black text-[#FCD535] uppercase tracking-[0.4em]">Logistics Protocol</span>
                        </div>
                        <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">{order['Internal Shipping Method']}</h2>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-3">Designated Transit Agent / Carrier ID: {order['Internal Shipping Method']?.substring(0,3).toUpperCase()}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* SETTLEMENT STATUS - INDUSTRIAL STYLE */}
                    <div className={`px-10 py-5 border-2 flex flex-col items-center justify-center min-w-[200px] shadow-2xl transition-all relative overflow-hidden ${isPaid ? 'bg-[#0ECB81]/5 border-[#0ECB81] text-[#0ECB81]' : 'bg-red-500/5 border-red-500 text-red-500 animate-pulse'}`}>
                        {/* Status small accent corner */}
                        <div className={`absolute top-0 right-0 w-3 h-3 ${isPaid ? 'bg-[#0ECB81]' : 'bg-red-500'}`}></div>
                        
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] mb-1.5 opacity-60">Settlement</span>
                        <span className="text-3xl font-black uppercase tracking-tighter">{isPaid ? 'SUCCESS' : 'PENDING'}</span>
                    </div>
                    
                    <div className="hidden xl:block h-16 w-px bg-white/10 mx-2"></div>
                    
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.3em] mb-2">System Trace ID</span>
                        <span className="text-xl font-mono font-bold text-white/90 bg-white/[0.03] px-4 py-2 border border-white/10 tracking-widest">#{order['Order ID'].substring(0, 14)}</span>
                    </div>
                </div>
            </div>

            {/* INFO GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 border border-white/5 shadow-2xl">
                {/* CUSTOMER */}
                <div className="bg-[#0B0E11]/40 p-6 relative overflow-hidden group hover:bg-white/[0.02] transition-all">
                    <div className="flex items-start gap-5 relative z-10">
                        <div className="w-12 h-12 bg-white/5 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-[#FCD535]/30 group-hover:text-[#FCD535] transition-all">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">Consignee Entity</span>
                            <span className="text-lg font-black text-white truncate tracking-tight">{order['Customer Name']}</span>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm font-mono text-[#FCD535] font-bold tracking-widest">{order['Customer Phone']}</span>
                                {(() => {
                                    const carrier = appData.phoneCarriers?.find(c =>
                                        String(c.Prefixes || '').split(',').map(p => p.trim()).filter(Boolean).some(prefix => order['Customer Phone']?.startsWith(prefix))
                                    );
                                    if (!carrier) return null;
                                    return (
                                        <div className="w-5 h-5 flex items-center justify-center">
                                            <img 
                                                src={convertGoogleDriveUrl(carrier.CarrierLogoURL || '')} 
                                                className="w-full h-full object-contain" 
                                                alt="Carrier"
                                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                            />
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* DESTINATION */}
                <div className="bg-[#0B0E11]/40 p-6 relative overflow-hidden group hover:bg-white/[0.02] transition-all border-l border-white/5">
                    <div className="flex items-start gap-5 relative z-10">
                        <div className="w-12 h-12 bg-white/5 flex items-center justify-center shrink-0 border border-white/5 group-hover:border-[#FCD535]/30 group-hover:text-[#FCD535] transition-all">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">Target Destination</span>
                            <span className="text-lg font-black text-white/90 truncate tracking-tight">{order.Location}</span>
                            <span className="text-[11px] text-gray-500 mt-1 line-clamp-1 italic font-medium">{order['Address Details'] || 'Terminal delivery protocol'}</span>
                        </div>
                    </div>
                </div>

                {/* SOURCE */}
                <div className="bg-[#0B0E11]/40 p-6 relative overflow-hidden group hover:bg-white/[0.02] transition-all border-l border-white/5">
                    <div className="flex items-start gap-5 relative z-10">
                        <div className="w-12 h-12 flex items-center justify-center shrink-0">
                            {(() => {
                                const pageLogo = appData.pages?.find(p => p.PageName === order.Page)?.PageLogoURL;
                                return pageLogo ? (
                                    <img 
                                        src={convertGoogleDriveUrl(pageLogo)} 
                                        className="w-full h-full object-contain" 
                                        alt="Page Logo" 
                                    />
                                ) : (
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                                );
                            })()}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mb-2">Acquisition Node</span>
                            <span className="text-lg font-black text-white/90 truncate tracking-tight">{order.Page || 'Direct Channel'}</span>
                            <span className="text-[10px] text-[#FCD535]/50 mt-1 uppercase tracking-[0.2em] font-black">Initiator: {order.User || 'System'}</span>
                        </div>
                    </div>
                </div>

                {/* FINANCIALS */}
                <div className="bg-[#0ECB81]/5 p-6 relative overflow-hidden group border-l border-white/5">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#0ECB81]/5 rounded-none -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] mb-2">Gross Value</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-mono font-black text-[#0ECB81] tracking-tighter">
                                    ${(Number(order['Grand Total']) || 0).toFixed(2)}
                                </span>
                                <span className="text-[10px] font-black text-[#0ECB81]/40 tracking-widest">USD</span>
                            </div>
                        </div>
                        <div className="w-14 h-14 bg-[#0ECB81]/10 flex items-center justify-center border border-[#0ECB81]/20">
                            <span className="text-[#0ECB81] font-black text-2xl">$</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderManifestCards;
