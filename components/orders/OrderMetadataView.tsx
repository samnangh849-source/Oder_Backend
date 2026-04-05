import React, { useMemo, useContext, useState, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import Spinner from '@/components/common/Spinner';
import { WEB_APP_URL } from '@/constants';
import { ParsedOrder } from '@/types';

interface OrderMetadataViewProps {
    orderId: string;
}

const OrderMetadataView: React.FC<OrderMetadataViewProps> = ({ orderId }) => {
    const { orders } = useContext(AppContext);
    const [fetchedOrder, setFetchedOrder] = useState<ParsedOrder | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const order = useMemo(() => {
        return fetchedOrder || orders.find(o => o['Order ID'] === orderId);
    }, [orders, orderId, fetchedOrder]);

    useEffect(() => {
        const fetchOrder = async () => {
            if (orders.find(o => o['Order ID'] === orderId)) return;
            
            setIsLoading(true);
            try {
                const res = await fetch(`${WEB_APP_URL}/api/order-metadata/${orderId}`);
                if (res.ok) {
                    const result = await res.json();
                        if (result.status === 'success' && result.data) {
                            const raw = result.data;
                            // Parse products JSON from the key used by Go backend
                            let products = [];
                            const productsJson = raw['Products (JSON)'] || raw.products_json;
                            if (typeof productsJson === 'string' && productsJson) {
                                try { products = JSON.parse(productsJson); } catch (e) { console.error("Failed to parse products", e); }
                            } else if (Array.isArray(raw.Products)) {
                                products = raw.Products;
                            }

                            setFetchedOrder({
                                ...raw,
                                Products: products,
                                FulfillmentStatus: raw['Fulfillment Status'] || raw.fulfillment_status || raw.FulfillmentStatus
                            });
                        }
                }
            } catch (error) {
                console.error("Failed to fetch order metadata:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (orderId) fetchOrder();
    }, [orderId, orders]);

    if (isLoading && !order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0E11] text-white gap-4">
                <Spinner size="lg" />
                <p className="text-xs font-black uppercase tracking-[0.3em] animate-pulse">Syncing Secure Metadata...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#0B0E11] text-white p-8 text-center gap-6">
                <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center border border-red-500/20">
                    <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter italic">Order Not Found</h2>
                <p className="text-gray-500 text-sm max-w-xs">The requested consignment metadata is either invalid or has been archived.</p>
                <button onClick={() => window.location.reload()} className="px-8 py-3 bg-[#FCD535] text-black font-black rounded-xl uppercase text-xs tracking-widest transition-all active:scale-95 shadow-xl">Retry Sync</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B0E11] text-[#EAECEF] font-sans selection:bg-[#FCD535]/30 p-4 sm:p-8 animate-fade-in overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-8 pb-20">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse"></div>
                            <span className="text-[10px] font-black text-[#0ECB81] uppercase tracking-[0.3em]">Verified Consignment</span>
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tighter italic flex items-center gap-3">
                            <span className="text-white">METADATA</span>
                            <span className="text-[#FCD535] font-mono">#{order['Order ID']}</span>
                        </h1>
                    </div>
                    <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex flex-col items-end">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Protocol Date</span>
                        <span className="text-sm font-mono font-bold text-white">{order.Timestamp}</span>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Column 1: Logistics & Customer */}
                    <div className="space-y-8">
                        <section className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <svg className="w-5 h-5 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <h3 className="text-xs font-black uppercase tracking-widest">Customer Profile</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Name</p>
                                    <p className="text-base font-black text-white">{order['Customer Name']}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Phone</p>
                                    <p className="text-lg font-mono font-black text-[#FCD535]">{order['Customer Phone']}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Location</p>
                                    <p className="text-sm font-bold text-white/80">{order.Location}</p>
                                    {order['Address Details'] && <p className="text-xs text-gray-500 italic mt-1">{order['Address Details']}</p>}
                                </div>
                            </div>
                        </section>

                        <section className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <svg className="w-5 h-5 text-[#0ECB81]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <h3 className="text-xs font-black uppercase tracking-widest">Fulfillment State</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Status</p>
                                    <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-[10px] font-black rounded-full border border-blue-500/20 uppercase">{order.FulfillmentStatus || order['Fulfillment Status']}</span>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Payment</p>
                                    <span className="px-3 py-1 bg-[#0ECB81]/20 text-[#0ECB81] text-[10px] font-black rounded-full border border-[#0ECB81]/20 uppercase">{order['Payment Status']}</span>
                                </div>
                                <div className="col-span-2 pt-4 border-t border-white/5 flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Payable</p>
                                        <p className="text-3xl font-mono font-black text-[#0ECB81]">${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Shipping</p>
                                        <p className="text-sm font-mono text-white/60">${(Number(order['Shipping Fee (Customer)']) || 0).toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Column 2: Manifest & Photo */}
                    <div className="space-y-8">
                        <section className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl space-y-6">
                            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                <h3 className="text-xs font-black uppercase tracking-widest">Order Manifest</h3>
                            </div>
                            <div className="space-y-2">
                                {order.Products?.map((p, i) => (
                                    <div key={i} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-bold text-white uppercase tracking-tight">{p.name}</span>
                                            <span className="text-[9px] text-gray-500 font-mono">${(Number(p.finalPrice) || 0).toFixed(2)} / unit</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Qty</span>
                                            <span className="text-sm font-black text-[#FCD535] bg-[#FCD535]/10 px-3 py-1 rounded-lg">x{p.quantity}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl space-y-4">
                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                                    <h3 className="text-xs font-black uppercase tracking-widest">Visual Evidence</h3>
                                </div>
                            </div>
                            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 bg-black relative group">
                                {order['Package Photo URL'] ? (
                                    <img src={convertGoogleDriveUrl(order['Package Photo URL'])} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Proof" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 gap-3">
                                        <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Image Pending Sync</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Footer Footer */}
                <div className="pt-12 text-center space-y-4">
                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.4em]">ACC ORDER MANAGEMENT SYSTEM • CORE 26.04</p>
                    <div className="flex justify-center items-center gap-6">
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">Audited By</span>
                            <span className="text-[10px] font-bold text-gray-500">{order['Packed By'] || 'System Alpha'}</span>
                        </div>
                        <div className="w-[1px] h-6 bg-white/5"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">Page Team</span>
                            <span className="text-[10px] font-bold text-gray-500">{order.Page} / Team {order.Team}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderMetadataView;