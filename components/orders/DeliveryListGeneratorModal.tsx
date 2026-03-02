
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
    const { currentUser, showNotification, refreshData } = useContext(AppContext);
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
                   (selectedStore ? o['Fulfillment Store'] === selectedStore : false) &&
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
            text += `${index + 1}. 📞 ${o['Customer Phone']} | ID: \`${o['Order ID'].slice(-5)}\`\n   📍 ${fullAddress}\n   (💵 $${grandTotal.toFixed(2)}) - ${isPaid ? '🟢' : '🔴'} **${isPaid ? 'Paid' : 'COD'}**${lineSuffix}\n\n`;
        });
        
        text += `--------------------------------\n📦 **ចំនួនកញ្ចប់សរុប:** ${successCount} កញ្ចប់\n💰 **សរុបទឹកប្រាក់ (ដឹកជោគជ័យ):** $${totalSuccessUSD.toFixed(2)}\n   ├─ 🟢 Paid: $${totalPaidUSD.toFixed(2)}\n   └─ 🔴 COD: $${totalCodUSD.toFixed(2)} 💸\n❌ **សរុបទឹកប្រាក់ (ដឹកមិនជោគជ័យ):** $${totalFailedUSD.toFixed(2)}\n\n`;
        
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

    const handleSelectAll = () => {
        if (verifiedIds.size === pendingOrders.length) setVerifiedIds(new Set());
        else setVerifiedIds(new Set(pendingOrders.map(o => o['Order ID'])));
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

            const idArray = pendingOrders.map(o => o['Order ID']);
            let failureCount = 0;
            const failedOrders: string[] = [];
            
            // 2. Algorithm: Progressive Queue Processing
            // Optimized for high speed: Concurrency 5 with reduced delay
            const concurrencyLimit = 5;
            const queue = [...pendingOrders];
            const totalToProcess = queue.length;
            let processedCount = 0;

            console.log(`Starting delivery list finalization for ${totalToProcess} orders...`);

            const processOrder = async (order: ParsedOrder) => {
                const isVerified = verifiedIds.has(order['Order ID']);
                const isUnpaid = order['Payment Status'] !== 'Paid';
                
                // Construct the payload based on update-order requirements (Full Data)
                const finalInternalCost = shippingAdjustments[order['Order ID']] !== undefined 
                    ? shippingAdjustments[order['Order ID']] 
                    : (order['Internal Cost'] || 0);

                const newData: any = { 
                    ...order,
                    'Internal Cost': finalInternalCost
                };
                
                if (isVerified) { 
                    if (isUnpaid) {
                        newData['Payment Status'] = 'Paid'; 
                        newData['Payment Info'] = selectedBank; 
                        newData['Delivery Paid'] = order['Grand Total']; 
                        newData['Delivery Unpaid'] = 0; 
                    }
                    
                    // --- Past Date Logic ---
                    if (order.Timestamp) {
                        const now = new Date();
                        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                        const match = order.Timestamp.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                        
                        if (match) {
                            const orderDate = `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
                            if (orderDate !== todayStr) {
                                const originalDD = match[3].padStart(2,'0');
                                const originalMM = match[2].padStart(2,'0');
                                const originalYY = match[1].slice(-2);
                                const noteAdd = `(កាលបរិចេ្ឆទទម្លាក់ការកម្មង់ : ${originalDD}/${originalMM}/${originalYY})`;
                                
                                let newNote = order.Note || '';
                                if (!newNote.includes('កាលបរិចេ្ឆទទម្លាក់ការកម្មង់')) {
                                    newData.Note = newNote ? `${newNote}\n${noteAdd}` : noteAdd;
                                }
                                
                                let timeStr = '12:00:00';
                                const timeMatch = order.Timestamp.match(/\s(\d{1,2}:\d{2}(?::\d{2})?)/);
                                if (timeMatch) timeStr = timeMatch[1].length === 5 ? `${timeMatch[1]}:00` : timeMatch[1];
                                
                                newData.Timestamp = `${todayStr} ${timeStr}`;
                            }
                        }
                    }
                }

                // Ensure Products are stringified for the API
                const payload = {
                    orderId: order['Order ID'],
                    team: order.Team,
                    userName: currentUser?.UserName,
                    newData: {
                        ...newData,
                        'Products (JSON)': JSON.stringify(order.Products)
                    }
                };

                let success = false;
                let attempts = 0;
                const maxAttempts = 3;

                while (!success && attempts < maxAttempts) {
                    attempts++;
                    try {
                        const res = await fetch(`${WEB_APP_URL}/api/admin/update-order`, { 
                            method: 'POST', 
                            headers: { 'Content-Type': 'application/json' }, 
                            body: JSON.stringify(payload) 
                        });
                        
                        if (res.ok) {
                            success = true;
                        } else {
                            // Exponential backoff
                            const delay = Math.min(5000, (Math.pow(2, attempts) * 500));
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    } catch (e) {
                        const delay = Math.min(5000, (Math.pow(2, attempts) * 500));
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                if (!success) {
                    failureCount++;
                    failedOrders.push(order['Order ID']);
                }
                
                processedCount++;
                console.log(`Progress: ${processedCount}/${totalToProcess} (${order['Order ID']}: ${success ? 'OK' : 'FAIL'})`);
                
                // Minimal breather for high-performance processing
                await new Promise(resolve => setTimeout(resolve, 300));
            };

            // Run in concurrent batches
            for (let i = 0; i < queue.length; i += concurrencyLimit) {
                const batch = queue.slice(i, i + concurrencyLimit);
                await Promise.all(batch.map(processOrder));
            }

            if (failureCount > 0) {
                alert(`ការ Update បានបញ្ចប់ ប៉ុន្តែមានបញ្ហាលើ ${failureCount} កញ្ចប់: (${failedOrders.join(', ')})\n\nសូមព្យាយាមម្តងទៀតសម្រាប់កញ្ចប់ដែលនៅសល់។`);
            } else {
                localStorage.removeItem(SESSION_KEY); 
                
                // Calculate Summary Stats
                const successVerified = pendingOrders.filter(o => verifiedIds.has(o['Order ID']));
                const stats = {
                    count: successVerified.length,
                    totalUSD: successVerified.reduce((sum, o) => sum + (o['Grand Total'] || 0), 0),
                    paidUSD: successVerified.filter(o => o['Payment Status'] === 'Paid' || verifiedIds.has(o['Order ID'])).reduce((sum, o) => sum + (o['Grand Total'] || 0), 0),
                    codUSD: successVerified.filter(o => o['Payment Status'] !== 'Paid' && !verifiedIds.has(o['Order ID'])).reduce((sum, o) => sum + (o['Grand Total'] || 0), 0),
                    shipCost: successVerified.reduce((sum, o) => sum + (shippingAdjustments[o['Order ID']] || 0), 0),
                    date: selectedDate,
                    store: selectedStore,
                    user: currentUser?.FullName
                };
                
                // Adjust paid/cod logic: since we just MARKED them as Paid if verified, 
                // in the summary they are all basically "Processed as Paid" if they were verified.
                // However, let's just show the breakdown of what was ALREADY paid vs what was just COLLECTED.
                const alreadyPaid = successVerified.filter(o => o['Payment Status'] === 'Paid').reduce((sum, o) => sum + (o['Grand Total'] || 0), 0);
                const newlyPaid = successVerified.filter(o => o['Payment Status'] !== 'Paid').reduce((sum, o) => sum + (o['Grand Total'] || 0), 0);

                setSummaryResult({
                    ...stats,
                    alreadyPaid,
                    newlyPaid
                });

                showNotification("Delivery verified and database updated!", "success"); 
                setStep(STEPS.SUMMARY);
                setShowPaymentModal(false);
            }
            
            await refreshData();
        } catch (err: any) { 
            alert(err.message || "Failed to update database."); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const handleCopySummary = async () => {
        const element = document.getElementById('summary-card');
        if (!element) return;
        try {
            setCopyStatus('idle');
            // Ensure fonts are loaded before capturing
            await document.fonts.ready;
            
            // Artificial delay to ensure full render
            await new Promise(resolve => setTimeout(resolve, 800));
            
            const canvas = await html2canvas(element, {
                backgroundColor: '#020617',
                scale: 4, // Higher scale for extreme clarity
                logging: false,
                useCORS: true,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('summary-card');
                    if (el) {
                        // FORCE FONT AND REMOVE BREAKING STYLES FOR KHMER
                        el.style.fontFamily = "'Kantumruy Pro', sans-serif";
                        const allNodes = el.querySelectorAll('*');
                        allNodes.forEach(node => {
                            const htmlNode = node as HTMLElement;
                            // Khmer rendering breaks with letter-spacing or uppercase in some canvas engines
                            htmlNode.style.letterSpacing = 'normal';
                            htmlNode.style.textTransform = 'none';
                            htmlNode.style.fontFamily = "'Kantumruy Pro', sans-serif";
                        });
                    }
                }
            });
            
            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        // Standard clipboard copy (modern browsers)
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        setCopyStatus('success');
                        setTimeout(() => setCopyStatus('idle'), 4000);
                        showNotification("Image Copied to Clipboard!", "success");
                    } catch (err) {
                        console.error("Clipboard write failed, falling back to download:", err);
                        // Fallback only if clipboard fails (required to Paste in Telegram)
                        const dataUrl = canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.download = `summary_${Date.now()}.png`;
                        link.href = dataUrl;
                        link.click();
                        setCopyStatus('error');
                        setTimeout(() => setCopyStatus('idle'), 4000);
                    }
                }
            }, 'image/png');
        } catch (e) { 
            console.error("Canvas capture failed:", e);
            setCopyStatus('error'); 
        }
    };

    if (!isOpen) return null;

    const hasCheckedUnpaidOrders = pendingOrders.some(o => verifiedIds.has(o['Order ID']) && o['Payment Status'] !== 'Paid');

    return (
        <Modal isOpen={isOpen} onClose={onClose} fullScreen={true}>
            <style>{`
                @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
            <div className="bg-[#020617] flex flex-col h-screen w-screen relative overflow-hidden text-white font-['Kantumruy_Pro']">
                {/* Fixed Header */}
                <div className="p-4 sm:p-6 bg-slate-900/90 backdrop-blur-xl border-b border-white/10 flex justify-between items-center z-30 shadow-2xl">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${step === STEPS.FILTER ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                            <span className="text-sm font-black italic">{step === STEPS.PROMPT ? '!' : Math.floor(step)}</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-tighter leading-none">{step === STEPS.FILTER ? "បង្កើតបញ្ជីដឹកជញ្ជូន" : "ផ្ទៀងផ្ទាត់ការដឹក"}</h2>
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">ACC Logistics Portal</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/5 active:scale-90 shadow-xl">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617] relative">
                    <div className="p-3 sm:p-10 relative z-10 h-full flex flex-col">
                        {step === STEPS.FILTER && (
                            <div className={`animate-fade-in mx-auto h-full flex flex-col w-full ${isMobile ? 'space-y-3' : 'max-w-[1600px] space-y-6'}`}>
                                {!isPreviewing ? (
                                    <div className={`${isMobile ? 'flex flex-col h-full' : 'grid grid-cols-12 gap-8 h-full'}`}>
                                        {/* Filter Section - Consolidated for Mobile */}
                                        <div className={`${isMobile ? 'w-full bg-slate-900/60 p-3 rounded-2xl border border-white/10' : 'col-span-3 bg-slate-900/60 p-6 rounded-[2.5rem] border border-white/10 shadow-2xl h-fit'}`}>
                                            <div className={`${isMobile ? 'flex items-center gap-2 overflow-x-auto no-scrollbar' : 'space-y-4'}`}>
                                                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={`${isMobile ? 'min-w-[120px] py-2 px-3' : 'w-full py-3 px-4'} bg-black/40 border-white/10 rounded-xl text-white font-bold text-xs`} />
                                                <select value={selectedShipping} onChange={(e) => setSelectedShipping(e.target.value)} className={`${isMobile ? 'min-w-[140px] py-2 px-3' : 'w-full py-3 px-4'} bg-black/40 border-white/10 rounded-xl text-white font-bold text-xs`}>
                                                    {appData.shippingMethods?.map(m => <option key={m.MethodName} value={m.MethodName}>{m.MethodName}</option>)}
                                                </select>
                                                <select value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)} className={`${isMobile ? 'min-w-[120px] py-2 px-3' : 'w-full py-3 px-4'} bg-black/40 border-white/10 rounded-xl text-white font-bold text-xs`}>
                                                    {appData.stores?.map(s => <option key={s.StoreName} value={s.StoreName}>{s.StoreName}</option>)}
                                                </select>
                                                <button onClick={() => setShowManualSearch(true)} className={`${isMobile ? 'px-4 py-2 flex-shrink-0' : 'w-full py-3'} bg-purple-600/10 text-purple-400 rounded-xl border border-dashed border-purple-500/30 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2`}>
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> Add Past
                                                </button>
                                            </div>
                                            {!isMobile && (
                                                <button onClick={handleGeneratePreview} disabled={step1SelectedIds.size === 0} className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl border border-white/10">បង្កើតបញ្ជី (Generate)</button>
                                            )}
                                        </div>

                                        {/* SELECTED Order List - Maximized Space */}
                                        <div className={`${isMobile ? 'w-full flex-grow mt-3' : 'col-span-9 h-full'} flex flex-col min-h-0 bg-slate-900/40 rounded-[2.5rem] border border-white/10 overflow-hidden`}>
                                            <div className="p-4 bg-gray-900/60 border-b border-white/10 flex justify-between items-center px-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">SELECTED</span>
                                                    <span className="text-2xl font-black text-white">{step1SelectedIds.size} / {filteredOrders.length}</span>
                                                </div>
                                                <button onClick={() => { if (step1SelectedIds.size === filteredOrders.length) setStep1SelectedIds(new Set()); else { setStep1SelectedIds(new Set(filteredOrders.map(o => o['Order ID']))); setStep1ReturnIds(new Set()); } }} className="px-4 py-2 bg-blue-600/10 text-[10px] font-black text-blue-400 uppercase rounded-xl border border-blue-500/20">
                                                    {step1SelectedIds.size === filteredOrders.length ? 'Unselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            
                                            <div className="overflow-y-auto custom-scrollbar flex-grow p-3 sm:p-6">
                                                <div className={`${isMobile ? 'flex flex-col gap-3' : 'grid grid-cols-2 gap-4'}`}>
                                                    {filteredOrders.length === 0 ? (
                                                        <div className="col-span-full py-20 text-center opacity-20 flex flex-col items-center gap-4">
                                                            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                                            <p className="text-xs font-black uppercase tracking-widest">No Orders Found</p>
                                                        </div>
                                                    ) : filteredOrders.map((order, idx) => {
                                                        const isSelected = step1SelectedIds.has(order['Order ID']);
                                                        const isReturn = step1ReturnIds.has(order['Order ID']);
                                                        const toggleSuccess = () => {
                                                            const nextS = new Set(step1SelectedIds); const nextR = new Set(step1ReturnIds);
                                                            if (nextS.has(order['Order ID'])) nextS.delete(order['Order ID']);
                                                            else { nextS.add(order['Order ID']); nextR.delete(order['Order ID']); }
                                                            setStep1SelectedIds(nextS); setStep1ReturnIds(nextR);
                                                        };
                                                        return (
                                                            <div key={order['Order ID']} className={`flex flex-col gap-3 p-4 rounded-[2rem] border transition-all ${isSelected ? 'bg-emerald-600/10 border-emerald-500/30' : isReturn ? 'bg-red-600/10 border-red-500/30' : 'bg-slate-900/60 border-white/5'}`}>
                                                                <div className="flex items-start justify-between gap-3" onClick={toggleSuccess}>
                                                                    <div className="flex items-start gap-3 min-w-0 flex-grow cursor-pointer">
                                                                        <div className="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center text-[10px] font-black text-gray-500 flex-shrink-0">{idx + 1}</div>
                                                                        <div className="min-w-0 flex-grow space-y-1">
                                                                            <p className="text-sm font-black text-white uppercase truncate">{order['Customer Name']}</p>
                                                                            <span className="text-lg font-black text-blue-400 font-mono leading-none block">{order['Customer Phone']}</span>
                                                                            <p className="text-xs text-gray-300 font-bold flex items-center gap-1 leading-none mt-1">📍 {order.Location}</p>
                                                                            {order['Address Details'] && <p className="text-[13px] text-gray-400 font-medium ml-4 border-l border-gray-700 pl-2 leading-tight italic">{order['Address Details']}</p>}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right flex-shrink-0"><p className="text-sm font-black text-white tracking-tighter mb-1">${Number(order['Grand Total']).toFixed(2)}</p><span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{order['Payment Status']}</span></div>
                                                                </div>
                                                                {/* Side-by-Side Checkbox and Return */}
                                                                <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
                                                                    <label className="flex items-center gap-2 cursor-pointer bg-black/20 px-3 py-1.5 rounded-xl border border-white/5 hover:bg-emerald-600/10 transition-all">
                                                                        <input type="checkbox" checked={isSelected} onChange={(e) => { e.stopPropagation(); toggleSuccess(); }} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-0" />
                                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isSelected ? 'text-emerald-400' : 'text-gray-500'}`}>Success</span>
                                                                    </label>
                                                                    <button onClick={(e) => { e.stopPropagation(); const nextS = new Set(step1SelectedIds), nextR = new Set(step1ReturnIds); if (nextR.has(order['Order ID'])) nextR.delete(order['Order ID']); else { nextR.add(order['Order ID']); nextS.delete(order['Order ID']); } setStep1SelectedIds(nextS); setStep1ReturnIds(nextR); }} className={`px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 ${isReturn ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-black/20 border-white/10 text-gray-500 hover:text-red-400'}`}>
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Return
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        {isMobile && (
                                            <div className="p-4 bg-slate-900 border-t border-white/10 flex justify-center">
                                                <button onClick={handleGeneratePreview} disabled={step1SelectedIds.size === 0} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl active:scale-95 transition-all">បង្កើតបញ្ជី (Generate Preview)</button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-grow flex flex-col animate-fade-in-up max-w-4xl mx-auto w-full space-y-4">
                                        <div className="flex justify-between items-center bg-slate-900/80 p-4 rounded-[2rem] border border-white/10 shadow-2xl">
                                            <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" /><label className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Preview Mode</label></div>
                                            <div className="flex gap-2">
                                                <button onClick={handleCopyAgentLink} className="text-[9px] font-black text-blue-400 uppercase bg-blue-400/10 px-3 py-1.5 rounded-xl border border-blue-400/20">Copy Link Only</button>
                                                <button onClick={() => setIsPreviewing(false)} className="text-[9px] font-black text-red-400 uppercase bg-red-400/10 px-3 py-1.5 rounded-xl border border-red-400/20">Reset</button>
                                            </div>
                                        </div>
                                        <div className="flex justify-center"><button onClick={handleGeneratePreview} className="w-full sm:w-auto px-10 py-3 bg-white/5 text-emerald-400 rounded-2xl border border-emerald-500/20 text-[10px] font-black uppercase shadow-xl">Refresh Text</button></div>
                                        <textarea value={previewText} onChange={(e) => setPreviewText(e.target.value)} className="w-full flex-grow bg-black/60 border border-white/10 rounded-[2.5rem] p-6 font-mono text-sm text-gray-200 focus:ring-0 resize-none shadow-2xl min-h-[400px] custom-scrollbar leading-relaxed" />
                                    </div>
                                )}
                            </div>
                        )}

                        {step === STEPS.PROMPT && (
                            <div className="h-full flex flex-col items-center justify-center space-y-10 animate-fade-in text-center max-w-lg mx-auto w-full">
                                <div className="w-24 h-24 bg-blue-600/10 rounded-3xl flex items-center justify-center border-2 border-blue-500/20 shadow-2xl animate-bounce-slow"><svg className="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                                <div><h3 className="text-2xl font-black text-white uppercase tracking-tighter">មានទិន្នន័យចាស់</h3><p className="text-gray-400 mt-2 text-sm">ប្រព័ន្ធបានរក្សាទុកទិន្នន័យពីលើកមុន. <br/> តើអ្នកចង់បន្តវា ឬចាប់ផ្តើមថ្មី?</p></div>
                                <div className="grid grid-cols-2 gap-4 w-full"><button onClick={handleDiscardSession} className="py-4 rounded-2xl bg-gray-800 text-gray-400 font-black uppercase text-[10px] tracking-widest border border-white/5">Discard</button><button onClick={() => setStep(STEPS.VERIFY)} className="py-4 rounded-2xl bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest shadow-2xl">Resume</button></div>
                            </div>
                        )}

                        {step === STEPS.VERIFY && (
                            <div className={`space-y-6 animate-fade-in w-full ${isMobile ? '' : 'max-w-6xl mx-auto'}`}>
                                <div className="bg-amber-900/20 border-2 border-amber-500/20 p-6 rounded-[2.5rem] flex items-start gap-6 shadow-2xl backdrop-blur-xl">
                                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 border border-amber-500/20 shadow-inner">
                                        <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-amber-400 font-black uppercase text-xs tracking-[0.3em]">ការណែនាំ (INSTRUCTIONS)</h4>
                                        <div className="text-gray-300 text-sm leading-relaxed space-y-1 font-medium">
                                            <p className="font-bold text-white mb-2">សូមពិនិត្យមើលបញ្ជីខាងក្រោមអោយបានច្បាស់លាស់។</p>
                                            <p>- ដកសញ្ញា ✔️ ចេញ ប្រសិនបើការដឹក **បរាជ័យ**(Failed) ឬ Return ។</p>
                                            <p>- កែប្រែ **Shipping Cost** ប្រសិនបើមានការផ្លាស់ប្តូរ។</p>
                                            <p>- ប្រព័ន្ធនឹងធ្វើបច្ចុប្បន្នភាពទិន្នន័យបង់ប្រាក់ (Paid) សម្រាប់តែការដឹកជោគជ័យប៉ុណ្ណោះ។</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 pb-20 px-2">
                                    <div className="flex justify-end mb-4">
                                        <button 
                                            onClick={() => {
                                                if (verifiedIds.size === pendingOrders.length) setVerifiedIds(new Set());
                                                else setVerifiedIds(new Set(pendingOrders.map(o => o['Order ID'])));
                                            }}
                                            className="px-4 py-2 bg-emerald-600/10 text-[10px] font-black text-emerald-400 uppercase rounded-xl border border-emerald-500/20"
                                        >
                                            {verifiedIds.size === pendingOrders.length ? 'Unselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    {pendingOrders.map((order, idx) => {
                                        const isChecked = verifiedIds.has(order['Order ID']);
                                        const isPaid = order['Payment Status'] === 'Paid';
                                        return (
                                            <div key={order['Order ID']} className={`transition-all rounded-[2.5rem] border-2 overflow-hidden shadow-xl ${isChecked ? 'bg-slate-900/60 border-white/10' : 'bg-red-900/5 border-red-500/10 opacity-40 grayscale'}`}>
                                                <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-start gap-4 min-w-0 flex-grow">
                                                        <div className="w-8 h-8 rounded-xl bg-black/40 flex items-center justify-center text-[10px] font-black text-gray-600 flex-shrink-0">{idx + 1}</div>
                                                        <div className="min-w-0 space-y-1 flex-grow">
                                                            <div className="flex items-center gap-3">
                                                                <p className="text-sm font-black text-white uppercase truncate">{order['Customer Name']}</p>
                                                                <span className="text-[11px] font-black text-blue-400 font-mono bg-blue-400/10 px-2 py-0.5 rounded-lg border border-blue-400/20">{order['Customer Phone']}</span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <p className="text-sm text-gray-200 font-bold flex items-center gap-1.5 leading-none">📍 {order.Location}</p>
                                                                {order['Address Details'] && (
                                                                    <p className="text-[13px] text-gray-400 font-medium ml-6 border-l-2 border-gray-800 pl-3 leading-relaxed opacity-90">
                                                                        {order['Address Details']}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-6 bg-black/40 p-3 sm:bg-transparent sm:p-0 rounded-2xl">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <p className="text-xl font-black text-white tracking-tighter leading-none">${Number(order['Grand Total']).toFixed(2)}</p>
                                                            <div className={`inline-flex flex-col items-center px-2 py-0.5 rounded-lg border ${isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                                <span className="text-[8px] font-black uppercase leading-none">{order['Payment Status']}</span>
                                                                <span className="text-[7px] font-bold opacity-70 mt-0.5 whitespace-nowrap">{isPaid ? 'បង់រួច' : 'ប្រមូល COD'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-28">
                                                            <p className="text-[9px] font-black text-blue-500 uppercase ml-1 mb-1">Ship Cost</p>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                                                                <input type="number" step="0.01" value={shippingAdjustments[order['Order ID']] ?? 0} onChange={(e) => handleShippingChange(order['Order ID'], e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-1.5 pl-6 pr-3 text-right text-sm font-black text-blue-400 focus:border-blue-500 transition-all" disabled={!isChecked} />
                                                            </div>
                                                        </div>
                                                        <button onClick={() => toggleVerify(order['Order ID'])} className={`w-12 h-12 rounded-[1.5rem] flex items-center justify-center border-2 transition-all flex-shrink-0 ${isChecked ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-gray-900 border-white/10 text-gray-700'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg></button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {step === STEPS.SUMMARY && summaryResult && (
                            <div className="h-full flex flex-col items-center justify-center space-y-8 animate-fade-in text-center max-w-lg mx-auto w-full">
                                <div id="summary-card" className="w-full bg-slate-900/60 border-2 border-emerald-500/30 rounded-[2.5rem] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden flex flex-col items-center">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/10 blur-[60px] -mr-16 -mt-16"></div>
                                    
                                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border-2 border-emerald-500/20 shadow-xl mb-2 relative z-10">
                                        <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    
                                    <div className="space-y-2 relative z-10">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">ប្រតិបត្តិការណ៍ជោគជ័យ</h3>
                                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{summaryResult.date} | {summaryResult.store}</p>
                                    </div>

                                    <div className="w-full grid grid-cols-2 gap-4 relative z-10">
                                        <div className="bg-black/40 p-4 rounded-[2rem] border border-white/5 shadow-inner">
                                            <p className="text-[10px] text-gray-500 font-bold mb-1">ចំនួនកញ្ចប់ (COUNT)</p>
                                            <p className="text-3xl font-black text-white">{summaryResult.count}</p>
                                        </div>
                                        <div className="bg-blue-600/10 p-4 rounded-[2rem] border border-blue-500/20 shadow-inner">
                                            <p className="text-[10px] text-blue-400 font-bold mb-1">ថ្លៃដឹកសរុប (SHIPPING)</p>
                                            <p className="text-3xl font-black text-white">${summaryResult.shipCost.toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="w-full bg-black/20 p-5 rounded-[2rem] border border-white/5 space-y-3 text-left relative z-10">
                                        <div className="flex justify-between items-center border-b border-white/5 pb-3">
                                            <span className="text-[13px] font-bold text-gray-200">សរុបទឹកប្រាក់ (TOTAL)</span>
                                            <span className="text-2xl font-black text-white tracking-tighter">${summaryResult.totalUSD.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-300">
                                            <span>├─ 🟢 បង់រួចស្រាប់ (Paid)</span>
                                            <span className="text-emerald-400">${summaryResult.alreadyPaid.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-300">
                                            <span>└─ 💵 ប្រមូលថ្មី (COD)</span>
                                            <span className="text-blue-400">${summaryResult.newlyPaid.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-white/5 w-full relative z-10">
                                        <p className="text-[9px] text-gray-500 font-bold italic">🙏 សូមអរគុណដល់ {summaryResult.user}!</p>
                                        <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-1">Generated by ACC Order System</p>
                                    </div>
                                </div>

                                <div className="flex flex-col w-full gap-3 mt-4">
                                    <button 
                                        onClick={async () => {
                                            // Handle Text Copy manually here to combine both
                                            const text = `✅ **ប្រតិបត្តិការណ៍ជោគជ័យ**\n` +
                                                `👤 អ្នករៀបចំ: ${summaryResult.user}\n` +
                                                `📅 កាលបរិច្ឆេទ: ${summaryResult.date}\n` +
                                                `🏭 ឃ្លាំង: ${summaryResult.store}\n` +
                                                `--------------------------------\n` +
                                                `📦 ចំនួនកញ្ចប់: ${summaryResult.count} កញ្ចប់\n` +
                                                `💰 សរុបទឹកប្រាក់: $${summaryResult.totalUSD.toFixed(2)}\n` +
                                                `   ├─ 🟢 បង់រួចស្រាប់: $${summaryResult.alreadyPaid.toFixed(2)}\n` +
                                                `   └─ 💵 ប្រមូលថ្មី (COD): $${summaryResult.newlyPaid.toFixed(2)}\n` +
                                                `🚚 ថ្លៃដឹកសរុប: $${summaryResult.shipCost.toFixed(2)}\n` +
                                                `--------------------------------\n` +
                                                `🙏 សូមអរគុណដល់ ${summaryResult.user} សម្រាប់ការបញ្ចប់កិច្ចការនេះ!`;
                                            try { await navigator.clipboard.writeText(text); } catch (e) {} // Silent fail for text
                                            
                                            // Then trigger Image Copy
                                            await handleCopySummary();
                                        }}
                                        className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-[0.1em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 border ${copyStatus === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white text-black border-white/10'}`}
                                    >
                                        {copyStatus === 'success' ? <>✅ បានចម្លង (Copied!)</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> ចម្លងសេចក្តីសង្ខេប (Copy Text & Image)</>}
                                    </button>
                                    <button 
                                        onClick={onClose}
                                        className="w-full py-4 bg-gray-800 text-gray-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:text-white transition-all active:scale-95"
                                    >
                                        បិទ (Close)
                                    </button>
                                </div>
                            </div>
                        )}

                        {showManualSearch && (
                            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                                <div className="bg-[#0f172a] border-2 border-white/10 rounded-[3rem] w-full max-w-xl p-8 shadow-2xl flex flex-col max-h-[80%] animate-scale-in">
                                    <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-white uppercase tracking-tighter">ស្វែងរកប្រតិបត្តិការណ៍ចាស់</h3><button onClick={() => { setShowManualSearch(false); setSearchQuery(''); }} className="text-gray-500 hover:text-white transition-all flex items-center justify-center w-8 h-8">&times;</button></div>
                                    <div className="relative mb-6"><input type="text" autoFocus placeholder="ស្វែងរកតាម ID ឬ លេខទូរស័ព្ទ..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/40 border-2 border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-white focus:border-purple-500 transition-all shadow-inner" /><svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="3" /></svg></div>
                                    <div className="flex-grow overflow-y-auto custom-scrollbar space-y-2">
                                        {searchResults.map(o => (
                                            <button key={o['Order ID']} onClick={() => { setManualOrders(prev => [...prev, o]); setStep1SelectedIds(prev => new Set(prev).add(o['Order ID'])); setShowManualSearch(false); setSearchQuery(''); showNotification("Order added!", "success"); }} className="w-full flex items-center justify-between p-4 bg-slate-900/60 hover:bg-blue-600/10 rounded-2xl border border-white/5 text-left transition-all">
                                                <div className="min-w-0"><p className="text-sm font-black text-white truncate">{o['Customer Name']}</p><p className="text-[10px] text-gray-500 font-mono">{o['Order ID']} | {o['Customer Phone']}</p></div>
                                                <div className="text-right"><p className="text-sm font-black text-blue-400">${o['Grand Total']}</p><p className="text-[10px] text-gray-600 font-bold uppercase">{o.Timestamp.split(' ')[0]}</p></div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-white/10 bg-slate-950/90 backdrop-blur-xl sticky bottom-0 z-30 flex justify-between gap-4 px-10">
                    {step === STEPS.VERIFY && <button onClick={() => setStep(STEPS.PROMPT)} className="px-8 py-4 rounded-2xl bg-white/5 text-gray-400 font-black uppercase text-[10px] tracking-widest border border-white/5 active:scale-95">Back</button>}
                    {step === STEPS.FILTER && isPreviewing && (
                        <div className="flex gap-4 w-full justify-end">
                             <button onClick={() => setIsPreviewing(false)} className="px-8 py-4 rounded-2xl bg-white/5 text-gray-400 font-black uppercase text-[10px] tracking-widest border border-white/5">Edit List</button>
                            <button onClick={handleCopyAndSaveSession} className="px-10 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-95">Copy & Continue</button>
                        </div>
                    )}
                    {step === STEPS.VERIFY && (
                        <button 
                            onClick={() => {
                                const hasUnpaid = pendingOrders.some(o => verifiedIds.has(o['Order ID']) && o['Payment Status'] !== 'Paid');
                                // We can't set state and immediately use it, so we'll handle the logic in the render
                                setShowPaymentModal(true);
                            }} 
                            className="w-full sm:w-auto ml-auto px-12 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-95"
                        >
                            Finalize Delivery
                        </button>
                    )}
                </div>

                {/* Payment Modal Overlay - Vertically Optimized for Mobile */}
                {showPaymentModal && (
                    <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-[#0f172a] border-2 border-white/10 rounded-[2rem] sm:rounded-[3.5rem] w-full max-w-lg p-5 sm:p-10 shadow-[0_0_100px_rgba(0,0,0,1)] transform scale-100 animate-scale-in relative overflow-hidden max-h-[95vh] overflow-y-auto no-scrollbar">
                            <div className="relative z-10 space-y-5 sm:space-y-8">
                                <div className="text-center space-y-2 sm:space-y-3">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto border-2 border-blue-500/20 shadow-xl">
                                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tighter italic">តម្រូវឱ្យមានការអនុញ្ញាត</h3>
                                        <p className="text-gray-500 text-[9px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-0.5">Authorization Required</p>
                                    </div>
                                </div>

                                <div className="space-y-4 sm:space-y-6">
                                    {pendingOrders.some(o => verifiedIds.has(o['Order ID']) && o['Payment Status'] !== 'Paid') && (
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-3">ជ្រើសរើសធនាគារ (Bank)</label>
                                            <BankSelector 
                                                bankAccounts={appData.bankAccounts || []} 
                                                selectedBankName={selectedBank} 
                                                onSelect={setSelectedBank} 
                                                fulfillmentStore={pendingOrders.find(o => verifiedIds.has(o['Order ID']))?.['Fulfillment Store']}
                                            />
                                        </div>
                                    )}
                                    
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-red-400 uppercase tracking-widest ml-3">លេខសម្ងាត់សុវត្ថិភាព (Password)</label>
                                        <input 
                                            type="password" 
                                            value={password} 
                                            onChange={e => setPassword(e.target.value)} 
                                            className="form-input bg-black/60 border-2 border-white/10 rounded-xl sm:rounded-2xl text-white font-black w-full py-3.5 sm:py-4 px-6 focus:border-red-500 text-center tracking-[0.5em] text-base sm:text-lg shadow-inner transition-all" 
                                            placeholder="••••••••" 
                                        />
                                    </div>

                                    <div className="flex gap-3 sm:gap-4 pt-2 sm:pt-4">
                                        <button 
                                            onClick={() => setShowPaymentModal(false)} 
                                            className="flex-1 py-3.5 sm:py-4 bg-gray-800/50 text-gray-500 hover:text-white font-black uppercase text-[9px] sm:text-[10px] tracking-widest rounded-xl sm:rounded-2xl border border-white/5 transition-all active:scale-95"
                                        >
                                            បោះបង់
                                        </button>
                                        <button 
                                            onClick={handleConfirmTransaction} 
                                            disabled={isSubmitting} 
                                            className="flex-1 py-3.5 sm:py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black uppercase text-[9px] sm:text-[10px] tracking-widest rounded-xl sm:rounded-2xl shadow-xl active:scale-95 flex justify-center items-center gap-2 border border-white/10 disabled:opacity-50"
                                        >
                                            {isSubmitting ? <Spinner size="sm" /> : (
                                                <>
                                                    <span>យល់ព្រម</span>
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                                                </>
                                            )}
                                        </button>
                                    </div>
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
