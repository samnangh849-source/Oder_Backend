
import React, { useState, useEffect, useMemo } from 'react';
import { ParsedOrder } from '../../types';
import { WEB_APP_URL } from '../../constants';
import Spinner from '../common/Spinner';
import html2canvas from 'html2canvas';

interface DeliveryAgentViewProps {
    orderIds: string[];
    returnOrderIds: string[];
    failedOrderIds: string[];
    storeName: string;
}

const DeliveryAgentView: React.FC<DeliveryAgentViewProps> = ({ orderIds, returnOrderIds, failedOrderIds, storeName }) => {
    const [orders, setOrders] = useState<ParsedOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [costs, setCosts] = useState<Record<string, number>>({});
    
    // Explicitly track returned and failed IDs as provided from Step 1
    const returnedSet = useMemo(() => new Set(returnOrderIds), [returnOrderIds]);
    const failedSet = useMemo(() => new Set(failedOrderIds), [failedOrderIds]);
    const successSet = useMemo(() => new Set(orderIds), [orderIds]);
    
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const expiresAt = parseInt(urlParams.get('e') || urlParams.get('expires') || '0');
        if (expiresAt && Date.now() > expiresAt) {
            setIsExpired(true);
            setLoading(false);
            return;
        }

        const fetchOrders = async () => {
            try {
                const res = await fetch(`${WEB_APP_URL}/api/admin/all-orders?days=30`);
                const result = await res.json();
                if (result.status === 'success') {
                    const allTargetIds = new Set([...orderIds, ...returnOrderIds, ...failedOrderIds]);
                    const found = result.data
                        .filter((o: any) => o && allTargetIds.has(o['Order ID']))
                        .map((o: any) => ({
                            ...o,
                            Products: o['Products (JSON)'] ? JSON.parse(o['Products (JSON)']) : [],
                            'Internal Cost': Number(o['Internal Cost']) || 0
                        }));
                    
                    setOrders(found);
                    const initialCosts: Record<string, number> = {};
                    found.forEach((o: any) => { initialCosts[o['Order ID']] = o['Internal Cost']; });
                    setCosts(initialCosts);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [orderIds, returnOrderIds, failedOrderIds]);

    const handleCostChange = (id: string, val: string) => {
        const num = parseFloat(val);
        setCosts(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
    };

    const handleSubmit = async () => {
        if (orders.length === 0) return;
        setIsSubmitting(true);
        let failureCount = 0;
        const failedOrders: string[] = [];

        try {
            // Algorithm: Progressive Queue Processing (Concurrency 5 for speed)
            // Balancing speed and safety for Google Sheets via Node backend
            const concurrencyLimit = 5;
            const queue = [...orders];
            const totalToProcess = queue.length;
            let processedCount = 0;

            const processItem = async (o: ParsedOrder) => {
                const isDelivered = successSet.has(o['Order ID']);
                const finalCost = isDelivered ? (costs[o['Order ID']] || 0) : 0;
                
                const newData: any = {
                    ...o,
                    'Internal Cost': finalCost
                };

                if (isDelivered) {
                    // --- Past Date Logic ---
                    if (o.Timestamp) {
                        const now = new Date();
                        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                        const match = o.Timestamp.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                        
                        if (match) {
                            const orderDate = `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
                            if (orderDate !== todayStr) {
                                const originalDD = match[3].padStart(2,'0');
                                const originalMM = match[2].padStart(2,'0');
                                const originalYY = match[1].slice(-2);
                                const noteAdd = `(កាលបរិចេ្ឆទទម្លាក់ការកម្មង់ : ${originalDD}/${originalMM}/${originalYY})`;
                                
                                let newNote = o.Note || '';
                                if (!newNote.includes('កាលបរិចេ្ឆទទម្លាក់ការកម្មង់')) {
                                    newData.Note = newNote ? `${newNote}\n${noteAdd}` : noteAdd;
                                }
                                
                                let timeStr = '12:00:00';
                                const timeMatch = o.Timestamp.match(/\s(\d{1,2}:\d{2}(?::\d{2})?)/);
                                if (timeMatch) timeStr = timeMatch[1].length === 5 ? `${timeMatch[1]}:00` : timeMatch[1];
                                
                                newData.Timestamp = `${todayStr} ${timeStr}`;
                            }
                        }
                    }
                }
                
                // Construct full payload for update-order consistency
                const payload = {
                    orderId: o['Order ID'],
                    team: o.Team,
                    userName: 'Delivery Agent',
                    newData: {
                        ...newData,
                        'Products (JSON)': JSON.stringify(o.Products)
                    }
                };

                let success = false;
                let attempts = 0;
                const maxAttempts = 3; // Reduced for faster failure detection, backend has its own retries

                while (!success && attempts < maxAttempts) {
                    attempts++;
                    try {
                        const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (response.ok) {
                            success = true;
                        } else {
                            // Exponential backoff
                            const delay = Math.min(5000, (Math.pow(2, attempts) * 500));
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    } catch (err) {
                        const delay = Math.min(5000, (Math.pow(2, attempts) * 500));
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                
                if (!success) {
                    failureCount++;
                    failedOrders.push(o['Order ID']);
                }

                processedCount++;
                console.log(`Agent Progress: ${processedCount}/${totalToProcess} (${o['Order ID']}: ${success ? 'OK' : 'FAIL'})`);
                
                // Minimal breather (300ms instead of 1500ms for high performance)
                await new Promise(resolve => setTimeout(resolve, 300));
            };

            // Run in concurrent batches
            for (let i = 0; i < queue.length; i += concurrencyLimit) {
                const batch = queue.slice(i, i + concurrencyLimit);
                await Promise.all(batch.map(processItem));
            }

            if (failureCount > 0) {
                 alert(`ការបញ្ជូនបានបញ្ចប់ ប៉ុន្តែមាន ${failureCount} កញ្ចប់បរាជ័យក្នុងការ Update: (${failedOrders.join(', ')})\n\nសូមព្យាយាមម្តងទៀតសម្រាប់កញ្ចប់ដែលបរាជ័យ។`);
            } else {
                 setIsSubmitted(true);
            }
        } catch (e: any) {
            console.error("Critical Submission Error:", e);
            alert(`ការបញ្ជូនបរាជ័យ: ${e.message}\n\nគន្លឹះ៖ សូមពិនិត្យអ៊ីនធឺណិត រួចចុចបញ្ជូនម្តងទៀត។`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalShipCost = useMemo(() => {
        return orders.reduce((acc, o) => {
            if (!successSet.has(o['Order ID'])) return acc;
            return acc + (costs[o['Order ID']] || 0);
        }, 0);
    }, [costs, successSet, orders]);

    const financialStats = useMemo(() => {
        const successOrders = orders.filter(o => successSet.has(o['Order ID']));
        const nonSuccessOrders = orders.filter(o => !successSet.has(o['Order ID']));
        
        return {
            totalSuccess: successOrders.reduce((acc, o) => acc + (Number(o['Grand Total']) || 0), 0),
            paidSuccess: successOrders.filter(o => o['Payment Status'] === 'Paid').reduce((acc, o) => acc + (Number(o['Grand Total']) || 0), 0),
            codSuccess: successOrders.filter(o => o['Payment Status'] !== 'Paid').reduce((acc, o) => acc + (Number(o['Grand Total']) || 0), 0),
            totalFailed: nonSuccessOrders.reduce((acc, o) => acc + (Number(o['Grand Total']) || 0), 0)
        };
    }, [orders, successSet]);

    const handleCopyImage = async () => {
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
                    } catch (err) {
                        console.error("Clipboard write failed, falling back to download:", err);
                        // Fallback only if clipboard fails (required to Paste in Telegram)
                        const dataUrl = canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.download = `confirm_${Date.now()}.png`;
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

    if (loading) return <div className="flex h-screen items-center justify-center bg-[#020617]"><Spinner size="lg" /></div>;

    if (isExpired) {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20 shadow-xl">
                    <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-1">Link ហួសសុពលភាព</h2>
                <p className="text-red-400 font-bold text-sm mb-4">Link Expired</p>
                <p className="text-gray-500 max-w-xs leading-relaxed text-xs">Link នេះមានសុពលភាពត្រឹមតែ ២ ម៉ោងប៉ុណ្ណោះ។ សូមទាក់ទងក្រុមហ៊ុនដើម្បីផ្ញើ Link ថ្មី។</p>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-[#020617] p-4 flex flex-col items-center justify-center animate-fade-in">
                <div id="summary-card" className="bg-[#0f172a] border-2 border-emerald-500/30 p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl text-center space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] -mr-16 -mt-16 rounded-full"></div>
                    <div className="relative z-10 space-y-6">
                        <div className="flex flex-col items-center">
                            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/20 shadow-2xl mb-4">
                                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white leading-snug">បញ្ជាក់ថ្លៃដឹកសរុប<br/><span className="text-base opacity-40 uppercase tracking-widest">(Confirmation)</span></h2>
                            <p className="text-blue-400 text-xs font-black uppercase tracking-widest mt-2">{storeName}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div className="bg-black/40 p-6 rounded-[2rem] border border-white/5 shadow-inner text-center">
                                <p className="text-[10px] font-bold text-gray-500 mb-2">ចំនួនកញ្ចប់ (COUNT)</p>
                                <p className="text-4xl font-black text-white">{orderIds.length}</p>
                            </div>
                            <div className="bg-blue-600/10 p-6 rounded-[2rem] border border-blue-500/20 shadow-inner text-center">
                                <p className="text-[10px] font-bold text-blue-400 mb-2">ថ្លៃដឹកសរុប (TOTAL)</p>
                                <p className="text-4xl font-black text-white">${(Number(totalShipCost) || 0).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="bg-black/20 p-7 rounded-[2.5rem] border border-white/5 text-left space-y-4">
                            <div className="flex justify-between items-center text-white font-black border-b border-white/10 pb-4 mb-1">
                                <span className="text-[13px] font-bold">សរុបទឹកប្រាក់ (ដឹកជោគជ័យ)</span>
                                <span className="text-2xl tracking-tighter">${(Number(financialStats.totalSuccess) || 0).toFixed(2)}</span>
                            </div>
                            <div className="space-y-3 font-bold text-gray-300">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">├─ 🟢 Paid (បង់រួច)</span>
                                    <span className="text-2xl text-emerald-400 font-black">${(Number(financialStats.paidSuccess) || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm">└─ 🔴 COD (ប្រមូលលុយ) 💸</span>
                                    <span className="text-2xl text-red-400 font-black">${(Number(financialStats.codSuccess) || 0).toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-gray-600 font-bold pt-4 border-t border-white/10 opacity-60">
                                <span className="text-xs font-bold">❌ ដឹកមិនជោគជ័យ និង Return</span>
                                <span className="text-lg tracking-tighter">${(Number(financialStats.totalFailed) || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 relative z-10">
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest italic">Generated by ACC Order System v2.0</p>
                    </div>
                </div>

                <div className="mt-8 flex flex-col w-full max-w-md gap-3">
                    <p className="text-[10px] text-gray-500 font-bold italic text-center mb-1">សូមចុចប៊ូតុងខាងក្រោមដើម្បី Copy រូបភាព រួច Paste ក្នុង Telegram</p>
                    <button onClick={handleCopyImage} className={`py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-3 shadow-xl border border-white/10 ${copyStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-white text-black active:scale-95'}`}>
                        {copyStatus === 'success' ? <>✅ បានចម្លងរូបភាព (Copied!)</> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> ចម្លងរូបភាព (Copy Image)</>}
                    </button>
                    <button onClick={() => setIsSubmitted(false)} className="py-4 bg-gray-900/50 text-gray-400 font-black uppercase tracking-widest text-[9px] rounded-[1.5rem] border border-white/5 hover:text-white transition-all active:scale-95">Back & Edit</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col relative overflow-x-hidden font-['Kantumruy_Pro']">
            <style>{`
                input::-webkit-outer-spin-button,
                input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                input[type=number] { -moz-appearance: textfield; }
            `}</style>
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 blur-[100px] -mr-48 -mt-48 rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/5 blur-[100px] -ml-48 -mb-48 rounded-full"></div>
            </div>

            <div className="relative z-10 flex flex-col h-full">
                <div className="p-4 sm:p-6 text-center">
                    <div className="inline-flex items-center gap-2 bg-blue-600/10 px-3 py-1 rounded-full border border-blue-500/20 mb-2">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Delivery Agent Portal</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter uppercase leading-none drop-shadow-2xl">បញ្ជាក់ថ្លៃសេវាដឹក</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mt-1 opacity-60">Confirm Ship Cost | {storeName}</p>
                </div>

                <div className={`mx-auto w-full px-3 sm:px-8 pb-32 ${isMobile ? 'max-w-2xl' : 'max-w-6xl'}`}>
                    <div className="bg-[#0f172a]/80 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
                        <div className="p-4 bg-gray-900/50 border-b border-white/10 flex justify-between items-center px-6">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Assignment List</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-black text-white">{orders.length}</span>
                                    <span className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">Packages</span>
                                </div>
                            </div>
                            <span className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 text-[8px] font-black text-blue-400 uppercase rounded-lg tracking-widest">Edit Ship Below</span>
                        </div>
                        
                        {!isMobile ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-black/30 text-[8px] font-black text-gray-500 uppercase tracking-widest border-b border-white/10">
                                            <th className="p-3 text-center w-12">#</th>
                                            <th className="p-3">Customer Detail</th>
                                            <th className="p-3">Location & Info</th>
                                            <th className="p-3 text-right">Order Val</th>
                                            <th className="p-3 text-right w-48">Ship Cost ($)</th>
                                            <th className="p-3 text-center w-24">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {orders.map((o, idx) => {
                                            const isReturned = returnedSet.has(o['Order ID']);
                                            const isFailed = failedSet.has(o['Order ID']);
                                            const isNotSuccess = isReturned || isFailed;
                                            
                                            return (
                                                <tr key={o['Order ID']} className={`transition-all group ${isNotSuccess ? 'bg-red-900/10 opacity-60' : 'hover:bg-white/5'}`}>
                                                    <td className="p-3 text-center font-black text-gray-700 text-[10px] group-hover:text-white transition-colors">{idx + 1}</td>
                                                    <td className="p-3 min-w-[200px]">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-lg font-black text-blue-400 font-mono bg-blue-400/10 px-3 py-1 rounded-lg border border-blue-400/20 shadow-sm">{o['Customer Phone']}</span>
                                                            <p className="text-[9px] text-gray-500 font-bold uppercase truncate max-w-[100px] opacity-60">{o['Customer Name']}</p>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 min-w-[280px]">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-base text-gray-100 font-bold leading-none flex items-center gap-1.5">📍 {o.Location}</p>
                                                            {o['Address Details'] && (
                                                                <p className="text-[13px] text-slate-200 font-bold truncate max-w-[220px] italic border-l border-slate-700 pl-2 ml-1">
                                                                    {o['Address Details']}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <p className="text-base font-black text-emerald-400 italic">${(Number(o['Grand Total']) || 0).toFixed(2)}</p>
                                                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border mt-1 inline-block ${o['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                            {o['Payment Status'] === 'Paid' ? 'Paid' : 'COD'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {!isNotSuccess ? (
                                                            <div className="relative inline-block w-32 animate-fade-in">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-black text-base z-10">$</span>
                                                                <input type="number" step="0.01" value={costs[o['Order ID']] ?? ''} onChange={(e) => handleCostChange(o['Order ID'], e.target.value)} className="relative w-full bg-black/60 border-2 border-white/10 rounded-lg py-2 pl-8 pr-3 text-right text-lg font-black text-blue-400 focus:border-blue-500 focus:ring-0 transition-all z-0" placeholder="0.00" />
                                                            </div>
                                                        ) : <span className="text-xs font-black text-red-500 uppercase tracking-widest">{isReturned ? 'Returned' : 'Failed'}</span>}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md border ${isNotSuccess ? 'bg-red-600/10 text-red-500 border-red-500/20' : 'bg-emerald-600/10 text-emerald-500 border-emerald-500/20'}`}>
                                                            {isReturned ? 'Returned' : isFailed ? 'Failed' : 'Success'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {orders.map((o, idx) => {
                                    const isReturned = returnedSet.has(o['Order ID']);
                                    const isFailed = failedSet.has(o['Order ID']);
                                    const isNotSuccess = isReturned || isFailed;
                                    
                                    return (
                                        <div key={o['Order ID']} className={`p-4 flex flex-col gap-3 transition-all group ${isNotSuccess ? 'bg-red-900/10' : 'hover:bg-white/5'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${isNotSuccess ? 'bg-red-600 border-red-500 text-white' : 'bg-gray-800 border-white/5 text-gray-500'}`}>{idx + 1}</div>
                                                    <div className="min-w-0 space-y-1">
                                                        <span className={`text-xl font-black font-mono leading-none block transition-colors ${isNotSuccess ? 'text-red-400' : 'text-blue-400'}`}>{o['Customer Phone']}</span>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm text-gray-100 font-bold leading-none">📍 {o.Location}</p>
                                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest opacity-60 truncate max-w-[100px]">{o['Customer Name']}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className={`text-base font-black italic transition-colors ${isNotSuccess ? 'text-gray-600 line-through' : 'text-emerald-400'}`}>${(Number(o['Grand Total']) || 0).toFixed(2)}</p>
                                                    <div className="flex flex-col items-end gap-1 mt-1">
                                                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border ${o['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                            {o['Payment Status'] === 'Paid' ? 'Paid' : 'COD'}
                                                        </span>
                                                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${isReturned ? 'bg-red-600/10 text-red-500 border-red-500/20' : isFailed ? 'bg-orange-600/10 text-orange-500 border-orange-500/20' : 'bg-emerald-600/10 text-emerald-500 border-emerald-500/20'}`}>
                                                            {isReturned ? 'Returned' : isFailed ? 'Failed' : 'Success'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {!isNotSuccess && (
                                                <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-xl border border-white/5 shadow-inner animate-fade-in">
                                                    <div className="flex-grow flex items-center gap-2 pl-2 overflow-hidden">
                                                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex-shrink-0">Ship Cost</span>
                                                        <div className="h-3 w-px bg-white/10 flex-shrink-0"></div>
                                                        {o['Address Details'] && <p className="text-[12px] text-gray-200 font-bold italic truncate flex-grow">{o['Address Details']}</p>}
                                                    </div>
                                                    <div className="relative w-32 flex-shrink-0"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-black text-sm z-10">$</span><input type="number" step="0.01" value={costs[o['Order ID']] ?? ''} onChange={(e) => handleCostChange(o['Order ID'], e.target.value)} className="w-full bg-black/60 border border-white/10 rounded-lg py-1.5 pl-7 pr-3 text-right text-base font-black text-blue-400 focus:border-blue-500 focus:ring-0 shadow-lg" placeholder="0.00" /></div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="p-6 bg-black/20 border-t border-white/5 space-y-3 px-8 sm:px-12">
                            <div className="flex items-center justify-between text-white font-black">
                                <span className="text-xs uppercase tracking-widest">សរុបទឹកប្រាក់ (ដឹកជោគជ័យ)</span>
                                <span className="text-xl tracking-tighter">${(Number(financialStats.totalSuccess) || 0).toFixed(2)}</span>
                            </div>
                            <div className="space-y-1 ml-4 text-[11px] font-bold text-gray-400">
                                <div className="flex justify-between items-center"><span>├─ 🟢 Paid</span><span className="text-emerald-400">${(Number(financialStats.paidSuccess) || 0).toFixed(2)}</span></div>
                                <div className="flex justify-between items-center"><span>└─ 🔴 COD 💸</span><span className="text-red-400">${(Number(financialStats.codSuccess) || 0).toFixed(2)}</span></div>
                            </div>
                            <div className="flex items-center justify-between text-gray-500 font-bold pt-2 border-t border-white/5">
                                <span className="text-[10px] uppercase tracking-widest">❌ សរុបទឹកប្រាក់ (ដឹកមិនជោគជ័យ និង Return)</span>
                                <span className="text-base tracking-tighter">${(Number(financialStats.totalFailed) || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="p-6 sm:p-8 bg-gray-900/80 border-t border-white/10 flex flex-col lg:flex-row justify-between items-center gap-6">
                            <div className="flex flex-col lg:items-start items-center text-center lg:text-left gap-0.5">
                                <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.3em]">Total Ship Fee (Success Only)</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter italic leading-none">${(Number(totalShipCost) || 0).toFixed(2)}</span>
                                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-60">USD</span>
                                </div>
                            </div>
                            <button onClick={handleSubmit} disabled={isSubmitting || orders.length === 0} className="w-full lg:w-auto px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:scale-[1.02] text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-4 border border-white/10 group disabled:opacity-50">
                                {isSubmitting ? <Spinner size="sm" /> : <><span>បញ្ជូនការបញ្ជាក់ (Confirm & Send)</span><div className="w-7 h-7 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg></div></>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-4 text-center opacity-20 relative z-10"><p className="text-[7px] font-black uppercase tracking-[0.4em]">ACC Node v2.0 Operations</p></div>
        </div>
    );
};

export default DeliveryAgentView;
