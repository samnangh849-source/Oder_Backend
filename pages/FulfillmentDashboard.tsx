import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import { useFulfillment } from '@/hooks/useFulfillment';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { ParsedOrder, FulfillmentStatus } from '@/types';
import BulkActionBarDesktop from '@/components/admin/BulkActionBarDesktop';
import SearchableShippingMethodDropdown from '@/components/common/SearchableShippingMethodDropdown';
import DriverSelector from '@/components/orders/DriverSelector';
import BankSelector from '@/components/orders/BankSelector';
import OrderFilters, { FilterState } from '@/components/orders/OrderFilters';
import { FilterPanel } from '@/components/orders/FilterPanel';
import Modal from '@/components/common/Modal';

// 1. Confirm Delivery Modal Component
const ConfirmDeliveryModal: React.FC<{
    order: ParsedOrder | null;
    onClose: () => void;
    onConfirm: (order: ParsedOrder, updates: any) => void;
    isLoading: boolean;
}> = ({ order, onClose, onConfirm, isLoading }) => {
    const { appData } = useContext(AppContext);
    const [driver, setDriver] = useState('');
    const [shippingMethod, setShippingMethod] = useState('');
    const [paymentStatus, setPaymentStatus] = useState<'Unpaid' | 'Paid'>('Unpaid');
    const [paymentInfo, setPaymentInfo] = useState('');

    useEffect(() => {
        if (order) {
            setDriver(order['Driver Name'] || order['Internal Shipping Details'] || '');
            setShippingMethod(order['Internal Shipping Method'] || '');
            setPaymentStatus((order['Payment Status'] as any) === 'Paid' ? 'Paid' : 'Unpaid');
            setPaymentInfo(order['Payment Info'] || '');
        }
    }, [order]);

    const selectedMethodObj = useMemo(() => {
        return appData.shippingMethods?.find((m: any) => m.MethodName === shippingMethod);
    }, [shippingMethod, appData.shippingMethods]);

    if (!order) return null;

    const handleConfirm = () => {
        if (selectedMethodObj?.RequireDriverSelection && !driver) {
            alert('សូមជ្រើសរើសអ្នកដឹក (Driver) ជាមុនសិន');
            return;
        }
        if (paymentStatus === 'Paid' && !paymentInfo) {
            alert('សូមជ្រើសរើសគណនីធនាគារ');
            return;
        }
        
        onConfirm(order, {
            'Driver Name': driver,
            'Internal Shipping Details': driver,
            'Internal Shipping Method': shippingMethod,
            'Payment Status': paymentStatus,
            'Payment Info': paymentStatus === 'Paid' ? paymentInfo : '',
            'Delivered Time': new Date().toLocaleString('km-KH'),
            'Fulfillment Status': 'Delivered'
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="bg-[#0f172a] border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div><h3 className="text-xl font-black text-white uppercase tracking-tight">បញ្ជាក់ការដឹកជោគជ័យ</h3><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">#{order['Order ID'].substring(0, 10)}</p></div>
                    </div>
                    <button onClick={onClose} disabled={isLoading} className="text-gray-500 hover:text-red-500 transition-colors w-10 h-10 rounded-full flex items-center justify-center bg-gray-800/50 hover:bg-gray-800"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    <div className="space-y-2"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>Shipping Method</label><SearchableShippingMethodDropdown methods={appData.shippingMethods} selectedMethodName={shippingMethod} onSelect={(val) => { setShippingMethod(val.MethodName); if (!val.RequireDriverSelection) setDriver(val.MethodName); else setDriver(''); }} /></div>
                    {selectedMethodObj?.RequireDriverSelection && (<div className="space-y-2 animate-fade-in-down"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>ជ្រើសរើសអ្នកដឹក (Driver)</label><div className="bg-black/20 p-2 rounded-2xl border border-white/5"><DriverSelector drivers={appData.drivers || []} selectedDriverName={driver} onSelect={setDriver} /></div></div>)}
                    <fieldset className="border border-white/10 p-5 rounded-[2rem] bg-white/[0.02]"><legend className="px-3 text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">ស្ថានភាពទូទាត់</legend><div className="space-y-5"><div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5"><button type="button" onClick={() => setPaymentStatus('Unpaid')} className={`flex-1 py-3.5 px-4 rounded-[1.2rem] text-xs font-black uppercase transition-all flex flex-col items-center gap-1 ${paymentStatus === 'Unpaid' ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'text-gray-500 hover:text-gray-300'}`}><span>Unpaid</span><span className="text-[8px] opacity-70 tracking-wider">COD</span></button><button type="button" onClick={() => setPaymentStatus('Paid')} className={`flex-1 py-3.5 px-4 rounded-[1.2rem] text-xs font-black uppercase transition-all flex flex-col items-center gap-1 ${paymentStatus === 'Paid' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-gray-500 hover:text-gray-300'}`}><span>Paid</span><span className="text-[8px] opacity-70 tracking-wider">Transfer</span></button></div>{paymentStatus === 'Paid' && (<div className="animate-fade-in-down space-y-2 pt-2 border-t border-white/5"><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ជ្រើសរើសគណនីធនាគារ</p><div className="bg-black/20 p-2 rounded-[1.5rem] border border-white/5 max-h-48 overflow-y-auto custom-scrollbar"><BankSelector bankAccounts={appData.bankAccounts || []} selectedBankName={paymentInfo} onSelect={setPaymentInfo} fulfillmentStore={order['Fulfillment Store']} /></div></div>)}</div></fieldset>
                </div>
                <div className="p-6 border-t border-white/5 bg-black/20 flex gap-3"><button onClick={onClose} disabled={isLoading} className="flex-1 py-4 rounded-2xl bg-gray-800 text-white font-black text-xs uppercase tracking-widest hover:bg-gray-700 transition-all border border-white/5 active:scale-95">បោះបង់</button><button onClick={handleConfirm} disabled={isLoading || (paymentStatus === 'Paid' && !paymentInfo)} className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-900/30 active:scale-95">{isLoading ? <Spinner size="sm" /> : 'បញ្ជាក់ការដឹកជោគជ័យ'}</button></div>
            </div>
        </div>
    );
};

// 2. Fulfillment Card Component
const FulfillmentCard: React.FC<{ 
    order: ParsedOrder; 
    onStatusChange: (order: ParsedOrder, status: FulfillmentStatus, extra?: any) => void;
    onConfirmDelivery: (order: ParsedOrder) => void;
    isLoading: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onViewDetails: (order: ParsedOrder) => void;
}> = ({ order, onStatusChange, onConfirmDelivery, isLoading, isSelected, onSelect, onViewDetails }) => {
    const { previewImage, appData } = useContext(AppContext);
    const currentStatus = order.FulfillmentStatus || 'Pending';
    const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);
    const driver = appData.drivers?.find(d => d.DriverName === (order['Driver Name'] || order['Internal Shipping Details']));
    const bank = appData.bankAccounts?.find(b => b.BankName === order['Payment Info']);
    const phone = order['Customer Phone'] || '';
    const phoneCarrier = appData.phoneCarriers?.find(c => (c.Prefixes || '').split(',').some(p => phone.startsWith(p.trim())));

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

    return (
        <div className={`bg-[#0f172a] border ${isSelected ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'border-white/5'} rounded-[2rem] overflow-hidden shadow-2xl flex flex-col h-full group transition-all duration-300 relative`}>
            {isLoading && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"><Spinner size="lg" /></div>}
            {(currentStatus === 'Shipped' || currentStatus === 'Ready to Ship') && (
                <div className="absolute top-4 left-4 z-10"><input type="checkbox" checked={isSelected} onChange={() => onSelect(order['Order ID'])} className={`w-5 h-5 rounded border-gray-600 focus:ring-opacity-50 bg-black/50 cursor-pointer ${currentStatus === 'Ready to Ship' ? 'text-amber-500 focus:ring-amber-500' : 'text-emerald-500 focus:ring-emerald-500'}`} /></div>
            )}
            <div className={`p-5 pb-3 border-b border-white/5 flex justify-between items-start bg-white/[0.02] ${(currentStatus === 'Shipped' || currentStatus === 'Ready to Ship') ? 'pl-12' : ''}`}>
                <div className="flex flex-col">
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(order['Order ID']).then(() => alert('Copied ID')); }} className="text-sm font-black text-white tracking-tighter hover:text-blue-400 transition-colors flex items-center gap-1 group/id text-left">#{order['Order ID'].substring(0, 10)}</button>
                    <p className="text-gray-500 text-[10px] mt-1 font-bold italic line-clamp-1">{order.Location}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className={`px-2 py-1 rounded-full text-[8px] font-black uppercase border ${getStatusColor(currentStatus)}`}>{currentStatus}</div>
                    <button onClick={() => onViewDetails(order)} className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all border border-white/5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                </div>
            </div>
            <div className="p-5 flex-grow space-y-4">
                <div className="flex justify-between items-center"><div className="flex items-center gap-3">{phoneCarrier && <div className="w-8 h-8 rounded-lg bg-white/5 p-1 border border-white/10"><img src={convertGoogleDriveUrl(phoneCarrier.CarrierLogoURL)} className="w-full h-full object-contain" alt="" /></div>}<div><p className="text-white font-black text-sm">{order['Customer Name']}</p><p className="text-blue-400 font-mono text-[11px] font-bold">{order['Customer Phone']}</p></div></div></div>
                {/* Team, Page, User Badge Section */}
                <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-4 py-1.5 bg-blue-600 text-white text-sm font-black uppercase rounded-xl shadow-xl shadow-blue-900/40 tracking-wider">
                        Team: {order.Team}
                    </span>
                    <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-black uppercase rounded-xl border border-purple-500/20 tracking-wider">
                        Page: {order.Page}
                    </span>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase rounded-xl border border-emerald-500/20 tracking-wider">
                        User: {order.User}
                    </span>
                </div>
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-2 shadow-inner">
                    <div className="flex justify-between items-center text-[10px] font-black"><div className="flex items-center gap-2"><span className="text-gray-500 uppercase tracking-widest">Shipping</span>{shippingMethod && <img src={convertGoogleDriveUrl(shippingMethod.LogosURL)} className="w-4 h-4 object-contain" alt="" />}</div><span className="text-indigo-400">{order['Internal Shipping Method']}</span></div>
                    {(order['Driver Name'] || order['Internal Shipping Details']) && (<div className="flex justify-between items-center text-[10px] font-black"><div className="flex items-center gap-2"><span className="text-gray-500 uppercase tracking-widest">Driver</span>{driver && <img src={convertGoogleDriveUrl(driver.ImageURL)} className="w-4 h-4 rounded-full object-cover" alt="" />}</div><span className="text-emerald-400">{order['Driver Name'] || order['Internal Shipping Details']}</span></div>)}
                    {(order['Payment Method'] || order['Payment Info']) && (<div className="flex justify-between items-center text-[10px] font-black"><div className="flex items-center gap-2"><span className="text-gray-500 uppercase tracking-widest">Payment</span>{bank && <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-4 h-4 object-contain" alt="" />}</div><span className="text-amber-400">{order['Payment Method'] || order['Payment Info']}</span></div>)}
                    {order['Packed By'] && <div className="flex justify-between items-center text-[10px] font-black pt-1 border-t border-white/5"><span className="text-gray-500 uppercase tracking-widest">អ្នកវេចខ្ចប់</span><span className="text-indigo-400">{order['Packed By']}</span></div>}
                    {order['Dispatched By'] && <div className="flex justify-between items-center text-[10px] font-black"><span className="text-gray-500 uppercase tracking-widest">អ្នកប្រគល់ឱ្យអ្នកដឹក</span><span className="text-orange-400">{order['Dispatched By']}</span></div>}
                </div>
                <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">{order.Products.map((p, i) => (<div key={i} className="flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-gray-900 border border-gray-800" onClick={() => previewImage(convertGoogleDriveUrl(p.image))}><img src={convertGoogleDriveUrl(p.image)} className="w-full h-full object-cover" alt="" /></div>))}<span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-[10px] text-gray-400 font-bold border border-white/5">x{order.Products.length}</span></div>
            </div>
            {currentStatus === 'Shipped' && (<div className="p-4 pt-0 mt-auto border-t border-white/5 bg-black/20"><button onClick={() => onConfirmDelivery(order)} className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>បញ្ជាក់ថាដឹកជោគជ័យ</button></div>)}
        </div>
    );
};

// 3. Main Dashboard Component
const FulfillmentDashboard: React.FC<{ orders: ParsedOrder[] }> = ({ orders }) => {
    const { refreshData, setMobilePageTitle, appData, currentUser, previewImage } = useContext(AppContext);
    
    // 1. Core State
    const [selectedStore, setSelectedStore] = useState<string>('');
    const [activeTab, setActiveTab] = useState<FulfillmentStatus>('Pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [confirmModalOrder, setConfirmModalOrder] = useState<ParsedOrder | null>(null);
    const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    
    // Grace Period State
    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [pendingAction, setPendingAction] = useState<{ type: 'single' | 'bulk', order?: ParsedOrder, status: string, extraData: any, ids?: string[] } | null>(null);
    const [isUndoing, setIsUndoing] = useState(false);

    const [filters, setFilters] = useState<FilterState>({
        datePreset: 'today', startDate: '', endDate: '', team: '', user: '',
        paymentStatus: '', shippingService: '', driver: '', product: '',
        bank: '', fulfillmentStore: '', store: '', page: '', location: '',
        internalCost: '', customerName: '',
    });

    // 2. Effects (Must be before any early return)
    useEffect(() => {
        setMobilePageTitle(selectedStore ? `HUB: ${selectedStore}` : 'ជ្រើសរើសឃ្លាំង');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle, selectedStore]);

    useEffect(() => {
        setSelectedOrderIds(new Set());
    }, [activeTab, selectedStore]);

    useEffect(() => {
        let interval: any;
        if (undoTimer !== null && undoTimer > 0) {
            interval = setInterval(() => setUndoTimer(prev => (prev !== null ? prev - 1 : null)), 1000);
        } else if (undoTimer === 0) {
            commitPendingAction();
        }
        return () => clearInterval(interval);
    }, [undoTimer]);

    // 3. Memos & Derived Data
    const storeOrders = useMemo(() => {
        if (!selectedStore) return [];
        return orders.filter(o => {
            const s = o['Fulfillment Store'] || 'Unassigned';
            return s.trim().toLowerCase() === selectedStore.trim().toLowerCase();
        });
    }, [orders, selectedStore]);

    const { ordersByStatus, updateStatus, loadingId } = useFulfillment(storeOrders, refreshData);

    const availableStores = useMemo(() => {
        return appData.stores ? appData.stores.map((s: any) => s.StoreName) : [];
    }, [appData.stores]);

    const getOrderTimestamp = (order: any) => {
        const ts = order.Timestamp;
        if (!ts) return 0;
        const match = ts.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
        
        if (typeof ts === 'string' && ts.endsWith('Z')) {
            return new Date(ts.slice(0, -1)).getTime();
        }
        
        return new Date(ts).getTime();
    };

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

    const filteredList = useMemo(() => {
        let list = ordersByStatus[activeTab] || [];
        list = list.filter(order => {
            if (filters.datePreset !== 'all') {
                const ts = getOrderTimestamp(order);
                const orderDate = new Date(ts);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                let start: Date | null = null;
                let end: Date | null = null;
                switch (filters.datePreset) {
                    case 'today': 
                        start = today; 
                        end = new Date(today); 
                        end.setHours(23, 59, 59, 999); 
                        break;
                    case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
                    case 'this_week': const day = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); break;
                    case 'last_week': start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59); break;
                    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
                    case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
                    case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
                    case 'custom': if (filters.startDate) start = new Date(filters.startDate + 'T00:00:00'); if (filters.endDate) end = new Date(filters.endDate + 'T23:59:59'); break;
                }
                if (start && orderDate < start) return false;
                if (end && orderDate > end) return false;
            }
            const isMatch = (f: string, v: string) => { if (!f) return true; return f.split(',').map(x => x.trim().toLowerCase()).includes((v || '').trim().toLowerCase()); };
            if (!isMatch(filters.team, order.Team)) return false;
            if (!isMatch(filters.user, order.User || '')) return false;
            if (!isMatch(filters.paymentStatus, order['Payment Status'])) return false;
            if (!isMatch(filters.shippingService, order['Internal Shipping Method'])) return false;
            if (!isMatch(filters.customerName, order['Customer Name'])) return false;
            if (searchTerm.trim()) { const q = searchTerm.toLowerCase(); return order['Order ID'].toLowerCase().includes(q) || (order['Customer Name'] || '').toLowerCase().includes(q) || (order['Customer Phone'] || '').includes(q); }
            return true;
        });
        return list.sort((a, b) => b['Order ID'].localeCompare(a['Order ID']));
    }, [activeTab, ordersByStatus, searchTerm, filters]);

    // 4. Action Handlers
    const commitPendingAction = async () => {
        if (!pendingAction) return;
        const { type, order, status, extraData, ids } = pendingAction;
        setUndoTimer(null); setPendingAction(null);
        if (type === 'single' && order) await updateStatus(order['Order ID'], status as any, extraData);
        else if (type === 'bulk' && ids) await executeBulkAction(ids, status as any, extraData);
    };

    const handleUndoAction = () => { setIsUndoing(true); setTimeout(() => { setUndoTimer(null); setPendingAction(null); setIsUndoing(false); }, 500); };

    const executeBulkAction = async (ids: string[], targetStatus: string, extraData: any = {}) => {
        setIsUpdatingBulk(true);
        const promises = ids.map(async (id) => {
            return fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'AllOrders',
                    primaryKey: { 'Order ID': id },
                    newData: { 'Fulfillment Status': targetStatus, ...extraData }
                })
            });
        });

        // Broadcast (Optimistic)
        const bulkMsg = targetStatus === 'Shipped' 
            ? `🚚 **[BULK DISPATCH]** ${ids.length} orders dispatched by **${currentUser?.FullName}**`
            : `📦 **[BULK STATUS]** ${ids.length} orders moved to **${targetStatus}** by **${currentUser?.FullName}**`;
        
        fetch(`${WEB_APP_URL}/api/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ UserName: 'System', MessageType: 'Text', Content: bulkMsg }) }).catch(() => {});

        Promise.all(promises).then(() => { refreshData(); }).finally(() => { setIsUpdatingBulk(false); setSelectedOrderIds(new Set()); });
    };

    const handleAction = (order: ParsedOrder, status: string, extraData: any = {}) => {
        setPendingAction({ type: 'single', order, status, extraData });
        setUndoTimer(3);
        
        // Optimistic UI: Auto switch tab after a short delay to simulate speed
        if (status === 'Delivered' && activeTab === 'Shipped') {
            setTimeout(() => setActiveTab('Delivered'), 500);
        } else if (status === 'Shipped' && activeTab === 'Ready to Ship') {
            setTimeout(() => setActiveTab('Shipped'), 500);
        }
    };

    const handleBulkAction = (targetStatus: string, extraData: any = {}) => {
        if (selectedOrderIds.size === 0) return;
        setPendingAction({ type: 'bulk', ids: Array.from(selectedOrderIds), status: targetStatus, extraData });
        setUndoTimer(3);
    };

    const handleSelectOrder = (id: string) => {
        setSelectedOrderIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        const currentTabList = ordersByStatus[activeTab] || [];
        if (selectedOrderIds.size === currentTabList.length) setSelectedOrderIds(new Set());
        else setSelectedOrderIds(new Set(currentTabList.map(o => o['Order ID'])));
    };

    // 5. Final Return (UI)
    if (!selectedStore) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 animate-fade-in">
                <div className="w-full max-w-md bg-[#0f172a]/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 sm:p-10 shadow-3xl text-center space-y-8 relative overflow-hidden">
                    <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="relative z-10 space-y-4">
                        <div className="w-20 h-20 bg-blue-600/20 rounded-3xl mx-auto flex items-center justify-center border-2 border-blue-500/30 shadow-xl shadow-blue-900/20"><span className="text-4xl">🏬</span></div>
                        <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter">ជ្រើសរើសឃ្លាំង</h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select Fulfillment Store</p>
                    </div>
                    <div className="relative z-10 space-y-3">
                        {availableStores.map(store => (
                            <button key={store} onClick={() => setSelectedStore(store)} className="w-full py-4 px-6 bg-gray-900/50 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/50 rounded-2xl text-white font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-between group">
                                <span>{store}</span><svg className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    const statusTabs: { id: FulfillmentStatus, label: string, color: string, icon: string }[] = [
        { id: 'Pending', label: 'មិនទាន់វេចខ្ចប់', color: 'blue', icon: '📥' },
        { id: 'Ready to Ship', label: 'ខ្ចប់រួច', color: 'amber', icon: '📦' },
        { id: 'Shipped', label: 'កំពុងដឹក', color: 'purple', icon: '🚚' },
        { id: 'Delivered', label: 'ដឹកជោគជ័យ', color: 'emerald', icon: '✅' }
    ];

    return (
        <div className="space-y-6 pb-24 animate-fade-in relative">
            <div className="bg-[#0f172a]/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-6 lg:p-8 flex flex-col lg:flex-row justify-between items-center gap-6 shadow-3xl">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-indigo-900/40"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg></div>
                    <div><h1 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3"><span>កញ្ចប់ឥវ៉ាន់</span><span className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg border border-indigo-500/30">{selectedStore}</span></h1><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Fulfillment Tracking</p></div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    <button onClick={() => setSelectedStore('')} className="w-full sm:w-auto px-6 py-3 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-white/5 active:scale-95 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>ប្ដូរឃ្លាំង</button>
                    <button onClick={refreshData} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-xl border border-white/5 active:scale-90 transition-all shadow-xl group flex justify-center"><svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                </div>
            </div>

            <div className="bg-gray-800/20 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-5 sm:p-6 mb-8 shadow-2xl relative z-20 group transition-all hover:bg-gray-800/30 max-w-6xl mx-auto">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="relative w-full lg:max-w-2xl group">
                        <input type="text" placeholder="ស្វែងរក ID, ឈ្មោះ, ឬលេខទូរស័ព្ទ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="form-input !pl-16 !py-5 bg-black/40 border-gray-800 rounded-[1.8rem] text-[15px] font-bold text-white placeholder:text-gray-700 focus:border-blue-500/50 focus:bg-black/60 transition-all shadow-inner" />
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-4 text-gray-700 group-focus-within:text-blue-500 transition-colors"><svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><div className="h-6 w-px bg-gray-800"></div></div>
                    </div>
                    <button onClick={() => setIsFilterModalOpen(true)} className="flex items-center justify-center gap-3 px-8 py-5 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all active:scale-95"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>Filters</button>
                </div>
            </div>

            <div className="flex justify-center px-2">
                <div className="flex bg-black/40 p-1.5 rounded-[2rem] border border-white/5 overflow-x-auto no-scrollbar max-w-full shadow-inner gap-1">
                    {statusTabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        const count = storeOrders.filter(o => (o.FulfillmentStatus || 'Pending') === tab.id).length;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap relative ${isActive ? `bg-white/10 text-white shadow-lg` : 'text-gray-500 hover:text-gray-300'}`}>
                                <span>{tab.icon}</span><span className="hidden sm:inline">{tab.label}</span><span className={`px-2 py-0.5 rounded-lg text-[9px] font-mono ${isActive ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-gray-600'}`}>{count}</span>
                                {isActive && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-10 h-1 bg-indigo-500 rounded-full animate-pulse"></div>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {(activeTab === 'Shipped' || activeTab === 'Ready to Ship') && storeOrders.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-[#1e293b]/50 p-4 rounded-3xl border border-white/5 max-w-6xl mx-auto shadow-2xl">
                    <div className="flex items-center gap-3 pl-2">
                        <input type="checkbox" checked={selectedOrderIds.size === storeOrders.filter(o => (o.FulfillmentStatus || 'Pending') === activeTab).length} onChange={handleSelectAll} className={`w-6 h-6 rounded border-gray-600 focus:ring-opacity-50 bg-black/50 cursor-pointer ${activeTab === 'Ready to Ship' ? 'text-amber-500' : 'text-emerald-500'}`} />
                        <div className="flex flex-col"><span className="text-[13px] font-black text-white uppercase tracking-wider">បានជ្រើសរើស: <span className={activeTab === 'Ready to Ship' ? 'text-amber-500' : 'text-emerald-500'}>{selectedOrderIds.size}</span></span><span className="text-[9px] text-gray-500 font-bold uppercase">ប្តូរស្ថានភាពជាក្រុម</span></div>
                    </div>
                    {selectedOrderIds.size > 0 && (
                        <div className="flex flex-wrap justify-center gap-3">
                            <button onClick={() => handleBulkAction(activeTab === 'Ready to Ship' ? 'Pending' : 'Ready to Ship', activeTab === 'Ready to Ship' ? { 'Packed By': '', 'Packed Time': '', 'Package Photo URL': '' } : { 'Dispatched Time': '', 'Dispatched By': '' })} className="px-6 py-3 rounded-2xl bg-gray-800 text-red-400 font-black uppercase text-[11px] tracking-widest border border-red-500/20 active:scale-95 transition-all">UNDO ទាំងអស់</button>
                            <button onClick={() => activeTab === 'Ready to Ship' ? handleBulkAction('Shipped', { 'Dispatched Time': new Date().toLocaleString('km-KH'), 'Dispatched By': currentUser?.FullName || 'System' }) : handleBulkAction('Delivered')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl text-white ${activeTab === 'Ready to Ship' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{activeTab === 'Ready to Ship' ? 'បញ្ជាក់ការបញ្ចេញ' : 'បញ្ជាក់ជោគជ័យ'}</button>
                        </div>
                    )}
                </div>
            )}

            {filteredList.length === 0 ? (
                <div className="py-20 text-center bg-gray-900/20 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-4"><span className="text-4xl opacity-50">📂</span><p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">មិនមានទិន្នន័យទេ</p></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 min-[1280px]:grid-cols-3 min-[1440px]:grid-cols-4 min-[1600px]:grid-cols-4 min-[1920px]:grid-cols-5 gap-4 min-[1366px]:gap-5 min-[1600px]:gap-6">
                    {filteredList.map(order => (<FulfillmentCard key={order['Order ID']} order={order} onStatusChange={handleAction} onConfirmDelivery={(o) => setConfirmModalOrder(o)} isLoading={loadingId === order['Order ID'] || isUpdatingBulk} isSelected={selectedOrderIds.has(order['Order ID'])} onSelect={handleSelectOrder} onViewDetails={(o) => setViewingOrder(o)} />))}
                </div>
            )}

            <ConfirmDeliveryModal order={confirmModalOrder} onClose={() => setConfirmModalOrder(null)} onConfirm={(o, u) => handleAction(o, 'Delivered', u)} isLoading={loadingId === confirmModalOrder?.['Order ID']} />
            
            {viewingOrder && (
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-3xl">
                    <div className="p-6 sm:p-10 bg-[#0f172a] rounded-[2.5rem] border border-white/10 shadow-3xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-start mb-8 border-b border-white/5 pb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30 text-blue-400"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
                                <div><h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">ព័ត៌មានលម្អិត</h3><p className="text-blue-400 font-mono text-sm font-bold mt-1">ID: #{viewingOrder['Order ID']}</p></div>
                            </div>
                            <button onClick={() => setViewingOrder(null)} className="w-12 h-12 rounded-2xl bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/5"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <div className="flex-grow overflow-y-auto custom-scrollbar space-y-8 pr-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-black/20 p-5 rounded-3xl border border-white/5"><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Customer Info</p><p className="text-white font-black text-lg">{viewingOrder['Customer Name']}</p><p className="text-blue-400 font-mono font-bold text-base">{viewingOrder['Customer Phone']}</p><p className="text-gray-400 text-sm mt-2">{viewingOrder.Location} - {viewingOrder['Address Details']}</p></div>
                                <div className="bg-blue-600/5 p-5 rounded-3xl border border-white/5"><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">System Context</p><div className="grid grid-cols-2 gap-4"><div><span className="text-[9px] text-gray-500 font-bold uppercase block">Team</span><span className="text-white font-black text-sm">{viewingOrder.Team}</span></div><div><span className="text-[9px] text-gray-500 font-bold uppercase block">Page</span><span className="text-white font-black text-xs">{viewingOrder.Page}</span></div><div><span className="text-[9px] text-gray-500 font-bold uppercase block">User</span><span className="text-white font-black text-xs">{viewingOrder.User}</span></div><div><span className="text-[9px] text-gray-500 font-bold uppercase block">Store</span><span className="text-orange-400 font-black text-xs">{viewingOrder['Fulfillment Store']}</span></div></div></div>
                            </div>
                            <div className="bg-black/20 p-5 rounded-3xl border border-white/5"><p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Logistics</p><div className="space-y-3"><div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-bold uppercase">Shipping</span><span className="text-indigo-400 font-black text-xs">{viewingOrder['Internal Shipping Method']}</span></div><div className="flex justify-between items-center"><span className="text-[10px] text-gray-500 font-bold uppercase">Payment</span><span className="text-amber-400 font-black text-xs">{viewingOrder['Payment Info'] || viewingOrder['Payment Status']}</span></div></div></div>
                            <div className="space-y-4"><div className="flex items-center gap-3"><div className="h-px flex-grow bg-gray-800"></div><span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Products</span><div className="h-px flex-grow bg-gray-800"></div></div><div className="space-y-3">{viewingOrder.Products.map((p, i) => (<div key={i} className="flex items-center gap-4 bg-white/[0.02] p-3 rounded-2xl border border-white/5"><img src={convertGoogleDriveUrl(p.image)} className="w-14 h-14 rounded-xl object-cover border border-white/10" alt="" /><div className="flex-grow min-w-0"><p className="text-white font-black text-sm truncate">{p.name}</p><p className="text-blue-400 font-black text-sm">x{p.quantity}</p></div></div>))}</div></div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-white/5 flex justify-end"><button onClick={() => setViewingOrder(null)} className="px-10 py-4 bg-gray-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">បិទ</button></div>
                    </div>
                </Modal>
            )}

            {undoTimer !== null && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md">
                    <div className="relative bg-[#0f172a]/90 border border-white/10 rounded-[2.5rem] p-12 w-full max-w-sm shadow-[0_20px_70px_rgba(0,0,0,0.5)] text-center overflow-hidden ring-1 ring-white/10">
                        <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center"><svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" className="stroke-gray-800 fill-none" strokeWidth="6" /><circle cx="50" cy="50" r="45" className="stroke-blue-500 fill-none transition-all duration-1000 ease-linear" strokeWidth="6" strokeDasharray="282.7" strokeDashoffset={282.7 - (282.7 * (undoTimer / 3))} strokeLinecap="round" /></svg><div className="absolute inset-0 flex items-center justify-center"><span className="text-4xl font-black text-white">{undoTimer}</span></div></div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">កំពុងរៀបចំ...</h3>
                        <button onClick={handleUndoAction} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest active:scale-95">UNDO (បោះបង់)</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FulfillmentDashboard;