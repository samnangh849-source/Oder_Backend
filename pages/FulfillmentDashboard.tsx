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
    const { previewImage } = useContext(AppContext);
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
                    <h4 className="text-sm font-black text-white tracking-tighter">#{order['Order ID'].substring(0, 10)}</h4>
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
                    <div>
                        <p className="text-white font-black text-sm">{order['Customer Name']}</p>
                        <p className="text-blue-400 font-mono text-[11px] font-bold">{order['Customer Phone']}</p>
                    </div>
                </div>

                {/* Logistics Details */}
                <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-2 shadow-inner">
                    <div className="flex justify-between items-center text-[10px] font-black">
                        <span className="text-gray-500 uppercase tracking-widest">Shipping</span>
                        <span className="text-indigo-400">{order['Internal Shipping Method']}</span>
                    </div>
                    {order['Driver Name'] && (
                        <div className="flex justify-between items-center text-[10px] font-black">
                            <span className="text-gray-500 uppercase tracking-widest">Driver</span>
                            <span className="text-emerald-400">{order['Driver Name']}</span>
                        </div>
                    )}
                    {order['Payment Method'] && (
                        <div className="flex justify-between items-center text-[10px] font-black">
                            <span className="text-gray-500 uppercase tracking-widest">Payment</span>
                            <span className="text-amber-400">{order['Payment Method']}</span>
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
    const { refreshData, setMobilePageTitle, appData } = useContext(AppContext);
    const { ordersByStatus, updateStatus, loadingId } = useFulfillment(orders, refreshData);
    
    // We only need 4 tabs for Fulfillment Tracking
    const [activeTab, setActiveTab] = useState<FulfillmentStatus>('Pending');
    const [storeFilter, setStoreFilter] = useState('All');
    
    // Selection state for Bulk Actions
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [confirmModalOrder, setConfirmModalOrder] = useState<ParsedOrder | null>(null);
    const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

    const statusTabs: { id: FulfillmentStatus, label: string, color: string, icon: string }[] = [
        { id: 'Pending', label: 'មិនទាន់វេចខ្ចប់', color: 'blue', icon: '📥' },
        { id: 'Ready to Ship', label: 'ខ្ចប់រួច', color: 'amber', icon: '📦' },
        { id: 'Shipped', label: 'កំពុងដឹក', color: 'purple', icon: '🚚' },
        { id: 'Delivered', label: 'ដឹកជោគជ័យ', color: 'emerald', icon: '✅' }
    ];

    useEffect(() => {
        setMobilePageTitle('ការតាមដានកញ្ចប់ឥវ៉ាន់');
        return () => setMobilePageTitle(null);
    }, [setMobilePageTitle]);

    // Reset selection when changing tabs
    useEffect(() => {
        setSelectedOrderIds(new Set());
    }, [activeTab]);

    const filteredList = useMemo(() => {
        let list = ordersByStatus[activeTab] || [];
        // Processing might be rolled into Pending or Ready depending on how you use it. 
        // For now, if activeTab is Pending, we might want to include Processing if they are mid-pack, 
        // but sticking to exact matches is safer unless specified.
        if (storeFilter !== 'All') {
            list = list.filter(o => o['Fulfillment Store'] === storeFilter);
        }
        return list;
    }, [activeTab, ordersByStatus, storeFilter]);

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

    return (
        <div className="space-y-6 pb-24 animate-fade-in relative">
            {/* Header Section */}
            <div className="bg-[#0f172a]/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-6 lg:p-8 flex flex-col lg:flex-row justify-between items-center gap-6 shadow-3xl">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-indigo-900/40">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-tight">តាមដានកញ្ចប់ឥវ៉ាន់</h1>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Fulfillment Tracking</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                    {/* Store Filter */}
                    <div className="relative w-full sm:w-64">
                        <select 
                            value={storeFilter}
                            onChange={(e) => setStoreFilter(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-3 text-xs font-black text-white uppercase tracking-widest focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option value="All">គ្រប់សាខាទាំងអស់</option>
                            {appData.stores?.map(s => <option key={s.StoreName} value={s.StoreName}>{s.StoreName}</option>)}
                        </select>
                        <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>

                    <button 
                        onClick={refreshData}
                        className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-xl border border-white/5 active:scale-90 transition-all shadow-xl group"
                    >
                        <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            {/* Status Tabs Navigation */}
            <div className="flex justify-center px-2">
                <div className="flex bg-black/40 p-1.5 rounded-[2rem] border border-white/5 overflow-x-auto no-scrollbar max-w-full shadow-inner gap-1">
                    {statusTabs.map(tab => {
                        const isActive = activeTab === tab.id;
                        const count = ordersByStatus[tab.id]?.length || 0;
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
                                {isActive && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1]"></div>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Bulk Actions Bar for 'Shipped' tab */}
            {activeTab === 'Shipped' && filteredList.length > 0 && (
                <div className="flex justify-between items-center bg-[#1e293b]/50 p-3 rounded-2xl border border-white/5">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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