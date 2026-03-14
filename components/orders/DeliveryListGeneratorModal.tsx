import React, { useState, useMemo, useEffect, useContext } from 'react';
import Modal from '../common/Modal';
import { ParsedOrder, AppData, User } from '../../types';
import { AppContext } from '../../context/AppContext';
import { WEB_APP_URL } from '../../constants';
import BankSelector from './BankSelector';
import Spinner from '../common/Spinner';
import html2canvas from 'html2canvas';

interface DeliveryListGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: ParsedOrder[];
    appData: AppData;
    team?: string;
}

const STEPS = {
    FILTER: 1,
    PROMPT: 1.5,
    VERIFY: 2,
    SUMMARY: 3
};

const SESSION_KEY = 'delivery_list_session';

const DeliveryListGeneratorModal: React.FC<DeliveryListGeneratorModalProps> = ({
    isOpen, onClose, orders, appData
}) => {
    const { currentUser, showNotification, refreshData, language } = useContext(AppContext);
    const [step, setStep] = useState(STEPS.FILTER);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedStore, setSelectedStore] = useState('');
    const [selectedShipping, setSelectedShipping] = useState('ACC Delivery Agent');
    const [previewText, setPreviewText] = useState('');
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [step1SelectedIds, setStep1SelectedIds] = useState<Set<string>>(new Set());
    const [step1ReturnIds, setStep1ReturnIds] = useState<Set<string>>(new Set());

    const [searchQuery, setSearchQuery] = useState('');
    const [manualOrders, setManualOrders] = useState<ParsedOrder[]>([]);
    const [showManualSearch, setShowManualSearch] = useState(false);

    const [pendingOrders, setPendingOrders] = useState<ParsedOrder[]>([]);
    const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
    const [shippingAdjustments, setShippingAdjustments] = useState<Record<string, number>>({});
    
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedBank, setSelectedBank] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [summaryResult, setSummaryResult] = useState<any>(null);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const getSafeIsoDate = (dateStr: string) => {
        if (!dateStr) return '';
        const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) {
            const d = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5]));
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
        try {
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        } catch (e) { return ''; }
    };

    const filteredOrders = useMemo(() => {
        const dateFiltered = orders.filter(o => {
            if (!o.Timestamp) return false;
            const orderDate = getSafeIsoDate(o.Timestamp); 
            return orderDate === selectedDate && 
                   (!selectedStore || o['Fulfillment Store'] === selectedStore) &&
                   (o['Internal Shipping Method'] || '').toLowerCase() === selectedShipping.toLowerCase();
        });
        const combined = [...dateFiltered, ...manualOrders];
        const seen = new Set();
        return combined.filter(o => {
            if (seen.has(o['Order ID'])) return false;
            seen.add(o['Order ID']);
            return true;
        });
    }, [orders, selectedDate, selectedStore, selectedShipping, manualOrders]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return orders.filter(o => 
            (o['Order ID'].toLowerCase().includes(q) || (o['Customer Phone'] || '').includes(q)) &&
            !filteredOrders.some(existing => existing['Order ID'] === o['Order ID'])
        ).slice(0, 10);
    }, [orders, searchQuery, filteredOrders]);

    useEffect(() => {
        setStep1SelectedIds(new Set(filteredOrders.map(o => o['Order ID'])));
    }, [filteredOrders]);

    useEffect(() => {
        if (isOpen) {
            const savedSession = localStorage.getItem(SESSION_KEY);
            if (savedSession) {
                try {
                    const session = JSON.parse(savedSession);
                    if (session.pendingOrders?.length > 0) {
                        setPendingOrders(session.pendingOrders);
                        setVerifiedIds(new Set(session.verifiedIds));
                        setShippingAdjustments(session.shippingAdjustments);
                        setStep(STEPS.PROMPT);
                    } else resetToFilter();
                } catch (e) { resetToFilter(); }
            } else resetToFilter();
        }
    }, [isOpen]);

    const resetToFilter = () => {
        setStep(STEPS.FILTER); setPreviewText(''); setIsPreviewing(false);
        setPendingOrders([]); setVerifiedIds(new Set()); setShippingAdjustments({});
        setStep1ReturnIds(new Set()); setManualOrders([]); setSearchQuery('');
        setShowManualSearch(false); setShowPaymentModal(false); setPassword(''); setSelectedBank('');
        if (appData.stores?.length > 0) setSelectedStore(appData.stores[0].StoreName);
        if (appData.shippingMethods?.length > 0) {
            const hasACC = appData.shippingMethods.some(m => m.MethodName === 'ACC Delivery Agent');
            if (!hasACC) setSelectedShipping(appData.shippingMethods[0].MethodName);
        }
    };

    const handleDiscardSession = () => { localStorage.removeItem(SESSION_KEY); resetToFilter(); };

    const handleGeneratePreview = () => {
        if (filteredOrders.length === 0) { alert("No orders selected!"); return; }
        const dateObj = new Date(selectedDate);
        const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        let text = `📦 **បញ្ជីដឹកជញ្ជូនប្រចាំថ្ងៃ** 📅 ${formattedDate}\n🚚 ក្រុមហ៊ុន: ${selectedShipping}\n🏭 ឃ្លាំង: ${selectedStore}\n--------------------------------\n\n`;
        
        let totalSuccessUSD = 0, totalPaidUSD = 0, totalCodUSD = 0, totalFailedUSD = 0, successCount = 0;
        
        filteredOrders.forEach((o, index) => {
            const isSuccess = step1SelectedIds.has(o['Order ID']), isReturn = step1ReturnIds.has(o['Order ID']);
            const grandTotal = o['Grand Total'] || 0, isPaid = o['Payment Status'] === 'Paid';
            let lineSuffix = isSuccess ? ' ✅' : isReturn ? ' ( Return )' : ' ⏳ (ដឹកមិនជោគជ័យ)';
            if (isSuccess) { totalSuccessUSD += grandTotal; successCount++; if (isPaid) totalPaidUSD += grandTotal; else totalCodUSD += grandTotal; }
            else totalFailedUSD += grandTotal;
            const location = o.Location || '', details = o['Address Details'] || '';
            let fullAddress = (location === 'រាជធានីភ្នំពេញ' && details) ? details : [location, details].filter(Boolean).join(', ');
            if (fullAddress.length > 40) fullAddress = fullAddress.substring(0, 40) + '...';
            text += `${index + 1}. 📞 ${o['Customer Phone']} | ID: \`${o['Order ID'].slice(-5)}\`\n   📍 ${fullAddress}\n   (💵 $${(Number(grandTotal) || 0).toFixed(2)}) - ${isPaid ? '🟢' : '🔴'} **${isPaid ? 'Paid' : 'COD'}**${lineSuffix}\n\n`;
        });
        
        text += `--------------------------------\n📦 **ចំនួនកញ្ចប់សរុប:** ${successCount} កញ្ចប់\n💰 **សរុបទឹកប្រាក់ (ដឹកជោគជ័យ):** $${(Number(totalSuccessUSD) || 0).toFixed(2)}\n   ├─ 🟢 Paid: $${(Number(totalPaidUSD) || 0).toFixed(2)}\n   └─ 🔴 COD: $${(Number(totalCodUSD) || 0).toFixed(2)} 💸\n❌ **សរុបទឹកប្រាក់ (ដឹកមិនជោគជ័យ):** $${(Number(totalFailedUSD) || 0).toFixed(2)}\n\n`;
        
        const selectedOrderIds = filteredOrders.filter(o => step1SelectedIds.has(o['Order ID'])).map(o => o['Order ID']);
        const returnOrderIds = filteredOrders.filter(o => step1ReturnIds.has(o['Order ID'])).map(o => o['Order ID']);
        const failedOrderIds = filteredOrders.filter(o => !step1SelectedIds.has(o['Order ID']) && !step1ReturnIds.has(o['Order ID'])).map(o => o['Order ID']);
        
        if (selectedOrderIds.length > 0 || returnOrderIds.length > 0 || failedOrderIds.length > 0) {
            const confirmUrl = `${window.location.origin}${window.location.pathname}?v=cd&i=${selectedOrderIds.join(',')}&r=${returnOrderIds.join(',')}&f=${failedOrderIds.join(',')}&s=${encodeURIComponent(selectedStore)}&e=${Date.now() + (2 * 60 * 60 * 1000)}`;
            text += `--------------------------------\n🔗 **បញ្ជាក់ថ្លៃដឹក (Confirm Delivery):**\n👉 [ចុចទីនេះដើម្បីបញ្ជាក់ថ្លៃដឹក (Confirm)](${confirmUrl})`;
        }
        setPreviewText(text); setIsPreviewing(true);
    };

    const handleCopyAgentLink = async () => {
        const selectedOrderIds = filteredOrders.filter(o => step1SelectedIds.has(o['Order ID'])).map(o => o['Order ID']);
        const returnOrderIds = filteredOrders.filter(o => step1ReturnIds.has(o['Order ID'])).map(o => o['Order ID']);
        const failedOrderIds = filteredOrders.filter(o => !step1SelectedIds.has(o['Order ID']) && !step1ReturnIds.has(o['Order ID'])).map(o => o['Order ID']);
        
        if (selectedOrderIds.length === 0 && returnOrderIds.length === 0 && failedOrderIds.length === 0) { alert("No orders selected!"); return; }
        const confirmUrl = `${window.location.origin}${window.location.pathname}?v=cd&i=${selectedOrderIds.join(',')}&r=${returnOrderIds.join(',')}&f=${failedOrderIds.join(',')}&s=${encodeURIComponent(selectedStore)}&e=${Date.now() + (2 * 60 * 60 * 1000)}`;
        try { await navigator.clipboard.writeText(confirmUrl); showNotification("Link Copied!", "success"); } catch (e) { alert("Failed to copy link"); }
    };

    const handleCopyAndSaveSession = async () => {
        try {
            await navigator.clipboard.writeText(previewText); showNotification("Report Copied!", "success");
            const currentOrders = filteredOrders.filter(o => step1SelectedIds.has(o['Order ID']));
            const initialAdjustments: Record<string, number> = {};
            currentOrders.forEach(o => { initialAdjustments[o['Order ID']] = o['Internal Cost'] || 0; });
            const allIds = currentOrders.map(o => o['Order ID']);
            setPendingOrders(currentOrders); setVerifiedIds(new Set(allIds)); setShippingAdjustments(initialAdjustments);
            localStorage.setItem(SESSION_KEY, JSON.stringify({ pendingOrders: currentOrders, verifiedIds: allIds, shippingAdjustments: initialAdjustments, timestamp: Date.now() }));
            setStep(STEPS.PROMPT);
        } catch (err) { alert("Copy failed."); }
    };

    const toggleVerify = (id: string) => {
        setVerifiedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };

    const handleShippingChange = (id: string, val: string) => {
        const num = parseFloat(val); setShippingAdjustments(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
    };

    const handleConfirmTransaction = async () => {
        if (!password) { alert("Password required."); return; }
        setIsSubmitting(true);
        
        try {
            // 1. Verify Password First
            const response = await fetch(`${WEB_APP_URL}/api/users`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Network synchronization error');
            const result = await response.json();
            const users: User[] = result.data;
            const foundUser = users.find(u => u.UserName === currentUser?.UserName && u.Password === password);
            if (!foundUser) throw new Error("លេខសម្ងាត់មិនត្រឹមត្រូវ (Incorrect Password)");

            const concurrencyLimit = 5;
            const queue = [...pendingOrders];
            const totalToProcess = queue.length;
            let failureCount = 0;
            const failedOrders: string[] = [];
            let processedCount = 0;

            const processOrder = async (order: ParsedOrder) => {
                const isVerified = verifiedIds.has(order['Order ID']);
                const isUnpaid = order['Payment Status'] !== 'Paid';
                const finalInternalCost = shippingAdjustments[order['Order ID']] !== undefined ? shippingAdjustments[order['Order ID']] : (order['Internal Cost'] || 0);
                const newData: any = { ...order, 'Internal Cost': finalInternalCost };
                
                if (isVerified) { 
                    if (isUnpaid) {
                        newData['Payment Status'] = 'Paid'; 
                        newData['Payment Info'] = selectedBank; 
                        newData['Delivery Paid'] = order['Grand Total']; 
                        newData['Delivery Unpaid'] = 0; 
                    }
                    if (order.Timestamp) {
                        const now = new Date();
                        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                        const match = order.Timestamp.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                        if (match) {
                            const orderDate = `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
                            if (orderDate !== todayStr) {
                                const noteAdd = `(កាលបរិចេ្ឆទទម្លាក់ការកម្មង់ : ${match[3]}/${match[2]}/${match[1].slice(-2)})`;
                                if (!(order.Note || '').includes('កាលបរិចេ្ឆទទម្លាក់ការកម្មង់')) newData.Note = order.Note ? `${order.Note}\n${noteAdd}` : noteAdd;
                                let timeStr = '12:00:00';
                                const timeMatch = order.Timestamp.match(/\s(\d{1,2}:\d{2}(?::\d{2})?)/);
                                if (timeMatch) timeStr = timeMatch[1].length === 5 ? `${timeMatch[1]}:00` : timeMatch[1];
                                newData.Timestamp = `${todayStr} ${timeStr}`;
                            }
                        }
                    }
                }

                const payload = { orderId: order['Order ID'], team: order.Team, userName: currentUser?.UserName, newData: { ...newData, 'Products (JSON)': JSON.stringify(order.Products) } };
                let success = false; let attempts = 0;
                while (!success && attempts < 3) {
                    attempts++;
                    try {
                        const res = await fetch(`${WEB_APP_URL}/api/admin/update-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                        if (res.ok) success = true;
                        else await new Promise(r => setTimeout(resolve, Math.min(5000, (Math.pow(2, attempts) * 500))));
                    } catch (e) { await new Promise(r => setTimeout(resolve, Math.min(5000, (Math.pow(2, attempts) * 500)))); }
                }
                if (!success) { failureCount++; failedOrders.push(order['Order ID']); }
                processedCount++;
                await new Promise(r => setTimeout(r, 300));
            };

            for (let i = 0; i < queue.length; i += concurrencyLimit) {
                await Promise.all(queue.slice(i, i + concurrencyLimit).map(processOrder));
            }

            if (failureCount > 0) alert(`Update finished with ${failureCount} errors.`);
            else {
                localStorage.removeItem(SESSION_KEY); 
                const successVerified = pendingOrders.filter(o => verifiedIds.has(o['Order ID']));
                const newlyPaid = successVerified.filter(o => o['Payment Status'] !== 'Paid').reduce((sum, o) => sum + (o['Grand Total'] || 0), 0);
                setSummaryResult({
                    count: successVerified.length,
                    totalUSD: successVerified.reduce((sum, o) => sum + (o['Grand Total'] || 0), 0),
                    shipCost: successVerified.reduce((sum, o) => sum + (shippingAdjustments[o['Order ID']] || 0), 0),
                    date: selectedDate, store: selectedStore, user: currentUser?.FullName,
                    alreadyPaid: successVerified.filter(o => o['Payment Status'] === 'Paid').reduce((sum, o) => sum + (o['Grand Total'] || 0), 0),
                    newlyPaid
                });
                setStep(STEPS.SUMMARY); setShowPaymentModal(false);
            }
            await refreshData();
        } catch (err: any) { alert(err.message); } finally { setIsSubmitting(false); }
    };

    const handleCopySummary = async () => {
        const element = document.getElementById('summary-card');
        if (!element) return;
        try {
            setCopyStatus('idle'); await document.fonts.ready; await new Promise(r => setTimeout(r, 800));
            const canvas = await html2canvas(element, { backgroundColor: '#020617', scale: 4, useCORS: true });
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setCopyStatus('success'); }
                    catch (err) { const dataUrl = canvas.toDataURL('image/png'); const link = document.createElement('a'); link.download = `summary.png`; link.href = dataUrl; link.click(); setCopyStatus('error'); }
                }
            }, 'image/png');
        } catch (e) { setCopyStatus('error'); }
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} fullScreen={true}>
            <style>{`
                .glass-surface { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.08); }
                .action-pill { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1); }
                .action-pill:active { transform: scale(0.95); background: rgba(255, 255, 255, 0.08); }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
            
            <div className="flex flex-col h-screen w-screen bg-[#020617] text-white font-['Kantumruy_Pro'] overflow-hidden">
                {/* Modern Fixed Header */}
                <div className="flex-shrink-0 px-6 py-4 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-2xl z-50">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/20 shadow-lg">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-widest">{step === STEPS.FILTER ? 'Generate List' : step === STEPS.VERIFY ? 'Verify Delivery' : 'Success Summary'}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Secure Logistics Mode</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-white/5 text-gray-500 transition-colors flex items-center justify-center text-2xl">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar relative">
                    <div className="max-w-6xl mx-auto w-full p-4 sm:p-10">
                        {step === STEPS.FILTER && (
                            <div className="animate-reveal space-y-8">
                                {/* Compact Control Panel */}
                                <div className="glass-surface rounded-[2.5rem] p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 shadow-2xl">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-3">Date Selection</label>
                                        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-xs font-bold focus:border-blue-500 transition-all shadow-inner" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest ml-3">Logistics Partner</label>
                                        <select value={selectedShipping} onChange={(e) => setSelectedShipping(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-xs font-bold focus:border-amber-500 transition-all shadow-inner">
                                            {appData.shippingMethods?.map(m => <option key={m.MethodName} value={m.MethodName}>{m.MethodName}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest ml-3">Fulfillment Node</label>
                                        <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 px-4 text-xs font-bold focus:border-emerald-500 transition-all shadow-inner">
                                            {appData.stores?.map(s => <option key={s.StoreName} value={s.StoreName}>{s.StoreName}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Order Grid - Premium List Style */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center px-4">
                                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">Selection Queue ({filteredOrders.length})</h3>
                                        <button onClick={() => setShowManualSearch(true)} className="px-4 py-2 bg-purple-600/10 text-purple-400 rounded-xl border border-purple-500/20 text-[9px] font-black uppercase tracking-widest">+ Add External</button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {filteredOrders.map((order, idx) => {
                                            const isSelected = step1SelectedIds.has(order['Order ID']);
                                            const isReturn = step1ReturnIds.has(order['Order ID']);
                                            return (
                                                <div key={order['Order ID']} className={`group p-4 rounded-[2rem] border-2 transition-all duration-500 ${isSelected ? 'bg-emerald-500/5 border-emerald-500/20' : isReturn ? 'bg-red-500/5 border-red-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex gap-3">
                                                            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-gray-600 shrink-0 italic">{idx + 1}</div>
                                                            <div className="min-w-0">
                                                                <h4 className="text-sm font-black text-white uppercase truncate tracking-tight">{order['Customer Name']}</h4>
                                                                <p className="text-[11px] font-bold text-blue-400 font-mono mt-0.5">{order['Customer Phone']}</p>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-black text-white italic">${(order['Grand Total'] || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => { const s = new Set(step1SelectedIds), r = new Set(step1ReturnIds); if (s.has(order['Order ID'])) s.delete(order['Order ID']); else { s.add(order['Order ID']); r.delete(order['Order ID']); }; setStep1SelectedIds(s); setStep1ReturnIds(r); }} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${isSelected ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-black/20 border-white/5 text-gray-500 hover:text-emerald-400'}`}>Success</button>
                                                        <button onClick={() => { const s = new Set(step1SelectedIds), r = new Set(step1ReturnIds); if (r.has(order['Order ID'])) r.delete(order['Order ID']); else { r.add(order['Order ID']); s.delete(order['Order ID']); }; setStep1SelectedIds(s); setStep1ReturnIds(r); }} className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${isReturn ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-black/20 border-white/5 text-gray-500 hover:text-red-400'}`}>Return</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === STEPS.VERIFY && (
                            <div className="animate-reveal space-y-6">
                                <div className="glass-surface rounded-[2.5rem] p-6 border-amber-500/20 flex gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0"><svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2.5}/></svg></div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Verification Protocol</h4>
                                        <p className="text-sm text-gray-300 font-medium leading-relaxed italic">សូមពិនិត្យមើលបញ្ជីដឹកជញ្ជូនឱ្យបានច្បាស់លាស់មុនពេលបញ្ជាក់។</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {pendingOrders.map((order, idx) => {
                                        const isChecked = verifiedIds.has(order['Order ID']);
                                        const isPaid = order['Payment Status'] === 'Paid';
                                        return (
                                            <div key={order['Order ID']} className={`p-4 rounded-[2rem] border-2 transition-all duration-500 ${isChecked ? 'bg-white/[0.03] border-white/10' : 'bg-red-500/5 border-red-500/10 opacity-40'}`}>
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex gap-4 min-w-0 flex-1">
                                                        <div className="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center text-[10px] font-black text-gray-600 shrink-0 italic">{idx + 1}</div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-black text-white uppercase truncate tracking-tight">{order['Customer Name']}</h4>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[11px] font-bold text-blue-400 font-mono">{order['Customer Phone']}</span>
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter truncate max-w-[120px]">{order.Location}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-end gap-4">
                                                        <div className="text-right">
                                                            <p className="text-lg font-black text-white italic tracking-tighter leading-none">${(order['Grand Total'] || 0).toFixed(2)}</p>
                                                            <span className={`text-[7px] font-black uppercase tracking-widest ${isPaid ? 'text-emerald-500' : 'text-orange-500'}`}>{order['Payment Status']}</span>
                                                        </div>
                                                        <div className="w-24">
                                                            <input type="number" step="0.01" value={shippingAdjustments[order['Order ID']] ?? 0} onChange={(e) => handleShippingChange(order['Order ID'], e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl py-2 px-3 text-right text-xs font-black text-blue-400 focus:border-blue-500 transition-all shadow-inner" disabled={!isChecked} />
                                                        </div>
                                                        <button onClick={() => toggleVerify(order['Order ID'])} className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${isChecked ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-900 border-white/5 text-gray-700'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {step === STEPS.SUMMARY && summaryResult && (
                            <div className="animate-reveal max-w-lg mx-auto w-full space-y-8 py-10">
                                <div id="summary-card" className="glass-surface rounded-[3rem] p-8 border-emerald-500/20 relative overflow-hidden flex flex-col items-center">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/10 blur-[60px] -mr-16 -mt-16"></div>
                                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border-2 border-emerald-500/20 shadow-2xl mb-6"><svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg></div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-8">Delivery Success</h3>
                                    
                                    <div className="w-full grid grid-cols-2 gap-4 mb-8">
                                        <div className="bg-black/40 p-5 rounded-[2.5rem] border border-white/5 text-center shadow-inner">
                                            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Items</p>
                                            <p className="text-3xl font-black text-white italic leading-none">{summaryResult.count}</p>
                                        </div>
                                        <div className="bg-blue-600/10 p-5 rounded-[2.5rem] border border-blue-500/20 text-center shadow-inner">
                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Fee</p>
                                            <p className="text-3xl font-black text-white italic leading-none">${summaryResult.shipCost.toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="w-full bg-black/20 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
                                        <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Gross Revenue</span>
                                            <span className="text-2xl font-black text-white italic tracking-tighter">${summaryResult.totalUSD.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">├─ Already Paid</span>
                                            <span className="text-xs font-black text-emerald-400/80">${summaryResult.alreadyPaid.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">└─ Newly Collected</span>
                                            <span className="text-xs font-black text-blue-400/80">${summaryResult.newlyPaid.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <p className="mt-8 text-[8px] font-black text-gray-700 uppercase tracking-[0.4em] italic">Authorized by {summaryResult.user}</p>
                                </div>

                                <button onClick={handleCopySummary} className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> {copyStatus === 'success' ? 'Report Copied!' : 'Copy Summary Image'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Secure Action Bar */}
                <div className="flex-shrink-0 px-8 py-6 border-t border-white/5 bg-black/40 backdrop-blur-2xl z-50 flex justify-end gap-4">
                    {step === STEPS.FILTER && (
                        <button onClick={handleGeneratePreview} disabled={step1SelectedIds.size === 0} className="px-10 py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-30 border border-blue-500/20">Generate Preview</button>
                    )}
                    {step === STEPS.VERIFY && (
                        <>
                            <button onClick={() => setStep(STEPS.FILTER)} className="px-8 py-4 rounded-2xl bg-white/5 text-gray-500 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Back</button>
                            <button onClick={() => setShowPaymentModal(true)} className="px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95 transition-all">Finalize Delivery</button>
                        </>
                    )}
                </div>

                {/* Password Modal (Auth) */}
                {showPaymentModal && (
                    <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in">
                        <div className="glass-surface rounded-[3rem] w-full max-w-md p-8 sm:p-12 shadow-[0_0_100px_rgba(0,0,0,1)] text-center space-y-8 animate-reveal">
                            <div className="w-16 h-16 bg-blue-600/10 rounded-3xl flex items-center justify-center border-2 border-blue-500/20 mx-auto shadow-2xl"><svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>
                            <div><h3 className="text-xl font-black uppercase tracking-tighter italic">Authorization Required</h3><p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Please confirm your secure password</p></div>
                            
                            <div className="space-y-6">
                                {pendingOrders.some(o => verifiedIds.has(o['Order ID']) && o['Payment Status'] !== 'Paid') && (
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest block text-left ml-4">Receive Funds Via</label>
                                        <BankSelector bankAccounts={appData.bankAccounts || []} selectedBankName={selectedBank} onSelect={setSelectedBank} />
                                    </div>
                                )}
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/60 border-2 border-white/5 rounded-2xl py-4 px-6 text-center text-xl font-black text-white focus:border-blue-500 transition-all shadow-inner tracking-[0.5em] placeholder:tracking-normal" placeholder="••••••••" />
                                <div className="grid grid-cols-2 gap-4 pt-4">
                                    <button onClick={() => setShowPaymentModal(false)} className="py-4 rounded-2xl bg-white/5 text-gray-500 font-black uppercase text-[10px] tracking-widest border border-white/5">Cancel</button>
                                    <button onClick={handleConfirmTransaction} disabled={isSubmitting} className="py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2">{isSubmitting ? <Spinner size="sm" /> : 'Confirm'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default DeliveryListGeneratorModal;
