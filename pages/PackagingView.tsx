import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import FastPackTerminal from '@/components/admin/packaging/fastpack/FastPackTerminal';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
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
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#0B0E11] font-sans">
                <div className="w-full max-w-sm space-y-8 text-center">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-[#EAECEF] uppercase tracking-tighter">Packaging Terminal</h2>
                        <p className="text-xs text-[#848E9C]">Initialize secure packaging protocol.</p>
                    </div>
                    <div className="space-y-2">
                        {availableStores.map(store => (
                            <button key={store} onClick={() => setSelectedStore(store)} className={`${bClasses.surface} ${bClasses.surfaceHover} w-full p-5 flex justify-between items-center group transition-all`}>
                                <span className="text-sm font-bold text-[#EAECEF] uppercase tracking-widest">{store}</span>
                                <span className="text-[#FCD535] group-hover:translate-x-1 transition-transform">→</span>
                            </button>
                        ))}
                    </div>
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
        onSwitchHub: () => setSelectedStore(''),
        onExit: () => setAppState('role_selection'),
        selectedStore, tabCounts, viewMode, setViewMode, loadingActionId,
        selectedOrderIds, toggleOrderSelection: (id: string) => setSelectedOrderIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }),
        clearSelection: () => setSelectedOrderIds(new Set()),
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
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-2xl">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-8 space-y-6 animate-in zoom-in duration-200">
                        <h3 className="text-xl font-black text-[#EAECEF] uppercase tracking-tighter border-b border-[#2B3139] pb-4">Consignment Metadata</h3>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-1">Counterparty</p>
                                    <p className="text-sm font-bold text-[#EAECEF]">{viewingOrder['Customer Name']}</p>
                                    <p className="text-xs font-mono text-[#848E9C]">{viewingOrder['Customer Phone']}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-1">Logistics Destination</p>
                                    <p className="text-xs text-[#EAECEF] leading-relaxed">{viewingOrder.Location}</p>
                                    <p className="text-[10px] text-[#848E9C] italic">{viewingOrder['Address Details']}</p>
                                </div>
                            </div>
                            <div className="bg-[#0B0E11] p-4 border border-[#2B3139]">
                                <p className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest mb-2">Item Allocation</p>
                                <div className="space-y-2 overflow-y-auto max-h-[200px] b-scroll pr-2">
                                    {viewingOrder.Products.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center text-[11px] font-mono border-b border-[#2B3139]/30 pb-1">
                                            <span className="text-[#EAECEF] truncate pr-2">{p.name}</span>
                                            <span className="text-[#FCD535] shrink-0">x{p.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end">
                            <button onClick={() => setViewingOrder(null)} className={bClasses.btnYellow}>Close Protocol</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PackagingView;
