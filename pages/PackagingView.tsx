import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import FastPackModal from '@/components/admin/FastPackModal';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { FilterState } from '@/components/orders/OrderFilters';
import Modal from '@/components/common/Modal';
import MobilePackagingHub from '@/components/admin/packaging/MobilePackagingHub';
import TabletPackagingHub from '@/components/admin/packaging/TabletPackagingHub';
import DesktopPackagingHub from '@/components/admin/packaging/DesktopPackagingHub';

const PackagingView: React.FC<{ orders?: ParsedOrder[] }> = ({ orders: propOrders }) => {
    const { appData, refreshData, currentUser, setMobilePageTitle, previewImage: showFullImage, appState, setAppState } = useContext(AppContext);
    
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'Pending' | 'Ready to Ship' | 'Shipped'>('Pending');
    const [packingOrder, setPackingOrder] = useState<ParsedOrder | null>(null);
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [localOrders, setLocalOrders] = useState<ParsedOrder[]>([]);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sessionStats, setSessionStats] = useState({ packed: 0, startTime: Date.now() });
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
        else setMobilePageTitle('ជ្រើសរើសឃ្លាំង');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    const availableStores = useMemo(() => appData.stores ? appData.stores.map((s: any) => s.StoreName) : [], [appData.stores]);
    
    const filteredOrders = useMemo(() => {
        if (!selectedStore) return [];
        const storeLower = selectedStore.trim().toLowerCase();
        let filtered = localOrders.filter(o => 
            (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === storeLower &&
            o.FulfillmentStatus === activeTab && 
            o.FulfillmentStatus !== 'Cancelled'
        );

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(order => 
                order['Order ID'].toLowerCase().includes(q) || 
                (order['Customer Name'] || '').toLowerCase().includes(q) || 
                (order['Customer Phone'] || '').includes(q)
            );
        }

        return filtered;
    }, [localOrders, selectedStore, activeTab, searchTerm]);

    const executeAction = async (order: ParsedOrder, newStatus: string, extraData: any = {}) => {
        const orderId = order['Order ID'];
        setLoadingActionId(orderId);
        try {
            const res = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, team: order.Team, userName: currentUser?.FullName || 'System', newData: { 'Fulfillment Status': newStatus, ...extraData } })
            });
            const result = await res.json();
            if (result.status === 'success') refreshData();
        } catch (err) { alert("ការបញ្ជូនបរាជ័យ!"); } finally { setLoadingActionId(null); }
    };

    if (!selectedStore) {
        return (
            <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-4 bg-black animate-fade-in overflow-hidden">
                {/* Spotify Style Background */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-black pointer-events-none"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]"></div>
                
                <div className="w-full max-w-md bg-[#121212] border border-white/5 rounded-[2.5rem] p-10 shadow-3xl text-center space-y-10 relative z-10 ring-1 ring-white/10">
                    <div className="space-y-4">
                        <div className="w-24 h-24 bg-[#1DB954] rounded-3xl mx-auto flex items-center justify-center border-4 border-black shadow-2xl shadow-[#1DB954]/20 transform -rotate-6 hover:rotate-0 transition-transform duration-500">
                            <span className="text-5xl">🏬</span>
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic">Packaging Hub</h2>
                        <p className="text-[11px] text-gray-500 font-black uppercase tracking-[0.4em]">Select Distribution Center</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                        {availableStores.map(store => (
                            <button 
                                key={store} 
                                onClick={() => setSelectedStore(store)} 
                                className="w-full py-5 px-8 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-between group"
                            >
                                <span className="group-hover:text-[#1DB954] transition-colors">{store}</span>
                                <svg className="w-6 h-6 transform group-hover:translate-x-2 transition-transform text-[#1DB954]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </button>
                        ))}
                    </div>

                    <div className="pt-6 border-t border-white/5">
                        <button 
                            onClick={() => setAppState('role_selection')}
                            className="text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-[0.3em] transition-colors flex items-center justify-center gap-3 mx-auto"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeWidth={3}/></svg>
                            Back to Role Selection
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
        onView: (order: ParsedOrder) => setViewingOrder(order),
        onSwitchHub: () => setSelectedStore(''),
        onExit: () => setAppState('role_selection'),
        selectedStore,
        sessionStats,
        viewMode,
        setViewMode,
        setIsFilterModalOpen,
        loadingActionId
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black overflow-hidden flex flex-col">
            {deviceType === 'mobile' && <MobilePackagingHub {...hubProps} />}
            {deviceType === 'tablet' && <TabletPackagingHub {...hubProps} />}
            {deviceType === 'desktop' && <DesktopPackagingHub {...hubProps} />}

            {packingOrder && (
                <FastPackModal 
                    order={packingOrder} 
                    onClose={() => setPackingOrder(null)} 
                    onSuccess={(tempUrl) => { 
                        const orderId = packingOrder['Order ID'];
                        setLocalOrders(prev => prev.map(o => 
                            o['Order ID'] === orderId 
                                ? { 
                                    ...o, 
                                    FulfillmentStatus: 'Ready to Ship' as any,
                                    'Package Photo URL': tempUrl || o['Package Photo URL']
                                  } 
                                : o
                        ));
                        setPackingOrder(null); 
                        setActiveTab('Ready to Ship'); 
                        setSessionStats(prev => ({ ...prev, packed: prev.packed + 1 }));
                        refreshData(); 
                    }} 
                />
            )}
            
            {viewingOrder && (
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-4xl">
                    <div className="p-8 sm:p-12 bg-[#121212] rounded-[3rem] border border-white/10 shadow-3xl flex flex-col max-h-[90vh] relative overflow-hidden text-white">
                        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                        <div className="flex justify-between items-start mb-10 relative z-10">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center border border-white/10 text-white shadow-2xl"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /></svg></div>
                                <div><h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Order Detail</h3><p className="text-[#1DB954] font-mono text-sm font-bold mt-1 tracking-widest uppercase">#{viewingOrder['Order ID']}</p></div>
                            </div>
                            <button onClick={() => setViewingOrder(null)} className="w-12 h-12 rounded-2xl bg-white/5 text-gray-500 hover:text-white flex items-center justify-center transition-all hover:bg-red-600/20 hover:text-red-400 border border-white/5 active:scale-90 shadow-xl"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar pr-4 space-y-10 relative z-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6">Customer Info</p>
                                    <div className="space-y-4">
                                        <p className="text-white font-black text-2xl tracking-tight">{viewingOrder['Customer Name']}</p>
                                        <p className="text-[#1DB954] font-mono font-black text-xl">{viewingOrder['Customer Phone']}</p>
                                        <div className="h-px bg-white/5 my-4"></div>
                                        <p className="text-gray-400 text-sm leading-relaxed">{viewingOrder.Location}</p>
                                        <p className="text-gray-500 text-xs italic">{viewingOrder['Address Details']}</p>
                                    </div>
                                </div>
                                <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">Logistics</p>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Team</span><span className="text-white font-black text-sm">{viewingOrder.Team}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Page</span><span className="text-white font-black text-xs">{viewingOrder.Page}</span></div>
                                        <div className="flex justify-between items-center pt-4 border-t border-white/5"><span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Total Valuation</span><span className="text-[#1DB954] font-black text-xl font-mono">${(Number(viewingOrder['Grand Total']) || 0).toFixed(2)}</span></div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div className="flex items-center gap-4"><div className="h-px flex-grow bg-white/5"></div><span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Products Manifest</span><div className="h-px flex-grow bg-white/5"></div></div>
                                <div className="grid grid-cols-1 gap-4">
                                    {viewingOrder.Products.map((p, i) => (
                                        <div key={i} className="flex items-center gap-5 bg-white/5 p-4 rounded-3xl border border-white/5 hover:bg-white/10 transition-colors group shadow-lg">
                                            <img src={convertGoogleDriveUrl(p.image)} className="w-16 h-16 rounded-2xl object-cover border border-white/10 group-hover:scale-105 transition-transform shadow-2xl" alt="" />
                                            <div className="flex-grow min-w-0">
                                                <p className="text-white font-black text-sm truncate uppercase tracking-tight">{p.name}</p>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <p className="text-[#1DB954] font-black text-xs uppercase tracking-widest">Quantity: {p.quantity}</p>
                                                    <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                                                        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Unit Price:</p>
                                                        <p className="text-white font-mono font-black text-xs">${(Number(p.finalPrice) || 0).toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-10 pt-8 border-t border-white/5 flex justify-end relative z-10"><button onClick={() => setViewingOrder(null)} className="px-12 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl border border-white/5 active:scale-95">Close View</button></div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PackagingView;
