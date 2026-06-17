import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
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

    const lowStockCount = useMemo(() => {
        return inventory.filter(i => i.Quantity < 5).length;
    }, [inventory]);

    const uniqueSkus = useMemo(() => {
        return new Set(inventory.map(i => i.Barcode)).size;
    }, [inventory]);

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans text-gray-300">
            {/* Header & Stats - Binancer Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Units</span>
                        <svg className="w-4 h-4 text-[#FCD535]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    </div>
                    <span className="text-2xl font-mono text-white leading-none">{totalStock.toLocaleString()}</span>
                </div>

                <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Unique SKUs</span>
                        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    </div>
                    <span className="text-2xl font-mono text-white leading-none">{uniqueSkus}</span>
                </div>

                <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Storage Sites</span>
                        <svg className="w-4 h-4 text-[#0ECB81]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <span className="text-2xl font-mono text-white leading-none">{stores.length}</span>
                </div>

                <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-4 flex flex-col justify-between relative overflow-hidden">
                    {lowStockCount > 0 && <div className="absolute top-0 right-0 w-1 h-full bg-[#F6465D] animate-pulse"></div>}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Low Stock Alert</span>
                        <svg className={`w-4 h-4 ${lowStockCount > 0 ? 'text-[#F6465D]' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <span className={`text-2xl font-mono leading-none ${lowStockCount > 0 ? 'text-[#F6465D]' : 'text-white'}`}>{lowStockCount}</span>
                </div>
            </div>

            {/* Main Ledger Table */}
            <div className="bg-[#181A20] border border-[#2B3139] rounded-sm overflow-hidden">
                <div className="p-4 border-b border-[#2B3139] flex flex-col lg:flex-row justify-between items-center gap-4 bg-[#0B0E11]/50">
                    <div>
                        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-widest flex items-center gap-2">
                            Stock Distribution Matrix
                            <span className="bg-[#0ECB81]/10 text-[#0ECB81] text-[10px] px-1.5 py-0.5 rounded-sm border border-[#0ECB81]/20">Live</span>
                        </h2>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-grow lg:w-80">
                            <input 
                                type="text" 
                                placeholder="Search barcode or product..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm pl-10 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:border-[#FCD535] outline-none transition-colors"
                            />
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <button onClick={refreshData} className="p-2 bg-[#0B0E11] border border-[#2B3139] text-gray-400 hover:text-white hover:bg-[#2B3139] rounded-sm transition-colors" title="Sync Ledger">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar bg-[#0B0E11]">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-[#181A20] text-[10px] font-bold text-gray-500 uppercase tracking-widest border-b border-[#2B3139]">
                            <tr>
                                <th className="px-6 py-4 sticky left-0 z-20 bg-[#181A20] font-normal w-64">Product Information</th>
                                {stores.map(store => (
                                    <th key={store.StoreName} className="px-4 py-4 text-center border-l border-[#2B3139] font-normal min-w-[100px]">{store.StoreName}</th>
                                ))}
                                <th className="px-6 py-4 text-right border-l border-[#2B3139] bg-[#0B0E11] text-[#FCD535] font-normal">Global PnL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2B3139]">
                            {groupedInventory.map(item => {
                                let rowTotal = 0;
                                return (
                                    <tr key={item.barcode} className="hover:bg-[#181A20] transition-colors group">
                                        <td className="px-6 py-3 sticky left-0 z-20 bg-[#0B0E11] group-hover:bg-[#181A20] transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-sm overflow-hidden bg-[#181A20] border border-[#2B3139] flex-shrink-0 cursor-pointer" onClick={() => item.image && previewImage(convertGoogleDriveUrl(item.image))}>
                                                    {item.image ? (
                                                        <img src={convertGoogleDriveUrl(item.image)} className="w-full h-full object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-gray-600 uppercase">{item.name.substring(0, 2)}</div>
                                                    )}
                                                </div>
                                                <div className="min-w-0 max-w-[180px]">
                                                    <p className="font-bold text-gray-200 text-xs truncate group-hover:text-white transition-colors">{item.name}</p>
                                                    <p className="font-mono text-[9px] text-gray-500 mt-0.5">{item.barcode}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {stores.map(store => {
                                            const qty = item.stock[store.StoreName] || 0;
                                            rowTotal += qty;
                                            return (
                                                <td key={store.StoreName} className="px-4 py-3 text-center border-l border-[#2B3139]">
                                                    <span className={`font-mono text-sm ${qty > 10 ? 'text-[#0ECB81]' : qty > 0 ? 'text-[#FCD535]' : 'text-[#F6465D]'}`}>
                                                        {qty}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td className="px-6 py-3 text-right font-mono font-bold text-white border-l border-[#2B3139] bg-[#0B0E11]">
                                            {rowTotal}
                                        </td>
                                    </tr>
                                );
                            })}
                            {groupedInventory.length === 0 && (
                                <tr>
                                    <td colSpan={stores.length + 2} className="px-6 py-16 text-center text-gray-600 uppercase font-bold tracking-widest text-xs bg-[#0B0E11]">
                                        No SKUs matched in the ledger
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sub-Operations Module */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-6 group relative">
                    <div className="absolute top-4 right-4 text-gray-700">
                        <svg className="w-8 h-8 opacity-20 group-hover:opacity-40 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Stock Transfers</h3>
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Beta Mode</span>
                    </div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest leading-relaxed mb-6">Internal fulfillment routing</p>
                    <div className="h-12 flex items-center justify-center border border-[#2B3139] border-dashed rounded-sm bg-[#0B0E11]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#FCD535] opacity-50">Link Established</p>
                    </div>
                </div>

                <div className="bg-[#181A20] border border-[#2B3139] rounded-sm p-6 group relative">
                    <div className="absolute top-4 right-4 text-gray-700">
                        <svg className="w-8 h-8 opacity-20 group-hover:opacity-40 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3" /></svg>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Reverse Logistics</h3>
                        <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Pending</span>
                    </div>
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest leading-relaxed mb-6">Returns & RTO processing pipeline</p>
                    <div className="h-12 flex items-center justify-center border border-[#2B3139] border-dashed rounded-sm bg-[#0B0E11]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400 opacity-50">Awaiting Auth</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryManagement;
