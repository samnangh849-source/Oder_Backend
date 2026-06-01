import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import { CacheService, CACHE_KEYS } from '@/services/cacheService';
import FastPackTerminal from '@/components/admin/packaging/fastpack/FastPackTerminal';
import { convertGoogleDriveUrl, getOptimisticPackagePhoto, fileToDataUrl } from '@/utils/fileUtils';
import { compressImage } from '@/utils/imageCompressor';
import Modal from '@/components/common/Modal';
import MobilePackagingHub from '@/components/admin/packaging/MobilePackagingHub';
import TabletPackagingHub from '@/components/admin/packaging/TabletPackagingHub';
import DesktopPackagingHub from '@/components/admin/packaging/DesktopPackagingHub';
import OrderDetailModal from '@/components/orders/OrderDetailModal';
import { Shift } from '@/types';

const bClasses = {
    surface: 'bg-[#1E2329] border border-[#2B3139]',
    surfaceHover: 'hover:bg-[#2B3139] transition-colors duration-200',
    btnYellow: 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-[#0B0E11] font-bold rounded-[4px] px-4 py-2 transition-all active:scale-[0.98]',
};

const PackagingView: React.FC<{ orders?: ParsedOrder[], onExit?: () => void }> = ({ orders: propOrders, onExit }) => {
    // 1. Context & States
    const { appData, refreshData, currentUser, setMobilePageTitle, appState, setAppState, setIsShiftOpener, setActiveShiftStore, logout } = useContext(AppContext);

    const [selectedStore, setSelectedStore] = useState<string>('');
    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [shiftStep, setShiftStep] = useState<'options' | 'login' | 'photo' | 'closing'>('options');
    const [shiftLogin, setShiftLogin] = useState({ username: '', password: '' });
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const [isShiftLoading, setIsShiftLoading] = useState(false);

    const [activeTab, setActiveTab] = useState<'Pending' | 'Ready to Ship' | 'Shipped' | 'Returned' | 'Cancelled'>('Pending');
    const [packingOrder, setPackingOrder] = useState<ParsedOrder | null>(null);
    const [returningOrder, setReturningOrder] = useState<ParsedOrder | null>(null);
    const [isReturnPhotoModalOpen, setIsReturnPhotoModalOpen] = useState(false);
    const [returnPhoto, setReturnPhoto] = useState<string | null>(null);
    const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [shippingFilter, setShippingFilter] = useState<string>('');
    const [teamFilter, setTeamFilter] = useState<string>('');
    const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [undoTarget, setUndoConfirmation] = useState<{ order: ParsedOrder, type: 'pending' | 'ready', isOpen: boolean } | null>(null);
    const [undoPassword, setUndoPassword] = useState('');
    const [isUndoVerifying, setIsUndoVerifying] = useState(false);
    
    // Close Shift Modal State
    const [isCloseShiftConfirmOpen, setIsCloseShiftConfirmOpen] = useState(false);
    const [closeShiftStats, setCloseShiftStats] = useState<{ packed: number, shipped: number, shippingCounts: Record<string, number>, summaryText: string } | null>(null);

    // 2. Memos
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

    const availableStores = useMemo(() => appData.stores ? appData.stores.map((s: any) => s.StoreName) : [], [appData.stores]);
    
    const availableTeams = useMemo(() => {
        const teams = new Set<string>();
        if (Array.isArray(appData.pages)) {
            appData.pages.forEach((p: any) => {
                if (p.Team) teams.add(p.Team);
            });
        }
        // Fallback: also check orders in case pages are not yet loaded or configured
        allOrdersMapped.forEach(o => {
            if (o.Team) teams.add(o.Team);
        });
        return Array.from(teams).sort();
    }, [appData.pages, allOrdersMapped]);

    const allFilteredOrdersBase = useMemo(() => {
        if (!selectedStore) return [];
        let filtered = allOrdersMapped.filter(o => (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === selectedStore.trim().toLowerCase());
        
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter(o => 
                o['Order ID'].toLowerCase().includes(q) || 
                (o['Customer Name'] || '').toLowerCase().includes(q) ||
                (o['Internal Shipping Method'] || '').toLowerCase().includes(q)
            );
        }

        if (teamFilter) {
            filtered = filtered.filter(o => o.Team === teamFilter);
        }

        return filtered;
    }, [allOrdersMapped, selectedStore, searchTerm, teamFilter]);

    const allFilteredOrders = useMemo(() => {
        if (!shippingFilter) return allFilteredOrdersBase;
        return allFilteredOrdersBase.filter(o => o['Internal Shipping Method'] === shippingFilter);
    }, [allFilteredOrdersBase, shippingFilter]);

    const filteredOrdersForCounts = useMemo(() => {
        return allFilteredOrdersBase.filter(o => {
            const fs = o.FulfillmentStatus;
            const isPacked = !!(o['Packed By'] || o['Packed Time']);
            const isUnpacked = !!o['Return Received By'];
            if (activeTab === 'Cancelled') return fs === 'Cancelled' && isUnpacked;
            if (fs === activeTab) return true;
            if (fs === 'Cancelled' && !isUnpacked) {
                if (activeTab === 'Pending' && !isPacked) return true;
                if (activeTab === 'Ready to Ship' && isPacked) return true;
            }
            return false;
        });
    }, [allFilteredOrdersBase, activeTab]);

    const filteredOrders = useMemo(() => {
        if (!shippingFilter) return filteredOrdersForCounts;
        return filteredOrdersForCounts.filter(o => o['Internal Shipping Method'] === shippingFilter);
    }, [filteredOrdersForCounts, shippingFilter]);

    const tabCounts = useMemo(() => {
        const counts = { pending: 0, ready: 0, shipped: 0, returned: 0, cancelled: 0 };
        allFilteredOrdersBase.forEach(o => {
            const fs = o.FulfillmentStatus;
            const isPacked = !!(o['Packed By'] || o['Packed Time']);
            const isUnpacked = !!o['Return Received By'];

            if (fs === 'Pending') counts.pending++;
            else if (fs === 'Ready to Ship') counts.ready++;
            else if (fs === 'Shipped') counts.shipped++;
            else if (fs === 'Returned') counts.returned++;
            else if (fs === 'Cancelled') {
                if (isUnpacked) {
                    counts.cancelled++;
                } else {
                    if (!isPacked) counts.pending++;
                    else counts.ready++;
                }
            }
        });
        return counts;
    }, [allFilteredOrdersBase]);

    const progressStats = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('km-KH');
        const packedByUserToday = allFilteredOrdersBase.filter(o => {
            const isPackedByMe = (o['Packed By'] || '') === (currentUser?.FullName || '');
            const isToday = (o['Packed Time'] || '').startsWith(todayStr.split(',')[0]);
            return isPackedByMe && isToday &&
                (o.FulfillmentStatus === 'Ready to Ship' || o.FulfillmentStatus === 'Shipped');
        }).length;
        const storeTotalToday = allFilteredOrdersBase.length;
        const progressPercentage = storeTotalToday > 0
            ? Math.round((packedByUserToday / storeTotalToday) * 100)
            : 0;
        return { packedByUserToday, storeTotalToday, progressPercentage };
    }, [allFilteredOrdersBase, currentUser]);

    const shippingCounts = useMemo(() => {
        const counts: { [key: string]: number } = { 'all': filteredOrdersForCounts.length };
        filteredOrdersForCounts.forEach(o => {
            const method = o['Internal Shipping Method'] || 'Unassigned';
            counts[method] = (counts[method] || 0) + 1;
        });
        return counts;
    }, [filteredOrdersForCounts]);

    // 3. Effects
    useEffect(() => {
        const openedBy = (activeShift?.OpenedBy || '').trim().toLowerCase();
        const me = (currentUser?.FullName || '').trim().toLowerCase();
        const isOpener = !!activeShift && openedBy === me;

        setIsShiftOpener(isOpener);
        if (isOpener && activeShift?.StoreName) {
            setActiveShiftStore(activeShift.StoreName);
        } else if (!isOpener) {
            setActiveShiftStore('');
        }
    }, [activeShift, setIsShiftOpener, setActiveShiftStore, currentUser?.FullName]);

    useEffect(() => {
        const checkActiveShift = async (store: string) => {
            setIsShiftLoading(true);
            try {
                const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
                const token = session?.token || '';
                const res = await fetch(`${WEB_APP_URL}/api/admin/shifts/active/${encodeURIComponent(store)}`, {
                    headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
                });
                const data = await res.json();
                if (data.status === 'success') {
                    setActiveShift(data.shift);
                    const openedBy = (data.shift.OpenedBy || '').trim().toLowerCase();
                    const me = (currentUser?.FullName || '').trim().toLowerCase();
                    setIsViewOnly(openedBy !== me);
                } else {
                    setActiveShift(null);
                    setIsViewOnly(false);
                    setIsShiftModalOpen(true);
                    setShiftStep('options');
                }
            } catch (error) {
                console.error("Failed to check active shift", error);
            } finally {
                setIsShiftLoading(false);
            }
        };

        if (selectedStore) {
            checkActiveShift(selectedStore);
        } else {
            setActiveShift(null);
            setIsViewOnly(false);
            setIsShiftModalOpen(false);
        }
    }, [selectedStore, currentUser?.FullName]);

    useEffect(() => {
        const title = selectedStore ? `PACK: ${selectedStore}` : 'Packaging Hub';
        setMobilePageTitle(title);
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

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

    // 4. Helper Functions (Callables)
    const handleOpenShift = async () => {
        setIsShiftLoading(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const res = await fetch(`${WEB_APP_URL}/api/admin/shifts/open`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    userName: shiftLogin.username,
                    password: shiftLogin.password,
                    storeName: selectedStore,
                    photo: capturedPhoto || ""
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setActiveShift(data.shift);
                setIsViewOnly(false);
                setIsShiftModalOpen(false);
                setShiftStep('options');
                setActiveTab('Pending');
                setSearchTerm('');
                setShippingFilter('');
                alert("បើកវេនជោគជ័យ!");
            } else {
                alert(data.message || "មិនអាចបើកវេនបានទេ");
            }
        } catch (error) {
            alert("មានបញ្ហាពេលបើកវេន");
        } finally {
            setIsShiftLoading(false);
        }
    };

    const handleCloseShift = async () => {
        if (!activeShift) return;
        const todayStr = new Date().toLocaleDateString('km-KH').split(',')[0];
        
        const myPackedOrders = allFilteredOrdersBase.filter(o => {
            const isMe = o['Packed By'] === currentUser?.FullName;
            const isToday = (o['Packed Time'] || '').startsWith(todayStr);
            return isMe && isToday && (o.FulfillmentStatus === 'Ready to Ship' || o.FulfillmentStatus === 'Shipped');
        });

        const shippedOrders = myPackedOrders.filter(o => o.FulfillmentStatus === 'Shipped');
        
        const shippingCounts: Record<string, number> = {};
        myPackedOrders.forEach(o => {
            const method = o['Internal Shipping Method'] || 'ផ្សេងៗ (Other)';
            shippingCounts[method] = (shippingCounts[method] || 0) + 1;
        });

        const lines = Object.entries(shippingCounts).map(([method, count]) => `• ${method}: *${count}*`);
        const summary = `📦 វេចខ្ចប់សរុប៖ *${myPackedOrders.length}* កញ្ចប់\n🚚 បញ្ជូនចេញរួច៖ *${shippedOrders.length}* កញ្ចប់\n\n📋 *តាមក្រុមហ៊ុនដឹកជញ្ជូន៖*\n${lines.join('\n')}`;

        setCloseShiftStats({
            packed: myPackedOrders.length,
            shipped: shippedOrders.length,
            shippingCounts,
            summaryText: summary
        });
        setIsCloseShiftConfirmOpen(true);
    };

    const confirmCloseShift = async () => {
        if (!activeShift || !closeShiftStats) return;
        setIsShiftLoading(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const res = await fetch(`${WEB_APP_URL}/api/admin/shifts/close`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    shiftId: activeShift.ID,
                    summary: closeShiftStats.summaryText
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setActiveShift(null);
                setSelectedStore('');
                setIsShiftModalOpen(false);
                setIsCloseShiftConfirmOpen(false);
                alert("បិទវេនជោគជ័យ!");
                logout(); // Immediately trigger a complete logout
            } else {
                alert(data.message || "មិនអាចបិទវេនបានទេ");
            }
        } catch (error) {
            alert("មានបញ្ហាពេលបិទវេន");
        } finally {
            setIsShiftLoading(false);
        }
    };

    const handleUndoConfirm = async () => {
        if (!undoTarget || !activeShift) return;
        if (!undoPassword) {
            alert("សូមបញ្ចូលលេខសម្ងាត់");
            return;
        }
        setIsUndoVerifying(true);
        try {
            const shiftOwner = appData.users?.find(u => u.FullName === activeShift.OpenedBy);
            const verifyUsername = shiftOwner?.UserName || activeShift.OpenedBy;
            const res = await fetch(`${WEB_APP_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userName: verifyUsername, password: undoPassword })
            });
            const data = await res.json();
            if (data.status === 'success') {
                const { order, type } = undoTarget;
                if (type === 'pending') {
                    await executeAction(order, 'Pending', { 'Packed By': '', 'Packed Time': '', 'Package Photo': '' });
                } else {
                    await executeAction(order, 'Ready to Ship', { 'Dispatched Time': '', 'Dispatched By': '' });
                }
                setUndoConfirmation(null);
                setUndoPassword('');
            } else {
                alert("លេខសម្ងាត់មិនត្រឹមត្រូវ! មិនអាច Undo បានទេ។");
            }
        } catch (error) {
            console.error("Undo verification error:", error);
            alert("មានបញ្ហាពេលផ្ទៀងផ្ទាត់លេខសម្ងាត់");
        } finally {
            setIsUndoVerifying(false);
        }
    };

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
            await Promise.all(ids.map(async (id) => {
                const order = allOrdersMapped.find(o => o['Order ID'] === id);
                if (!order) return;
                return fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {}) 
                    },
                    body: JSON.stringify({ 
                        orderId: id, team: order.Team, userName: currentUser?.FullName || 'System', 
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

    const executeAction = async (order: ParsedOrder, newStatus: string, extraData: any = {}) => {
        setLoadingActionId(order['Order ID']);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            if (extraData['Package Photo'] === '') {
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

    const handleConfirmReturnReceipt = async (photo: string) => {
        if (!returningOrder) return;
        setIsSubmittingReturn(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const res = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({ 
                    orderId: returningOrder['Order ID'], team: returningOrder.Team, userName: currentUser?.FullName || 'System', 
                    newData: { 
                        'Fulfillment Status': 'Returned', 'Return Photo': photo,
                        'Return Received By': currentUser?.FullName || 'Staff',
                        'Return Received Time': new Date().toISOString().slice(0, 19).replace('T', ' ')
                    } 
                })
            });
            const data = await res.json();
            if (data.status === 'success') {
                setIsReturnPhotoModalOpen(false);
                setReturningOrder(null);
                setReturnPhoto(null);
                refreshData();
                alert("បានបញ្ជាក់ការទទួលឥវ៉ាន់ Return រួចរាល់!");
            } else { alert(data.message || "មិនអាចបញ្ជាក់បានទេ"); }
        } catch (error) { alert("មានបញ្ហាពេលបញ្ជាក់ការទទួល"); } finally { setIsSubmittingReturn(false); }
    };

    // 5. Early Return for Store Selection
    if (!selectedStore) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#0B0E11] font-sans relative overflow-hidden">
                <div className="absolute top-0 left-0 p-6 z-50">
                    <button 
                        onClick={() => {
                            if (onExit) onExit();
                            else setAppState('role_selection');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all active:scale-[0.98] group"
                    >
                        <svg className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="text-sm font-bold uppercase tracking-wider">Back</span>
                    </button>
                </div>
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
                                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </button>
                        ))}
                        {availableStores.length === 0 && (
                            <div className="p-12 rounded-2xl border border-dashed border-white/10 text-gray-600">
                                <p className="text-sm font-bold uppercase tracking-widest">No Active Nodes Found</p>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] pt-8">Authorized Access Only</p>
                </div>
            </div>
        );
    }

    // 6. Hub Props & Main Render
    const hubProps = {
        orders: filteredOrders, 
        shippingCounts,
        activeTab, 
        setActiveTab: (tab: any) => {
            setActiveTab(tab);
            if (tab === 'Pending') {
                setSearchTerm('');
                setShippingFilter('');
            }
        }, 
        searchTerm, 
        setSearchTerm,
        onPack: (order: ParsedOrder) => !isViewOnly && setPackingOrder(order),
        onShip: (order: ParsedOrder) => !isViewOnly && executeAction(order, 'Shipped', { 'Dispatched Time': new Date().toISOString().slice(0, 19).replace('T', ' '), 'Dispatched By': currentUser?.FullName || 'Packer' }),
        onDeliver: (order: ParsedOrder) => {
            if (isViewOnly) return;
            const extra: any = { 'Delivered Time': new Date().toISOString().slice(0, 19).replace('T', ' ') };
            if (!order['Driver Name'] && !order['Internal Shipping Details']) {
                extra['Internal Shipping Details'] = order['Internal Shipping Method'] || 'Hub Operation';
            }
            executeAction(order, 'Delivered', extra);
        },
        onUndo: (o: ParsedOrder) => !isViewOnly && setUndoConfirmation({ order: o, type: 'pending', isOpen: true }),
        onUndoShipped: (o: ParsedOrder) => !isViewOnly && setUndoConfirmation({ order: o, type: 'ready', isOpen: true }),
        onUnpack: (order: ParsedOrder, skipConfirm = false) => {
            if (isViewOnly) return;
            if (skipConfirm || window.confirm("តើអ្នកប្រាកដថាបានហែកកញ្ចប់ និងទុកឥវ៉ាន់ចូលស្តុកវិញរួចរាល់ហើយមែនទេ?")) {
                executeAction(order, 'Cancelled', { 
                    'Return Received By': currentUser?.FullName || 'Staff',
                    'Return Received Time': new Date().toISOString().slice(0, 19).replace('T', ' '),
                    'Packed By': '', 'Packed Time': '', 'Package Photo': ''
                });
            }
        },
        onView: (order: ParsedOrder) => setViewingOrder(order),
        onConfirmReturn: (order: ParsedOrder) => {
            if (isViewOnly) return;
            setReturningOrder(order);
            setIsReturnPhotoModalOpen(true);
        },
        onPrintManifest: () => {
            const printWindow = window.open('', '_blank');
            if (!printWindow) return;
            const manifestOrders = filteredOrders;
            const html = `<html><head><title>Dispatch Manifest - ${selectedStore}</title><style>body { font-family: sans-serif; padding: 20px; } table { width: 100%; border-collapse: collapse; margin-top: 20px; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; } th { background-color: #f2f2f2; } h1 { font-size: 18px; margin-bottom: 5px; } .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; }</style></head><body><div class="header"><h1>Dispatch Manifest: ${selectedStore}</h1><p>Date: ${new Date().toLocaleString('km-KH')}</p></div><table><thead><tr><th>#</th><th>Order ID</th><th>Customer</th><th>Phone</th><th>Location</th><th>Driver</th><th>Total</th></tr></thead><tbody>${manifestOrders.map((o, i) => `<tr><td>${i + 1}</td><td>${o['Order ID']}</td><td>${o['Customer Name']}</td><td>${o['Customer Phone']}</td><td>${o.Location}</td><td>${o['Driver Name'] || 'TBD'}</td><td>$${(Number(o['Grand Total']) || 0).toFixed(2)}</td></tr>`).join('')}</tbody></table><script>window.onload = () => { window.print(); window.close(); }</script></body></html>`;
            printWindow.document.write(html);
            printWindow.document.close();
        },
        onSwitchHub: () => setSelectedStore(''),
        onExit: () => {
            if (onExit) onExit();
            else setAppState('role_selection');
        },
        onCloseShift: handleCloseShift,
        shippingFilter, setShippingFilter, teamFilter, setTeamFilter,
        selectedStore, tabCounts, viewMode, setViewMode, loadingActionId: isShiftLoading ? 'shift-loading' : loadingActionId,
        selectedOrderIds, toggleOrderSelection: (id: string) => !isViewOnly && setSelectedOrderIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }),
        clearSelection: () => setSelectedOrderIds(new Set()),
        onToggleSelectAll: (orders: ParsedOrder[]) => !isViewOnly && onToggleSelectAll(orders),
        onBulkShip: () => !isViewOnly && onBulkShip(),
        isBulkProcessing, progressStats, isFilterModalOpen, setIsFilterModalOpen, isViewOnly, activeShift
    };

    return (
        <div className="fixed inset-0 z-[150] bg-[#0B0E11] overflow-hidden flex flex-col font-sans">
            {deviceType === 'mobile' && <MobilePackagingHub {...hubProps} />}
            {deviceType === 'tablet' && <TabletPackagingHub {...hubProps} />}
            {deviceType === 'desktop' && <DesktopPackagingHub {...hubProps} />}

            {isShiftModalOpen && (
                <Modal isOpen={true} onClose={() => setSelectedStore('')} maxWidth="max-w-md">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-8 space-y-8 rounded-2xl animate-in fade-in zoom-in duration-300">
                        {shiftStep === 'options' && (
                            <div className="space-y-6 text-center">
                                <div className="w-20 h-20 bg-[#FCD535]/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6"><svg className="w-10 h-10 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-wider">{selectedStore}</h3>
                                <p className="text-gray-400 text-sm">សូមជ្រើសរើសជម្រើសខាងក្រោម៖</p>
                                <div className="grid grid-cols-1 gap-4 pt-4">
                                    <button onClick={() => { setIsViewOnly(true); setIsShiftModalOpen(false); }} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/10">👀 ចូលមើល (View Only)</button>
                                    <button onClick={() => setShiftStep('login')} className="w-full py-4 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black font-bold rounded-xl transition-all shadow-xl shadow-[#FCD535]/10">🔑 បើកវេន (Open Shift)</button>
                                </div>
                            </div>
                        )}
                        {shiftStep === 'login' && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h3 className="text-xl font-black text-white uppercase tracking-wider">បញ្ជាក់អត្តសញ្ញាណ</h3>
                                    <p className="text-gray-400 text-xs mt-2 uppercase tracking-widest">Verify credentials to open shift</p>
                                </div>
                                <div className="space-y-4">
                                    <input type="text" placeholder="Username" value={shiftLogin.username} onChange={e => setShiftLogin({...shiftLogin, username: e.target.value})} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-xl px-5 py-4 text-white focus:border-[#FCD535] outline-none transition-all font-mono" />
                                    <input type="password" placeholder="Password" value={shiftLogin.password} onChange={e => setShiftLogin({...shiftLogin, password: e.target.value})} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-xl px-5 py-4 text-white focus:border-[#FCD535] outline-none transition-all font-mono" />
                                    <div className="flex gap-3 pt-4">
                                        <button onClick={() => setShiftStep('options')} className="flex-1 py-4 bg-white/5 text-gray-400 font-bold rounded-xl hover:bg-white/10 transition-all">ថយក្រោយ</button>
                                        <button onClick={() => { if (shiftLogin.username && shiftLogin.password) handleOpenShift(); else alert("សូមបញ្ចូល Username និង Password"); }} disabled={isShiftLoading} className="flex-grow py-4 bg-[#FCD535] text-black font-bold rounded-xl hover:bg-[#FCD535]/90 transition-all shadow-lg flex items-center justify-center">{isShiftLoading ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div><span>កំពុងបើកវេន...</span></div> : 'បើកវេន'}</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {undoTarget && undoTarget.isOpen && (
                <Modal isOpen={true} onClose={() => { setUndoConfirmation(null); setUndoPassword(''); }} maxWidth="max-w-md">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-8 space-y-8 rounded-2xl animate-in fade-in zoom-in duration-300">
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto"><svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                            <h3 className="text-xl font-black text-white uppercase tracking-wider">បញ្ជាក់ការ Undo</h3>
                            <p className="text-gray-400 text-sm">សូមបញ្ចូលលេខសម្ងាត់របស់ <span className="text-[#FCD535] font-bold">@{activeShift?.OpenedBy}</span> ដើម្បីបន្ត។</p>
                        </div>
                        <div className="space-y-4">
                            <input type="password" placeholder="លេខសម្ងាត់ (Shift Password)" value={undoPassword} onChange={e => setUndoPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUndoConfirm()} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-xl px-5 py-4 text-white focus:border-[#FCD535] outline-none transition-all font-mono" autoFocus />
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => { setUndoConfirmation(null); setUndoPassword(''); }} className="flex-1 py-4 bg-white/5 text-gray-400 font-bold rounded-xl hover:bg-white/10 transition-all">បោះបង់</button>
                                <button onClick={handleUndoConfirm} disabled={isUndoVerifying} className="flex-grow py-4 bg-[#FCD535] text-black font-bold rounded-xl hover:bg-[#FCD535]/90 transition-all shadow-lg flex items-center justify-center">{isUndoVerifying ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div><span>កំពុងផ្ទៀងផ្ទាត់...</span></div> : 'បញ្ជាក់ Undo'}</button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {packingOrder && (
                <FastPackTerminal 
                    order={packingOrder} onClose={() => setPackingOrder(null)} 
                    onSuccess={() => { refreshData(); setPackingOrder(null); setActiveTab('Ready to Ship'); }} 
                />
            )}
            
            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}

            {isReturnPhotoModalOpen && returningOrder && (
                <Modal isOpen={true} onClose={() => { setIsReturnPhotoModalOpen(false); setReturningOrder(null); setReturnPhoto(null); }} maxWidth="max-w-xl">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 space-y-6 rounded-2xl">
                        <div className="text-center space-y-2"><h3 className="text-xl font-black text-white uppercase tracking-wider">បញ្ជាក់ការទទួល Return</h3><p className="text-gray-400 text-xs">សូមថតរូបកញ្ចប់ឥវ៉ាន់ដែលបាន Return មកវិញ</p></div>
                        <div className="aspect-square bg-black rounded-xl overflow-hidden relative border border-white/10">
                            {returnPhoto ? <img src={returnPhoto} className="w-full h-full object-cover" alt="Return Proof" /> : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center"><svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div>
                                    <input type="file" accept="image/*" capture="environment" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const compressed = await compressImage(file, 'balanced'); const dataUrl = await fileToDataUrl(compressed); setReturnPhoto(dataUrl); } }} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <p className="text-sm font-bold text-white">ចុចទីនេះដើម្បីថតរូប</p>
                                </div>
                            )}
                            {returnPhoto && <button onClick={() => setReturnPhoto(null)} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => { setIsReturnPhotoModalOpen(false); setReturningOrder(null); setReturnPhoto(null); }} className="flex-1 py-4 bg-white/5 text-gray-400 font-bold rounded-xl hover:bg-white/10 transition-all">បោះបង់</button>
                            <button onClick={() => handleConfirmReturnReceipt(returnPhoto || '')} disabled={!returnPhoto || isSubmittingReturn} className="flex-[2] py-4 bg-purple-500 text-white font-bold rounded-xl hover:bg-purple-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">{isSubmittingReturn ? <Spinner size="sm" /> : <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>បញ្ជាក់ការទទួល</>}</button>
                        </div>
                    </div>
                </Modal>
            )}

            {isFilterModalOpen && (
                <Modal isOpen={true} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-lg">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 space-y-6 rounded-2xl">
                        <div className="flex justify-between items-center border-b border-[#2B3139] pb-4">
                            <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <svg className="w-5 h-5 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                                OPS FILTERS
                            </h3>
                            <button onClick={() => setIsFilterModalOpen(false)} className="text-[#848E9C] hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Team Selection */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Select Team</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                    <button 
                                        onClick={() => setTeamFilter('')}
                                        className={`py-3 rounded-xl text-xs font-bold uppercase transition-all border ${!teamFilter ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50'}`}
                                    >
                                        All Teams
                                    </button>
                                    {availableTeams.map(team => (
                                        <button 
                                            key={team}
                                            onClick={() => setTeamFilter(team)}
                                            className={`py-3 rounded-xl text-xs font-bold uppercase transition-all border ${teamFilter === team ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50'}`}
                                        >
                                            Team {team}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Carrier Selection */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Shipping Carrier</p>
                                <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                                    <button 
                                        onClick={() => setShippingFilter('')}
                                        className={`px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all border ${!shippingFilter ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50'}`}
                                    >
                                        All Carriers
                                    </button>
                                    {appData.shippingMethods?.filter((m: any) => m.Status !== 'Inactive').map((method: any) => (
                                        <button
                                            key={method.MethodName}
                                            onClick={() => setShippingFilter(method.MethodName)}
                                            className={`px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all border flex items-center gap-2 ${shippingFilter === method.MethodName ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50'}`}
                                        >
                                            {method.LogoURL && <img src={convertGoogleDriveUrl(method.LogoURL)} alt="" className="w-4 h-4 object-contain" />}
                                            <span className="truncate">{method.MethodName}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Quick Actions</p>
                                <button 
                                    onClick={() => {
                                        setSearchTerm('');
                                        setShippingFilter('');
                                        setTeamFilter('');
                                        setIsFilterModalOpen(false);
                                    }}
                                    className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Reset All Filters
                                </button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={() => setIsFilterModalOpen(false)}
                                className="w-full py-4 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-[#FCD535]/10 transition-all active:scale-[0.98]"
                            >
                                Apply Configuration
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Close Shift Confirmation Modal */}
            {isCloseShiftConfirmOpen && closeShiftStats && (
                <Modal isOpen={true} onClose={() => setIsCloseShiftConfirmOpen(false)} maxWidth="max-w-md">
                    <div className="bg-[#181A20] rounded-xl border border-[#2B3139] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="flex-shrink-0 p-5 border-b border-[#2B3139] bg-[#0B0E11] flex items-center justify-between sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                                    <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-[#EAECEF] uppercase tracking-wider">បិទវេន (Close Shift)</h3>
                                    <p className="text-[11px] text-[#848E9C] font-bold mt-0.5">ផ្ទៀងផ្ទាត់ទិន្នន័យវេចខ្ចប់</p>
                                </div>
                            </div>
                            <button onClick={() => setIsCloseShiftConfirmOpen(false)} className="p-2 text-[#848E9C] hover:text-[#EAECEF] bg-[#2B3139]/50 hover:bg-[#2B3139] rounded-lg transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 bg-gradient-to-b from-[#0B0E11] to-[#181A20]">
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[#2B3139]/30 border border-[#2B3139] rounded-xl p-4 flex flex-col items-center text-center shadow-inner">
                                    <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest mb-2">វេចខ្ចប់សរុប (Packed)</span>
                                    <span className="text-4xl font-mono font-black text-[#FCD535]">{closeShiftStats.packed}</span>
                                </div>
                                <div className="bg-[#2B3139]/30 border border-[#2B3139] rounded-xl p-4 flex flex-col items-center text-center shadow-inner">
                                    <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest mb-2">បញ្ជូនចេញ (Shipped)</span>
                                    <span className="text-4xl font-mono font-black text-[#0ECB81]">{closeShiftStats.shipped}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-[#EAECEF] uppercase tracking-wider border-b border-[#2B3139] pb-2 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                    តាមក្រុមហ៊ុនដឹកជញ្ជូន (By Carrier)
                                </h4>
                                <div className="bg-[#0B0E11] border border-[#2B3139] rounded-xl overflow-hidden shadow-inner">
                                    {Object.keys(closeShiftStats.shippingCounts).length > 0 ? (
                                        <div className="divide-y divide-[#2B3139]">
                                            {Object.entries(closeShiftStats.shippingCounts).map(([method, count]) => (
                                                <div key={method} className="flex justify-between items-center p-3 hover:bg-[#2B3139]/50 transition-colors">
                                                    <span className="text-sm font-bold text-[#EAECEF] uppercase">{method}</span>
                                                    <span className="text-sm font-mono font-black text-[#FCD535] bg-[#FCD535]/10 px-3 py-1 rounded-lg border border-[#FCD535]/20">{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-sm text-[#848E9C] italic">គ្មានទិន្នន័យ (No Data)</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex-shrink-0 p-5 bg-[#0B0E11] border-t border-[#2B3139] flex gap-3 sticky bottom-0 z-10">
                            <button 
                                onClick={() => setIsCloseShiftConfirmOpen(false)}
                                className="flex-1 py-3.5 bg-[#2B3139] hover:bg-[#3B424A] text-[#EAECEF] font-black text-xs uppercase tracking-widest rounded-xl transition-all"
                            >
                                បោះបង់ (Cancel)
                            </button>
                            <button 
                                onClick={confirmCloseShift}
                                disabled={isShiftLoading}
                                className="flex-[1.5] py-3.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-70 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                {isShiftLoading ? (
                                    <>
                                        <Spinner size="sm" /> កំពុងដំណើរការ...
                                    </>
                                ) : (
                                    'បញ្ជាក់ការបិទវេន'
                                )}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PackagingView;
