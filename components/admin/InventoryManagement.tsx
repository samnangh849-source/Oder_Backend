
import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import StatCard from '../performance/StatCard';
import Spinner from '../common/Spinner';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

const InventoryManagement: React.FC = () => {
    const { appData, refreshData, previewImage } = useContext(AppContext);
    const [searchTerm, setSearchTerm] = useState('');

    const inventory = appData.inventory || [];
    const stores = appData.stores || [];
    const products = appData.products || [];

    // Helper to find product by barcode
    const getProductByBarcode = (barcode: string) => {
        return products.find(p => p.Barcode === barcode);
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const product = getProductByBarcode(item.Barcode);
            const searchStr = `${item.Barcode} ${product?.ProductName || ''}`.toLowerCase();
            return searchStr.includes(searchTerm.toLowerCase());
        });
    }, [inventory, products, searchTerm]);

    // Group by Barcode for the table rows
    const groupedInventory = useMemo(() => {
        const groups: Record<string, any> = {};
        filteredInventory.forEach(item => {
            if (!groups[item.Barcode]) {
                const product = getProductByBarcode(item.Barcode);
                groups[item.Barcode] = {
                    barcode: item.Barcode,
                    name: product?.ProductName || 'Unknown Product',
                    image: product?.ImageURL || '',
                    stock: {}
                };
            }
            groups[item.Barcode].stock[item.StoreName] = item.Quantity;
        });
        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredInventory, products]);

    const totalStock = useMemo(() => {
        return inventory.reduce((sum, item) => sum + item.Quantity, 0);
    }, [inventory]);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <StatCard label="Total Units" value={totalStock.toLocaleString()} icon="📦" colorClass="from-blue-600 to-indigo-600" />
                <StatCard label="Unique SKUs" value={new Set(inventory.map(i => i.Barcode)).size} icon="🏷️" colorClass="from-indigo-600 to-purple-600" />
                <StatCard label="Storage Sites" value={stores.length} icon="🏠" colorClass="from-emerald-600 to-teal-600" />
                <StatCard label="Low Stock Alert" value={inventory.filter(i => i.Quantity < 5).length} icon="⚠️" colorClass="from-orange-600 to-red-600" />
            </div>

            <div className="bg-[#0f172a]/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] overflow-hidden shadow-3xl">
                <div className="p-6 lg:p-10 border-b border-white/5 flex flex-col lg:flex-row justify-between items-center gap-8 bg-white/[0.01]">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Stock Distribution Matrix</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Real-time Multi-store Inventory Ledger</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className="relative flex-grow lg:w-96">
                            <input 
                                type="text" 
                                placeholder="Search barcode or product name..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black/40 border-gray-700 rounded-2xl pl-12 pr-6 py-3.5 text-sm text-white focus:border-blue-500 outline-none transition-all shadow-inner"
                            />
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <button onClick={refreshData} className="p-3.5 bg-gray-800 rounded-2xl border border-white/5 hover:bg-gray-700 transition-all active:scale-90">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-black/40 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-8 py-6 sticky left-0 z-20 bg-[#0f172a]">Product Information</th>
                                {stores.map(store => (
                                    <th key={store.StoreName} className="px-6 py-6 text-center border-l border-white/5 min-w-[120px]">{store.StoreName}</th>
                                ))}
                                <th className="px-8 py-6 text-right border-l border-white/5 bg-blue-600/5 text-blue-400 font-black">Consolidated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {groupedInventory.map(item => {
                                let rowTotal = 0;
                                return (
                                    <tr key={item.barcode} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-8 py-5 sticky left-0 z-20 bg-[#0f172a] group-hover:bg-[#1e293b] transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 cursor-pointer" onClick={() => item.image && previewImage(convertGoogleDriveUrl(item.image))}>
                                                    {item.image ? (
                                                        <img src={convertGoogleDriveUrl(item.image)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-700 uppercase">{item.name.substring(0, 2)}</div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-white text-sm truncate leading-tight mb-1 group-hover:text-blue-400 transition-colors">{item.name}</p>
                                                    <p className="font-mono text-[10px] text-gray-500 font-bold tracking-widest">{item.barcode}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {stores.map(store => {
                                            const qty = item.stock[store.StoreName] || 0;
                                            rowTotal += qty;
                                            return (
                                                <td key={store.StoreName} className="px-6 py-5 text-center border-l border-white/5">
                                                    <span className={`
                                                        px-3 py-1 rounded-lg font-black font-mono text-sm
                                                        ${qty > 10 ? 'text-white' : qty > 0 ? 'text-amber-400 bg-amber-500/5' : 'text-gray-800'}
                                                    `}>
                                                        {qty}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td className="px-8 py-5 text-right font-black text-blue-400 border-l border-white/5 bg-blue-600/5 text-lg tracking-tighter">
                                            {rowTotal}
                                        </td>
                                    </tr>
                                );
                            })}
                            {groupedInventory.length === 0 && (
                                <tr>
                                    <td colSpan={stores.length + 2} className="px-8 py-20 text-center text-gray-600 uppercase font-black tracking-widest text-xs italic opacity-50">
                                        No SKUs found matching your search criteria
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sub-Operations: Transfers & Returns (Coming Soon) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="page-card !p-10 border-white/5 bg-[#0f172a]/40 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-2 flex items-center gap-3 italic">
                        Stock Transfers
                        <span className="bg-blue-600/20 text-blue-400 text-[8px] px-2 py-0.5 rounded-full not-italic">V2.1 Beta</span>
                    </h3>
                    <p className="text-gray-500 text-xs font-bold leading-relaxed mb-8">Manage stock movements between regional fulfillment sites with approval workflow.</p>
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-800 rounded-[2rem] bg-black/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 animate-pulse">Subsystem Offline</p>
                    </div>
                </div>

                <div className="page-card !p-10 border-white/5 bg-[#0f172a]/40 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3" /></svg>
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-2 flex items-center gap-3 italic">
                        Returns & RTO
                        <span className="bg-purple-600/20 text-purple-400 text-[8px] px-2 py-0.5 rounded-full not-italic">Coming Soon</span>
                    </h3>
                    <p className="text-gray-500 text-xs font-bold leading-relaxed mb-8">Process customer returns, quality inspections, and restock operations automatically.</p>
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-800 rounded-[2rem] bg-black/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-700 animate-pulse">Logic Pending</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryManagement;
