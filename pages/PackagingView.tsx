import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import FastPackTerminal from '@/components/admin/packaging/fastpack/FastPackTerminal';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { FilterState } from '@/components/orders/OrderFilters';
import OrderFilters from '@/components/orders/OrderFilters';
import Modal from '@/components/common/Modal';
import MobilePackagingHub from '@/components/admin/packaging/MobilePackagingHub';
import TabletPackagingHub from '@/components/admin/packaging/TabletPackagingHub';
import DesktopPackagingHub from '@/components/admin/packaging/DesktopPackagingHub';
import DeliveryListGeneratorModal from '@/components/orders/DeliveryListGeneratorModal';

interface DeliveryListGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: ParsedOrder[];
    appData: any;
    initialStore?: string;
    initialShipping?: string;
    ignoreDateFilter?: boolean;
}

// --- Binance Theme Constants ---
const B_BG_MAIN = 'bg-[#0B0E11]';
const B_BG_PANEL = 'bg-[#181A20]';
const B_BG_HOVER = 'hover:bg-[#2B3139]';
const B_BORDER = 'border-[#2B3139]';
const B_TEXT_PRIMARY = 'text-[#EAECEF]';
const B_TEXT_SECONDARY = 'text-[#848E9C]';
const B_ACCENT = 'text-[#FCD535]';

