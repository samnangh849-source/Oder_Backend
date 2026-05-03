import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { ParsedOrder } from '../../types';
import { convertGoogleDriveUrl, getOptimisticPackagePhoto } from '../../utils/fileUtils';
import Modal from '../common/Modal';
import { 
    Copy, 
    Check, 
    User, 
    Phone, 
    MapPin, 
    Truck, 
    CreditCard, 
    Package, 
    Box, 
    Clock, 
    ShieldCheck, 
    ExternalLink,
    Zap,
    Hash
} from 'lucide-react';

interface OrderDetailModalProps {
    order: ParsedOrder;
    onClose: () => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose }) => {
    const { previewImage, appData } = useContext(AppContext);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    const page = appData.pages?.find(p => p.PageName === order.Page);
    const bank = appData.bankAccounts?.find(b => b.BankName === order['Payment Info']);
    const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const cleanPhone = (phone: string) => {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('855')) cleaned = cleaned.substring(3);
        if (!cleaned.startsWith('0')) cleaned = '0' + cleaned;
        return cleaned;
    };

    const fs = (order as any).FulfillmentStatus || (order as any)['Fulfillment Status'] || 'Pending';
    const fsColors: Record<string, string> = {
        'Pending': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'Ready to Ship': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Shipped': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'Delivered': 'bg-[#0ECB81]/20 text-[#0ECB81] border-[#0ECB81]/30',
        'Cancelled': 'bg-[#F6465D]/20 text-[#F6465D] border-[#F6465D]/30',
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-6xl">
            <div className="flex flex-col h-[90vh] overflow-hidden bg-[#0B0E11] text-[#EAECEF] selection:bg-[#FCD535]/30 rounded-2xl border border-[#2B3139]" style={{ fontFamily: "'Inter', sans-serif" }}>
                {/* Header: Terminal Style */}
                <div className="p-6 border-b border-[#2B3139] bg-gradient-to-r from-[#1E2329] to-[#0B0E11] flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-5">
                        <div className="relative group">
                            {page ? (
                                <img src={convertGoogleDriveUrl(page.PageLogoURL)} className="w-14 h-14 rounded-xl border-2 border-[#2B3139] object-cover shadow-2xl transition-all group-hover:border-[#FCD535]/50 group-hover:scale-105" alt="" />
                            ) : (
                                <div className="w-14 h-14 rounded-xl bg-[#1E2329] border-2 border-[#2B3139] flex items-center justify-center text-[#FCD535]">
                                    <Box size={28} />
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#0ECB81] rounded-full border-2 border-[#1E2329] animate-pulse"></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-1.5 h-5 bg-[#FCD535] rounded-full"></div>
                                <h2 className="text-xl font-black uppercase tracking-widest italic leading-none text-white">Order Analysis <span className="text-[#848E9C] not-italic font-medium text-xs ml-2 tracking-normal opacity-50">v4.0.2</span></h2>
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <div 
                                    onClick={() => handleCopy(order['Order ID'], 'orderId')}
                                    className="flex items-center gap-2 cursor-pointer group"
                                >
                                    <p className="text-[10px] font-mono text-[#848E9C] font-bold uppercase tracking-[0.2em] group-hover:text-[#FCD535] transition-colors">NODE ID: {order['Order ID']}</p>
                                    {copiedField === 'orderId' ? <Check size={10} className="text-[#0ECB81]" /> : <Copy size={10} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity" />}
                                </div>
                                <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest border rounded-sm ${fsColors[fs] || 'bg-[#2B3139] text-[#848E9C] border-[#2B3139]'}`}>{fs}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-[#1E2329] hover:bg-[#F6465D]/10 text-[#848E9C] hover:text-[#F6465D] rounded-xl flex items-center justify-center transition-all active:scale-90 border border-[#2B3139] group shadow-lg">
                        <svg className="w-6 h-6 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} strokeLinecap="round" /></svg>
                    </button>
                </div>

                <div className="p-8 flex-grow overflow-y-auto custom-scrollbar space-y-10 select-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left: Customer & Logistics */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Customer Info Card: Sharp Terminal Look */}
                            <div className="bg-[#1E2329]/80 backdrop-blur-md border border-[#2B3139] p-8 space-y-8 relative overflow-hidden rounded-2xl shadow-2xl">
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                                    <User size={120} />
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-6 bg-[#FCD535] rounded-full"></div>
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#848E9C]">Customer Intelligence (ព័ត៌មានអតិថិជន)</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <User size={12} /> Full Name (ឈ្មោះ)
                                        </label>
                                        <div 
                                            onClick={() => handleCopy(order['Customer Name'], 'name')}
                                            className="bg-[#0B0E11] border border-[#2B3139] p-5 rounded-xl group hover:border-[#FCD535]/50 transition-all cursor-pointer relative overflow-hidden"
                                        >
                                            <div className="flex justify-between items-center">
                                                <p className="text-xl font-black text-[#EAECEF] uppercase tracking-wider">{order['Customer Name']}</p>
                                                {copiedField === 'name' ? <Check size={16} className="text-[#0ECB81]" /> : <Copy size={16} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                            <div className="absolute bottom-0 left-0 h-0.5 bg-[#FCD535] transition-all w-0 group-hover:w-full"></div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <Phone size={12} /> Phone (លេខទូរស័ព្ទ)
                                        </label>
                                        <div 
                                            onClick={() => handleCopy(cleanPhone(order['Customer Phone']), 'phone')}
                                            className="bg-[#0B0E11] border border-[#2B3139] p-5 rounded-xl group hover:border-[#FCD535]/50 transition-all cursor-pointer relative overflow-hidden"
                                        >
                                            <div className="flex justify-between items-center">
                                                <p className="text-xl font-mono font-black text-[#FCD535]">{cleanPhone(order['Customer Phone'])}</p>
                                                {copiedField === 'phone' ? <Check size={16} className="text-[#0ECB81]" /> : <Copy size={16} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                            <div className="absolute bottom-0 left-0 h-0.5 bg-[#FCD535] transition-all w-0 group-hover:w-full"></div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <MapPin size={12} /> Shipping Destination (អាសយដ្ឋាន)
                                        </label>
                                        <div 
                                            onClick={() => handleCopy(`${order.Location} ${order['Address Details'] || ''}`, 'address')}
                                            className="bg-[#0B0E11] border border-[#2B3139] p-5 rounded-xl group hover:border-[#FCD535]/50 transition-all cursor-pointer relative overflow-hidden"
                                        >
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-[#EAECEF] leading-relaxed uppercase tracking-wide">{order.Location}</p>
                                                    <p className="text-xs text-[#848E9C] mt-2 italic font-medium">{order['Address Details'] || 'NO ADDITIONAL ANNOTATIONS'}</p>
                                                </div>
                                                {copiedField === 'address' ? <Check size={18} className="text-[#0ECB81] shrink-0 mt-1" /> : <Copy size={18} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />}
                                            </div>
                                            <div className="absolute bottom-0 left-0 h-0.5 bg-[#FCD535] transition-all w-0 group-hover:w-full"></div>
                                        </div>
                                    </div>

                                    {order.Note && (
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-[#FCD535] uppercase tracking-widest ml-1 flex items-center gap-2">
                                                <Zap size={12} /> Special Instruction (ចំណាំ)
                                            </label>
                                            <div className="bg-[#FCD535]/5 border border-[#FCD535]/20 p-5 rounded-xl italic">
                                                <p className="text-sm text-[#EAECEF] leading-relaxed">"{order.Note}"</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Logistics & Payment Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-[#1E2329]/80 backdrop-blur-md border border-[#2B3139] p-8 space-y-6 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-5 bg-[#FCD535] rounded-full"></div>
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#848E9C]">Logistics Protocol</h3>
                                    </div>
                                    <div className="flex items-center gap-5 bg-[#0B0E11] p-5 rounded-xl border border-[#2B3139] group hover:border-[#FCD535]/40 transition-all">
                                        {shippingMethod ? (
                                            <div className="relative">
                                                <img src={convertGoogleDriveUrl(shippingMethod.LogoURL)} className="w-12 h-12 object-contain p-2 bg-[#1E2329] border border-[#2B3139] rounded-lg shadow-inner" alt="" />
                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-[#0B0E11]"></div>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 bg-[#1E2329] border border-[#2B3139] rounded-lg flex items-center justify-center text-[#848E9C]">
                                                <Truck size={24} />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-[#EAECEF] truncate uppercase tracking-wider">{order['Internal Shipping Method'] || 'DIRECT DISPATCH'}</p>
                                            <p className="text-[10px] text-[#848E9C] font-black uppercase tracking-widest mt-1 opacity-70">{order['Internal Shipping Details'] || 'STANDARD PROTOCOL'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-[#1E2329]/80 backdrop-blur-md border border-[#2B3139] p-8 space-y-6 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-5 bg-[#FCD535] rounded-full"></div>
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#848E9C]">Financial Clearing</h3>
                                    </div>
                                    <div className="flex items-center justify-between bg-[#0B0E11] p-5 rounded-xl border border-[#2B3139] group hover:border-[#FCD535]/40 transition-all">
                                        <div className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border rounded-md ${order['Payment Status'] === 'Paid' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/30' : 'bg-[#F6465D]/10 text-[#F6465D] border-[#F6465D]/30'}`}>
                                            {order['Payment Status']}
                                        </div>
                                        {bank && (
                                            <div className="flex items-center gap-4">
                                                <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-8 h-8 object-contain opacity-90 drop-shadow-md" alt="" />
                                                <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">{bank.BankName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Inventory Assets List */}
                            <div className="space-y-5">
                                <div className="flex justify-between items-center px-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-5 bg-[#FCD535] rounded-full"></div>
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#848E9C]">Inventory Assets (ផលិតផល)</h3>
                                    </div>
                                    <span className="text-[10px] font-black bg-[#FCD535]/10 text-[#FCD535] px-3 py-1 border border-[#FCD535]/20 uppercase tracking-[0.2em] rounded-full shadow-lg shadow-[#FCD535]/5">{order.Products.length} UNITS ALLOCATED</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {order.Products.map((product, idx) => (
                                        <div key={idx} className="bg-[#1E2329]/60 backdrop-blur-sm border border-[#2B3139] p-5 flex items-center gap-5 group hover:border-[#FCD535]/50 transition-all rounded-2xl shadow-xl hover:shadow-[#FCD535]/5 hover:bg-[#2B3139]/50">
                                            <div className="relative flex-shrink-0">
                                                <img 
                                                    src={convertGoogleDriveUrl(product.image)} 
                                                    className="w-20 h-20 rounded-xl object-cover border-2 border-[#2B3139] cursor-pointer grayscale group-hover:grayscale-0 transition-all duration-700 shadow-lg group-hover:scale-105" 
                                                    alt="" 
                                                    onClick={() => previewImage(convertGoogleDriveUrl(product.image))}
                                                />
                                                <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#FCD535] text-[#0B0E11] rounded-lg flex items-center justify-center text-[12px] font-black shadow-xl border-2 border-[#0B0E11] z-10">
                                                    {product.quantity}
                                                </div>
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <p className="text-sm font-black text-white truncate uppercase tracking-widest group-hover:text-[#FCD535] transition-colors">{product.name}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[9px] bg-[#2B3139] text-[#848E9C] px-2 py-0.5 rounded uppercase font-black tracking-widest">{product.colorInfo || 'CORE EDITION'}</span>
                                                </div>
                                                <div className="flex items-center justify-between mt-3">
                                                    <p className="text-xs font-mono text-[#848E9C] opacity-60">${product.finalPrice.toFixed(2)} / unit</p>
                                                    <p className="text-base font-mono font-black text-[#0ECB81] tabular-nums">${(product.finalPrice * product.quantity).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar: Ops & Totals */}
                        <div className="space-y-8">
                            {/* Ops Hub: Technical Card */}
                            <div className="bg-gradient-to-br from-[#1E2329] to-[#0B0E11] border border-[#FCD535]/30 p-8 space-y-8 relative overflow-hidden group rounded-2xl shadow-2xl">
                                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity pointer-events-none -rotate-12 group-hover:rotate-0 duration-1000">
                                    <ShieldCheck size={140} />
                                </div>
                                <div className="flex items-center gap-3 relative z-10">
                                    <Zap size={18} className="text-[#FCD535] animate-pulse" />
                                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[#FCD535]">Operations Hub</h3>
                                </div>
                                <div className="space-y-6 relative z-10">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-1 flex items-center gap-2">
                                            <User size={10} /> Packed By (អ្នកវេចខ្ចប់)
                                        </label>
                                        <div className="bg-[#0B0E11] border border-[#2B3139] p-4 rounded-xl flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-[#0ECB81]"></div>
                                            <p className="text-xs font-black text-[#EAECEF] uppercase tracking-wider">{order['Packed By'] || 'AWAITING DISPATCH'}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-1 flex items-center gap-2">
                                            <Clock size={10} /> Packed Time
                                        </label>
                                        <div className="bg-[#0B0E11] border border-[#2B3139] p-4 rounded-xl flex items-center gap-3">
                                            <Clock size={12} className="text-[#848E9C]" />
                                            <p className="text-[11px] font-mono font-black text-[#848E9C] tracking-[0.1em] uppercase">{order['Packed Time'] || 'UNRECORDED'}</p>
                                        </div>
                                    </div>
                                    {order['Driver Name'] && (
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-1 flex items-center gap-2">
                                                <Truck size={10} /> Assigned Driver
                                            </label>
                                            <div className="bg-[#0B0E11] border border-[#2B3139] p-4 rounded-xl flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-[#F28C28]/20 flex items-center justify-center">
                                                    <Truck size={14} className="text-[#F28C28]" />
                                                </div>
                                                <p className="text-xs font-black text-[#F28C28] uppercase tracking-wider">{order['Driver Name']}</p>
                                            </div>
                                        </div>
                                    )}
                                    {order['Tracking Number'] && (
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black text-[#848E9C] uppercase tracking-[0.25em] ml-1 flex items-center gap-2">
                                                <Hash size={10} /> Tracking Identification
                                            </label>
                                            <div 
                                                onClick={() => handleCopy(order['Tracking Number'] || '', 'tracking')}
                                                className="bg-[#0B0E11] border border-[#2B3139] p-4 rounded-xl flex justify-between items-center group cursor-pointer hover:border-[#0ECB81]/50 transition-all"
                                            >
                                                <p className="text-[11px] font-mono font-black text-[#0ECB81] tracking-wider uppercase">{order['Tracking Number']}</p>
                                                {copiedField === 'tracking' ? <Check size={12} className="text-[#0ECB81]" /> : <Copy size={12} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-[#FCD535]/10 to-transparent pointer-events-none rounded-br-2xl"></div>
                            </div>

                            {/* Digital Proof: Package Photo */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 ml-2">
                                    <div className="w-1.5 h-4 bg-[#848E9C] rounded-full"></div>
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#848E9C]">Package Evidence</h3>
                                    </div>
                                    {getOptimisticPackagePhoto(order['Order ID'], order['Package Photo']) ? (
                                    <div className="relative group aspect-square rounded-2xl border-2 border-[#2B3139] bg-[#0B0E11] cursor-pointer overflow-hidden shadow-2xl transition-all hover:border-[#FCD535]/50" onClick={() => previewImage(getOptimisticPackagePhoto(order['Order ID'], order['Package Photo']))}>
                                       <img src={getOptimisticPackagePhoto(order['Order ID'], order['Package Photo'])} className="w-full h-full object-cover transition-all duration-1000 grayscale group-hover:grayscale-0 group-hover:scale-110" alt="Package Proof" />
                                       <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px]">
                                            <div className="w-16 h-16 border-2 border-[#FCD535] bg-[#0B0E11]/90 rounded-2xl flex items-center justify-center text-[#FCD535] shadow-[0_0_30px_rgba(252,213,53,0.3)] scale-75 group-hover:scale-100 transition-all duration-500">
                                                <ExternalLink size={28} />
                                            </div>
                                        </div>
                                        <div className="absolute inset-x-0 h-[2px] bg-[#FCD535]/70 shadow-[0_0_15px_#FCD535] top-0 animate-[scan_4s_linear_infinite] z-20"></div>
                                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-[#0ECB81] rounded-full animate-pulse"></div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Encrypted Proof</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-square rounded-2xl border-2 border-dashed border-[#2B3139] flex flex-col items-center justify-center gap-5 text-[#848E9C] bg-[#1E2329]/30 group hover:border-[#FCD535]/30 transition-all">
                                        <div className="w-16 h-16 bg-[#1E2329] border border-[#2B3139] rounded-2xl flex items-center justify-center grayscale group-hover:grayscale-0 transition-all opacity-40 group-hover:opacity-100 group-hover:scale-110 duration-500 shadow-xl">
                                            <Package size={32} />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 group-hover:opacity-100 transition-opacity">Awaiting Photo Assets</p>
                                    </div>
                                )}
                            </div>

                            {/* Digital Proof: Delivery Photo */}
                            {order['Delivery Photo URL'] && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 ml-2">
                                        <div className="w-1.5 h-4 bg-[#0ECB81] rounded-full"></div>
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#0ECB81]">Delivery Proof</h3>
                                    </div>
                                    <div className="relative group aspect-square rounded-2xl border-2 border-[#0ECB81]/30 bg-[#0B0E11] cursor-pointer overflow-hidden shadow-2xl transition-all hover:border-[#0ECB81]/50" onClick={() => previewImage(order['Delivery Photo URL']!)}>
                                        <img src={convertGoogleDriveUrl(order['Delivery Photo URL']!)} className="w-full h-full object-cover transition-all duration-1000 grayscale group-hover:grayscale-0 group-hover:scale-110" alt="Delivery Proof" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px]">
                                            <div className="w-16 h-16 border-2 border-[#0ECB81] bg-[#0B0E11]/90 rounded-2xl flex items-center justify-center text-[#0ECB81] shadow-[0_0_30px_rgba(14,203,129,0.3)] scale-75 group-hover:scale-100 transition-all duration-500">
                                                <ExternalLink size={28} />
                                            </div>
                                        </div>
                                        <div className="absolute inset-x-0 h-[2px] bg-[#0ECB81]/70 shadow-[0_0_15px_#0ECB81] top-0 animate-[scan_4s_linear_infinite] z-20"></div>
                                    </div>
                                </div>
                            )}

                            {/* Settlement Summary: High-Impact Card */}
                            <div className="bg-[#1E2329] border-2 border-[#2B3139] p-8 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-[#FCD535]/40 transition-all">
                                <div className="space-y-5 relative z-10">
                                    <div className="flex justify-between items-center pb-5 border-b border-[#2B3139] border-dashed">
                                        <div className="flex items-center gap-2">
                                            <Box size={14} className="text-[#848E9C]" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#848E9C]">Asset Subtotal</span>
                                        </div>
                                        <span className="text-lg font-mono font-black text-[#EAECEF] tabular-nums">${(Number(order.Subtotal) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-5 border-b border-[#2B3139] border-dashed">
                                        <div className="flex items-center gap-2">
                                            <Truck size={14} className="text-[#848E9C]" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#848E9C]">Logistics Fee</span>
                                        </div>
                                        <span className="text-lg font-mono font-black text-[#EAECEF] tabular-nums">${(Number(order['Shipping Fee (Customer)']) || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="pt-3">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-2 h-4 bg-[#FCD535] rounded-sm"></div>
                                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FCD535]">Grand Settlement</span>
                                                </div>
                                                <div className="text-[10px] font-bold text-[#848E9C] uppercase tracking-wider ml-4 flex items-center gap-2">
                                                    <CreditCard size={10} /> Final Amount (USD)
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <div className="text-4xl font-mono font-black text-[#FCD535] tabular-nums drop-shadow-[0_0_15px_rgba(252,213,53,0.3)] group-hover:scale-105 transition-transform">
                                                    ${(Number(order['Grand Total']) || 0).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {(order as any)['Delivery Unpaid'] > 0 && (
                                        <div className="mt-6 p-4 bg-[#F6465D]/10 border border-[#F6465D]/30 rounded-xl flex items-center gap-4 animate-pulse">
                                            <div className="w-10 h-10 bg-[#F6465D]/20 rounded-lg flex items-center justify-center text-[#F6465D] shrink-0">
                                                <Zap size={20} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-[#F6465D] uppercase tracking-[0.2em]">Attention: Collect Cash (បង់ប្រាក់ផ្ទាល់)</p>
                                                <p className="text-lg font-mono font-black text-white mt-0.5">COLLECT: ${(order as any)['Delivery Unpaid'].toFixed(2)}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#FCD535]/5 to-transparent pointer-events-none rounded-bl-full"></div>
                                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-[#0ECB81]/5 blur-3xl rounded-full pointer-events-none group-hover:bg-[#0ECB81]/10 transition-all"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Strip */}
                <div className="p-6 border-t border-[#2B3139] bg-[#1E2329] flex justify-end items-center gap-6">
                    <p className="text-[10px] font-mono text-[#848E9C] uppercase tracking-widest opacity-40 hidden md:block">System encryption active // secure protocol enabled</p>
                    <button 
                        onClick={onClose} 
                        className="px-10 py-4 bg-[#2B3139] hover:bg-[#FCD535] text-[#EAECEF] hover:text-[#0B0E11] font-black uppercase text-xs tracking-[0.4em] rounded-xl transition-all active:scale-[0.95] border border-[#474D57] hover:border-[#FCD535] shadow-xl hover:shadow-[#FCD535]/20 group flex items-center gap-3"
                    >
                        <span>Terminate System View</span>
                        <Zap size={14} className="group-hover:fill-current" />
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(100%); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #0B0E11;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #2B3139;
                    border-radius: 10px;
                    border: 1px solid #0B0E11;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #FCD535;
                }
            `}</style>
        </Modal>
    );
};

export default OrderDetailModal;