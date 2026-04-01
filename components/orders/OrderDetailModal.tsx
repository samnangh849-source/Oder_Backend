import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { ParsedOrder } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import Modal from '../common/Modal';

interface OrderDetailModalProps {
    order: ParsedOrder;
    onClose: () => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose }) => {
    const { previewImage, appData } = useContext(AppContext);

    const page = appData.pages?.find(p => p.PageName === order.Page);
    const bank = appData.bankAccounts?.find(b => b.BankName === order['Payment Info']);
    const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-5xl">
            <div className="flex flex-col h-full overflow-hidden bg-[#0B0E11] text-[#EAECEF] selection:bg-[#FCD535]/30" style={{ fontFamily: "'Inter', sans-serif" }}>
                {/* Header: Binance Strip */}
                <div className="p-6 border-b border-[#2B3139] bg-[#1E2329] flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            {page ? (
                                <img src={convertGoogleDriveUrl(page.PageLogoURL)} className="w-12 h-12 rounded-sm border border-[#2B3139] object-cover shadow-2xl transition-transform group-hover:scale-105" alt="" />
                            ) : (
                                <div className="w-12 h-12 rounded-sm bg-[#2B3139] flex items-center justify-center text-[#FCD535]">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h12l1 12H4L5 9z" strokeWidth={2} /></svg>
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#0ECB81] rounded-full border-2 border-[#1E2329] animate-pulse"></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-4 bg-[#FCD535]"></div>
                                <h2 className="text-lg font-black uppercase tracking-widest italic leading-none">Order Analysis</h2>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] font-mono text-[#848E9C] font-bold uppercase tracking-[0.2em]">NODE ID: {order['Order ID']}</p>
                                {(() => {
                                    const fs = (order as any).FulfillmentStatus || (order as any)['Fulfillment Status'] || 'Pending';
                                    const fsColors: Record<string, string> = {
                                        'Pending': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                                        'Ready to Ship': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                                        'Shipped': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                                        'Delivered': 'bg-[#0ECB81]/20 text-[#0ECB81] border-[#0ECB81]/30',
                                        'Cancelled': 'bg-[#F6465D]/20 text-[#F6465D] border-[#F6465D]/30',
                                    };
                                    return <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${fsColors[fs] || 'bg-[#2B3139] text-[#848E9C] border-[#2B3139]'}`}>{fs}</span>;
                                })()}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-[#2B3139] hover:bg-[#F6465D]/10 text-[#848E9C] hover:text-[#F6465D] rounded-sm flex items-center justify-center transition-all active:scale-90 border border-[#2B3139] group">
                        <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} strokeLinecap="round" /></svg>
                    </button>
                </div>

                <div className="p-6 flex-grow overflow-y-auto custom-scrollbar space-y-8 select-none">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left: Customer & Logistics */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Customer Info Card: Sharp Terminal Look */}
                            <div className="bg-[#1E2329] border border-[#2B3139] p-6 space-y-6 relative overflow-hidden">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-5 bg-[#FCD535]"></div>
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#848E9C]">Customer Intelligence</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-[#848E9C] uppercase tracking-widest ml-0.5">Full Name (ឈ្មោះ)</label>
                                        <div className="bg-[#0B0E11] border border-[#2B3139] p-4 group hover:border-[#FCD535]/30 transition-colors">
                                            <p className="text-lg font-black text-[#EAECEF] uppercase tracking-wider">{order['Customer Name']}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-[#848E9C] uppercase tracking-widest ml-0.5">Phone (លេខទូរស័ព្ទ)</label>
                                        <div className="bg-[#0B0E11] border border-[#2B3139] p-4 group hover:border-[#FCD535]/30 transition-colors">
                                            <p className="text-lg font-mono font-black text-[#FCD535]">{order['Customer Phone']}</p>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-1.5">
                                        <label className="text-[9px] font-black text-[#848E9C] uppercase tracking-widest ml-0.5">Shipping Destination (អាសយដ្ឋាន)</label>
                                        <div className="bg-[#0B0E11] border border-[#2B3139] p-4 group hover:border-[#FCD535]/30 transition-colors">
                                            <p className="text-xs font-bold text-[#EAECEF] leading-relaxed uppercase tracking-wide">{order.Location}</p>
                                            <p className="text-[10px] text-[#848E9C] mt-2 italic font-medium">{order['Address Details'] || 'NO ADDITIONAL ANNOTATIONS'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Logistics & Payment Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-[#1E2329] border border-[#2B3139] p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-4 bg-[#FCD535]"></div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#848E9C]">Logistics Team</h3>
                                    </div>
                                    <div className="flex items-center gap-4 bg-[#0B0E11] p-4 border border-[#2B3139] group hover:border-[#FCD535]/30 transition-colors">
                                        {shippingMethod ? (
                                            <img src={convertGoogleDriveUrl(shippingMethod.LogoURL)} className="w-10 h-10 object-contain p-1.5 bg-[#1E2329] border border-[#2B3139]" alt="" />
                                        ) : (
                                            <div className="w-10 h-10 bg-[#1E2329] border border-[#2B3139] flex items-center justify-center text-[#848E9C]">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" strokeWidth={2} /></svg>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-[#EAECEF] truncate uppercase tracking-wider">{order['Internal Shipping Method']}</p>
                                            <p className="text-[9px] text-[#848E9C] font-black uppercase tracking-widest mt-0.5 truncate">{order['Internal Shipping Details'] || 'STANDARD PROTOCOL'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-[#1E2329] border border-[#2B3139] p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-4 bg-[#FCD535]"></div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#848E9C]">Financial Status</h3>
                                    </div>
                                    <div className="flex items-center justify-between bg-[#0B0E11] p-4 border border-[#2B3139] group hover:border-[#FCD535]/30 transition-colors">
                                        <div className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${order['Payment Status'] === 'Paid' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/30' : 'bg-[#F6465D]/10 text-[#F6465D] border-[#F6465D]/30'}`}>
                                            {order['Payment Status']}
                                        </div>
                                        {bank && (
                                            <div className="flex items-center gap-3">
                                                <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-7 h-7 object-contain opacity-80" alt="" />
                                                <span className="text-[9px] font-black text-[#848E9C] uppercase tracking-widest">{bank.BankName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Assets List */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-4 bg-[#FCD535]"></div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#848E9C]">Inventory Assets</h3>
                                    </div>
                                    <span className="text-[9px] font-black bg-[#FCD535]/10 text-[#FCD535] px-2 py-0.5 border border-[#FCD535]/20 uppercase tracking-[0.2em]">{order.Products.length} UNITS</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {order.Products.map((product, idx) => (
                                        <div key={idx} className="bg-[#1E2329] border border-[#2B3139] p-4 flex items-center gap-4 group hover:border-[#FCD535]/40 transition-all shadow-xl hover:bg-[#2B3139]/30">
                                            <div className="relative flex-shrink-0">
                                                <img 
                                                    src={convertGoogleDriveUrl(product.image)} 
                                                    className="w-14 h-14 rounded-sm object-cover border border-[#2B3139] cursor-pointer grayscale group-hover:grayscale-0 transition-all duration-500" 
                                                    alt="" 
                                                    onClick={() => previewImage(convertGoogleDriveUrl(product.image))}
                                                />
                                                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-[#FCD535] text-[#0B0E11] rounded-sm flex items-center justify-center text-[10px] font-black shadow-lg border border-[#1E2329]">
                                                    {product.quantity}
                                                </div>
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <p className="text-[11px] font-black text-[#EAECEF] truncate uppercase tracking-widest">{product.name}</p>
                                                <p className="text-[9px] text-[#FCD535] font-black mt-0.5 uppercase tracking-widest opacity-80">{product.colorInfo || 'CORE EDITION'}</p>
                                                <p className="text-[11px] font-mono font-black text-[#0ECB81] mt-1 tabular-nums">${(product.finalPrice * product.quantity).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar: Ops & Totals */}
                        <div className="space-y-6">
                            {/* Ops Hub: Technical Card */}
                            <div className="bg-[#1E2329] border border-[#FCD535]/20 p-6 space-y-6 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                    <svg className="w-16 h-16 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth={2} /></svg>
                                </div>
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className="w-1.5 h-4 bg-[#FCD535]"></div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FCD535]">Operations Hub</h3>
                                </div>
                                <div className="space-y-5 relative z-10">
                                    <div className="space-y-1.5">
                                        <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-0.5">Packed By</label>
                                        <div className="bg-[#0B0E11] border border-[#2B3139] p-3">
                                            <p className="text-[11px] font-black text-[#EAECEF] uppercase tracking-wider">{order['Packed By'] || 'AWAITING DISPATCH'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-0.5">Packed Time</label>
                                        <div className="bg-[#0B0E11] border border-[#2B3139] p-3">
                                            <p className="text-[11px] font-mono font-black text-[#848E9C] tracking-[0.1em] uppercase">{order['Packed Time'] || 'UNRECORDED'}</p>
                                        </div>
                                    </div>
                                    {order['Driver Name'] && (
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-0.5">Driver</label>
                                            <div className="bg-[#0B0E11] border border-[#2B3139] p-3 flex items-center gap-2">
                                                <svg className="w-3.5 h-3.5 text-[#F28C28] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                                                <p className="text-[11px] font-black text-[#F28C28] uppercase tracking-wider">{order['Driver Name']}</p>
                                            </div>
                                        </div>
                                    )}
                                    {order['Tracking Number'] && (
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-0.5">Tracking Number</label>
                                            <div className="bg-[#0B0E11] border border-[#2B3139] p-3">
                                                <p className="text-[11px] font-mono font-black text-[#0ECB81] tracking-wider">{order['Tracking Number']}</p>
                                            </div>
                                        </div>
                                    )}
                                    {order['Dispatched By'] && (
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-0.5">Dispatched By</label>
                                            <div className="bg-[#0B0E11] border border-[#2B3139] p-3 flex justify-between items-center">
                                                <p className="text-[11px] font-black text-[#EAECEF] uppercase tracking-wider">{order['Dispatched By']}</p>
                                                <p className="text-[9px] font-mono text-[#848E9C]">{order['Dispatched Time'] || ''}</p>
                                            </div>
                                        </div>
                                    )}
                                    {order['Delivered Time'] && (
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-0.5">Delivered</label>
                                            <div className="bg-[#0B0E11] border border-[#0ECB81]/30 p-3 flex items-center gap-2">
                                                <svg className="w-3.5 h-3.5 text-[#0ECB81] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                <p className="text-[11px] font-mono font-black text-[#0ECB81] tracking-[0.1em]">{order['Delivered Time']}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 w-12 h-12 bg-gradient-to-tl from-[#FCD535]/10 to-transparent pointer-events-none"></div>
                            </div>

                            {/* Digital Proof: Package Photo */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 ml-1">
                                    <div className="w-1 h-3 bg-[#848E9C]"></div>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#848E9C]">Package Photo</h3>
                                </div>
                                {order['Package Photo URL'] ? (
                                    <div className="relative group aspect-square border-2 border-[#2B3139] bg-[#0B0E11] cursor-pointer overflow-hidden" onClick={() => previewImage(order['Package Photo URL']!)}>
                                        <img src={convertGoogleDriveUrl(order['Package Photo URL']!)} className="w-full h-full object-cover transition-all duration-700 grayscale group-hover:grayscale-0 group-hover:scale-110" alt="Package Proof" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="w-12 h-12 border border-[#FCD535] bg-[#0B0E11]/80 flex items-center justify-center text-[#FCD535] shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" strokeWidth={2.5} /></svg>
                                            </div>
                                        </div>
                                        <div className="absolute inset-x-0 h-[1px] bg-[#FCD535]/50 shadow-[0_0_10px_#FCD535] top-0 animate-[scan_3s_linear_infinite]"></div>
                                    </div>
                                ) : (
                                    <div className="aspect-square border-2 border-dashed border-[#2B3139] flex flex-col items-center justify-center gap-4 text-[#848E9C] bg-[#1E2329]/20 group">
                                        <div className="w-12 h-12 border border-[#2B3139] rounded-sm flex items-center justify-center grayscale group-hover:grayscale-0 transition-all opacity-40">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={1.5} /></svg>
                                        </div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40">No Package Photo</p>
                                    </div>
                                )}
                            </div>

                            {/* Digital Proof: Delivery Photo */}
                            {order['Delivery Photo URL'] && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 ml-1">
                                        <div className="w-1 h-3 bg-[#0ECB81]"></div>
                                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0ECB81]">Delivery Photo</h3>
                                    </div>
                                    <div className="relative group aspect-square border-2 border-[#0ECB81]/30 bg-[#0B0E11] cursor-pointer overflow-hidden" onClick={() => previewImage(order['Delivery Photo URL']!)}>
                                        <img src={convertGoogleDriveUrl(order['Delivery Photo URL']!)} className="w-full h-full object-cover transition-all duration-700 grayscale group-hover:grayscale-0 group-hover:scale-110" alt="Delivery Proof" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <div className="w-12 h-12 border border-[#0ECB81] bg-[#0B0E11]/80 flex items-center justify-center text-[#0ECB81] shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" strokeWidth={2.5} /></svg>
                                            </div>
                                        </div>
                                        <div className="absolute inset-x-0 h-[1px] bg-[#0ECB81]/50 shadow-[0_0_10px_#0ECB81] top-0 animate-[scan_3s_linear_infinite]"></div>
                                    </div>
                                </div>
                            )}

                            {/* Settlement Summary: High-Impact Card */}
                            <div className="bg-[#1E2329] border border-[#2B3139] p-6 shadow-2xl relative overflow-hidden group">
                                <div className="space-y-4 relative z-10">
                                    <div className="flex justify-between items-center pb-4 border-b border-[#2B3139] border-dashed">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-[#848E9C]">Asset Subtotal</span>
                                        <span className="text-[13px] font-mono font-black text-[#EAECEF] tabular-nums">${(Number(order.Subtotal) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-[#2B3139] border-dashed">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-[#848E9C]">Logistics Surcharge</span>
                                        <span className="text-[13px] font-mono font-black text-[#EAECEF] tabular-nums">${(Number(order['Shipping Fee (Customer)']) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="pt-2">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-1 h-3 bg-[#FCD535]"></div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#FCD535]">Grand Settlement</span>
                                                </div>
                                                <div className="text-[10px] font-bold text-[#848E9C] uppercase tracking-wider">Final Amount (USD)</div>
                                            </div>
                                            <div className="text-3xl font-mono font-black text-[#FCD535] tabular-nums drop-shadow-[0_0_10px_rgba(252,213,53,0.2)]">
                                                ${(Number(order['Grand Total']) || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 right-0 w-16 h-16 bg-[#FCD535]/5 rounded-bl-full pointer-events-none"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Strip */}
                <div className="p-4 border-t border-[#2B3139] bg-[#1E2329] flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="px-8 py-3 bg-[#2B3139] hover:bg-[#374151] text-[#EAECEF] font-black uppercase text-[10px] tracking-[0.3em] rounded-sm transition-all active:scale-[0.98] border border-[#474D57]"
                    >
                        Terminate System View
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #0B0E11;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #2B3139;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #FCD535;
                }
            `}</style>
        </Modal>
    );
};

export default OrderDetailModal;