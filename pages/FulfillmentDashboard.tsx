import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import { useFulfillment } from '@/hooks/useFulfillment';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { ParsedOrder, FulfillmentStatus } from '@/types';
import BulkActionBarDesktop from '@/components/admin/BulkActionBarDesktop'; // Assume this exists or we can create a generic one
import SearchableShippingMethodDropdown from '@/components/common/SearchableShippingMethodDropdown';
import SearchableProductDropdown from '@/components/common/SearchableProductDropdown'; // Using as a proxy for payment method if needed, or we make one
import OrderFilters, { FilterState } from '@/components/orders/OrderFilters';
import { FilterPanel } from '@/components/orders/FilterPanel';
import Modal from '@/components/common/Modal';

// We will need a new Confirm Delivery Modal Component
const ConfirmDeliveryModal: React.FC<{
    order: ParsedOrder | null;
    onClose: () => void;
    onConfirm: (orderId: string, updates: any) => void;
    isLoading: boolean;
}> = ({ order, onClose, onConfirm, isLoading }) => {
    const { appData } = useContext(AppContext);
    const [driver, setDriver] = useState('');
    const [shippingMethod, setShippingMethod] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');

    useEffect(() => {
        if (order) {
            setDriver(order['Driver Name'] || '');
            setShippingMethod(order['Internal Shipping Method'] || '');
            setPaymentMethod(order['Payment Method'] || '');
        }
    }, [order]);

    if (!order) return null;

    const handleConfirm = () => {
        if (!paymentMethod) {
            alert('សូមជ្រើសរើសវិធីសាស្ត្របង់ប្រាក់');
            return;
        }
        onConfirm(order['Order ID'], {
            'Driver Name': driver,
            'Internal Shipping Method': shippingMethod,
            'Payment Method': paymentMethod,
            'Delivered Time': new Date().toLocaleString('km-KH'),
            'Fulfillment Status': 'Delivered'
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0f172a] border border-white/10 rounded-[2.5rem] w-full max-w-md shadow-2xl p-6 flex flex-col gap-6">
                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">បញ្ជាក់ការដឹកជោគជ័យ</h3>
                    <button onClick={onClose} disabled={isLoading} className="text-gray-500 hover:text-red-500 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Shipping Method</label>
                        <SearchableShippingMethodDropdown 
                            methods={appData.shippingMethods}
                            selectedMethodName={shippingMethod}
                            onSelect={(val) => setShippingMethod(val.MethodName)}
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Driver Name</label>
                        <input 
                            type="text" 
                            value={driver}
                            onChange={(e) => setDriver(e.target.value)}
                            className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none"
                            placeholder="ឈ្មោះអ្នកដឹក"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Payment Method <span className="text-red-500">*</span></label>
                        <select 
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full bg-black/40 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 outline-none appearance-none"
                        >
                            <option value="">-- រើសវិធីសាស្ត្របង់ប្រាក់ --</option>
                            <option value="Cash on Delivery">Cash on Delivery</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Prepaid">Prepaid</option>
                        </select>
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button onClick={onClose} disabled={isLoading} className="flex-1 py-3 rounded-xl bg-gray-800 text-white font-black text-xs uppercase tracking-widest hover:bg-gray-700 transition-all">បោះបង់</button>
                    <button onClick={handleConfirm} disabled={isLoading || !paymentMethod} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                        {isLoading ? <Spinner size="sm" /> : 'បញ្ជាក់'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const FulfillmentCard: React.FC<{ 
    order: ParsedOrder; 
    onStatusChange: (id: string, status: FulfillmentStatus, extra?: any) => void;
    onConfirmDelivery: (order: ParsedOrder) => void;
    isLoading: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
}> = ({ order, onStatusChange, onConfirmDelivery, isLoading, isSelected, onSelect }) => {
    const { previewImage, appData } = useContext(AppContext);
    const currentStatus = order.FulfillmentStatus || 'Pending';
    
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Pending': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'Processing': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
            case 'Ready to Ship': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'Shipped': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'Delivered': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    // Logos finding logic
    const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);
    const driver = appData.drivers?.find(d => d.DriverName === (order['Driver Name'] || order['Internal Shipping Details']));
    const bank = appData.bankAccounts?.find(b => b.BankName === order['Payment Info']);
    
    // Simple phone carrier logic based on prefixes
    const phone = order['Customer Phone'] || '';
    const phoneCarrier = appData.phoneCarriers?.find(c => {
        const prefixes = (c.Prefixes || '').split(',').map(p => p.trim());
        return prefixes.some(p => phone.startsWith(p));
    });

    return (
        <div className={`bg-[#0f172a] border ${isSelected ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-white/5'} rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-full group transition-all duration-300 relative`}>
            {isLoading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <Spinner size="lg" />
                </div>
            )}

            {/* Checkbox for Bulk Actions (Only visible on relevant tabs) */}
            {currentStatus === 'Shipped' && (
                <div className="absolute top-4 left-4 z-10">
                    <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => onSelect(order['Order ID'])}
                        className="w-5 h-5 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-black/50 cursor-pointer"
                    />
                </div>
            )}

            {/* Header: Status & ID */}
            <div className={`p-5 pb-3 border-b border-white/5 flex justify-between items-start bg-white/[0.02] ${currentStatus === 'Shipped' ? 'pl-12' : ''}`}>
                <div className="flex flex-col">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(order['Order ID']).then(() => alert('ចម្លង ID បានជោគជ័យ: ' + order['Order ID']));
                        }}
                        className="text-sm font-black text-white tracking-tighter hover:text-blue-400 transition-colors flex items-center gap-1 group/id text-left"
                        title="ចុចដើម្បីចម្លង ID"
                    >
                        #{order['Order ID'].substring(0, 10)}
                        <svg className="w-3 h-3 opacity-0 group-hover/id:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </button>
                    <p className="text-gray-500 text-[10px] mt-1 font-bold italic line-clamp-1">{order.Location}</p>
                </div>
                <div className={`px-2 py-1 rounded-full text-[8px] font-black uppercase border ${getStatusColor(currentStatus)}`}>
                    {currentStatus === 'Pending' ? 'មិនទាន់វេចខ្ចប់' : 
                     currentStatus === 'Ready to Ship' ? 'វេចខ្ចប់រួច' :
                     currentStatus === 'Shipped' ? 'កំពុងដឹកជញ្ជូន' :
                     currentStatus === 'Delivered' ? 'ដឹកជោគជ័យ' : currentStatus}
                </div>
            </div>

            <div className="p-5 flex-grow space-y-4">
                {/* Customer Info */}
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {phoneCarrier && (
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 p-1 border border-white/10">
                                <img src={convertGoogleDriveUrl(phoneCarrier.CarrierLogoURL)} className="w-full h-full object-contain" alt="" />
                            </div>
                        )}
                        <div>
                            <p className="text-white font-black text-sm">{order['Customer Name']}</p>
                            <p className="text-blue-400 font-mono text-[11px] font-bold">{order['Customer Phone']}</p>
                        </div>
                    </div>
                </div>

                {/* Logistics Details */}
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-2 shadow-inner">
                    <div className="flex justify-between items-center text-[10px] font-black">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-500 uppercase tracking-widest">Shipping</span>
                            {shippingMethod && (
                                <img src={convertGoogleDriveUrl(shippingMethod.LogosURL)} className="w-4 h-4 object-contain" alt="" />
                            )}
                        </div>
                        <span className="text-indigo-400">{order['Internal Shipping Method']}</span>
                    </div>
                    {(order['Driver Name'] || order['Internal Shipping Details']) && (
                        <div className="flex justify-between items-center text-[10px] font-black">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 uppercase tracking-widest">Driver</span>
                                {driver && (
                                    <img src={convertGoogleDriveUrl(driver.ImageURL)} className="w-4 h-4 rounded-full object-cover" alt="" />
                                )}
                            </div>
                            <span className="text-emerald-400">{order['Driver Name'] || order['Internal Shipping Details']}</span>
                        </div>
                    )}
                    {(order['Payment Method'] || order['Payment Info']) && (
                        <div className="flex justify-between items-center text-[10px] font-black">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 uppercase tracking-widest">Payment</span>
                                {bank && (
                                    <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-4 h-4 object-contain" alt="" />
                                )}
                            </div>
                            <span className="text-amber-400">{order['Payment Method'] || order['Payment Info']}</span>
                        </div>
                    )}
                    {order['Packed By'] && (
                        <div className="flex justify-between items-center text-[10px] font-black pt-1 border-t border-white/5">
                            <span className="text-gray-500 uppercase tracking-widest">Packed By</span>
                            <span className="text-indigo-400">{order['Packed By']}</span>
                        </div>
                    )}
                    {order['Dispatched By'] && (
                        <div className="flex justify-between items-center text-[10px] font-black">
                            <span className="text-gray-500 uppercase tracking-widest">Dispatched By</span>
                            <span className="text-orange-400">{order['Dispatched By']}</span>
                        </div>
                    )}
                </div>

                {/* Products Thumbnails */}
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {order.Products.map((p, i) => (
                        <div key={i} className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-gray-900 border border-gray-800" onClick={() => previewImage(convertGoogleDriveUrl(p.image))}>
                            <img src={convertGoogleDriveUrl(p.image)} className="w-full h-full object-cover" alt="" />
                        </div>
                    ))}
                    <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-[10px] text-gray-400 font-bold border border-white/5">
                        x{order.Products.length}
                    </span>
                </div>
            </div>

            {/* Footer Actions */}
            {currentStatus === 'Shipped' && (
                <div className="p-4 pt-0 mt-auto border-t border-white/5 bg-black/20">
                    <button 
                        onClick={() => onConfirmDelivery(order)}
                        className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-xl shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        បញ្ជាក់ថាដឹកជោគជ័យ
                    </button>
                </div>
            )}
        </div>
    );
};

