
import React, { useState, useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';
import { WEB_APP_URL } from '../../constants';
import { ParsedOrder } from '../../types';
import BulkActionBarDesktop from './BulkActionBarDesktop';
import BulkActionBarMobile from './BulkActionBarMobile';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import ShippingMethodDropdown from '../common/ShippingMethodDropdown';
import DriverSelector from '../orders/DriverSelector';
import Spinner from '../common/Spinner';

interface BulkActionManagerProps {
    orders: ParsedOrder[];
    selectedIds: Set<string>;
    onComplete: () => void;
    onClearSelection: () => void;
    onOptimisticUpdate?: (ids: string[], status: string) => void;
}

const BulkActionManager: React.FC<BulkActionManagerProps> = ({ orders, selectedIds, onComplete, onClearSelection, onOptimisticUpdate }) => {
    const { appData, currentUser, refreshData, isSidebarCollapsed } = useContext(AppContext);
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Modals visibility
    const [activeModal, setActiveModal] = useState<'cost' | 'payment' | 'shipping' | 'delete' | 'date' | null>(null);

    // Form states
    const [costValue, setCostValue] = useState('');
    const [bulkDate, setBulkDate] = useState('');
    
    // Payment States
    const [paymentStatus, setPaymentStatus] = useState('Paid');
    const [paymentInfo, setPaymentInfo] = useState('');

    // Shipping States
    const [shippingMethod, setShippingMethod] = useState('');
    const [shippingDriver, setShippingDriver] = useState('');
    const [shippingCost, setShippingCost] = useState('');
    
    const [deletePassword, setDeletePassword] = useState('');

    const handleBulkSendTelegram = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`តើអ្នកចង់ផ្ញើការកម្មង់ទាំង ${selectedIds.size} នេះទៅ Telegram មែនទេ?`)) return;

        setIsProcessing(true);
        try {
            const idArray = Array.from(selectedIds);
            
            // Optimistic update
            if (onOptimisticUpdate) {
                onOptimisticUpdate(idArray, 'CHECKING');
            }
            
            const sendPromises = idArray.map(async (id) => {
                return fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ 
                        orderId: id, 
                        newData: { "Force Sync": true }
                    })
                });
            });

            await Promise.all(sendPromises);
            
            // Wait longer for background workers to finish their Apps Script calls
            // Apps Script can take 3-5 seconds per call, and they run in parallel but 
            // the background worker might be processing the queue.
            setTimeout(() => {
                refreshData();
                onComplete();
            }, 3000);
            
        } catch (e) {
            console.error("Bulk Telegram send failed:", e);
            alert("ការផ្ញើទៅ Telegram បរាជ័យ!");
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredBanks = React.useMemo(() => {
        if (!appData.bankAccounts) return [];
        
        const selectedOrders = orders.filter(o => selectedIds.has(o['Order ID']));
        const stores = new Set(selectedOrders.map(o => o['Fulfillment Store']).filter(Boolean));
        
        if (stores.size === 1) {
            const store = Array.from(stores)[0] as string;
            return appData.bankAccounts.filter((bank: any) => {
                const assignedStores = bank.AssignedStores || '';
                if (!assignedStores || assignedStores.trim() === '') return true;
                const storesList = assignedStores.split(',').map((s: string) => s.trim().toLowerCase());
                return storesList.includes(String(store || '').toLowerCase()) || storesList.includes('all');
            });
        }
        
        return appData.bankAccounts;
    }, [appData.bankAccounts, orders, selectedIds]);

    const handleBulkUpdate = async (partialUpdate: any, confirmMsg?: string) => {
        if (selectedIds.size === 0) return;
        if (confirmMsg && !window.confirm(confirmMsg)) return;

        setIsProcessing(true);
        try {
            const idArray = Array.from(selectedIds);
            
            // Create an array of update promises to run in parallel
            const updatePromises = idArray.map(async (id) => {
                const originalOrder = orders.find(o => o['Order ID'] === id);
                if (!originalOrder) return null;

                const mergedData = { ...originalOrder, ...partialUpdate };
                
                const cleanPayload: any = {
                    "Timestamp": mergedData.Timestamp,
                    "Order ID": mergedData['Order ID'],
                    "User": mergedData.User,
                    "Page": mergedData.Page,
                    "TelegramValue": mergedData.TelegramValue,
                    "Customer Name": mergedData['Customer Name'],
                    "Customer Phone": mergedData['Customer Phone'],
                    "Location": mergedData.Location,
                    "Address Details": mergedData['Address Details'],
                    "Note": mergedData.Note || "",
                    "Shipping Fee (Customer)": mergedData['Shipping Fee (Customer)'],
                    "Subtotal": mergedData.Subtotal,
                    "Grand Total": mergedData['Grand Total'],
                    "Internal Shipping Method": mergedData['Internal Shipping Method'],
                    "Internal Shipping Details": mergedData['Internal Shipping Details'],
                    "Internal Cost": Number(mergedData['Internal Cost']) || 0,
                    "Payment Status": mergedData['Payment Status'],
                    "Payment Info": mergedData['Payment Info'] || "",
                    "Discount ($)": mergedData['Discount ($)'],
                    "Total Product Cost ($)": mergedData['Total Product Cost ($)'],
                    "Fulfillment Store": mergedData['Fulfillment Store'],
                    "Team": mergedData.Team,
                    "Scheduled Time": mergedData['Scheduled Time'] || "",
                    "IsVerified": mergedData.IsVerified
                };

                cleanPayload['Products (JSON)'] = JSON.stringify(mergedData.Products);

                const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ 
                        orderId: id, 
                        team: mergedData.Team, 
                        userName: currentUser?.UserName, 
                        newData: cleanPayload 
                    })
                });
                return response.ok;
            });

            // Run all updates simultaneously
            const results = await Promise.all(updatePromises);
            const successCount = results.filter(r => r === true).length;
            
            if (successCount < idArray.length) {
                console.warn(`Bulk update partially completed: ${successCount}/${idArray.length} succeeded.`);
            }
            
            await refreshData();
            setActiveModal(null);
            onComplete();
        } catch (e) {
            console.error("Bulk update failed:", e);
            alert("ការកែសម្រួលបរាជ័យ!");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkDateUpdate = async () => {
        if (selectedIds.size === 0 || !bulkDate) return;
        setIsProcessing(true);

        try {
            const token = localStorage.getItem('token');
            const idArray = Array.from(selectedIds);
            
            // Parse new date components [Year, Month, Day]
            const [newYear, newMonth, newDay] = bulkDate.split('-').map(Number);

            const updatePromises = idArray.map(async (id) => {
                const originalOrder = orders.find(o => o['Order ID'] === id);
                if (!originalOrder) return null;

                // Create date object from original timestamp to preserve time
                const originalDate = new Date(originalOrder.Timestamp);
                
                // Construct new date object using New Date + Original Time
                const newTimestamp = new Date(
                    newYear, 
                    newMonth - 1, // Month is 0-indexed in JS Date
                    newDay, 
                    originalDate.getHours(), 
                    originalDate.getMinutes(), 
                    originalDate.getSeconds()
                );

                const mergedData = { ...originalOrder, Timestamp: newTimestamp.toISOString() };
                
                const cleanPayload: any = {
                    "Timestamp": mergedData.Timestamp,
                    "Order ID": mergedData['Order ID'],
                    "User": mergedData.User,
                    "Page": mergedData.Page,
                    "TelegramValue": mergedData.TelegramValue,
                    "Customer Name": mergedData['Customer Name'],
                    "Customer Phone": mergedData['Customer Phone'],
                    "Location": mergedData.Location,
                    "Address Details": mergedData['Address Details'],
                    "Note": mergedData.Note || "",
                    "Shipping Fee (Customer)": mergedData['Shipping Fee (Customer)'],
                    "Subtotal": mergedData.Subtotal,
                    "Grand Total": mergedData['Grand Total'],
                    "Internal Shipping Method": mergedData['Internal Shipping Method'],
                    "Internal Shipping Details": mergedData['Internal Shipping Details'],
                    "Internal Cost": Number(mergedData['Internal Cost']) || 0,
                    "Payment Status": mergedData['Payment Status'],
                    "Payment Info": mergedData['Payment Info'] || "",
                    "Discount ($)": mergedData['Discount ($)'],
                    "Total Product Cost ($)": mergedData['Total Product Cost ($)'],
                    "Fulfillment Store": mergedData['Fulfillment Store'],
                    "Team": mergedData.Team,
                    "Scheduled Time": mergedData['Scheduled Time'] || "",
                    "IsVerified": mergedData.IsVerified
                };
                cleanPayload['Products (JSON)'] = JSON.stringify(mergedData.Products);

                return fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        orderId: id, 
                        team: mergedData.Team, 
                        userName: currentUser?.UserName, 
                        newData: cleanPayload 
                    })
                });
            });

            await Promise.all(updatePromises);
            await refreshData();
            setActiveModal(null);
            setBulkDate('');
            onComplete();
        } catch (e) {
            console.error("Bulk date update failed:", e);
            alert("ការកែប្រែកាលបរិច្ឆេទបរាជ័យ!");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        
        setIsProcessing(true);
        try {
            const token = localStorage.getItem('token');
            // 1. Verify password via API
            const verifyRes = await fetch(`${WEB_APP_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username: currentUser?.UserName, 
                    password: deletePassword 
                })
            });

            if (!verifyRes.ok) {
                alert("លេខសម្ងាត់មិនត្រឹមត្រូវ!");
                setIsProcessing(false);
                return;
            }

            // 2. Proceed with parallel deletion
            const idArray = Array.from(selectedIds);
            const deletePromises = idArray.map(async (id) => {
                const order = orders.find(o => o['Order ID'] === id);
                return fetch(`${WEB_APP_URL}/api/admin/delete-order`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        orderId: id,
                        team: order?.Team,
                        userName: currentUser?.UserName,
                        telegramMessageId1: order?.['Telegram Message ID 1'],
                        telegramMessageId2: order?.['Telegram Message ID 2'],
                        telegramChatId: order?.TelegramValue
                    })
                });
            });

            await Promise.all(deletePromises);
            await refreshData();
            setActiveModal(null);
            setDeletePassword('');
            onComplete();
        } catch (e) {
            console.error("Bulk delete failed:", e);
            alert("ការលុបបរាជ័យ!");
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper to check if selected shipping needs driver
    const selectedMethodInfo = appData.shippingMethods?.find(m => m.MethodName === shippingMethod);
    const requiresDriver = selectedMethodInfo?.RequireDriverSelection;

    if (selectedIds.size === 0) return null;

    return (
        <>
            {/* Hide Action Bars when any modal is active */}
            {!activeModal && (
                <>
                    {/* Desktop View */}
                    <BulkActionBarDesktop 
                        selectedCount={selectedIds.size}
                        isSidebarCollapsed={isSidebarCollapsed}
                        isProcessing={isProcessing}
                        onVerify={() => handleBulkUpdate({ 'IsVerified': true }, `បញ្ជាក់លើការកម្មង់ទាំង ${selectedIds.size} នេះ?`)}
                        onUnverify={() => handleBulkUpdate({ 'IsVerified': false })}
                        onSendTelegram={handleBulkSendTelegram}
                        onOpenModal={setActiveModal}
                        onClearSelection={onClearSelection}
                    />

                    {/* Mobile View */}
                    <BulkActionBarMobile 
                        selectedCount={selectedIds.size}
                        isProcessing={isProcessing}
                        onVerify={() => handleBulkUpdate({ 'IsVerified': true }, `បញ្ជាក់លើការកម្មង់ទាំង ${selectedIds.size} នេះ?`)}
                        onUnverify={() => handleBulkUpdate({ 'IsVerified': false })}
                        onSendTelegram={handleBulkSendTelegram}
                        onOpenModal={setActiveModal}
                        onClearSelection={onClearSelection}
                    />
                </>
            )}

            {/* Modals */}
            
            {/* 1. DATE MODAL */}
            <Modal isOpen={activeModal === 'date'} onClose={() => setActiveModal(null)} maxWidth="max-w-sm">
                <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10">
                    <div className="w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyan-500/30">
                        <span className="text-3xl">📅</span>
                    </div>
                    <h3 className="text-xl font-black text-white text-center mb-2 uppercase tracking-tight">កែប្រែកាលបរិច្ឆេទ</h3>
                    <p className="text-[10px] text-gray-500 font-bold text-center mb-6 uppercase tracking-widest">
                        ម៉ោងនឹងរក្សាទុកដូចដើម (Time Unchanged)
                    </p>
                    
                    <div className="relative mb-8">
                        <input 
                            type="date" 
                            value={bulkDate} 
                            onChange={e => setBulkDate(e.target.value)} 
                            className="form-input !bg-black/40 !border-gray-700 !py-4 text-white font-bold text-center rounded-[2rem] focus:ring-4 focus:ring-cyan-500/10 transition-all w-full"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest hover:text-white transition-colors">បោះបង់</button>
                        <button 
                            onClick={handleBulkDateUpdate} 
                            className="py-4 bg-cyan-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-cyan-600/20 active:scale-95 flex items-center justify-center gap-2" 
                            disabled={isProcessing || !bulkDate}
                        >
                            {isProcessing ? <Spinner size="sm"/> : "រក្សាទុក"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 2. COST MODAL */}
            <Modal isOpen={activeModal === 'cost'} onClose={() => setActiveModal(null)} maxWidth="max-w-sm">
                <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10">
                    <h3 className="text-xl font-black text-white text-center mb-8 uppercase tracking-tight">កែប្រែថ្លៃដឹកដើម (Cost)</h3>
                    <div className="relative mb-8">
                        <input type="number" step="0.01" value={costValue} onChange={e => setCostValue(e.target.value)} className="form-input !bg-black/40 !border-gray-700 !py-6 text-blue-400 font-black text-4xl text-center rounded-[2rem] focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="0.00" autoFocus />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-600 font-black text-2xl">$</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest hover:text-white transition-colors">បោះបង់</button>
                        <button onClick={() => handleBulkUpdate({ 'Internal Cost': Number(costValue) })} className="py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2" disabled={isProcessing || !costValue}>
                            {isProcessing ? <Spinner size="sm"/> : "រក្សាទុក"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 3. PAYMENT MODAL */}
            <Modal isOpen={activeModal === 'payment'} onClose={() => setActiveModal(null)} maxWidth="max-w-lg">
                <div className="p-6 sm:p-8 bg-[#0f172a] rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="flex-shrink-0">
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                                <span className="text-xl">💳</span>
                            </div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">កែប្រែស្ថានភាពទូទាត់</h3>
                        </div>
                        
                        {/* Segmented Control for Status */}
                        <div className="flex p-1.5 bg-black/40 rounded-2xl border border-gray-700 mb-6">
                            <button 
                                onClick={() => { setPaymentStatus('Paid'); }}
                                className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl transition-all duration-300 ${paymentStatus === 'Paid' ? 'bg-emerald-600 shadow-lg text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="text-base font-black tracking-wider uppercase">PAID</span>
                                <span className="text-[9px] font-bold opacity-80">(ទូទាត់រួចរាល់)</span>
                            </button>
                            <button 
                                onClick={() => { setPaymentStatus('Unpaid'); setPaymentInfo(''); }}
                                className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl transition-all duration-300 ${paymentStatus === 'Unpaid' ? 'bg-red-600 shadow-lg text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <span className="text-base font-black tracking-wider uppercase">UNPAID</span>
                                <span className="text-[9px] font-bold opacity-80">(មិនទាន់ទូទាត់ - COD)</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto custom-scrollbar px-1">
                        {paymentStatus === 'Paid' ? (
                            <div className="space-y-4 animate-fade-in-down pb-4">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    ជ្រើសរើសគណនីធនាគារ
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {filteredBanks.map((b: any) => {
                                        const isSelected = paymentInfo === b.BankName;
                                        return (
                                            <button 
                                                key={b.BankName} 
                                                onClick={() => setPaymentInfo(b.BankName)}
                                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 group ${isSelected ? 'bg-blue-600/20 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : 'bg-gray-800/40 border-white/5 hover:bg-gray-800 hover:border-white/20'}`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-black/40' : 'bg-black/20'}`}>
                                                    <img src={convertGoogleDriveUrl(b.LogoURL)} className="w-7 h-7 object-contain" alt="" />
                                                </div>
                                                <span className={`text-xs font-black w-full text-left whitespace-normal leading-tight ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                                    {b.BankName}
                                                </span>
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-center opacity-50 space-y-3">
                                <div className="w-16 h-16 rounded-full bg-red-900/20 flex items-center justify-center border border-red-500/20">
                                    <span className="text-3xl grayscale">📦</span>
                                </div>
                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">ការទូទាត់នឹងត្រូវធ្វើឡើងពេលដឹកដល់</p>
                            </div>
                        )}
                    </div>

                    <div className="flex-shrink-0 grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest hover:text-white transition-colors bg-gray-800/50 rounded-2xl hover:bg-gray-800">បោះបង់</button>
                        <button 
                            onClick={() => handleBulkUpdate({ 'Payment Status': paymentStatus, 'Payment Info': paymentStatus === 'Paid' ? paymentInfo : '' })} 
                            className="py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2" 
                            disabled={isProcessing || (paymentStatus === 'Paid' && !paymentInfo)}
                        >
                            {isProcessing ? <Spinner size="sm" /> : 'រក្សាទុកការផ្លាស់ប្តូរ'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 4. SHIPPING MODAL */}
            <Modal isOpen={activeModal === 'shipping'} onClose={() => setActiveModal(null)} maxWidth="max-w-xl">
                <div className="p-6 sm:p-8 bg-[#0f172a] rounded-[2.5rem] border border-white/10 max-h-[85vh] flex flex-col">
                    <h3 className="text-lg font-black text-white text-center mb-6 uppercase tracking-tight flex-shrink-0">កែប្រែក្រុមហ៊ុនដឹកជញ្ជូន</h3>
                    
                    <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 flex-grow">
                        {/* 1. Method Selection using Component */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ជ្រើសរើសសេវាដឹក</p>
                            <ShippingMethodDropdown 
                                methods={appData.shippingMethods || []}
                                selectedMethodName={shippingMethod}
                                onSelect={(m) => { setShippingMethod(m.MethodName); setShippingDriver(''); }}
                            />
                        </div>

                        {/* 2. Driver Selection using Component */}
                        {requiresDriver && (
                            <div className="space-y-3 animate-fade-in">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">ជ្រើសរើសអ្នកដឹក (DriverSelection)*</label>
                                </div>
                                <DriverSelector 
                                    drivers={appData.drivers || []}
                                    selectedDriverName={shippingDriver}
                                    onSelect={setShippingDriver}
                                />
                                {!shippingDriver && <p className="text-center text-[9px] text-gray-500 italic">សូមជ្រើសរើសអ្នកដឹកម្នាក់</p>}
                            </div>
                        )}

                        {/* 3. Cost Input */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">កែប្រែថ្លៃដឹកដើម (Internal Cost)</p>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={shippingCost} 
                                    onChange={e => setShippingCost(e.target.value)} 
                                    className="form-input !bg-black/40 !border-gray-700 !py-4 pl-4 pr-10 rounded-2xl font-black text-white focus:border-blue-500" 
                                    placeholder="បញ្ចូលថ្លៃដឹកថ្មី (បើមាន)" 
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                            </div>
                            <div className="flex gap-2">
                                {[0, 1.25, 1.5, 2.0].map(val => (
                                    <button 
                                        key={val} 
                                        onClick={() => setShippingCost(String(val))}
                                        className="flex-1 py-2 bg-gray-800 border border-gray-700 rounded-xl text-[10px] font-bold text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
                                    >
                                        ${val}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5 flex-shrink-0">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest hover:text-white">បោះបង់</button>
                        <button 
                            onClick={() => {
                                const payload: any = { 'Internal Shipping Method': shippingMethod };
                                if (requiresDriver) payload['Internal Shipping Details'] = shippingDriver;
                                else payload['Internal Shipping Details'] = ''; // Set empty if no driver selection required
                                
                                if (shippingCost) payload['Internal Cost'] = Number(shippingCost);
                                
                                handleBulkUpdate(payload);
                            }} 
                            className="py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            disabled={isProcessing || !shippingMethod || (requiresDriver && !shippingDriver)}
                        >
                            {isProcessing ? <Spinner size="sm" /> : "រក្សាទុក"}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* 5. DELETE MODAL */}
            <Modal isOpen={activeModal === 'delete'} onClose={() => setActiveModal(null)} maxWidth="max-w-md">
                <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2.5" /></svg>
                    </div>
                    <h3 className="text-xl font-black text-white text-center mb-4 uppercase tracking-tight">លុបប្រតិបត្តិការណ៍សរុប</h3>
                    <p className="text-center text-gray-500 text-sm mb-8">តើអ្នកប្រាកដទេថាចង់លុបការកម្មង់ទាំង <strong>{selectedIds.size}</strong> នេះ? សកម្មភាពនេះមិនអាចត្រឡប់ក្រោយបានទេ។</p>
                    
                    <div className="space-y-4 mb-8">
                        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">បញ្ចូលពាក្យសម្ងាត់ដើម្បីបញ្ជាក់</label>
                        <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} className="form-input !bg-red-500/5 !border-red-500/20 !py-4 text-center text-white font-black tracking-widest" placeholder="••••••••" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest">បោះបង់</button>
                        <button 
                            onClick={handleBulkDelete} 
                            className="py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-900/40 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2" 
                            disabled={isProcessing || !deletePassword}
                        >
                            {isProcessing ? (
                                <>
                                    <Spinner size="sm" />
                                    <span>កំពុងលុប...</span>
                                </>
                            ) : (
                                "បាទ, លុបទាំងអស់"
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            <style>{`
                @keyframes pulse-subtle {
                    0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(37,99,235,0.2); }
                    50% { transform: scale(1.05); box-shadow: 0 0 35px rgba(37,99,235,0.4); }
                }
                .animate-pulse-subtle {
                    animation: pulse-subtle 2s infinite ease-in-out;
                }
            `}</style>
        </>
    );
};

export default BulkActionManager;
