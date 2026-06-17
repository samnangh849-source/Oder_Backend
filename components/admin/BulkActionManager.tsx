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
import { logOrderEdit, logUserActivity } from '../../services/auditService';

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
    const [activeModal, setActiveModal] = useState<'cost' | 'payment' | 'shipping' | 'delete' | 'date' | 'cancel' | 'return' | null>(null);

    // Form states
    const [costValue, setCostValue] = useState('');
    const [bulkDate, setBulkDate] = useState('');
    const [actionReason, setActionReason] = useState('');
    
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

    const handleBulkStatusChange = async (status: 'Cancelled' | 'Returned', reason: string) => {
        if (selectedIds.size === 0 || !reason) return;
        setIsProcessing(true);

        try {
            const idArray = Array.from(selectedIds);
            const fullName = currentUser?.FullName || 'System';
            
            const updatePromises = idArray.map(async (id) => {
                const order = orders.find(o => o['Order ID'] === id);
                if (!order) return null;

                const newData: any = { 'Fulfillment Status': status };
                if (status === 'Returned') newData['Return Reason'] = reason;
                else newData['Cancel Reason'] = reason;

                // Log to Edit Logs before updating
                await logOrderEdit(id, fullName, 'Fulfillment Status', order.FulfillmentStatus, status);

                return fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ 
                        orderId: id, 
                        team: order.Team, 
                        userName: fullName, 
                        newData: newData
                    })
                });
            });

            await Promise.all(updatePromises);
            await logUserActivity(fullName, `BULK_${status.toUpperCase()}`, `Bulk ${status} ${idArray.length} orders. Reason: ${reason}`);
            
            await refreshData();
            setActiveModal(null);
            setActionReason('');
            onComplete();
        } catch (e) {
            console.error(`Bulk ${status} failed:`, e);
            alert(`ការផ្លាស់ប្តូរស្ថានភាពបរាជ័យ!`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        
        setIsProcessing(true);
        try {
            const username = currentUser?.UserName || (currentUser as any)?.userName || (currentUser as any)?.user_name;
            const fullName = currentUser?.FullName || 'System';

            if (!username) {
                alert("មិនអាចរកឃើញឈ្មោះអ្នកប្រើប្រាស់ (User name not found)");
                setIsProcessing(false);
                return;
            }

            // 1. Verify password via API
            const verifyRes = await fetch(`${WEB_APP_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userName: username, 
                    password: deletePassword 
                })
            });

            if (!verifyRes.ok) {
                const errorData = await verifyRes.json().catch(() => ({}));
                alert(errorData.message || "លេខសម្ងាត់មិនត្រឹមត្រូវ!");
                setIsProcessing(false);
                return;
            }

            // 2. Proceed with parallel deletion
            const idArray = Array.from(selectedIds);
            const token = localStorage.getItem('token');

            // Log deletions to Edit Logs first
            for (const id of idArray) {
                await logOrderEdit(id, fullName, 'Order', 'Existing', 'DELETED (Bulk)');
            }

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
                        userName: username,
                        fulfillmentStore: order?.['Fulfillment Store'],
                        telegramMessageId1: order?.['Telegram Message ID 1'],
                        telegramMessageId2: order?.['Telegram Message ID 2'],
                        telegramMessageId3: order?.['Telegram Message ID 3'],
                        telegramChatId: order?.TelegramValue
                    })
                });
            });

            await Promise.all(deletePromises);
            await logUserActivity(fullName, 'BULK_DELETE_ORDERS', `Bulk deleted ${idArray.length} orders.`);
            
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
            const fullName = currentUser?.FullName || 'System';
            
            const updatePromises = idArray.map(async (id) => {
                const originalOrder = orders.find(o => o['Order ID'] === id);
                if (!originalOrder) return null;

                const mergedData = { ...originalOrder, ...partialUpdate };
                
                // Log significant changes
                for (const key in partialUpdate) {
                    if (originalOrder[key as keyof ParsedOrder] !== partialUpdate[key]) {
                        await logOrderEdit(id, fullName, key, String(originalOrder[key as keyof ParsedOrder] || ''), String(partialUpdate[key]));
                    }
                }
                
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
                        userName: fullName, 
                        newData: cleanPayload 
                    })
                });
                return response.ok;
            });

            const results = await Promise.all(updatePromises);
            
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
            const fullName = currentUser?.FullName || 'System';
            
            const [newYear, newMonth, newDay] = bulkDate.split('-').map(Number);

            const updatePromises = idArray.map(async (id) => {
                const originalOrder = orders.find(o => o['Order ID'] === id);
                if (!originalOrder) return null;

                const originalDate = new Date(originalOrder.Timestamp);
                const newTimestamp = new Date(
                    newYear, 
                    newMonth - 1, 
                    newDay, 
                    originalDate.getHours(), 
                    originalDate.getMinutes(), 
                    originalDate.getSeconds()
                );

                const newIso = newTimestamp.toISOString();
                await logOrderEdit(id, fullName, 'Timestamp', originalOrder.Timestamp, newIso);

                const mergedData = { ...originalOrder, Timestamp: newIso };
                
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
                        userName: fullName, 
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

    const selectedMethodInfo = appData.shippingMethods?.find(m => m.MethodName === shippingMethod);
    const requiresDriver = selectedMethodInfo?.RequireDriverSelection;

    if (selectedIds.size === 0) return null;

    return (
        <>
            {!activeModal && (
                <>
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

            <Modal isOpen={activeModal === 'date'} onClose={() => setActiveModal(null)} maxWidth="max-w-sm">
                <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10">
                    <div className="w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-cyan-500/30">
                        <span className="text-3xl">📅</span>
                    </div>
                    <h3 className="text-xl font-black text-white text-center mb-2 uppercase tracking-tight">កែប្រែកាលបរិច្ឆេទ</h3>
                    <p className="text-[10px] text-gray-500 font-bold text-center mb-6 uppercase tracking-widest">ម៉ោងនឹងរក្សាទុកដូចដើម</p>
                    <div className="relative mb-8">
                        <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} className="form-input !bg-black/40 !border-gray-700 !py-4 text-white font-bold text-center rounded-[2rem] w-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest">បោះបង់</button>
                        <button onClick={handleBulkDateUpdate} className="py-4 bg-cyan-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2" disabled={isProcessing || !bulkDate}>
                            {isProcessing ? <Spinner size="sm"/> : "រក្សាទុក"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'cost'} onClose={() => setActiveModal(null)} maxWidth="max-w-sm">
                <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10">
                    <h3 className="text-xl font-black text-white text-center mb-8 uppercase tracking-tight">កែប្រែថ្លៃដឹកដើម (Cost)</h3>
                    <div className="relative mb-8">
                        <input type="number" step="0.01" value={costValue} onChange={e => setCostValue(e.target.value)} className="form-input !bg-black/40 !border-gray-700 !py-6 text-blue-400 font-black text-4xl text-center rounded-[2rem]" placeholder="0.00" autoFocus />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-600 font-black text-2xl">$</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest">បោះបង់</button>
                        <button onClick={() => handleBulkUpdate({ 'Internal Cost': Number(costValue) })} className="py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2" disabled={isProcessing || !costValue}>
                            {isProcessing ? <Spinner size="sm"/> : "រក្សាទុក"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'payment'} onClose={() => setActiveModal(null)} maxWidth="max-w-lg">
                <div className="p-6 sm:p-8 bg-[#0f172a] rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="flex-shrink-0">
                        <h3 className="text-xl font-black text-white text-center mb-6 uppercase tracking-tighter">កែប្រែស្ថានភាពទូទាត់</h3>
                        <div className="flex p-1.5 bg-black/40 rounded-2xl border border-gray-700 mb-6">
                            <button onClick={() => setPaymentStatus('Paid')} className={`flex-1 py-4 rounded-xl font-black uppercase ${paymentStatus === 'Paid' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}>PAID</button>
                            <button onClick={() => { setPaymentStatus('Unpaid'); setPaymentInfo(''); }} className={`flex-1 py-4 rounded-xl font-black uppercase ${paymentStatus === 'Unpaid' ? 'bg-red-600 text-white' : 'text-gray-500'}`}>UNPAID</button>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto custom-scrollbar">
                        {paymentStatus === 'Paid' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
                                {filteredBanks.map((b: any) => (
                                    <button key={b.BankName} onClick={() => setPaymentInfo(b.BankName)} className={`flex items-center gap-4 p-4 rounded-2xl border ${paymentInfo === b.BankName ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-800/40 border-white/5'}`}>
                                        <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center"><img src={convertGoogleDriveUrl(b.LogoURL)} className="w-7 h-7 object-contain" alt="" /></div>
                                        <span className="text-xs font-black text-white">{b.BankName}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex-shrink-0 grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest bg-gray-800/50 rounded-2xl">បោះបង់</button>
                        <button onClick={() => handleBulkUpdate({ 'Payment Status': paymentStatus, 'Payment Info': paymentStatus === 'Paid' ? paymentInfo : '' })} className="py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2" disabled={isProcessing || (paymentStatus === 'Paid' && !paymentInfo)}>
                            {isProcessing ? <Spinner size="sm" /> : 'រក្សាទុក'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'shipping'} onClose={() => setActiveModal(null)} maxWidth="max-w-xl">
                <div className="p-6 sm:p-8 bg-[#0f172a] rounded-[2.5rem] border border-white/10 max-h-[85vh] flex flex-col">
                    <h3 className="text-lg font-black text-white text-center mb-6 uppercase tracking-tight">កែប្រែក្រុមហ៊ុនដឹកជញ្ជូន</h3>
                    <div className="space-y-6 overflow-y-auto custom-scrollbar flex-grow pr-2">
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ជ្រើសរើសសេវាដឹក</p>
                            <ShippingMethodDropdown methods={appData.shippingMethods || []} selectedMethodName={shippingMethod} onSelect={(m) => { setShippingMethod(m.MethodName); setShippingDriver(''); }} />
                        </div>
                        {requiresDriver && (
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">ជ្រើសរើសអ្នកដឹក</p>
                                <DriverSelector drivers={appData.drivers || []} selectedDriverName={shippingDriver} onSelect={setShippingDriver} />
                            </div>
                        )}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">កែប្រែថ្លៃដឹកដើម (Internal Cost)</p>
                            <input type="number" step="0.01" value={shippingCost} onChange={e => setShippingCost(e.target.value)} className="form-input !bg-black/40 !border-gray-700 !py-4 rounded-2xl text-white w-full" placeholder="0.00" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest">បោះបង់</button>
                        <button 
                            onClick={() => {
                                const payload: any = { 'Internal Shipping Method': shippingMethod, 'Internal Shipping Details': requiresDriver ? shippingDriver : '' };
                                if (shippingCost) payload['Internal Cost'] = Number(shippingCost);
                                handleBulkUpdate(payload);
                            }} 
                            className="py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2"
                            disabled={isProcessing || !shippingMethod || (requiresDriver && !shippingDriver)}
                        >
                            {isProcessing ? <Spinner size="sm" /> : "រក្សាទុក"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'delete'} onClose={() => setActiveModal(null)} maxWidth="max-w-md">
                <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10 text-center">
                    <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">⚠️</div>
                    <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tight">លុបប្រតិបត្តិការណ៍សរុប</h3>
                    <p className="text-gray-500 text-sm mb-8">តើអ្នកប្រាកដទេថាចង់លុបការកម្មង់ទាំង <strong>{selectedIds.size}</strong> នេះ?</p>
                    <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} className="form-input !bg-red-500/5 !border-red-500/20 !py-4 text-center text-white font-black w-full mb-8" placeholder="លេខសម្ងាត់" />
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest">បោះបង់</button>
                        <button onClick={handleBulkDelete} className="py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2" disabled={isProcessing || !deletePassword}>
                            {isProcessing ? <Spinner size="sm" /> : "បាទ, លុបទាំងអស់"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'cancel' || activeModal === 'return'} onClose={() => { setActiveModal(null); setActionReason(''); }} maxWidth="max-w-md">
                <div className="p-8 bg-[#0f172a] rounded-[3rem] border border-white/10">
                    <h3 className="text-xl font-black text-white text-center mb-6 uppercase tracking-tight">
                        {activeModal === 'cancel' ? 'បោះបង់ការកម្មង់សរុប' : 'បញ្ជូនឥវ៉ាន់ត្រឡប់មកវិញសរុប'}
                    </h3>
                    <textarea value={actionReason} onChange={e => setActionReason(e.target.value)} className="form-input !bg-black/40 !border-gray-700 !py-4 text-white text-sm min-h-[100px] w-full rounded-2xl mb-8" placeholder="បញ្ចូលមូលហេតុ..." />
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setActiveModal(null)} className="py-4 text-gray-500 font-black uppercase text-xs tracking-widest">បោះបង់</button>
                        <button onClick={() => handleBulkStatusChange(activeModal === 'cancel' ? 'Cancelled' : 'Returned', actionReason)} className={`py-4 ${activeModal === 'cancel' ? 'bg-red-600' : 'bg-purple-600'} text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 flex items-center justify-center gap-2`} disabled={isProcessing || !actionReason}>
                            {isProcessing ? <Spinner size="sm" /> : "បញ្ជាក់"}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default BulkActionManager;
