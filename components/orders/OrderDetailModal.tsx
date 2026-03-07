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
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="bg-[#0f172a] text-white overflow-hidden rounded-[2rem] flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-blue-600/20 to-transparent flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {page && (
                            <img src={convertGoogleDriveUrl(page.PageLogoURL)} className="w-12 h-12 rounded-2xl border border-white/10 object-cover" alt="" />
                        )}
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tighter italic">Order Details</h2>
                            <p className="text-[10px] font-mono text-blue-400 font-bold">ID: {order['Order ID']}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left: Customer & Logistics */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Customer Info Card */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">ព័ត៌មានអតិថិជន (Customer)</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 uppercase">ឈ្មោះ</label>
                                        <p className="text-lg font-black text-white">{order['Customer Name']}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 uppercase">លេខទូរស័ព្ទ</label>
                                        <p className="text-lg font-mono font-black text-blue-400">{order['Customer Phone']}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-black text-gray-500 uppercase">អាសយដ្ឋាន</label>
                                        <p className="text-sm font-bold text-gray-300">{order.Location} - {order['Address Details'] || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Logistics & Payment */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">ដឹកជញ្ជូន (Logistics)</h3>
                                    <div className="flex items-center gap-3">
                                        {shippingMethod && <img src={convertGoogleDriveUrl(shippingMethod.LogosURL)} className="w-10 h-10 object-contain bg-white/5 p-1.5 rounded-xl" alt="" />}
                                        <div>
                                            <p className="text-sm font-black text-white">{order['Internal Shipping Method']}</p>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase">{order['Internal Shipping Details'] || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">ការទូទាត់ (Payment)</h3>
                                    <div className="flex items-center justify-between">
                                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {order['Payment Status']}
                                        </div>
                                        {bank && (
                                            <div className="flex items-center gap-2">
                                                <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-6 h-6 object-contain" alt="" />
                                                <span className="text-[10px] font-bold text-gray-400">{bank.BankName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Product List */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">ផលិតផល ({order.Products.length})</h3>
                                <div className="space-y-2">
                                    {order.Products.map((product, idx) => (
                                        <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-4">
                                            <img 
                                                src={convertGoogleDriveUrl(product.image)} 
                                                className="w-14 h-14 rounded-xl object-cover border border-white/5 cursor-pointer" 
                                                alt="" 
                                                onClick={() => previewImage(convertGoogleDriveUrl(product.image))}
                                            />
                                            <div className="flex-grow min-w-0">
                                                <p className="text-sm font-black text-white truncate">{product.name}</p>
                                                <p className="text-[10px] text-blue-400 font-black">x{product.quantity} {product.colorInfo && `| ${product.colorInfo}`}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-mono font-black text-emerald-400">${(product.finalPrice * product.quantity).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Packaging & Proof */}
                        <div className="space-y-6">
                            {/* Packaging Info */}
                            <div className="bg-blue-600/5 border border-blue-500/20 rounded-3xl p-6 space-y-4">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth={2} /></svg>
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">ព័ត៌មានវេចខ្ចប់ (Packaging)</h3>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-500 uppercase">អ្នកវេចខ្ចប់ (Packed By)</label>
                                        <p className="text-sm font-black text-white">{order['Packed By'] || 'មិនទាន់មាន (Pending)'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-gray-500 uppercase">ម៉ោងវេចខ្ចប់ (Packed Time)</label>
                                        <p className="text-sm font-mono font-bold text-gray-300">{order['Packed Time'] || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Package Photo */}
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 ml-2">រូបភាពកញ្ចប់ឥវ៉ាន់ (Package Proof)</h3>
                                {order['Package Photo URL'] ? (
                                    <div className="relative group aspect-square rounded-[2rem] overflow-hidden border-4 border-white/5 bg-black cursor-pointer shadow-2xl" onClick={() => previewImage(convertGoogleDriveUrl(order['Package Photo URL']!))}>
                                        <img src={convertGoogleDriveUrl(order['Package Photo URL']!)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Package Proof" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" strokeWidth={2.5} /></svg>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-square rounded-[2rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-3 text-gray-600 bg-white/[0.01]">
                                        <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2} /></svg>
                                        <p className="text-[10px] font-black uppercase tracking-widest">No Package Photo</p>
                                    </div>
                                )}
                            </div>

                            {/* Totals Card */}
                            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 shadow-xl shadow-blue-900/20">
                                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                                    <span className="text-[10px] font-black uppercase text-blue-100">Subtotal</span>
                                    <span className="font-mono font-black text-white">${Number(order.Subtotal).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center py-4 border-b border-white/10">
                                    <span className="text-[10px] font-black uppercase text-blue-100">Shipping</span>
                                    <span className="font-mono font-black text-white">${Number(order['Shipping Fee (Customer)']).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-4">
                                    <span className="text-xs font-black uppercase text-white">Grand Total</span>
                                    <span className="text-2xl font-mono font-black text-white">${Number(order['Grand Total']).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-white/5 bg-black/20 flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 text-gray-400 font-black uppercase text-xs tracking-widest rounded-2xl transition-all">Close</button>
                </div>
            </div>
        </Modal>
    );
};

export default OrderDetailModal;