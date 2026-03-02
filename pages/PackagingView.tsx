import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import FastPackModal from '@/components/admin/FastPackModal';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import OrderFilters, { FilterState } from '@/components/orders/OrderFilters';
import { FilterPanel } from '@/components/orders/FilterPanel';
import Modal from '@/components/common/Modal';

const PackagingView: React.FC<{ orders?: ParsedOrder[] }> = ({ orders: propOrders }) => {
    const { appData, refreshData, currentUser, setMobilePageTitle, previewImage: showFullImage } = useContext(AppContext);
    
    // Derived raw list with Team enrichment to ensure UNDO and updates work
    const allOrders = useMemo(() => {
        const rawData = propOrders || (Array.isArray((appData as any).orders) ? (appData as any).orders : []);
        
        return rawData
            .filter((o: any) => o !== null && o['Order ID'] !== 'Opening_Balance')
            .map((o: any) => {
                let products = o.Products || [];
                if (typeof o['Products (JSON)'] === 'string' && products.length === 0) {
                    try { products = JSON.parse(o['Products (JSON)']); } catch(e) {}
                }

                // Robust Team Enrichment
                let team = (o.Team || '').trim();
                if (!team) {
                    const userMatch = appData.users?.find(u => u.UserName === o.User);
                    if (userMatch?.Team) team = userMatch.Team.split(',')[0].trim();
                    else {
                        const pageMatch = appData.pages?.find(p => p.PageName === o.Page);
                        if (pageMatch?.Team) team = pageMatch.Team;
                    }
                }

                return { 
                    ...o, 
                    Products: products, 
                    Team: team || 'A', // Fallback to avoid API error 400
                    IsVerified: String(o.IsVerified).toUpperCase() === 'TRUE' || o.IsVerified === 'A',
                    FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending') as any
                };
            }) as ParsedOrder[];
    }, [appData, propOrders]);

    const [selectedStore, setSelectedStore] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'Pending' | 'Ready to Ship' | 'Shipped'>('Pending');
    const [packingOrder, setPackingOrder] = useState<ParsedOrder | null>(null);
    const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    
    // Comprehensive Filters
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<FilterState>({
        datePreset: 'all',
        startDate: '',
        endDate: '',
        team: '',
        user: '',
        paymentStatus: '',
        shippingService: '',
        driver: '',
        product: '',
        bank: '',
        fulfillmentStore: '',
        store: '',
        page: '',
        location: '',
        internalCost: '',
        customerName: '',
    });

    useEffect(() => {
        setMobilePageTitle(selectedStore ? `វេចខ្ចប់: ${selectedStore}` : 'ជ្រើសរើសឃ្លាំងវេចខ្ចប់');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    const availableStores = useMemo(() => {
        if (!appData.stores) return [];
        return appData.stores.map((s: any) => s.StoreName);
    }, [appData.stores]);

    const calculatedRange = useMemo(() => {
        if (filters.datePreset === 'all') return 'All time data stream';
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start: Date | null = null;
        let end: Date | null = new Date();
        switch (filters.datePreset) {
            case 'today': start = today; break;
            case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
            case 'this_week': const day = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); break;
            case 'last_week': start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59); break;
            case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
            case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
            case 'custom': return `${filters.startDate || '...'} to ${filters.endDate || '...'}`;
        }
        const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return start ? `${formatDate(start)} to ${formatDate(end)}` : 'All time data stream';
    }, [filters.datePreset, filters.startDate, filters.endDate]);

    const getOrderTimestamp = (order: any) => {
        const ts = order.Timestamp;
        if (!ts) return 0;
        const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
        return new Date(ts).getTime();
    };

    const storeOrders = useMemo(() => {
        if (!selectedStore) return [];
        return allOrders.filter(o => {
            const store = o['Fulfillment Store'] || 'Unassigned';
            return store.trim().toLowerCase() === selectedStore.trim().toLowerCase();
        });
    }, [allOrders, selectedStore]);

    const groupedOrders = useMemo(() => {
        let filtered = storeOrders.filter(o => o.FulfillmentStatus === activeTab && o.FulfillmentStatus !== 'Cancelled');

        filtered = filtered.filter(order => {
            if (filters.datePreset !== 'all') {
                const ts = getOrderTimestamp(order);
                const orderDate = new Date(ts);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                let start: Date | null = null;
                let end: Date | null = null;
                switch (filters.datePreset) {
                    case 'today': start = today; break;
                    case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
                    case 'this_week': const day = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); break;
                    case 'last_week': start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59); break;
                    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
                    case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
                    case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
                    case 'custom':
                        if (filters.startDate) start = new Date(filters.startDate + 'T00:00:00');
                        if (filters.endDate) end = new Date(filters.endDate + 'T23:59:59');
                        break;
                }
                if (start && orderDate < start) return false;
                if (end && orderDate > end) return false;
            }

            const isMatch = (filterValue: string, orderValue: string) => {
                if (!filterValue) return true;
                const selectedValues = filterValue.split(',').map(v => v.trim().toLowerCase());
                const val = (orderValue || '').trim().toLowerCase();
                return selectedValues.includes(val);
            };

            if (!isMatch(filters.fulfillmentStore, order['Fulfillment Store'] || 'Unassigned')) return false;
            if (filters.store) {
                const pageConfig = appData.pages?.find(p => p.PageName === order.Page);
                const orderStore = pageConfig ? pageConfig.DefaultStore : null;
                const selectedStores = filters.store.split(',');
                if (!orderStore || !selectedStores.includes(orderStore)) return false;
            }
            if (!isMatch(filters.team, order.Team)) return false;
            if (!isMatch(filters.user, order.User || '')) return false;
            if (!isMatch(filters.paymentStatus, order['Payment Status'])) return false;
            if (!isMatch(filters.shippingService, order['Internal Shipping Method'])) return false;
            if (!isMatch(filters.driver, order['Internal Shipping Details'])) return false;
            if (!isMatch(filters.bank, order['Payment Info'])) return false;
            if (!isMatch(filters.page, order.Page)) return false;
            if (!isMatch(filters.location, order.Location)) return false;
            if (!isMatch(filters.customerName, order['Customer Name'])) return false;
            if (filters.product && !order.Products.some(p => p.name === filters.product)) return false;

            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                return order['Order ID'].toLowerCase().includes(q) ||
                       (order['Customer Name'] || '').toLowerCase().includes(q) ||
                       (order['Customer Phone'] || '').includes(q);
            }
            return true;
        });

        filtered = filtered.sort((a, b) => b['Order ID'].localeCompare(a['Order ID']));

        if (activeTab === 'Pending') {
            const groups: { [date: string]: ParsedOrder[] } = {};
            filtered.forEach(order => {
                const dateStr = order.Timestamp ? new Date(order.Timestamp).toLocaleDateString('km-KH') : 'ថ្ងៃនេះ';
                if (!groups[dateStr]) groups[dateStr] = [];
                groups[dateStr].push(order);
            });
            return groups;
        }
        
        return { 'All': filtered };
    }, [allOrders, activeTab, searchTerm, filters, appData.pages]);

    const handleAction = async (order: ParsedOrder, newStatus: string, extraData: any = {}) => {
        setLoadingActionId(order['Order ID']);
        try {
            const updateRes = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order['Order ID'],
                    team: order.Team,
                    userName: currentUser?.FullName || 'System',
                    newData: { 
                        'Fulfillment Status': newStatus,
                        ...extraData
                    }
                })
            });

            const result = await updateRes.json();
            if (!updateRes.ok || result.status !== 'success') throw new Error(result.message || "Status update failed");
            
            // Auto switch tab
            if (newStatus === 'Shipped' && activeTab === 'Ready to Ship') setActiveTab('Shipped');
            else if (newStatus === 'Ready to Ship' && activeTab === 'Pending') setActiveTab('Ready to Ship');

            refreshData(); 
        } catch (error: any) {
            console.error("Action error:", error);
            alert("បរាជ័យក្នុងការធ្វើបច្ចុប្បន្នភាព: " + error.message);
        } finally {
            setLoadingActionId(null);
        }
    };

    const handleUndo = (order: ParsedOrder, targetStatus: string, extra: any) => {
        const msg = targetStatus === 'Pending' 
            ? "តើអ្នកពិតជាចង់លុបទិន្នន័យវេចខ្ចប់ និងត្រឡប់ទៅ 'រង់ចាំខ្ចប់' វិញមែនទេ?" 
            : "តើអ្នកពិតជាចង់លុបពេលវេលាបញ្ចេញឥវ៉ាន់ និងត្រឡប់ទៅ 'ខ្ចប់រួចរាល់' វិញមែនទេ?";
        
        if (window.confirm(msg)) {
            handleAction(order, targetStatus, extra);
        }
    };

    const renderOrderCard = (order: ParsedOrder) => {
        const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);
        const driver = appData.drivers?.find(d => d.DriverName === (order['Driver Name'] || order['Internal Shipping Details']));
        const bank = appData.bankAccounts?.find(b => b.BankName === order['Payment Info']);
        
        const phone = order['Customer Phone'] || '';
        const phoneCarrier = appData.phoneCarriers?.find(c => {
            const prefixes = (c.Prefixes || '').split(',').map(p => p.trim());
            return prefixes.some(p => phone.startsWith(p));
        });

        return (
            <div key={order['Order ID']} className="bg-[#1e293b]/60 backdrop-blur-md border border-white/5 rounded-[2rem] p-5 shadow-2xl flex flex-col gap-4 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                {loadingActionId === order['Order ID'] && (
                    <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm rounded-[2rem]">
                        <Spinner />
                    </div>
                )}
                
                <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-grow">
                        <div className="flex items-center gap-2">
                            {phoneCarrier && (
                                <img src={convertGoogleDriveUrl(phoneCarrier.CarrierLogoURL)} className="w-4 h-4 object-contain" alt="" />
                            )}
                            <h3 className="text-white font-black text-lg truncate">{order['Customer Name']}</h3>
                        </div>
                        <p className="text-blue-400 font-mono text-xs font-bold">{order['Customer Phone']}</p>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(order['Order ID']).then(() => alert('ចម្លង ID បានជោគជ័យ: ' + order['Order ID']));
                            }}
                            className="text-gray-500 text-[10px] mt-1 italic font-bold hover:text-blue-400 transition-colors flex items-center gap-1 group/id"
                            title="ចុចដើម្បីចម្លង ID"
                        >
                            #{order['Order ID'].substring(0,8)}
                            <svg className="w-3 h-3 opacity-0 group-hover/id:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </button>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="bg-white/5 px-2 py-1 rounded-lg text-[9px] font-black uppercase text-gray-400 border border-white/10">
                            {order.Products.length} Items
                        </span>
                        <div className="flex items-center gap-1.5 mt-1">
                            {shippingMethod && (
                                <img src={convertGoogleDriveUrl(shippingMethod.LogosURL)} className="w-4 h-4 object-contain opacity-70" alt="" />
                            )}
                            <span className="text-[10px] text-gray-500 font-bold">{order['Internal Shipping Method']}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-2 shadow-inner">
                    <div className="flex justify-between items-center text-[10px] font-black">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 uppercase tracking-widest">Driver</span>
                            {driver && (
                                <img src={convertGoogleDriveUrl(driver.ImageURL)} className="w-4 h-4 rounded-full object-cover" alt="" />
                            )}
                        </div>
                        <span className="text-emerald-400 truncate max-w-[100px]">{order['Driver Name'] || order['Internal Shipping Details'] || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 uppercase tracking-widest">Payment</span>
                            {bank && (
                                <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-4 h-4 object-contain" alt="" />
                            )}
                        </div>
                        <span className="text-pink-400 truncate max-w-[100px]">{order['Payment Info'] || order['Payment Status'] || 'N/A'}</span>
                    </div>
                    {order['Packed By'] && (
                        <div className="flex justify-between items-center text-[10px] font-black pt-1 border-t border-white/5">
                            <span className="text-gray-500 uppercase tracking-widest">Packed By</span>
                            <span className="text-indigo-400 truncate max-w-[100px]">{order['Packed By']}</span>
                        </div>
                    )}
                    {order['Dispatched By'] && (
                        <div className="flex justify-between items-center text-[10px] font-black">
                            <span className="text-gray-500 uppercase tracking-widest">Dispatched By</span>
                            <span className="text-orange-400 truncate max-w-[100px]">{order['Dispatched By']}</span>
                        </div>
                    )}
                </div>

                <div className="bg-black/30 rounded-2xl p-3 border border-white/5 flex gap-2 overflow-x-auto custom-scrollbar">
                    {order.Products.map((p, idx) => (
                        <div key={idx} className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-gray-900 border border-gray-800 cursor-pointer hover:border-blue-500/50" onClick={() => showFullImage(convertGoogleDriveUrl(p.image))}>
                            <img src={convertGoogleDriveUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                    ))}
                </div>

                {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && order['Package Photo URL'] && (
                    <div className="space-y-2 mt-2">
                        <div 
                            className="w-full h-24 rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-blue-500/50 transition-all relative group/photo"
                            onClick={() => showFullImage(convertGoogleDriveUrl(order['Package Photo URL'] as string))}
                        >
                            <img src={convertGoogleDriveUrl(order['Package Photo URL'] as string)} className="w-full h-full object-cover opacity-60 group-hover/photo:opacity-100 transition-opacity" alt="Package" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/photo:bg-transparent transition-all">
                                <svg className="w-6 h-6 text-white shadow-xl" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </div>
                        </div>
                        <button 
                            onClick={() => showFullImage(convertGoogleDriveUrl(order['Package Photo URL'] as string))}
                            className="w-full py-2 bg-gray-800/80 hover:bg-gray-700 text-gray-300 rounded-xl font-black uppercase text-[9px] tracking-widest border border-white/10 transition-all flex justify-center items-center gap-2"
                        >
                            មើលរូបធំ
                        </button>
                    </div>
                )}

                <div className="mt-auto pt-2 space-y-2">
                    {activeTab === 'Pending' && (
                        <button 
                            onClick={() => setPackingOrder(order)}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            ចាប់ផ្ដើមវេចខ្ចប់
                        </button>
                    )}
                    {activeTab === 'Ready to Ship' && (
                        <>
                            <button 
                                onClick={() => handleAction(order, 'Shipped', { 'Dispatched Time': new Date().toLocaleString('km-KH'), 'Dispatched By': currentUser?.FullName || 'Station Packer' })}
                                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-amber-900/20 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                ប្រគល់អោយអ្នកដឹករួចរាល់
                            </button>
                            <button 
                                onClick={() => handleUndo(order, 'Pending', { 
                                    'Packed By': '', 
                                    'Packed Time': '', 
                                    'Package Photo URL': '' 
                                })}
                                className="w-full py-2 bg-gray-800/50 hover:bg-red-600/20 text-gray-500 hover:text-red-400 rounded-lg font-black uppercase text-[9px] tracking-[0.2em] transition-all flex justify-center items-center gap-2 border border-white/5"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                UNDO (ត្រឡប់ទៅរង់ចាំខ្ចប់)
                            </button>
                        </>
                    )}
                    {activeTab === 'Shipped' && (
                        <>
                            <div className="w-full py-3 bg-gray-800/50 text-emerald-500 border border-emerald-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest flex justify-center items-center gap-2 cursor-not-allowed">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                បានបញ្ចេញរួចរាល់
                            </div>
                            <button 
                                onClick={() => handleUndo(order, 'Ready to Ship', { 
                                    'Dispatched Time': '',
                                    'Dispatched By': ''
                                })}
                                className="w-full py-2 bg-gray-800/50 hover:bg-red-600/20 text-gray-500 hover:text-red-400 rounded-lg font-black uppercase text-[9px] tracking-[0.2em] transition-all flex justify-center items-center gap-2 border border-white/5"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                UNDO (ត្រឡប់ទៅខ្ចប់រួច)
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderOrderListRow = (order: ParsedOrder) => {
        const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);
        const driver = appData.drivers?.find(d => d.DriverName === (order['Driver Name'] || order['Internal Shipping Details']));
        const bank = appData.bankAccounts?.find(b => b.BankName === order['Payment Info']);
        
        return (
            <div key={order['Order ID']} className="bg-[#1e293b]/40 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:border-blue-500/30 transition-all relative overflow-hidden">
                {loadingActionId === order['Order ID'] && (
                    <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center rounded-2xl">
                        <Spinner size="sm" />
                    </div>
                )}
                
                <div className="flex-grow min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div className="min-w-0">
                        <h3 className="text-white font-black text-sm truncate">{order['Customer Name']}</h3>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(order['Order ID']).then(() => alert('ចម្លង ID បានជោគជ័យ: ' + order['Order ID']));
                            }}
                            className="text-blue-400 font-mono text-[10px] font-bold hover:text-white transition-colors"
                        >
                            #{order['Order ID'].substring(0,8)}
                        </button>
                    </div>

                    <div className="hidden md:block text-center">
                        <p className="text-gray-400 text-xs font-bold">{order['Customer Phone']}</p>
                        <p className="text-gray-500 text-[9px] uppercase tracking-widest">{order.Page}</p>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-1">
                        <div className="flex items-center gap-2">
                            {shippingMethod && <img src={convertGoogleDriveUrl(shippingMethod.LogosURL)} className="w-5 h-5 object-contain" alt="Shipping" />}
                            {bank && <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-5 h-5 object-contain" alt="Bank" />}
                            {driver && <img src={convertGoogleDriveUrl(driver.ImageURL)} className="w-5 h-5 rounded-full object-cover" alt="Driver" />}
                        </div>
                        {order['Packed By'] && <span className="text-[8px] text-indigo-400 font-bold uppercase truncate max-w-[80px]">📦 {order['Packed By']}</span>}
                        {order['Dispatched By'] && <span className="text-[8px] text-orange-400 font-bold uppercase truncate max-w-[80px]">🚚 {order['Dispatched By']}</span>}
                    </div>

                    <div className="flex justify-end gap-2">
                        {activeTab === 'Pending' && (
                            <button onClick={() => setPackingOrder(order)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all">ខ្ចប់ឥវ៉ាន់</button>
                        )}
                        {activeTab === 'Ready to Ship' && (
                            <div className="flex gap-1">
                                <button onClick={() => handleAction(order, 'Shipped', { 'Dispatched Time': new Date().toLocaleString('km-KH'), 'Dispatched By': currentUser?.FullName || 'Station Packer' })} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all">បញ្ចេញ</button>
                                <button onClick={() => handleUndo(order, 'Pending', { 'Packed By': '', 'Packed Time': '', 'Package Photo URL': '' })} className="bg-red-600/20 text-red-400 p-2 rounded-lg border border-red-500/20 hover:bg-red-600 hover:text-white transition-all">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                </button>
                            </div>
                        )}
                        {activeTab === 'Shipped' && (
                            <button onClick={() => handleUndo(order, 'Ready to Ship', { 'Dispatched Time': '', 'Dispatched By': '' })} className="bg-red-600/20 text-red-400 px-4 py-2 rounded-lg border border-red-500/20 hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase">UNDO</button>
                        )}
                        {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && order['Package Photo URL'] && (
                            <button onClick={() => showFullImage(convertGoogleDriveUrl(order['Package Photo URL'] as string))} className="bg-gray-800 text-gray-300 p-2 rounded-lg border border-white/10 hover:bg-gray-700">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const hasOrders = (Object.values(groupedOrders) as ParsedOrder[][]).some(list => list.length > 0);

    if (!selectedStore) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 animate-fade-in">
                <div className="w-full max-w-md bg-[#0f172a]/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 sm:p-10 shadow-3xl text-center space-y-8 relative overflow-hidden">
                    <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    <div className="relative z-10 space-y-4">
                        <div className="w-20 h-20 bg-blue-600/20 rounded-3xl mx-auto flex items-center justify-center border-2 border-blue-500/30 shadow-xl shadow-blue-900/20">
                            <span className="text-4xl">🏬</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter">ជ្រើសរើសឃ្លាំង</h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select Packaging Store</p>
                    </div>

                    <div className="relative z-10 space-y-3">
                        {availableStores.map(store => (
                            <button
                                key={store}
                                onClick={() => setSelectedStore(store)}
                                className="w-full py-4 px-6 bg-gray-900/50 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/50 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-between group"
                            >
                                <span>{store}</span>
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24 animate-fade-in px-4 lg:px-8">
            {/* Header / Change Store */}
            <div className="flex justify-between items-center bg-[#0f172a]/60 backdrop-blur-md border border-white/5 rounded-[2rem] p-4 sm:p-6 mb-6">
                <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <span>ផ្នែកវេចខ្ចប់</span>
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/30">{selectedStore}</span>
                    </h2>
                </div>
                <button 
                    onClick={() => setSelectedStore('')}
                    className="px-4 py-2.5 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-white/5 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    ប្ដូរឃ្លាំង
                </button>
            </div>

            {/* 4 Steps Navigation (Visualizing 4 steps, Step 2 is modal) */}
            <div className="flex bg-black/40 p-1.5 rounded-[2rem] border border-white/5 overflow-x-auto no-scrollbar max-w-2xl mx-auto shadow-inner gap-1">
                {[
                    { id: 'Pending', label: 'រង់ចាំខ្ចប់', icon: '📥' },
                    { id: 'Ready to Ship', label: 'ខ្ចប់រួច', icon: '📦' },
                    { id: 'Shipped', label: 'បានបញ្ចេញ', icon: '🚚' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex-1 min-w-[120px] px-4 py-3 rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 relative ${activeTab === tab.id ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <span className="text-lg">{tab.icon}</span>
                        <span>{tab.label}</span>
                        {activeTab === tab.id && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-blue-500 rounded-full shadow-[0_0_15px_#3b82f6] animate-pulse"></div>}
                    </button>
                ))}
            </div>

            {/* Filter Section */}
            <div className="bg-gray-800/20 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-5 sm:p-6 mb-8 shadow-2xl relative z-20 group transition-all hover:bg-gray-800/30 max-w-6xl mx-auto">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="relative w-full lg:max-w-2xl group">
                        <input 
                            type="text" 
                            placeholder="ស្វែងរក ID, ឈ្មោះ, ឬលេខទូរស័ព្ទ..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="form-input !pl-16 !py-5 bg-black/40 border-gray-800 rounded-[1.8rem] text-[15px] font-bold text-white placeholder:text-gray-700 focus:border-blue-500/50 focus:bg-black/60 transition-all shadow-inner" 
                        />
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-4 text-gray-700 group-focus-within:text-blue-500 transition-colors">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <div className="h-6 w-px bg-gray-800"></div>
                        </div>
                    </div>
                    <div className="flex items-stretch gap-3 w-full lg:w-auto h-16 sm:h-[68px]">
                        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                            <button 
                                onClick={() => setViewMode('card')}
                                className={`px-5 flex items-center justify-center rounded-xl transition-all duration-300 ${viewMode === 'card' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105' : 'text-gray-600 hover:text-gray-400'}`}
                                title="Card View"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                                </svg>
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`px-5 flex items-center justify-center rounded-xl transition-all duration-300 ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105' : 'text-gray-600 hover:text-gray-400'}`}
                                title="List View"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <button 
                            onClick={() => setIsFilterModalOpen(true)} 
                            className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-blue-500/30 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Modal/Panel */}
            <div className="md:hidden">
                <FilterPanel isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)}>
                    <OrderFilters filters={filters} setFilters={setFilters} orders={allOrders} usersList={appData.users} appData={appData} calculatedRange={calculatedRange} />
                </FilterPanel>
            </div>
            <div className="hidden md:block">
                <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-4xl">
                    <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10 shadow-3xl overflow-hidden relative">
                        <div className="flex justify-between items-center mb-10 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Subsystem</h2>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5">&times;</button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 relative z-10">
                            <OrderFilters filters={filters} setFilters={setFilters} orders={allOrders} usersList={appData.users} appData={appData} calculatedRange={calculatedRange} />
                        </div>
                        <div className="mt-12 flex justify-center relative z-10"><button onClick={() => setIsFilterModalOpen(false)} className="btn btn-primary w-full py-5 text-[13px] font-black uppercase tracking-[0.25em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] rounded-2xl active:scale-[0.98] transition-all">Apply Filter Configuration</button></div>
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                    </div>
                </Modal>
            </div>

            {/* Live Update Indicator */}
            {activeTab === 'Pending' && (
                <div className="flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Live Auto-Update</span>
                    </div>
                </div>
            )}

            {/* Content List */}
            {!hasOrders ? (
                <div className="py-20 text-center bg-gray-900/20 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-4">
                    <span className="text-4xl opacity-50">📭</span>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">មិនមានកញ្ចប់ឥវ៉ាន់ទេ</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {(Object.entries(groupedOrders) as [string, ParsedOrder[]][]).map(([date, orders]) => (
                        orders.length > 0 && (
                            <div key={date} className="space-y-4">
                                {activeTab === 'Pending' && (
                                    <div className="flex items-center gap-3">
                                        <div className="h-px flex-grow bg-gradient-to-r from-transparent to-white/10"></div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1 bg-black/40 rounded-full border border-white/5">{date}</span>
                                        <div className="h-px flex-grow bg-gradient-to-l from-transparent to-white/10"></div>
                                    </div>
                                )}
                                <div className={viewMode === 'card' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4" : "flex flex-col gap-2"}>
                                    {orders.map(order => viewMode === 'card' ? renderOrderCard(order) : renderOrderListRow(order))}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            )}

            {/* Step 2: Packing Modal */}
            {packingOrder && (
                <FastPackModal 
                    order={packingOrder} 
                    onClose={() => setPackingOrder(null)} 
                    onSuccess={() => {
                        setPackingOrder(null);
                        setActiveTab('Ready to Ship'); // Auto switch to Step 3
                        refreshData(); 
                    }} 
                />
            )}
        </div>
    );
};

export default PackagingView;