const PackagingView: React.FC<{ orders?: ParsedOrder[] }> = ({ orders: propOrders }) => {
    const { appData, refreshData, currentUser, setMobilePageTitle, previewImage: showFullImage, appState, setAppState } = useContext(AppContext);
    
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'Pending' | 'Ready to Ship' | 'Shipped'>('Pending');
    const [packingOrder, setPackingOrder] = useState<ParsedOrder | null>(null);
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [localOrders, setLocalOrders] = useState<ParsedOrder[]>([]);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<FilterState>({
        datePreset: 'all', startDate: '', endDate: '', team: '', user: '',
        paymentStatus: '', shippingService: '', driver: '', product: '',
        bank: '', fulfillmentStore: '', store: '', page: '', location: '',
        internalCost: '', customerName: '',
    });

    const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 768) setDeviceType('mobile');
            else if (width < 1024) setDeviceType('tablet');
            else setDeviceType('desktop');
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const allOrdersMapped = useMemo(() => {
        const rawData = propOrders || (Array.isArray((appData as any).orders) ? (appData as any).orders : []);
        if (!rawData || rawData.length === 0) return [];
        return rawData
            .filter((o: any) => o && o['Order ID'] && o['Order ID'] !== 'Opening_Balance')
            .map((o: any) => {
                let products = o.Products || [];
                if (typeof o['Products (JSON)'] === 'string' && products.length === 0) {
                    try { products = JSON.parse(o['Products (JSON)']); } catch(e) {}
                }
                let team = (o.Team || '').trim();
                if (!team) {
                    const userMatch = appData.users?.find(u => u.UserName === o.User);
                    if (userMatch?.Team) team = userMatch.Team.split(',')[0].trim();
                }
                return { 
                    ...o, 
                    Products: Array.isArray(products) ? products : [], 
                    Team: team || 'A',
                    IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A',
                    FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending') as any
                };
            }) as ParsedOrder[];
    }, [appData.orders, propOrders, appData.users]);

    useEffect(() => { setLocalOrders(allOrdersMapped); }, [allOrdersMapped]);

    useEffect(() => {
        if (selectedStore) setMobilePageTitle(`HUB: ${selectedStore}`);
        else setMobilePageTitle('Select Warehouse');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    const availableStores = useMemo(() => appData.stores ? appData.stores.map((s: any) => s.StoreName) : [], [appData.stores]);
    
    const allFilteredOrders = useMemo(() => {
        if (!selectedStore) return [];
        const storeLower = selectedStore.trim().toLowerCase();
        let filtered = localOrders.filter(o => 
            (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === storeLower &&
            o.FulfillmentStatus !== 'Cancelled'
        );

        if (filters.team) filtered = filtered.filter(o => o.Team === filters.team);
        if (filters.paymentStatus) filtered = filtered.filter(o => o['Payment Status'] === filters.paymentStatus);
        if (filters.shippingService) filtered = filtered.filter(o => o['Internal Shipping Method'] === filters.shippingService);
        if (filters.driver) filtered = filtered.filter(o => (o['Driver Name'] || o['Internal Shipping Details']) === filters.driver);
        if (filters.location) filtered = filtered.filter(o => o.Location === filters.location);
        if (filters.page) filtered = filtered.filter(o => o.Page === filters.page);
        if (filters.bank) filtered = filtered.filter(o => o['Payment Info'] === filters.bank);

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(order => 
                order['Order ID'].toLowerCase().includes(q) || 
                (order['Customer Name'] || '').toLowerCase().includes(q) || 
                (order['Customer Phone'] || '').includes(q)
            );
        }

        return filtered;
    }, [localOrders, selectedStore, searchTerm, filters]);

    const filteredOrders = useMemo(() => allFilteredOrders.filter(o => o.FulfillmentStatus === activeTab), [allFilteredOrders, activeTab]);

    const tabCounts = useMemo(() => ({
        pending: allFilteredOrders.filter(o => o.FulfillmentStatus === 'Pending').length,
        ready: allFilteredOrders.filter(o => o.FulfillmentStatus === 'Ready to Ship').length,
        shipped: allFilteredOrders.filter(o => o.FulfillmentStatus === 'Shipped').length
    }), [allFilteredOrders]);

    const progressStats = useMemo(() => {
        let packedByUserToday = 0;
        let storeTotalToday = 0;
        let storePackedToday = 0;

        const getSafeDateObj = (dateStr: string) => {
            if (!dateStr) return new Date();
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? new Date() : d;
        };

        const today = new Date();

        localOrders.forEach(o => {
            if (selectedStore && (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === selectedStore.trim().toLowerCase()) {
                const isPendingOrShipped = o.FulfillmentStatus === 'Pending' || o.FulfillmentStatus === 'Ready to Ship' || o.FulfillmentStatus === 'Shipped';
                if (isPendingOrShipped) {
                    storeTotalToday++;
                    if (o.FulfillmentStatus === 'Ready to Ship' || o.FulfillmentStatus === 'Shipped') storePackedToday++;
                }
            }
            if (o['Packed By'] === currentUser?.FullName || o['Packed By'] === currentUser?.UserName || o['Packed By'] === 'Packer') {
                const packDate = getSafeDateObj(o['Packed Time'] || o.Timestamp); 
                if (packDate.getDate() === today.getDate() && packDate.getMonth() === today.getMonth() && packDate.getFullYear() === today.getFullYear()) {
                    packedByUserToday++;
                }
            }
        });

        const progressPercentage = storeTotalToday > 0 ? Math.round((storePackedToday / storeTotalToday) * 100) : 0;
        return { packedByUserToday, storeTotalToday, progressPercentage };
    }, [localOrders, selectedStore, currentUser]);

    const executeAction = async (order: ParsedOrder, newStatus: string, extraData: any = {}, onSuccess?: () => void) => {
        const orderId = order['Order ID'];
        setLoadingActionId(orderId);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';

            const res = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ 
                    orderId, 
                    team: order.Team, 
                    userName: currentUser?.FullName || 'System', 
                    newData: { 'Fulfillment Status': newStatus, ...extraData } 
                })
            });
            const result = await res.json();
            if (result.status === 'success') {
                if (onSuccess) onSuccess();
                refreshData();
            } else {
                alert("Action Failed: " + (result.message || "Unknown error"));
            }
        } catch (err: any) { 
            console.error("Action Error:", err);
            alert("Action Failed: " + err.message); 
        } finally { 
            setLoadingActionId(null); 
        }
    };

    const handleBulkShip = async () => {
        if (selectedOrderIds.size === 0) return;
        if (!window.confirm(`Are you sure you want to ship ${selectedOrderIds.size} orders?`)) return;
        
        setIsBulkProcessing(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const ids = Array.from(selectedOrderIds);
            const dispatchTime = new Date().toLocaleString('km-KH');
            const dispatcher = currentUser?.FullName || 'Packer';

            const promises = ids.map(async (id) => {
                const order = localOrders.find(o => o['Order ID'] === id);
                if (!order) return null;

                const res = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ 
                        orderId: id, 
                        team: order.Team, 
                        userName: dispatcher, 
                        newData: { 
                            'Fulfillment Status': 'Shipped',
                            'Dispatched Time': dispatchTime,
                            'Dispatched By': dispatcher
                        } 
                    })
                });
                return res.ok;
            });

            const results = await Promise.all(promises);
            const successCount = results.filter(r => r).length;
            
            if (successCount > 0) refreshData();
            setSelectedOrderIds(new Set());
            
            if (successCount < ids.length) {
                alert(`Partial Success: ${successCount}/${ids.length} orders shipped.`);
            }
        } catch (err: any) {
            alert("Bulk Ship Failed: " + err.message);
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const toggleOrderSelection = (id: string) => {
        setSelectedOrderIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearSelection = () => setSelectedOrderIds(new Set());

    const handleUndoReadyToShip = async (order: ParsedOrder) => {
        if (!window.confirm("Do you want to move this order back to Pending Pack?")) return;
        await executeAction(order, 'Pending', { 
            'Packed By': '', 
            'Packed Time': '', 
            'Package Photo URL': '' 
        }, () => {
            setActiveTab('Pending');
        });
    };

    const toggleSelectAll = (ordersToSelect: ParsedOrder[]) => {
        const allIds = ordersToSelect.map(o => o['Order ID']);
        const allSelected = allIds.length > 0 && allIds.every(id => selectedOrderIds.has(id));
        
        setSelectedOrderIds(prev => {
            const next = new Set(prev);
            if (allSelected) {
                allIds.forEach(id => next.delete(id));
            } else {
                allIds.forEach(id => next.add(id));
            }
            return next;
        });
    };

    if (!selectedStore) {
        return (
            <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center p-4 ${B_BG_MAIN} animate-fade-in font-sans`}>
                <div className={`w-full max-w-sm ${B_BG_PANEL} border ${B_BORDER} p-8 flex flex-col shadow-2xl`}>
                    <div className="text-center mb-8">
                        <svg className={`w-12 h-12 mx-auto mb-4 ${B_ACCENT}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        <h2 className={`text-xl font-medium ${B_TEXT_PRIMARY}`}>Packaging Terminal</h2>
                        <p className={`text-xs ${B_TEXT_SECONDARY} mt-1`}>Select Operation Center</p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        {availableStores.map(store => (
                            <button 
                                key={store} 
                                onClick={() => setSelectedStore(store)} 
                                className={`w-full py-3 px-4 ${B_BG_MAIN} border ${B_BORDER} ${B_BG_HOVER} text-left text-sm font-medium ${B_TEXT_PRIMARY} flex justify-between items-center transition-colors`}
                            >
                                <span>{store}</span>
                                <span className={B_ACCENT}>&rarr;</span>
                            </button>
                        ))}
                    </div>

                    <div className="pt-6 mt-6 border-t border-[#2B3139]">
                        <button 
                            onClick={() => setAppState('role_selection')}
                            className={`w-full text-xs font-medium ${B_TEXT_SECONDARY} hover:${B_TEXT_PRIMARY} transition-colors flex items-center justify-center gap-2`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeWidth={2}/></svg>
                            Back to Module Select
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const hubProps = {
        orders: filteredOrders,
        activeTab,
        setActiveTab,
        searchTerm,
        setSearchTerm,
        onPack: (order: ParsedOrder) => setPackingOrder(order),
        onShip: (order: ParsedOrder) => executeAction(order, 'Shipped', { 'Dispatched Time': new Date().toLocaleString('km-KH'), 'Dispatched By': currentUser?.FullName || 'Packer' }),
        onUndo: handleUndoReadyToShip,
        onView: (order: ParsedOrder) => setViewingOrder(order),
        onPrintManifest: () => setIsManifestModalOpen(true),
        onSwitchHub: () => setSelectedStore(''),
        onExit: () => setAppState('role_selection'),
        selectedStore,
        progressStats,
        tabCounts,
        viewMode,
        setViewMode,
        setIsFilterModalOpen,
        loadingActionId,
        selectedOrderIds,
        toggleOrderSelection,
        clearSelection,
        onBulkShip: handleBulkShip,
        isBulkProcessing,
        onToggleSelectAll: toggleSelectAll
    };

    return (
        <div className={`fixed inset-0 z-[150] ${B_BG_MAIN} overflow-hidden flex flex-col font-sans`}>
            {deviceType === 'mobile' && <MobilePackagingHub {...hubProps} />}
            {deviceType === 'tablet' && <TabletPackagingHub {...hubProps} />}
            {deviceType === 'desktop' && <DesktopPackagingHub {...hubProps} />}

            {packingOrder && (
                <FastPackTerminal 
                    order={packingOrder} 
                    onClose={() => setPackingOrder(null)} 
                    onSuccess={(tempUrl) => { 
                        const orderId = packingOrder['Order ID'];
                        setLocalOrders(prev => prev.map(o => 
                            o['Order ID'] === orderId 
                                ? { ...o, FulfillmentStatus: 'Ready to Ship' as any, 'Package Photo URL': tempUrl || o['Package Photo URL'] } 
                                : o
                        ));
                        setPackingOrder(null); 
                        setActiveTab('Ready to Ship'); 
                        refreshData(); 
                    }} 
                />
            )}
            
            {viewingOrder && (() => {
                const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === viewingOrder['Internal Shipping Method']);
                const driver = appData.drivers?.find(d => d.DriverName === (viewingOrder['Driver Name'] || viewingOrder['Internal Shipping Details']));
                const bank = appData.bankAccounts?.find(b => b.BankName === viewingOrder['Payment Info']);

                const getTelecomBadge = (phone: string) => {
                    if (!phone) return null;
                    const cleanPhone = phone.replace(/\D/g, '');
                    let prefix = cleanPhone.substring(0, 3);
                    if (cleanPhone.startsWith('855')) prefix = '0' + cleanPhone.substring(3, 5);

                    const smart = ['010','015','016','069','070','081','086','087','093','096','098'];
                    const cellcard = ['011','012','014','017','076','077','078','085','089','092','095','099'];
                    const metfone = ['031','060','066','067','068','071','088','090','097'];

                    if (smart.includes(prefix)) return <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-[2px] bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/20 text-[8px] font-black uppercase tracking-wider relative -top-0.5`}>SMART</span>;
                    if (cellcard.includes(prefix)) return <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-[2px] bg-[#F28C28]/10 text-[#F28C28] border border-[#F28C28]/20 text-[8px] font-black uppercase tracking-wider relative -top-0.5`}>CELLCARD</span>;
                    if (metfone.includes(prefix)) return <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-[2px] bg-[#E50914]/10 text-[#E50914] border border-[#E50914]/20 text-[8px] font-black uppercase tracking-wider relative -top-0.5`}>METFONE</span>;
                    return null;
                };

                return (
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-3xl">
                    <div className={`${B_BG_PANEL} border ${B_BORDER} flex flex-col max-h-[90vh]`}>
                        <div className={`p-4 border-b ${B_BORDER} flex justify-between items-center`}>
                            <h3 className={`text-base font-medium ${B_TEXT_PRIMARY}`}>Order Protocol <span className={`${B_TEXT_SECONDARY} ml-2 font-mono text-xs`}>#{viewingOrder['Order ID']}</span></h3>
                            <button onClick={() => setViewingOrder(null)} className={`${B_TEXT_SECONDARY} hover:text-white transition-colors`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="p-5 flex-grow overflow-y-auto custom-scrollbar space-y-6">
                            
                            <div className="flex flex-wrap gap-3">
                                <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-widest border rounded-sm ${viewingOrder['Fulfillment Status'] === 'Ready to Ship' ? 'bg-[#F28C28]/10 text-[#F28C28] border-[#F28C28]/30' : viewingOrder['Fulfillment Status'] === 'Shipped' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/30' : 'bg-[#2B3139] text-gray-300 border-gray-600'}`}>
                                    STATUS: {viewingOrder['Fulfillment Status']}
                                </span>
                                <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-widest border rounded-sm ${viewingOrder['Payment Status'] === 'Paid' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/30' : 'bg-[#FCD535]/10 text-[#FCD535] border-[#FCD535]/30'}`}>
                                    PAYMENT: {viewingOrder['Payment Status']}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className={`p-4 ${B_BG_MAIN} border ${B_BORDER}`}>
                                        <p className={`text-[10px] uppercase font-bold ${B_TEXT_SECONDARY} mb-3`}>Customer Node</p>
                                        <p className={`text-sm font-medium ${B_TEXT_PRIMARY} mb-1`}>{viewingOrder['Customer Name']}</p>
                                        <div className="flex items-center gap-2 mb-4">
                                            <p className={`font-mono text-[11px] ${B_ACCENT}`}>{viewingOrder['Customer Phone']}</p>
                                            {getTelecomBadge(viewingOrder['Customer Phone'] || '')}
                                        </div>
                                        <div className={`h-px bg-[#2B3139] my-2`}></div>
                                        <p className={`text-[11px] ${B_TEXT_SECONDARY} mt-2 leading-relaxed whitespace-pre-wrap`}>Location: {viewingOrder.Location}</p>
                                        <p className={`text-[10px] ${B_TEXT_SECONDARY} italic mt-1 whitespace-pre-wrap`}>Address: {viewingOrder['Address Details']}</p>
                                        {viewingOrder.Note && (
                                            <div className="mt-4 p-3 bg-[#E50914]/10 border border-[#E50914]/30 rounded-sm">
                                                <p className="text-[9px] font-bold text-[#E50914] uppercase tracking-widest mb-1">Warning / Note</p>
                                                <p className="text-xs text-[#E50914] leading-relaxed italic">"{viewingOrder.Note}"</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`p-4 ${B_BG_MAIN} border ${B_BORDER}`}>
                                        <p className={`text-[10px] uppercase font-bold ${B_TEXT_SECONDARY} mb-3`}>Systems & Personnel Data</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className={`text-[9px] ${B_TEXT_SECONDARY} uppercase`}>Origin Mode</p>
                                                <p className={`text-[10px] ${B_TEXT_PRIMARY}`}>{viewingOrder.Page} / {viewingOrder.Team}</p>
                                            </div>
                                            <div>
                                                <p className={`text-[9px] ${B_TEXT_SECONDARY} uppercase`}>Order Dropped By</p>
                                                <p className={`text-[10px] font-bold text-[#FCD535]`}>{viewingOrder.User || 'Unknown'}</p>
                                            </div>
                                            {viewingOrder['Packed By'] && (
                                                <div className="col-span-2 pt-2 border-t border-[#2B3139] mt-1 flex justify-between">
                                                    <div>
                                                        <p className={`text-[9px] ${B_TEXT_SECONDARY} uppercase`}>Packed By</p>
                                                        <p className={`text-[10px] flex items-center gap-1 font-bold text-[#0ECB81]`}>
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            {viewingOrder['Packed By']}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[9px] ${B_TEXT_SECONDARY} uppercase`}>Packed Time</p>
                                                        <p className={`text-[10px] font-mono ${B_TEXT_PRIMARY}`}>{viewingOrder['Packed Time']}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {(viewingOrder['Dispatched By'] || viewingOrder['Shipped By']) && (
                                                <div className="col-span-2 pt-2 border-t border-[#2B3139] mt-1 flex justify-between">
                                                    <div>
                                                        <p className={`text-[9px] ${B_TEXT_SECONDARY} uppercase`}>Dispatched To Driver By</p>
                                                        <p className={`text-[10px] flex items-center gap-1 font-bold text-[#F28C28]`}>
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            {viewingOrder['Dispatched By'] || viewingOrder['Shipped By']}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-[9px] ${B_TEXT_SECONDARY} uppercase`}>Dispatch Time</p>
                                                        <p className={`text-[10px] font-mono ${B_TEXT_PRIMARY}`}>{viewingOrder['Dispatched Time'] || viewingOrder['Shipped Time']}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className={`p-4 ${B_BG_MAIN} border ${B_BORDER}`}>
                                    <p className={`text-[10px] uppercase font-bold ${B_TEXT_SECONDARY} mb-3`}>Logistics & Financials</p>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center"><span className={`text-[10px] ${B_TEXT_SECONDARY} font-bold uppercase`}>Method</span>
                                            <div className="flex items-center gap-2">
                                                {shippingMethod && <img src={convertGoogleDriveUrl(shippingMethod.LogoURL)} className="w-4 h-4 object-contain" alt="" />}
                                                <span className={`text-[11px] font-bold ${B_TEXT_PRIMARY}`}>{viewingOrder['Internal Shipping Method'] || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center"><span className={`text-[10px] ${B_TEXT_SECONDARY} font-bold uppercase`}>Driver</span>
                                            <div className="flex items-center gap-2">
                                                {driver && <img src={convertGoogleDriveUrl(driver.ImageURL)} className="w-4 h-4 object-cover rounded-sm border border-[#2B3139]" alt="" />}
                                                <span className={`text-[11px] uppercase ${B_TEXT_PRIMARY}`}>{viewingOrder['Driver Name'] || viewingOrder['Internal Shipping Details'] || 'N/A'}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center"><span className={`text-[10px] ${B_TEXT_SECONDARY} font-bold uppercase`}>Pay Method</span>
                                            <div className="flex items-center gap-2">
                                                {bank && <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-4 h-4 object-contain" alt="" />}
                                                <span className={`text-[11px] uppercase ${B_TEXT_PRIMARY}`}>{viewingOrder['Payment Info'] || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`h-px bg-[#2B3139] my-4`}></div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center"><span className={`text-[10px] ${B_TEXT_SECONDARY} font-bold uppercase`}>Subtotal</span><span className={`text-[11px] font-mono text-gray-400`}>${(Number(viewingOrder.Subtotal) || 0).toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center"><span className={`text-[10px] ${B_TEXT_SECONDARY} font-bold uppercase`}>Shipping</span><span className={`text-[11px] font-mono text-gray-400`}>${(Number(viewingOrder['Shipping Fee (Customer)']) || 0).toFixed(2)}</span></div>
                                        {Number(viewingOrder.Discount) > 0 && (
                                            <div className="flex justify-between items-center"><span className={`text-[10px] ${B_TEXT_SECONDARY} font-bold uppercase`}>Discount</span><span className={`text-[11px] font-mono text-[#0ECB81]`}>-${(Number(viewingOrder.Discount) || 0).toFixed(2)}</span></div>
                                        )}
                                        <div className={`flex justify-between items-center pt-3 mt-3 border-t ${B_BORDER}`}><span className={`text-[10px] ${B_TEXT_SECONDARY} font-bold uppercase tracking-widest`}>Total Pay</span><span className="text-[#0ECB81] font-bold font-mono text-base">${(Number(viewingOrder['Grand Total']) || 0).toFixed(2)}</span></div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 className={`text-[10px] ${B_TEXT_SECONDARY} uppercase tracking-wider font-bold mb-3`}>Products Matrix</h4>
                                <div className="space-y-2">
                                    {viewingOrder.Products.map((p, i) => (
                                        <div key={i} className={`flex items-center gap-4 ${B_BG_MAIN} p-3 border ${B_BORDER} ${B_BG_HOVER} transition-colors cursor-pointer`} onClick={() => showFullImage(convertGoogleDriveUrl(p.image))}>
                                            <img src={convertGoogleDriveUrl(p.image)} className={`w-10 h-10 object-cover border ${B_BORDER}`} alt="" />
                                            <div className="flex-grow min-w-0 flex items-center justify-between">
                                                <p className={`text-xs ${B_TEXT_PRIMARY} truncate uppercase`}>{p.name}</p>
                                                <div className="flex items-center gap-4 ml-4">
                                                    <p className={`text-[10px] ${B_TEXT_SECONDARY}`}>Qty: <span className={B_TEXT_PRIMARY}>{p.quantity}</span></p>
                                                    <p className={`text-[10px] ${B_TEXT_SECONDARY}`}>Unit: <span className={`font-mono ${B_TEXT_PRIMARY}`}>${(Number(p.finalPrice) || 0).toFixed(2)}</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {viewingOrder['Package Photo URL'] && (
                                <div className="mt-6 pt-6 border-t border-[#2B3139]">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className={`text-[10px] ${B_TEXT_SECONDARY} uppercase tracking-wider font-bold`}>Package Verification</h4>
                                        <span className="px-2 py-0.5 bg-[#0ECB81]/10 text-[#0ECB81] text-[9px] uppercase font-bold tracking-widest border border-[#0ECB81]/30 rounded-[2px] animate-pulse">SYS_SECURE_CAPTURE</span>
                                    </div>
                                    <div className={`p-4 ${B_BG_MAIN} border ${B_BORDER} flex justify-center`}>
                                        <img 
                                            src={convertGoogleDriveUrl(viewingOrder['Package Photo URL'])} 
                                            className="max-h-[300px] object-contain rounded-sm shadow-[0_0_15px_rgba(14,203,129,0.15)] cursor-pointer hover:opacity-90 transition-opacity" 
                                            onClick={() => showFullImage(convertGoogleDriveUrl(viewingOrder['Package Photo URL']))} 
                                            alt="Package Verification Proof" 
                                        />
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </Modal>
                );
            })()}

            {isFilterModalOpen && (
                <Modal isOpen={true} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-4xl">
                    <div className={`${B_BG_PANEL} border ${B_BORDER} flex flex-col h-[85vh]`}>
                        <div className={`p-4 border-b ${B_BORDER} flex justify-between items-center`}>
                            <h3 className={`text-base font-medium ${B_TEXT_PRIMARY}`}>Operational Filters</h3>
                            <button onClick={() => setIsFilterModalOpen(false)} className={`${B_TEXT_SECONDARY} hover:text-white`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className={`flex-grow p-4 min-h-0 bg-[#0B0E11]`}>
                            <OrderFilters filters={filters} setFilters={setFilters} orders={localOrders} usersList={appData.users || []} appData={appData} calculatedRange="Analysis Timeframe" />
                        </div>
                        <div className={`p-4 border-t ${B_BORDER} flex justify-end gap-3`}>
                            <button onClick={() => setIsFilterModalOpen(false)} className={`px-6 py-2 bg-[#2B3139] hover:bg-[#3B424A] ${B_TEXT_PRIMARY} text-xs font-medium rounded-sm transition-colors`}>Execute Filters</button>
                        </div>
                    </div>
                </Modal>
            )}
            {isManifestModalOpen && (
                <DeliveryListGeneratorModal
                    isOpen={true}
                    onClose={() => setIsManifestModalOpen(false)}
                    orders={localOrders.filter(o => o.FulfillmentStatus === 'Ready to Ship' && (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === selectedStore.trim().toLowerCase())}
                    appData={appData}
                    initialStore={selectedStore}
                    ignoreDateFilter={true}
                />
            )}
        </div>
    );
};

export default PackagingView;