const FulfillmentDashboard: React.FC<{ orders: ParsedOrder[] }> = ({ orders }) => {
    const { refreshData, setMobilePageTitle, appData, currentUser } = useContext(AppContext);
    
    // Store Selection State
    const [selectedStore, setSelectedStore] = useState<string>('');

    // Filter orders by selected store
    const storeOrders = useMemo(() => {
        if (!selectedStore) return [];
        return orders.filter(o => {
            const store = o['Fulfillment Store'] || 'Unassigned';
            return store.trim().toLowerCase() === selectedStore.trim().toLowerCase();
        });
    }, [orders, selectedStore]);

    const { ordersByStatus, updateStatus, loadingId } = useFulfillment(storeOrders, refreshData);
    
    // Selection state for Bulk Actions
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [confirmModalOrder, setConfirmModalOrder] = useState<ParsedOrder | null>(null);
    const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

    // Comprehensive Filters
    const [activeTab, setActiveTab] = useState<FulfillmentStatus>('Pending');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<FilterState>({
        datePreset: 'today', // Default to Today
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

    const statusTabs: { id: FulfillmentStatus, label: string, color: string, icon: string }[] = [
        { id: 'Pending', label: 'មិនទាន់វេចខ្ចប់', color: 'blue', icon: '📥' },
        { id: 'Ready to Ship', label: 'ខ្ចប់រួច', color: 'amber', icon: '📦' },
        { id: 'Shipped', label: 'កំពុងដឹក', color: 'purple', icon: '🚚' },
        { id: 'Delivered', label: 'ដឹកជោគជ័យ', color: 'emerald', icon: '✅' }
    ];

    useEffect(() => {
        setMobilePageTitle(selectedStore ? `ឃ្លាំង: ${selectedStore}` : 'ជ្រើសរើសឃ្លាំង');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    // Reset selection when changing tabs
    useEffect(() => {
        setSelectedOrderIds(new Set());
    }, [activeTab]);

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

    // Robust Date Parsing helper
    const getOrderTimestamp = (order: any) => {
        const ts = order.Timestamp;
        if (!ts) return 0;
        const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
        return new Date(ts).getTime();
    };

    const filteredList = useMemo(() => {
        let list = ordersByStatus[activeTab] || [];
        
        // Apply Filters
        list = list.filter(order => {
            // 1. Date Filter
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

            // Helper for multi-select
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

        return list.sort((a, b) => b['Order ID'].localeCompare(a['Order ID']));
    }, [activeTab, ordersByStatus, searchTerm, filters, appData.pages]);

    const handleSelectOrder = (id: string) => {
        const newSet = new Set(selectedOrderIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedOrderIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedOrderIds.size === filteredList.length) {
            setSelectedOrderIds(new Set());
        } else {
            setSelectedOrderIds(new Set(filteredList.map(o => o['Order ID'])));
        }
    };

    const handleConfirmDeliverySubmit = async (orderId: string, updates: any) => {
        // Calls the single update hook with extra fields
        await updateStatus(orderId, 'Delivered', updates);
        setConfirmModalOrder(null);
    };

    // Note: Bulk action for delivery needs payment method, which varies. 
    // So bulk delivery confirmation might be tricky if payment method isn't set.
    // For simplicity, a bulk action might just set status if we assume payment method is pre-filled,
    // otherwise it might be better to do it one by one.
    const handleBulkConfirmDelivery = async () => {
        if (selectedOrderIds.size === 0) return;
        
        // Check if all selected have a payment method
        const selectedOrders = filteredList.filter(o => selectedOrderIds.has(o['Order ID']));
        const missingPayment = selectedOrders.find(o => !o['Payment Method']);
        
        if (missingPayment) {
            alert(`ការកម្មង់ #${missingPayment['Order ID'].substring(0,8)} មិនទាន់មានវិធីសាស្ត្របង់ប្រាក់ទេ។ សូមបញ្ជាក់ម្ដងមួយៗសិន។`);
            return;
        }

        const confirm = window.confirm(`តើអ្នកពិតជាចង់បញ្ជាក់ថាដឹកជោគជ័យ ចំនួន ${selectedOrderIds.size} កញ្ចប់មែនទេ?`);
        if (!confirm) return;

        setIsUpdatingBulk(true);
        try {
            // Sequential updates to avoid overloading the API in basic implementation
            for (const id of selectedOrderIds) {
                await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sheetName: 'AllOrders',
                        primaryKey: { 'Order ID': id },
                        newData: { 
                            'Fulfillment Status': 'Delivered',
                            'Delivered Time': new Date().toLocaleString('km-KH')
                        }
                    })
                });
            }
            setSelectedOrderIds(new Set());
            refreshData();
        } catch (error) {
            alert('មានបញ្ហាក្នុងការធ្វើបច្ចុប្បន្នភាពជាក្រុម។');
        } finally {
            setIsUpdatingBulk(false);
        }
    };

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
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select Fulfillment Store</p>
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
        <div className="space-y-6 pb-24 animate-fade-in relative">
            {/* Header Section */}
            <div className="bg-[#0f172a]/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-6 lg:p-8 flex flex-col lg:flex-row justify-between items-center gap-6 shadow-3xl">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-indigo-900/40">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                            <span>កញ្ចប់ឥវ៉ាន់</span>
                            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/30">{selectedStore}</span>
                        </h1>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Fulfillment Tracking</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <button 
                        onClick={() => setSelectedStore('')}
                        className="w-full sm:w-auto px-6 py-3 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-white/5 active:scale-95 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        ប្ដូរឃ្លាំង
                    </button>
                    <button 
                        onClick={refreshData}
                        className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-xl border border-white/5 active:scale-90 transition-all shadow-xl group flex justify-center"
                    >
                        <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
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
                    <OrderFilters filters={filters} setFilters={setFilters} orders={orders} usersList={appData.users} appData={appData} calculatedRange={calculatedRange} />
                </FilterPanel>
            </div>
            <div className="hidden md:block">
                <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-4xl">
                    <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10 shadow-3xl overflow-hidden relative">
                        <div className="flex justify-between items-center mb-10 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Tracking Subsystem</h2>
                            </div>
                            <button onClick={() => setIsFilterModalOpen(false)} className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5">&times;</button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 relative z-10">
                            <OrderFilters filters={filters} setFilters={setFilters} orders={orders} usersList={appData.users} appData={appData} calculatedRange={calculatedRange} />
                        </div>
                        <div className="mt-12 flex justify-center relative z-10"><button onClick={() => setIsFilterModalOpen(false)} className="btn btn-primary w-full py-5 text-[13px] font-black uppercase tracking-[0.25em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] rounded-2xl active:scale-[0.98] transition-all">Apply Filter Configuration</button></div>
                        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                    </div>
                </Modal>
            </div>

            {/* Status Tabs Navigation */}
            <div className="flex justify-center px-2">
                <div className="flex bg-black/40 p-1.5 rounded-[2rem] border border-white/5 overflow-x-auto no-scrollbar max-w-full shadow-inner gap-1">
                    {statusTabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        // For count, we filter the orders by status and filters
                        const count = orders.filter(o => 
                            (o.FulfillmentStatus || 'Pending') === tab.id &&
                            // Applying standard filters logic for counting
                            (() => {
                                // Date check
                                if (filters.datePreset !== 'all') {
                                    const ts = getOrderTimestamp(o);
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
                                
                                // Multi-select helpers
                                const isMatch = (filterValue: string, orderValue: string) => {
                                    if (!filterValue) return true;
                                    const selectedValues = filterValue.split(',').map(v => v.trim().toLowerCase());
                                    const val = (orderValue || '').trim().toLowerCase();
                                    return selectedValues.includes(val);
                                };

                                if (!isMatch(filters.fulfillmentStore, o['Fulfillment Store'] || 'Unassigned')) return false;
                                if (!isMatch(filters.team, o.Team)) return false;
                                if (!isMatch(filters.paymentStatus, o['Payment Status'])) return false;
                                if (!isMatch(filters.shippingService, o['Internal Shipping Method'])) return false;
                                if (!isMatch(filters.customerName, o['Customer Name'])) return false;
                                
                                if (searchTerm.trim()) {
                                    const q = searchTerm.toLowerCase();
                                    return o['Order ID'].toLowerCase().includes(q) ||
                                           (o['Customer Name'] || '').toLowerCase().includes(q) ||
                                           (o['Customer Phone'] || '').includes(q);
                                }
                                return true;
                            })()
                        ).length;

                        return (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    px-4 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap relative
                                    ${isActive 
                                        ? `bg-white/10 text-white shadow-lg ring-1 ring-white/10` 
                                        : 'text-gray-500 hover:text-gray-300'
                                    }
                                `}
                            >
                                <span>{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-mono ${isActive ? 'bg-indigo-600 text-white shadow-indigo-900/50' : 'bg-gray-900 text-gray-600'}`}>
                                    {count}
                                </span>
                                {isActive && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-indigo-500 rounded-full shadow-[0_0_15px_#6366f1] animate-pulse"></div>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bulk Actions Bar for 'Shipped' tab */}
            {activeTab === 'Shipped' && filteredList.length > 0 && (
                <div className="flex justify-between items-center bg-[#1e293b]/50 p-3 rounded-2xl border border-white/5 max-w-6xl mx-auto">
                    <div className="flex items-center gap-3 pl-2">
                        <input 
                            type="checkbox" 
                            checked={selectedOrderIds.size === filteredList.length && filteredList.length > 0}
                            onChange={handleSelectAll}
                            className="w-5 h-5 rounded border-gray-600 text-emerald-500 focus:ring-emerald-500 bg-black/50 cursor-pointer"
                        />
                        <span className="text-[11px] font-black text-white tracking-widest uppercase">
                            បានជ្រើសរើស: <span className="text-emerald-500">{selectedOrderIds.size}</span>
                        </span>
                    </div>
                    {selectedOrderIds.size > 0 && (
                        <button 
                            onClick={handleBulkConfirmDelivery}
                            disabled={isUpdatingBulk}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/30 flex items-center gap-2"
                        >
                            {isUpdatingBulk ? <Spinner size="sm" /> : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    បញ្ជាក់ជោគជ័យ
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Content Display */}
            {filteredList.length === 0 ? (
                <div className="py-20 text-center bg-gray-900/20 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <span className="text-4xl opacity-50">📂</span>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">មិនមានទិន្នន័យទេ</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 min-[1280px]:grid-cols-3 min-[1440px]:grid-cols-4 min-[1600px]:grid-cols-4 min-[1920px]:grid-cols-5 gap-4 min-[1366px]:gap-5 min-[1600px]:gap-6">
                    {filteredList.map(order => (
                        <FulfillmentCard 
                            key={order['Order ID']} 
                            order={order} 
                            onStatusChange={updateStatus}
                            onConfirmDelivery={(o) => setConfirmModalOrder(o)}
                            isLoading={loadingId === order['Order ID'] || isUpdatingBulk}
                            isSelected={selectedOrderIds.has(order['Order ID'])}
                            onSelect={handleSelectOrder}
                        />
                    ))}
                </div>
            )}

            {/* Confirm Delivery Modal */}
            <ConfirmDeliveryModal 
                order={confirmModalOrder}
                onClose={() => setConfirmModalOrder(null)}
                onConfirm={handleConfirmDeliverySubmit}
                isLoading={loadingId === confirmModalOrder?.['Order ID']}
            />
        </div>
    );
};

export default FulfillmentDashboard;