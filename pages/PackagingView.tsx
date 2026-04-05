import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import FastPackTerminal from '@/components/admin/packaging/fastpack/FastPackTerminal';
import { convertGoogleDriveUrl, getOptimisticPackagePhoto } from '@/utils/fileUtils';
import Modal from '@/components/common/Modal';
import MobilePackagingHub from '@/components/admin/packaging/MobilePackagingHub';
import TabletPackagingHub from '@/components/admin/packaging/TabletPackagingHub';
import DesktopPackagingHub from '@/components/admin/packaging/DesktopPackagingHub';

const bClasses = {
    surface: 'bg-[#1E2329] border border-[#2B3139]',
    surfaceHover: 'hover:bg-[#2B3139] transition-colors duration-200',
    btnYellow: 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-[#0B0E11] font-bold rounded-[4px] px-4 py-2 transition-all active:scale-[0.98]',
};

const PackagingView: React.FC<{ orders?: ParsedOrder[] }> = ({ orders: propOrders }) => {
    const { appData, refreshData, currentUser, setMobilePageTitle, appState, setAppState } = useContext(AppContext);
    
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'Pending' | 'Ready to Ship' | 'Shipped'>('Pending');
    const [packingOrder, setPackingOrder] = useState<ParsedOrder | null>(null);
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [localOrders, setLocalOrders] = useState<ParsedOrder[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const onToggleSelectAll = (ordersToSelect: ParsedOrder[]) => {
        if (ordersToSelect.length === 0) return;
        const allSelected = ordersToSelect.every(o => selectedOrderIds.has(o['Order ID']));
        setSelectedOrderIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                ordersToSelect.forEach(o => next.delete(o['Order ID']));
            } else {
                ordersToSelect.forEach(o => next.add(o['Order ID']));
            }
            return next;
        });
    };

    const onBulkShip = async () => {
        if (selectedOrderIds.size === 0) return;
        
        const confirmed = window.confirm(`Are you sure you want to ship ${selectedOrderIds.size} orders?`);
        if (!confirmed) return;

        setIsBulkProcessing(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const ids = Array.from(selectedOrderIds);
            
            // Execute updates in parallel with a small delay to avoid overwhelming the server if needed, 
            // but for now simple Promise.all or sequential is fine.
            await Promise.all(ids.map(async (id) => {
                const order = localOrders.find(o => o['Order ID'] === id);
                if (!order) return;

                return fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {}) 
                    },
                    body: JSON.stringify({ 
                        orderId: id, 
                        team: order.Team, 
                        userName: currentUser?.FullName || 'System', 
                        newData: { 
                            'Fulfillment Status': 'Shipped', 
                            'Dispatched Time': new Date().toLocaleString('km-KH'), 
                            'Dispatched By': currentUser?.FullName || 'Packer' 
                        } 
                    })
                });
            }));

            setSelectedOrderIds(new Set());
            refreshData();
        } catch (error) {
            console.error("Bulk ship failed", error);
            alert("Some orders failed to ship. Please try again.");
        } finally {
            setIsBulkProcessing(false);
        }
    };

    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            if (w < 768) setDeviceType('mobile');
            else if (w < 1024) setDeviceType('tablet');
            else setDeviceType('desktop');
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const allOrdersMapped = useMemo(() => {
        const rawData = propOrders || (Array.isArray((appData as any).orders) ? (appData as any).orders : []);
        return rawData
            .filter((o: any) => o && o['Order ID'] && o['Order ID'] !== 'Opening_Balance')
            .map((o: any) => ({ 
                ...o, 
                Products: Array.isArray(o.Products) ? o.Products : [], 
                FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending') as any
            })) as ParsedOrder[];
    }, [appData.orders, propOrders]);

    useEffect(() => { setLocalOrders(allOrdersMapped); }, [allOrdersMapped]);

    useEffect(() => {
        setMobilePageTitle(selectedStore ? `PACK: ${selectedStore}` : 'Packaging Hub');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    const availableStores = useMemo(() => appData.stores ? appData.stores.map((s: any) => s.StoreName) : [], [appData.stores]);
    
    const allFilteredOrders = useMemo(() => {
        if (!selectedStore) return [];
        let filtered = localOrders.filter(o => (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === selectedStore.trim().toLowerCase());
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(o => o['Order ID'].toLowerCase().includes(q) || (o['Customer Name'] || '').toLowerCase().includes(q));
        }
        return filtered;
    }, [localOrders, selectedStore, searchTerm]);

    const filteredOrders = useMemo(() => allFilteredOrders.filter(o => o.FulfillmentStatus === activeTab), [allFilteredOrders, activeTab]);

    const tabCounts = useMemo(() => ({
        pending: allFilteredOrders.filter(o => o.FulfillmentStatus === 'Pending').length,
        ready: allFilteredOrders.filter(o => o.FulfillmentStatus === 'Ready to Ship').length,
        shipped: allFilteredOrders.filter(o => o.FulfillmentStatus === 'Shipped').length
    }), [allFilteredOrders]);

    const executeAction = async (order: ParsedOrder, newStatus: string, extraData: any = {}) => {
        setLoadingActionId(order['Order ID']);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            
            // Clear local optimistic photo if we are resetting the photo URL
            if (extraData['Package Photo URL'] === '') {
                localStorage.removeItem(`package_photo_${order['Order ID']}`);
            }

            await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({ orderId: order['Order ID'], team: order.Team, userName: currentUser?.FullName || 'System', newData: { 'Fulfillment Status': newStatus, ...extraData } })
            });
            refreshData();
        } finally { setLoadingActionId(null); }
    };

    if (!selectedStore) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#0B0E11] font-sans relative overflow-hidden">
                {/* Background Decorative Elements */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-[#FCD535]/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#FCD535]/[0.02] rounded-full blur-[150px] translate-x-1/2 translate-y-1/2"></div>
                
                <div className="w-full max-w-md space-y-12 text-center relative z-10 animate-fade-in">
                    <div className="space-y-4">
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 rounded-[2rem] bg-[#FCD535]/10 border border-[#FCD535]/20 flex items-center justify-center shadow-[0_0_50px_rgba(252,213,53,0.1)]">
                                <svg className="w-10 h-10 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            </div>
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] drop-shadow-2xl">Packaging Hub</h2>
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-[1px] w-8 bg-white/10"></div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Initialize secure protocol</p>
                            <div className="h-[1px] w-8 bg-white/10"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {availableStores.map((store, idx) => (
                            <button 
                                key={store} 
                                onClick={() => setSelectedStore(store)} 
                                className="group relative overflow-hidden bg-white/[0.03] hover:bg-[#FCD535] border border-white/5 hover:border-[#FCD535] w-full p-8 flex justify-between items-center transition-all duration-500 rounded-2xl active:scale-[0.98] shadow-2xl"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="flex flex-col items-start gap-1 relative z-10">
                                    <span className="text-[10px] font-black text-gray-500 group-hover:text-black/40 uppercase tracking-widest transition-colors">Select Node</span>
                                    <span className="text-xl font-black text-white group-hover:text-black uppercase tracking-[0.1em] transition-colors">{store}</span>
                                </div>
                                <div className="relative z-10 w-12 h-12 rounded-xl bg-white/5 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                    <span className="text-[#FCD535] group-hover:text-black group-hover:translate-x-1 transition-all text-2xl">→</span>
                                </div>
                                
                                {/* Hover Decorative Element */}
                                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </button>
                        ))}
                        
                        {availableStores.length === 0 && (
                            <div className="p-12 rounded-2xl border border-dashed border-white/10 text-gray-600">
                                <p className="text-sm font-bold uppercase tracking-widest">No Active Nodes Found</p>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => setAppState('role_selection')}
                        className="text-[10px] font-black text-gray-600 hover:text-[#FCD535] uppercase tracking-[0.4em] transition-colors pt-8"
                    >
                        [ Terminate Session ]
                    </button>
                </div>
            </div>
        );
    }

    const hubProps = {
        orders: filteredOrders, activeTab, setActiveTab, searchTerm, setSearchTerm,
        onPack: (order: ParsedOrder) => setPackingOrder(order),
        onShip: (order: ParsedOrder) => executeAction(order, 'Shipped', { 'Dispatched Time': new Date().toLocaleString('km-KH'), 'Dispatched By': currentUser?.FullName || 'Packer' }),
        onUndo: (o: ParsedOrder) => executeAction(o, 'Pending', { 'Packed By': '', 'Packed Time': '', 'Package Photo URL': '' }),
        onUndoShipped: (o: ParsedOrder) => executeAction(o, 'Ready to Ship', { 'Dispatched Time': '', 'Dispatched By': '' }),
        onView: (order: ParsedOrder) => setViewingOrder(order),
        onPrintManifest: () => {
            const printWindow = window.open('', '_blank');
            if (!printWindow) return;
            
            const manifestOrders = filteredOrders;
            const html = `
                <html>
                    <head>
                        <title>Dispatch Manifest - ${selectedStore}</title>
                        <style>
                            body { font-family: sans-serif; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                            th { background-color: #f2f2f2; }
                            h1 { font-size: 18px; margin-bottom: 5px; }
                            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>Dispatch Manifest: ${selectedStore}</h1>
                            <p>Date: ${new Date().toLocaleString('km-KH')}</p>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Order ID</th>
                                    <th>Customer</th>
                                    <th>Phone</th>
                                    <th>Location</th>
                                    <th>Driver</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${manifestOrders.map((o, i) => `
                                    <tr>
                                        <td>${i + 1}</td>
                                        <td>${o['Order ID']}</td>
                                        <td>${o['Customer Name']}</td>
                                        <td>${o['Customer Phone']}</td>
                                        <td>${o.Location}</td>
                                        <td>${o['Driver Name'] || 'TBD'}</td>
                                        <td>$${(Number(o['Grand Total']) || 0).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <script>window.onload = () => { window.print(); window.close(); }</script>
                    </body>
                </html>
            `;
            printWindow.document.write(html);
            printWindow.document.close();
        },
        onSwitchHub: () => setSelectedStore(''),
        onExit: () => setAppState('role_selection'),
        selectedStore, tabCounts, viewMode, setViewMode, loadingActionId,
        selectedOrderIds, toggleOrderSelection: (id: string) => setSelectedOrderIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }),
        clearSelection: () => setSelectedOrderIds(new Set()),
        onToggleSelectAll,
        onBulkShip,
        isBulkProcessing,
        progressStats: { storeTotalToday: allFilteredOrders.length, progressPercentage: 0 }
    };

    return (
        <div className="fixed inset-0 z-[150] bg-[#0B0E11] overflow-hidden flex flex-col font-sans">
            {deviceType === 'mobile' && <MobilePackagingHub {...hubProps} />}
            {deviceType === 'tablet' && <TabletPackagingHub {...hubProps} />}
            {deviceType === 'desktop' && <DesktopPackagingHub {...hubProps} />}

            {packingOrder && (
                <FastPackTerminal 
                    order={packingOrder} onClose={() => setPackingOrder(null)} 
                    onSuccess={() => { refreshData(); setPackingOrder(null); setActiveTab('Ready to Ship'); }} 
                />
            )}
            
            {viewingOrder && (
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-4xl">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-8 space-y-6 animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center border-b border-[#2B3139] pb-4">
                            <h3 className="text-xl font-black text-[#EAECEF] uppercase tracking-tighter">Consignment Metadata</h3>
                            <span className="text-sm font-mono text-[#FCD535]">{viewingOrder['Order ID']}</span>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Column 1: Counterparty & Routing */}
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-1">Counterparty</p>
                                    <p className="text-sm font-bold text-[#EAECEF]">{viewingOrder['Customer Name']}</p>
                                    <p className="text-xs font-mono text-[#848E9C]">{viewingOrder['Customer Phone']}</p>
                                </div>
                                
                                <div>
                                    <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-1">Logistics Routing</p>
                                    <p className="text-xs text-[#EAECEF] leading-relaxed">{viewingOrder.Location}</p>
                                    <p className="text-[10px] text-[#848E9C] italic">{viewingOrder['Address Details']}</p>
                                    {viewingOrder.Note && (
                                        <div className="mt-3 p-3 bg-[#FCD535]/10 border border-[#FCD535]/30 rounded">
                                            <p className="text-[10px] font-bold text-[#FCD535] uppercase mb-1">Special Note</p>
                                            <p className="text-xs text-[#EAECEF]">{viewingOrder.Note}</p>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-2">Financial State</p>
                                    <div className="flex justify-between items-end mb-3">
                                        <div>
                                            <p className="text-[10px] text-[#848E9C]">Total Amount</p>
                                            <span className="font-mono text-lg font-bold text-[#FCD535]">${viewingOrder['Grand Total']?.toFixed(2) || '0.00'}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-[#848E9C] mb-1">Status</p>
                                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#EAECEF] bg-[#2B3139] px-2 py-1 rounded">{viewingOrder['Payment Status']}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-2 flex items-center space-x-3 bg-[#0B0E11] p-3 rounded border border-[#2B3139]">
                                        {appData.bankAccounts?.find((b: any) => b.BankName === viewingOrder['Payment Info'])?.LogoURL ? (
                                            <img src={convertGoogleDriveUrl(appData.bankAccounts.find((b: any) => b.BankName === viewingOrder['Payment Info'])?.LogoURL || '')} alt="Bank Logo" className="w-8 h-8 object-cover rounded bg-white p-0.5" />
                                        ) : (
                                            <div className="w-8 h-8 bg-[#2B3139] rounded flex items-center justify-center text-sm font-bold text-[#848E9C]">
                                                {viewingOrder['Payment Info'] === 'COD' || viewingOrder['Payment Status']?.includes('Unpaid') ? '💵' : '💳'}
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs font-bold text-[#EAECEF]">{viewingOrder['Payment Info'] || 'Unspecified'}</p>
                                            <p className="text-[10px] text-[#848E9C]">Payment Method</p>
                                        </div>
                                    </div>

                                    {(viewingOrder['Delivery Unpaid'] || 0) > 0 && (
                                        <div className="mt-3 text-center bg-red-500/10 border border-red-500/30 p-2 rounded relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-red-500/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                            <p className="text-xs text-red-400 font-bold tracking-wider uppercase">Collect Cash: ${viewingOrder['Delivery Unpaid']?.toFixed(2)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Column 2: Fulfillment & Media */}
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-1">Fulfillment Node</p>
                                    <p className="text-xs text-[#EAECEF]">{viewingOrder['Fulfillment Store'] || 'Unassigned'}</p>
                                    
                                    <div className="mt-3 flex items-center space-x-3 bg-[#0B0E11] p-3 rounded border border-[#2B3139]">
                                        {appData.shippingMethods?.find((m: any) => m.MethodName === viewingOrder['Internal Shipping Method'])?.LogoURL ? (
                                            <img src={convertGoogleDriveUrl(appData.shippingMethods.find((m: any) => m.MethodName === viewingOrder['Internal Shipping Method'])?.LogoURL || '')} alt="Shipping Logo" className="w-8 h-8 object-contain rounded bg-white p-1" />
                                        ) : (
                                            <div className="w-8 h-8 bg-[#2B3139] rounded flex items-center justify-center text-[10px] font-bold text-[#848E9C]">N/A</div>
                                        )}
                                        <div>
                                            <p className="text-xs font-bold text-[#EAECEF]">{viewingOrder['Internal Shipping Method'] || 'TBD'}</p>
                                            <p className="text-[10px] text-[#848E9C]">Delivery Service</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center space-x-3 bg-[#0B0E11] p-3 rounded border border-[#2B3139]">
                                        {appData.pages?.find((p: any) => p.PageName === viewingOrder.Page)?.PageLogoURL ? (
                                            <img src={convertGoogleDriveUrl(appData.pages.find((p: any) => p.PageName === viewingOrder.Page)?.PageLogoURL || '')} alt="Page Logo" className="w-8 h-8 object-cover rounded-full" />
                                        ) : (
                                            <div className="w-8 h-8 bg-[#2B3139] rounded-full flex items-center justify-center text-[10px] font-bold text-[#848E9C]">N/A</div>
                                        )}
                                        <div>
                                            <p className="text-xs font-bold text-[#EAECEF]">{viewingOrder.Page || 'Direct'}</p>
                                            <p className="text-[10px] text-[#848E9C]">Source Page</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-2">Package Integrity Evidence</p>
                                    {getOptimisticPackagePhoto(viewingOrder['Order ID'], viewingOrder['Package Photo URL']) ? (
                                        <a href={getOptimisticPackagePhoto(viewingOrder['Order ID'], viewingOrder['Package Photo URL'])} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded border border-[#2B3139]">
                                            <img src={getOptimisticPackagePhoto(viewingOrder['Order ID'], viewingOrder['Package Photo URL'])} alt="Package" className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105" />
                                            <div className="absolute inset-0 bg-[#0B0E11]/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                                                <span className="text-[11px] font-bold tracking-wider text-[#FCD535]">VIEW FULL RESOLUTION</span>
                                            </div>
                                        </a>
                                    ) : (
                                        <div className="w-full h-32 bg-[#0B0E11] border border-dashed border-[#2B3139] rounded flex items-center justify-center text-[#848E9C] text-xs font-mono">
                                            [NO IMAGE AVAILABLE]
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Column 3: Item Allocation & Timeline */}
                            <div className="space-y-6 flex flex-col h-full">
                                <div className="bg-[#0B0E11] p-4 border border-[#2B3139] flex-grow flex flex-col min-h-0">
                                    <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-3 flex justify-between items-center shrink-0">
                                        <span>Item Allocation</span>
                                        <span className="text-[#FCD535] bg-[#FCD535]/10 px-2 py-0.5 rounded">
                                            Total: {viewingOrder.Products?.reduce((acc, p) => acc + p.quantity, 0) || 0}
                                        </span>
                                    </p>
                                    <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-grow max-h-[220px]">
                                        {viewingOrder.Products?.map((p, i) => (
                                            <div key={i} className="flex space-x-3 items-center border-b border-[#2B3139]/30 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
                                                {p.image ? (
                                                    <img src={convertGoogleDriveUrl(p.image)} alt={p.name} className="w-12 h-12 rounded object-cover border border-[#2B3139] shrink-0" />
                                                ) : (
                                                    <div className="w-12 h-12 bg-[#1E2329] border border-[#2B3139] rounded flex items-center justify-center shrink-0">
                                                        <svg className="w-5 h-5 text-[#848E9C]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    </div>
                                                )}
                                                <div className="flex flex-col flex-grow min-w-0">
                                                    <span className="text-[11px] text-[#EAECEF] break-words line-clamp-2 leading-tight">{p.name}</span>
                                                    {p.colorInfo && <span className="text-[10px] text-[#848E9C] mt-1 opacity-80">[{p.colorInfo}]</span>}
                                                </div>
                                                <span className="text-[#FCD535] shrink-0 font-bold text-sm bg-[#2B3139] px-2 py-1 rounded">x{p.quantity}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-[#1E2329] border border-[#2B3139] p-3 text-[10px] text-[#848E9C] rounded shrink-0">
                                    <div className="flex justify-between mb-1 pb-1 border-b border-[#2B3139]/50">
                                        <span>Temporal Signature:</span>
                                        <span className="font-mono">{viewingOrder.Timestamp}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Team Assignment:</span>
                                        <span className="font-mono">{viewingOrder.Team}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end border-t border-[#2B3139]">
                            <button onClick={() => setViewingOrder(null)} className={bClasses.btnYellow}>Close Protocol</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PackagingView;
