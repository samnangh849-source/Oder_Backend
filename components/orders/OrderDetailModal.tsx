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
            <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-transparent flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-5">
                        {page ? (
                            <img src={convertGoogleDriveUrl(page.PageLogoURL)} className="w-14 h-14 rounded-2xl border border-white/10 object-cover shadow-2xl" alt="" />
                        ) : (
                            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h12l1 12H4L5 9z" strokeWidth={2} /></svg>
                            </div>
                        )}
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter italic leading-none">Order Analysis</h2>
                            <p className="text-[11px] font-mono text-blue-400 font-black mt-1 uppercase tracking-widest">Tracking ID: {order['Order ID']}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-90 border border-white/5">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} strokeLinecap="round" /></svg>
                    </button>
                </div>

                <div className="p-8 flex-grow space-y-10">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Left: Customer & Logistics */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Customer Info Card */}
                            <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-8 space-y-6 shadow-inner">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-2 h-5 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 italic">Customer Intelligence</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Full Name (ឈ្មោះ)</label>
                                        <p className="text-xl font-black text-white bg-gray-900/50 p-4 rounded-2xl border border-white/5">{order['Customer Name']}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Phone (លេខទូរស័ព្ទ)</label>
                                        <p className="text-xl font-mono font-black text-blue-400 bg-gray-900/50 p-4 rounded-2xl border border-white/5">{order['Customer Phone']}</p>
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Shipping Destination (អាសយដ្ឋាន)</label>
                                        <div className="bg-gray-900/50 p-4 rounded-2xl border border-white/5">
                                            <p className="text-sm font-bold text-gray-200">{order.Location}</p>
                                            <p className="text-sm text-gray-400 mt-1">{order['Address Details'] || 'No additional details provided'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Logistics & Payment */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-8 space-y-5 shadow-inner">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 italic">Logistics Team</h3>
                                    <div className="flex items-center gap-4 bg-gray-900/50 p-4 rounded-2xl border border-white/5">
                                        {shippingMethod ? (
                                            <img src={convertGoogleDriveUrl(shippingMethod.LogosURL)} className="w-12 h-12 object-contain bg-white/5 p-2 rounded-xl border border-white/5" alt="" />
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center text-gray-600">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" strokeWidth={2} /></svg>
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-white truncate">{order['Internal Shipping Method']}</p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5 truncate">{order['Internal Shipping Details'] || 'STANDARD DELIVERY'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 rounded-[2rem] p-8 space-y-5 shadow-inner">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 italic">Financial Status</h3>
                                    <div className="flex items-center justify-between bg-gray-900/50 p-4 rounded-2xl border border-white/5">
                                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]'}`}>
                                            {order['Payment Status']}
                                        </div>
                                        {bank && (
                                            <div className="flex items-center gap-3">
                                                <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-8 h-8 object-contain rounded-lg shadow-lg" alt="" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{bank.BankName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Product List */}
                            <div className="space-y-5">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 italic">Inventory Assets</h3>
                                    <span className="text-[10px] font-black bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest">{order.Products.length} Items</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {order.Products.map((product, idx) => (
                                        <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] p-5 flex items-center gap-5 group hover:bg-white/[0.05] transition-all hover:border-blue-500/20 shadow-lg">
                                            <div className="relative flex-shrink-0">
                                                <img 
                                                    src={convertGoogleDriveUrl(product.image)} 
                                                    className="w-16 h-16 rounded-2xl object-cover border border-white/5 cursor-pointer shadow-xl transition-transform group-hover:scale-105" 
                                                    alt="" 
                                                    onClick={() => previewImage(convertGoogleDriveUrl(product.image))}
                                                />
                                                <div className="absolute -top-2 -right-2 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg border-2 border-[#0f172a]">
                                                    {product.quantity}
                                                </div>
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <p className="text-sm font-black text-white truncate">{product.name}</p>
                                                <p className="text-[10px] text-blue-400 font-bold mt-0.5 uppercase tracking-widest">{product.colorInfo || 'Standard Edition'}</p>
                                                <p className="text-xs font-mono font-black text-emerald-400 mt-1">${(product.finalPrice * product.quantity).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Packaging & Proof */}
                        <div className="space-y-8">
                            {/* Packaging Info */}
                            <div className="bg-blue-600/5 border border-blue-500/20 rounded-[2rem] p-8 space-y-6 shadow-inner relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                                    <svg className="w-16 h-16 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth={2} /></svg>
                                </div>
                                <div className="flex items-center gap-3 relative z-10">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-400 italic">Ops Status</h3>
                                </div>
                                <div className="space-y-5 relative z-10">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Packed By (វេចខ្ចប់ដោយ)</label>
                                        <p className="text-sm font-black text-white bg-white/5 p-3 rounded-xl border border-white/5">{order['Packed By'] || 'Awaiting Operations'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Timestamp (ម៉ោងវេចខ្ចប់)</label>
                                        <p className="text-sm font-mono font-bold text-gray-300 bg-white/5 p-3 rounded-xl border border-white/5">{order['Packed Time'] || 'PENDING'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Package Photo */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 italic ml-2">Digital Proof</h3>
                                {order['Package Photo URL'] ? (
                                            <div className="relative group aspect-square rounded-[2.5rem] overflow-hidden border-4 border-white/5 bg-black cursor-pointer shadow-3xl" onClick={() => previewImage(order['Package Photo URL']!)}>
                                        <img src={convertGoogleDriveUrl(order['Package Photo URL']!)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Package Proof" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                            <div className="w-16 h-16 rounded-full bg-blue-600/80 flex items-center justify-center text-white shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-500">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" strokeWidth={3} /></svg>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-square rounded-[2.5rem] border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-4 text-gray-600 bg-white/[0.01] shadow-inner">
                                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center opacity-20">
                                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2} /></svg>
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Visual Evidence</p>
                                    </div>
                                )}
                            </div>

                            {/* Totals Card */}
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[2rem] p-8 shadow-2xl shadow-blue-900/40 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/20 transition-all"></div>
                                <div className="flex justify-between items-center pb-5 border-b border-white/10 relative z-10">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Subtotal</span>
                                    <span className="text-lg font-mono font-black text-white">${(Number(order.Subtotal) || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center py-5 border-b border-white/10 relative z-10">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">Shipping</span>
                                    <span className="text-lg font-mono font-black text-white">${(Number(order['Shipping Fee (Customer)']) || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-6 relative z-10">
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white">Grand Total</span>
                                    <span className="text-3xl font-mono font-black text-white drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)]">${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-white/5 bg-black/40 flex gap-6 relative z-10">
                    <button onClick={onClose} className="flex-1 py-5 bg-gray-800 hover:bg-gray-700 text-white font-black uppercase text-[11px] tracking-[0.3em] rounded-2xl transition-all shadow-xl active:scale-[0.98] border border-white/5">Terminate View</button>
                </div>
            </div>
        </Modal>
    );
};

export default OrderDetailModal;