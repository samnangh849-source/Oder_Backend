import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { ParsedOrder, EditLog, UserActivityLog } from '../../types';
import { safeParseDate } from '../../utils/dateUtils';
import { convertGoogleDriveUrl, getOptimisticPackagePhoto } from '../../utils/fileUtils';
import { WEB_APP_URL } from '../../constants';
import { CacheService, CACHE_KEYS } from '../../services/cacheService';
import { fetchAuditLogs } from '../../services/auditService';
import Modal from '../common/Modal';
import { 
    Copy, 
    Check, 
    User, 
    Phone, 
    MapPin, 
    Truck,
    Image as ImageIcon,
    Trash,
    CreditCard, 
    Package, 
    Box, 
    Clock, 
    ShieldCheck, 
    ExternalLink,
    Zap,
    Hash,
    History,
    Activity
} from 'lucide-react';

interface OrderDetailModalProps {
    order: ParsedOrder;
    onClose: () => void;
    inline?: boolean;
}

const JsonValueRenderer: React.FC<{ value: string; field: string; type: 'old' | 'new' }> = ({ value, field, type }) => {
    const { previewImage } = useContext(AppContext);
    const [isExpanded, setIsExpanded] = useState(false);
    
    if (!value || value === 'EMPTY' || value === 'null') {
        return <p className="text-[9px] font-bold text-[#848E9C] italic">EMPTY</p>;
    }

    let isJson = false;
    let parsed: any = null;
    try {
        const trimmed = value.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            parsed = JSON.parse(trimmed);
            isJson = true;
        }
    } catch (e) {}

    if (!isJson) {
        return <p className={`text-[9px] font-bold ${type === 'new' ? 'text-white' : 'text-[#848E9C] italic'} break-words line-clamp-2`}>{value}</p>;
    }

    // Special handling for Products
    const isProductField = field.toLowerCase().includes('product');
    if (isProductField && Array.isArray(parsed)) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border ${
                            type === 'new' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                            {parsed.length} {parsed.length === 1 ? 'ASSET' : 'ASSETS'}
                        </span>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className="text-[7px] font-black text-[#FCD535] uppercase hover:underline tracking-tighter"
                    >
                        {isExpanded ? '[ CLOSE ]' : '[ VIEW ALL ]'}
                    </button>
                </div>

                {isExpanded ? (
                    <div className="grid grid-cols-1 gap-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                        {parsed.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-2.5 bg-black/40 p-2 rounded-xl border border-white/5 group hover:bg-black/60 transition-all">
                                {p.image && (
                                    <div className="relative shrink-0">
                                        <img 
                                            src={convertGoogleDriveUrl(p.image)} 
                                            className="w-10 h-10 rounded-lg object-cover border border-white/10 shadow-lg cursor-zoom-in" 
                                            alt="" 
                                            onClick={(e) => { e.stopPropagation(); previewImage(convertGoogleDriveUrl(p.image)); }}
                                        />
                                        <div className="absolute -top-1.5 -right-1.5 bg-[#FCD535] text-black text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-black shadow-sm">
                                            {p.quantity || p.qty || 1}
                                        </div>
                                    </div>
                                )}
                                <div className="min-w-0 flex-grow">
                                    <p className="text-white font-black text-[9px] truncate uppercase tracking-tight">{p.name || p.ProductName || 'Unnamed Asset'}</p>
                                    <p className="text-[#848E9C] text-[7px] font-bold uppercase tracking-widest">{p.colorInfo || 'Standard Spec'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {parsed.slice(0, 3).map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                                {p.image ? (
                                    <img 
                                        src={convertGoogleDriveUrl(p.image)} 
                                        className="w-6 h-6 rounded object-cover border border-white/10 shrink-0" 
                                        alt="" 
                                    />
                                ) : (
                                    <div className="w-6 h-6 rounded bg-white/5 border border-white/5 flex items-center justify-center text-[#848E9C] shrink-0">
                                        <Package size={10} />
                                    </div>
                                )}
                                <p className="text-[8px] font-bold text-white/90 truncate uppercase tracking-tight flex-grow">
                                    {p.name || p.ProductName || 'Asset'}
                                </p>
                                <span className="text-[#FCD535] text-[8px] font-black px-1 font-mono shrink-0">
                                    x{p.quantity || p.qty || 1}
                                </span>
                            </div>
                        ))}
                        {parsed.length > 3 && (
                            <div 
                                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
                                className="text-[7px] font-black text-[#848E9C] hover:text-[#FCD535] transition-colors cursor-pointer ml-1 uppercase tracking-widest"
                            >
                                + {parsed.length - 3} more items detected...
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Generic JSON
    return (
        <div className="space-y-1">
             <div className="flex items-center justify-between mb-1">
                <span className="text-[7px] font-black text-[#848E9C] opacity-50 tracking-widest">STRUCTURED LOG</span>
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                    className="text-[7px] font-black text-[#FCD535] uppercase hover:text-[#FCD535]/80 transition-colors"
                >
                    {isExpanded ? 'Collapse' : 'Raw Data'}
                </button>
            </div>
            {isExpanded ? (
                <pre className="text-[8px] font-mono leading-tight bg-black/60 p-2 rounded border border-white/5 overflow-x-auto custom-scrollbar max-h-[120px] text-[#848E9C]">
                    {JSON.stringify(parsed, null, 2)}
                </pre>
            ) : (
                <p className="text-[8px] text-[#848E9C] italic truncate opacity-70">{value}</p>
            )}
        </div>
    );
};

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose, inline = false }) => {
    const { previewImage, appData, isShiftOpener, activeShiftStore, currentUser } = useContext(AppContext);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isSendingTelegram, setIsSendingTelegram] = useState(false);

    // Permission Check: Only the user who opened the packaging shift for this store can send to driver
    // AND it must be in the "Ready to Ship" (Ready for Dispatch) step.
    const canSendToDriver = useMemo(() => {
        const fs = (order as any).FulfillmentStatus || (order as any)['Fulfillment Status'] || 'Pending';
        const isReadyForDispatch = fs === 'Ready to Ship';

        // Global rule: Only allowed in "Ready to Ship" status
        if (!isReadyForDispatch) return false;
        if (!currentUser) return false;
        
        const orderStore = (order['Fulfillment Store'] || '').trim().toLowerCase();
        const myShiftStore = (activeShiftStore || '').trim().toLowerCase();
        
        // Strict: Only the person who opened the packaging shift for this store can send
        return isShiftOpener && orderStore === myShiftStore;
    }, [isShiftOpener, activeShiftStore, order, currentUser]);

    const [editLogs, setEditLogs] = useState<EditLog[]>([]);
    const [activityLogs, setActivityLogs] = useState<UserActivityLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    useEffect(() => {
        const loadLogs = async () => {
            setLoadingLogs(true);
            try {
                const [eLogs, aLogs] = await Promise.all([
                    fetchAuditLogs('edit'),
                    fetchAuditLogs('activity')
                ]);
                
                // Filter EditLogs by OrderID
                const filteredEditLogs = (eLogs as EditLog[]).filter(log => 
                    log.OrderID && log.OrderID.toLowerCase() === order['Order ID'].toLowerCase()
                );
                setEditLogs(filteredEditLogs.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()));

                // Filter UserActivityLogs by OrderID in Details
                const filteredActivityLogs = (aLogs as UserActivityLog[]).filter(log => 
                    log.Details && log.Details.toLowerCase().includes(order['Order ID'].toLowerCase())
                );
                setActivityLogs(filteredActivityLogs.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()));
            } catch (error) {
                console.error("Error loading order logs:", error);
            } finally {
                setLoadingLogs(false);
            }
        };
        loadLogs();
    }, [order['Order ID']]);

    const page = appData.pages?.find(p => p.PageName === order.Page);
    const bank = appData.bankAccounts?.find(b => b.BankName === order['Payment Info']);
    const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);

    // Check if there is a Telegram group assigned for this delivery method and store
    const deliveryGroup = useMemo(() => {
        if (!order['Internal Shipping Method'] || !order['Fulfillment Store']) return null;
        return appData.deliveryGroups?.find(dg => 
            dg.ShippingMethod === order['Internal Shipping Method'] && 
            dg.StoreName === order['Fulfillment Store']
        );
    }, [appData.deliveryGroups, order]);

    const hasTelegramGroup = !!deliveryGroup?.TelegramGroupID;
    const isAlreadySent = !!(order['Delivery Telegram Message ID'] || (order as any)['Delivery Telegram Message ID']);

    const handleSendToDeliveryTelegram = async () => {
        setIsSendingTelegram(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const res = await fetch(`${WEB_APP_URL}/api/admin/send-delivery-telegram`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ orderId: order['Order ID'] })
            });
            const data = await res.json();
            if (data.status !== 'success') {
                let errorMsg = data.message || 'មិនស្គាល់បញ្ហា';
                if (data.details && data.details.description) {
                    errorMsg += ` (${data.details.description})`;
                }
                alert('បរាជ័យ: ' + errorMsg);
            }
        } catch (error) {
            console.error("Error sending to telegram:", error);
            alert('មានបញ្ហាក្នុងការបញ្ជូនរូបភាព (Server Error)។');
        } finally {
            setIsSendingTelegram(false);
        }
    };

    const handleDeleteFromDeliveryTelegram = async () => {
        if (!confirm('តើអ្នកពិតជាចង់លុបរូបភាពនេះចេញពី Telegram មែនទេ? លេខរៀងនឹងត្រូវបានរៀបចំឡើងវិញ។')) return;
        
        setIsSendingTelegram(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || '';
            const res = await fetch(`${WEB_APP_URL}/api/admin/delete-delivery-telegram`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ orderId: order['Order ID'] })
            });
            const data = await res.json();
            if (data.status !== 'success') {
                alert('បរាជ័យ: ' + (data.message || 'មិនស្គាល់បញ្ហា'));
            }
        } catch (error) {
            console.error("Error deleting from telegram:", error);
            alert('មានបញ្ហាក្នុងការលុប។');
        } finally {
            setIsSendingTelegram(false);
        }
    };

    const handleCopy = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const cleanPhone = (phone: string) => {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('855')) cleaned = cleaned.substring(3);
        if (!cleaned.startsWith('0')) cleaned = '0' + cleaned;
        return cleaned;
    };

    const fs = (order as any).FulfillmentStatus || (order as any)['Fulfillment Status'] || 'Pending';
    const fsColors: Record<string, string> = {
        'Pending': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'Ready to Ship': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'Shipped': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'Delivered': 'bg-[#0ECB81]/20 text-[#0ECB81] border-[#0ECB81]/30',
        'Cancelled': 'bg-[#F6465D]/20 text-[#F6465D] border-[#F6465D]/30',
    };

    const formatLifecycleDateTime = (value?: string) => {
        const rawValue = String(value || '').trim();
        if (!rawValue) return null;

        const parsed = safeParseDate(rawValue);
        if (!parsed) {
            const [datePart, timePart] = rawValue.split(/\s+/, 2);
            return {
                date: datePart || rawValue,
                time: timePart || 'TIME N/A',
            };
        }

        return {
            date: parsed.toLocaleDateString('km-KH', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            }),
            time: parsed.toLocaleTimeString('km-KH', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }),
        };
    };

    const lifecycleEvents = [
        {
            key: 'dropped',
            label: 'Dropped Order',
            labelKm: 'ទម្លាក់ការកម្មង់',
            value: order.Timestamp,
            icon: Package,
            color: 'text-[#FCD535]',
            dot: 'bg-[#FCD535]',
        },
        {
            key: 'packed',
            label: 'Packed',
            labelKm: 'វេចខ្ចប់',
            value: order['Packed Time'],
            icon: Box,
            color: 'text-[#0ECB81]',
            dot: 'bg-[#0ECB81]',
        },
        {
            key: 'shipped',
            label: 'Shipped',
            labelKm: 'បានដឹកចេញ',
            value: order['Dispatched Time'],
            icon: Truck,
            color: 'text-blue-400',
            dot: 'bg-blue-400',
        },
        {
            key: 'delivered',
            label: 'Delivered',
            labelKm: 'បានដល់អតិថិជន',
            value: order['Delivered Time'],
            icon: ShieldCheck,
            color: 'text-[#0ECB81]',
            dot: 'bg-[#0ECB81]',
        },
    ];

    const content = (
        <div className={`flex flex-col ${inline ? 'h-full' : 'h-screen'} overflow-hidden bg-[#0B0E11] text-[#EAECEF] selection:bg-[#FCD535]/30 sm:rounded-2xl border-x border-b border-[#2B3139]`} style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header: Terminal Style */}
            <div className="p-4 sm:p-6 border-b border-[#2B3139] bg-gradient-to-r from-[#1E2329] to-[#0B0E11] flex justify-between items-center relative z-10">
                <div className="flex items-center gap-3 sm:gap-5">
                    <div className="relative group shrink-0">
                        {page ? (
                            <img src={convertGoogleDriveUrl(page.PageLogoURL)} className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl border-2 border-[#2B3139] object-cover shadow-2xl transition-all group-hover:border-[#FCD535]/50" alt="" />
                        ) : (
                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-[#1E2329] border-2 border-[#2B3139] flex items-center justify-center text-[#FCD535]">
                                <Box size={20} className="sm:w-7 sm:h-7" />
                            </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-[#0ECB81] rounded-full border-2 border-[#1E2329] animate-pulse"></div>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 sm:w-1.5 sm:h-5 bg-[#FCD535] rounded-full hidden xs:block"></div>
                            <h2 className="text-sm sm:text-xl font-black uppercase tracking-widest italic leading-none text-white truncate">Order Analysis <span className="text-[#848E9C] not-italic font-medium text-[10px] sm:text-xs ml-1 sm:ml-2 tracking-normal opacity-50">v4.0.2</span></h2>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1 sm:mt-2">
                            <div 
                                onClick={() => handleCopy(order['Order ID'], 'orderId')}
                                className="flex items-center gap-1 sm:gap-2 cursor-pointer group"
                            >
                                <p className="text-[8px] sm:text-[10px] font-mono text-[#848E9C] font-bold uppercase tracking-widest sm:tracking-[0.2em] group-hover:text-[#FCD535] transition-colors truncate max-w-[120px] sm:max-w-none">ID: {order['Order ID'].substring(0, 8)}...</p>
                                {copiedField === 'orderId' ? <Check size={8} className="text-[#0ECB81] sm:w-2.5 sm:h-2.5" /> : <Copy size={8} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity sm:w-2.5 sm:h-2.5" />}
                            </div>
                            <span className={`px-1.5 sm:px-2.5 py-0.5 text-[8px] sm:text-[10px] font-black uppercase tracking-widest border rounded-sm ${fsColors[fs] || 'bg-[#2B3139] text-[#848E9C] border-[#2B3139]'}`}>{fs}</span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1E2329] hover:bg-[#F6465D]/10 text-[#848E9C] hover:text-[#F6465D] rounded-lg sm:rounded-xl flex items-center justify-center transition-all active:scale-90 border border-[#2B3139] group shadow-lg shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5} strokeLinecap="round" /></svg>
                </button>
            </div>

            <div className="p-4 sm:p-8 flex-grow overflow-y-auto custom-scrollbar space-y-6 sm:space-y-10 select-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                    {/* Left: Customer & Logistics */}
                    <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                        {/* Customer Info Card: Sharp Terminal Look */}
                        <div className="bg-[#1E2329]/80 backdrop-blur-md border border-[#2B3139] p-5 sm:p-8 space-y-6 sm:space-y-8 relative overflow-hidden rounded-2xl shadow-2xl">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                                <User size={120} />
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-5 sm:w-1.5 sm:h-6 bg-[#FCD535] rounded-full"></div>
                                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#848E9C]">Customer Intelligence (ព័ត៌មានអតិថិជន)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                                <div className="space-y-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-[#848E9C] uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <User size={10} className="sm:w-3 sm:h-3" /> Full Name (ឈ្មោះ)
                                    </label>
                                    <div 
                                        onClick={() => handleCopy(order['Customer Name'], 'name')}
                                        className="bg-[#0B0E11] border border-[#2B3139] p-4 sm:p-5 rounded-xl group hover:border-[#FCD535]/50 transition-all cursor-pointer relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-center gap-2">
                                            <p className="text-base sm:text-xl font-black text-[#EAECEF] uppercase tracking-wider truncate">{order['Customer Name']}</p>
                                            {copiedField === 'name' ? <Check size={14} className="text-[#0ECB81] shrink-0" /> : <Copy size={14} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                                        </div>
                                        <div className="absolute bottom-0 left-0 h-0.5 bg-[#FCD535] transition-all w-0 group-hover:w-full"></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-[#848E9C] uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Phone size={10} className="sm:w-3 sm:h-3" /> Phone (លេខទូរស័ព្ទ)
                                    </label>
                                    <div 
                                        onClick={() => handleCopy(cleanPhone(order['Customer Phone']), 'phone')}
                                        className="bg-[#0B0E11] border border-[#2B3139] p-4 sm:p-5 rounded-xl group hover:border-[#FCD535]/50 transition-all cursor-pointer relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-center gap-2">
                                            <p className="text-base sm:text-xl font-mono font-black text-[#FCD535]">{cleanPhone(order['Customer Phone'])}</p>
                                            {copiedField === 'phone' ? <Check size={14} className="text-[#0ECB81] shrink-0" /> : <Copy size={14} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                                        </div>
                                        <div className="absolute bottom-0 left-0 h-0.5 bg-[#FCD535] transition-all w-0 group-hover:w-full"></div>
                                    </div>
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-[#848E9C] uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <MapPin size={10} className="sm:w-3 sm:h-3" /> Shipping Destination (អាសយដ្ឋាន)
                                    </label>
                                    <div 
                                        onClick={() => handleCopy(`${order.Location} ${order['Address Details'] || ''}`, 'address')}
                                        className="bg-[#0B0E11] border border-[#2B3139] p-4 sm:p-5 rounded-xl group hover:border-[#FCD535]/50 transition-all cursor-pointer relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="min-w-0">
                                                <p className="text-xs sm:text-sm font-bold text-[#EAECEF] leading-relaxed uppercase tracking-wide">{order.Location}</p>
                                                <p className="text-[10px] sm:text-xs text-[#848E9C] mt-1 sm:mt-2 italic font-medium">{order['Address Details'] || 'NO ADDITIONAL ANNOTATIONS'}</p>
                                            </div>
                                            {copiedField === 'address' ? <Check size={16} className="text-[#0ECB81] shrink-0 mt-0.5 sm:mt-1" /> : <Copy size={16} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 sm:mt-1" />}
                                        </div>
                                        <div className="absolute bottom-0 left-0 h-0.5 bg-[#FCD535] transition-all w-0 group-hover:w-full"></div>
                                    </div>
                                </div>

                                {order.Note && (
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-[9px] sm:text-[10px] font-black text-[#FCD535] uppercase tracking-widest ml-1 flex items-center gap-2">
                                            <Zap size={10} className="sm:w-3 sm:h-3" /> Special Instruction (ចំណាំ)
                                        </label>
                                        <div className="bg-[#FCD535]/5 border border-[#FCD535]/20 p-4 sm:p-5 rounded-xl italic">
                                            <p className="text-xs sm:text-sm text-[#EAECEF] leading-relaxed">"{order.Note}"</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Logistics & Payment Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                            <div className="bg-[#1E2329]/80 backdrop-blur-md border border-[#2B3139] p-5 sm:p-8 space-y-4 sm:space-y-6 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-4 sm:w-1.5 sm:h-5 bg-[#FCD535] rounded-full"></div>
                                    <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#848E9C]">Logistics Protocol</h3>
                                </div>
                                <div className="flex items-center gap-4 sm:gap-5 bg-[#0B0E11] p-4 sm:p-5 rounded-xl border border-[#2B3139] group hover:border-[#FCD535]/40 transition-all">
                                    {shippingMethod ? (
                                        <div className="relative shrink-0">
                                            <img src={convertGoogleDriveUrl(shippingMethod.LogoURL)} className="w-10 h-10 sm:w-12 sm:h-12 object-contain p-1.5 sm:p-2 bg-[#1E2329] border border-[#2B3139] rounded-lg shadow-inner" alt="" />
                                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-blue-500 rounded-full border-2 border-[#0B0E11]"></div>
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1E2329] border border-[#2B3139] rounded-lg flex items-center justify-center text-[#848E9C] shrink-0">
                                            <Truck size={20} className="sm:w-6 sm:h-6" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-[10px] sm:text-xs font-black text-[#EAECEF] truncate uppercase tracking-wider">{order['Internal Shipping Method'] || 'DIRECT DISPATCH'}</p>
                                        <p className="text-[8px] sm:text-[10px] text-[#848E9C] font-black uppercase tracking-widest mt-0.5 sm:mt-1 opacity-70 truncate">{order['Internal Shipping Details'] || 'STANDARD PROTOCOL'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-[#1E2329]/80 backdrop-blur-md border border-[#2B3139] p-5 sm:p-8 space-y-4 sm:space-y-6 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-4 sm:w-1.5 sm:h-5 bg-[#FCD535] rounded-full"></div>
                                    <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#848E9C]">Financial Clearing</h3>
                                </div>
                                <div className="flex items-center justify-between gap-4 bg-[#0B0E11] p-4 sm:p-5 rounded-xl border border-[#2B3139] group hover:border-[#FCD535]/40 transition-all">
                                    <div className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[8px] sm:text-[10px] font-black uppercase tracking-widest border rounded-md shrink-0 ${order['Payment Status'] === 'Paid' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/30' : 'bg-[#F6465D]/10 text-[#F6465D] border-[#F6465D]/30'}`}>
                                        {order['Payment Status']}
                                    </div>
                                    {bank && (
                                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                                            <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-6 h-6 sm:w-8 sm:h-8 object-contain opacity-90 drop-shadow-md shrink-0" alt="" />
                                            <span className="text-[8px] sm:text-[10px] font-black text-[#848E9C] uppercase tracking-widest truncate">{bank.BankName}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Audit Logs Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                            {/* Edit Logs */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 ml-2">
                                    <History size={16} className="text-[#FCD535]" />
                                    <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#848E9C]">Edit Logs (ប្រវត្តិការកែប្រែ)</h3>
                                </div>
                                <div className="bg-[#1E2329]/60 backdrop-blur-md border border-[#2B3139] rounded-2xl overflow-hidden max-h-[300px] flex flex-col">
                                    <div className="overflow-y-auto custom-scrollbar flex-grow p-1">
                                        {loadingLogs ? (
                                            <div className="p-8 flex flex-col items-center justify-center gap-3 opacity-50">
                                                <div className="w-5 h-5 border-2 border-[#FCD535] border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-[8px] font-black uppercase tracking-widest">Loading Protocol...</p>
                                            </div>
                                        ) : editLogs.length > 0 ? (
                                            <div className="space-y-1">
                                                {editLogs.map((log, idx) => (
                                                    <div key={idx} className="p-3 bg-[#0B0E11]/50 border border-[#2B3139] rounded-xl hover:border-[#FCD535]/30 transition-all group">
                                                        <div className="flex justify-between items-start gap-2 mb-2">
                                                            <p className="text-[8px] font-mono text-[#FCD535] font-black uppercase tracking-tighter opacity-70">{new Date(log.Timestamp).toLocaleString('km-KH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                                                            <p className="text-[9px] font-black text-white/90 uppercase tracking-widest bg-[#2B3139] px-2 py-0.5 rounded shadow-inner">{log.Requester}</p>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest border-l-2 border-blue-500/50 pl-2 ml-1">{log['Field Changed']}</p>
                                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                                <div className="bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                                                                    <p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-1 opacity-50">Old</p>
                                                                    <JsonValueRenderer value={log['Old Value']} field={log['Field Changed']} type="old" />
                                                                </div>
                                                                <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                                                                    <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest mb-1 opacity-50">New</p>
                                                                    <JsonValueRenderer value={log['New Value']} field={log['Field Changed']} type="new" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-10 text-center opacity-30 flex flex-col items-center gap-3">
                                                <History size={32} />
                                                <p className="text-[9px] font-black uppercase tracking-[0.3em]">No Modification Records</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Activity Logs */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 ml-2">
                                    <Activity size={16} className="text-[#0ECB81]" />
                                    <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#848E9C]">User Activity (សកម្មភាពអ្នកប្រើ)</h3>
                                </div>
                                <div className="bg-[#1E2329]/60 backdrop-blur-md border border-[#2B3139] rounded-2xl overflow-hidden max-h-[300px] flex flex-col">
                                    <div className="overflow-y-auto custom-scrollbar flex-grow p-1">
                                        {loadingLogs ? (
                                            <div className="p-8 flex flex-col items-center justify-center gap-3 opacity-50">
                                                <div className="w-5 h-5 border-2 border-[#0ECB81] border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-[8px] font-black uppercase tracking-widest">Scanning Uplink...</p>
                                            </div>
                                        ) : activityLogs.length > 0 ? (
                                            <div className="space-y-1">
                                                {activityLogs.map((log, idx) => (
                                                    <div key={idx} className="p-3 bg-[#0B0E11]/50 border border-[#2B3139] rounded-xl hover:border-[#0ECB81]/30 transition-all group">
                                                        <div className="flex justify-between items-start gap-2 mb-2">
                                                            <p className="text-[8px] font-mono text-[#0ECB81] font-black uppercase tracking-tighter opacity-70">{new Date(log.Timestamp).toLocaleString('km-KH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                                                            <p className="text-[9px] font-black text-white/90 uppercase tracking-widest bg-[#2B3139] px-2 py-0.5 rounded shadow-inner">{log.User}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{log.Action}</p>
                                                            <p className="text-[8px] font-medium text-[#848E9C] leading-relaxed break-words line-clamp-2 group-hover:line-clamp-none transition-all">{log.Details}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-10 text-center opacity-30 flex flex-col items-center gap-3">
                                                <Activity size={32} />
                                                <p className="text-[9px] font-black uppercase tracking-[0.3em]">No Activity Detected</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Inventory Assets List */}
                        <div className="space-y-4 sm:space-y-5">
                            <div className="flex justify-between items-center px-2">
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="w-1 h-4 sm:w-1.5 sm:h-5 bg-[#FCD535] rounded-full"></div>
                                    <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#848E9C]">Inventory Assets (ផលិតផល)</h3>
                                </div>
                                <span className="text-[8px] sm:text-[10px] font-black bg-[#FCD535]/10 text-[#FCD535] px-2 sm:px-3 py-0.5 sm:py-1 border border-[#FCD535]/20 uppercase tracking-widest sm:tracking-[0.2em] rounded-full shadow-lg shrink-0">{order.Products.length} UNITS</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                {order.Products.map((product, idx) => (
                                    <div key={idx} className="bg-[#1E2329]/60 backdrop-blur-sm border border-[#2B3139] p-4 sm:p-5 flex items-center gap-4 sm:gap-5 group hover:border-[#FCD535]/50 transition-all rounded-2xl shadow-xl hover:bg-[#2B3139]/50">
                                        <div className="relative shrink-0">
                                            <img 
                                                src={convertGoogleDriveUrl(product.image)} 
                                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border-2 border-[#2B3139] cursor-pointer grayscale group-hover:grayscale-0 transition-all duration-700 shadow-lg group-hover:scale-105" 
                                                alt="" 
                                                onClick={() => previewImage(convertGoogleDriveUrl(product.image))}
                                            />
                                            <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 bg-[#FCD535] text-[#0B0E11] rounded-lg flex items-center justify-center text-[10px] sm:text-[12px] font-black shadow-xl border-2 border-[#0B0E11] z-10">
                                                {product.quantity}
                                            </div>
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-xs sm:text-sm font-black text-white truncate uppercase tracking-widest group-hover:text-[#FCD535] transition-colors">{product.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[8px] sm:text-[9px] bg-[#2B3139] text-[#848E9C] px-1.5 py-0.5 rounded uppercase font-black tracking-widest">{product.colorInfo || 'CORE EDITION'}</span>
                                            </div>
                                            <div className="flex items-center justify-between mt-2 sm:mt-3">
                                                <p className="text-[10px] sm:text-xs font-mono text-[#848E9C] opacity-60">${product.finalPrice.toFixed(2)} / unit</p>
                                                <p className="text-sm sm:text-base font-mono font-black text-[#0ECB81] tabular-nums">${(product.finalPrice * product.quantity).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Sidebar: Ops & Totals */}
                    <div className="space-y-6 sm:space-y-8">
                        {/* Ops Hub: Technical Card */}
                        <div className="bg-gradient-to-br from-[#1E2329] to-[#0B0E11] border border-[#FCD535]/30 p-6 sm:p-8 space-y-6 sm:space-y-8 relative overflow-hidden group rounded-2xl shadow-2xl">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-10 transition-opacity pointer-events-none -rotate-12 group-hover:rotate-0 duration-1000">
                                <ShieldCheck size={140} />
                            </div>
                            <div className="flex items-center gap-3 relative z-10">
                                <Zap size={16} className="text-[#FCD535] animate-pulse sm:w-4.5 sm:h-4.5" />
                                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#FCD535]">Operations Hub</h3>
                            </div>
                            <div className="space-y-5 sm:space-y-6 relative z-10">
                                {order['Cancel Reason'] && (
                                    <div className="space-y-2">
                                        <label className="text-[8px] sm:text-[9px] font-black text-red-400 uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1 flex items-center gap-2">
                                            <Zap size={10} /> Cancel Reason (មូលហេតុបោះបង់)
                                        </label>
                                        <div className="bg-red-500/10 border border-red-500/30 p-3 sm:p-4 rounded-xl">
                                            <p className="text-[10px] sm:text-xs font-black text-red-400 uppercase tracking-wider">{order['Cancel Reason']}</p>
                                        </div>
                                    </div>
                                )}
                                {order['Return Reason'] && (
                                    <div className="space-y-2">
                                        <label className="text-[8px] sm:text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1 flex items-center gap-2">
                                            <Zap size={10} /> Return Reason (មូលហេតុប្តូរ/សង)
                                        </label>
                                        <div className="bg-purple-500/10 border border-purple-500/30 p-3 sm:p-4 rounded-xl">
                                            <p className="text-[10px] sm:text-xs font-black text-purple-400 uppercase tracking-wider">{order['Return Reason']}</p>
                                        </div>
                                    </div>
                                )}
                                {order['Return Received By'] && (
                                    <div className="space-y-2">
                                        <label className="text-[8px] sm:text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1 flex items-center gap-2">
                                            <ShieldCheck size={10} /> Return Confirmed By
                                        </label>
                                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 sm:p-4 rounded-xl">
                                            <p className="text-[10px] sm:text-xs font-black text-emerald-400 uppercase tracking-wider">{order['Return Received By']} at {order['Return Received Time']}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="text-[8px] sm:text-[9px] font-black text-[#848E9C] uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1 flex items-center gap-2">
                                        <User size={10} /> Packed By (អ្នកវេចខ្ចប់)
                                    </label>
                                    <div className="bg-[#0B0E11] border border-[#2B3139] p-3 sm:p-4 rounded-xl flex items-center gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#0ECB81]"></div>
                                        <p className="text-[10px] sm:text-xs font-black text-[#EAECEF] uppercase tracking-wider truncate">{order['Packed By'] || 'AWAITING DISPATCH'}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[8px] sm:text-[9px] font-black text-[#848E9C] uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1 flex items-center gap-2">
                                        <Clock size={10} /> Packed Time
                                    </label>
                                    <div className="bg-[#0B0E11] border border-[#2B3139] p-3 sm:p-4 rounded-xl flex items-center gap-3">
                                        <Clock size={12} className="text-[#848E9C] shrink-0" />
                                        <p className="text-[10px] sm:text-[11px] font-mono font-black text-[#848E9C] tracking-[0.1em] uppercase truncate">{order['Packed Time'] || 'UNRECORDED'}</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[8px] sm:text-[9px] font-black text-[#848E9C] uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1 flex items-center gap-2">
                                        <Clock size={10} /> Lifecycle Timeline (កាលបរិច្ឆេទ / ពេលវេលា)
                                    </label>
                                    <div className="bg-[#0B0E11] border border-[#2B3139] rounded-xl overflow-hidden">
                                        {lifecycleEvents.map((event, index) => {
                                            const dateTime = formatLifecycleDateTime(event.value);
                                            const Icon = event.icon;

                                            return (
                                                <div key={event.key} className={`p-3 sm:p-4 flex items-start gap-3 ${index > 0 ? 'border-t border-[#2B3139]' : ''}`}>
                                                    <div className={`mt-0.5 w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center shrink-0 ${dateTime ? 'bg-[#1E2329] border-[#2B3139]' : 'bg-[#1E2329]/40 border-[#2B3139]/70'}`}>
                                                        <Icon size={13} className={dateTime ? event.color : 'text-[#5E6673]'} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="min-w-0">
                                                                <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider truncate ${dateTime ? 'text-[#EAECEF]' : 'text-[#5E6673]'}`}>{event.label}</p>
                                                                <p className="text-[8px] sm:text-[9px] font-bold text-[#848E9C] truncate">{event.labelKm}</p>
                                                            </div>
                                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dateTime ? event.dot : 'bg-[#474D57]'}`}></div>
                                                        </div>
                                                        
                                                        {dateTime ? (
                                                            <div className="mt-2 flex flex-col gap-2">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="min-w-0">
                                                                        <p className="text-[7px] sm:text-[8px] font-black text-[#5E6673] uppercase tracking-widest">Date</p>
                                                                        <p className="text-[9px] sm:text-[10px] font-mono font-black text-[#EAECEF] truncate">{dateTime.date}</p>
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-[7px] sm:text-[8px] font-black text-[#5E6673] uppercase tracking-widest">Time</p>
                                                                        <p className={`text-[9px] sm:text-[10px] font-mono font-black truncate ${event.color}`}>{dateTime.time}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="mt-2 text-[9px] sm:text-[10px] font-mono font-black text-[#5E6673] uppercase tracking-wider">UNRECORDED</p>
                                                        )}

                                                        {/* Send to Driver Action Block inside Shipped Node */}
                                                        {event.key === 'shipped' && hasTelegramGroup && (
                                                            <div className="mt-2 pt-2 border-t border-[#2B3139] border-dashed">
                                                                {isAlreadySent ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="flex-grow flex items-center gap-2 px-3 py-1.5 bg-[#0ECB81]/10 border border-[#0ECB81]/20 rounded-lg">
                                                                            <Check size={10} className="text-[#0ECB81]" />
                                                                            <span className="text-[8px] font-black text-[#0ECB81] uppercase tracking-widest">បញ្ជូនរូបរួចរាល់ (Sent)</span>
                                                                        </div>
                                                                        {(order['Delivery Telegram Message ID'] || (order as any)['Delivery Telegram Message ID']) && (
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleDeleteFromDeliveryTelegram(); }}
                                                                                disabled={isSendingTelegram || !canSendToDriver}
                                                                                className={`w-8 h-8 flex items-center justify-center ${!canSendToDriver ? 'bg-gray-800 text-gray-600' : 'bg-red-500/10 hover:bg-red-500/20 text-red-500'} rounded-lg border border-red-500/20 transition-all active:scale-95 disabled:opacity-50`}
                                                                                title={!canSendToDriver ? "អាចលុបបានតែដោយអ្នកបើកវេនប៉ុណ្ណោះ" : "លុបចេញពី Telegram"}
                                                                            >
                                                                                <Trash size={12} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : String(fs).trim() === 'Ready to Ship' ? (
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleSendToDeliveryTelegram(); }}
                                                                        disabled={isSendingTelegram || !canSendToDriver}
                                                                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 ${!canSendToDriver ? 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700' : 'bg-blue-600 hover:bg-blue-500 text-white'} rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50`}
                                                                        title={!canSendToDriver ? "អាចផ្ញើបានតែក្នុងស្ថានភាព Ready for Dispatch និងដោយអ្នកបើកវេនប៉ុណ្ណោះ" : "បញ្ជូនរូបភាពកញ្ចប់ទៅ Telegram"}
                                                                    >
                                                                        <ImageIcon size={12} className={canSendToDriver ? "text-white" : "text-gray-600"} />
                                                                        {isSendingTelegram ? 'Processing...' : 'បញ្ជូនរូបភាពកញ្ចប់'}
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {order['Driver Name'] && (
                                    <div className="space-y-2">
                                        <label className="text-[8px] sm:text-[9px] font-black text-[#848E9C] uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1 flex items-center gap-2">
                                            <Truck size={10} /> Assigned Driver
                                        </label>
                                        <div className="bg-[#0B0E11] border border-[#2B3139] p-3 sm:p-4 rounded-xl flex items-center gap-3">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#F28C28]/20 flex items-center justify-center shrink-0">
                                                <Truck size={12} className="text-[#F28C28] sm:w-3.5 sm:h-3.5" />
                                            </div>
                                            <p className="text-[10px] sm:text-xs font-black text-[#F28C28] uppercase tracking-wider truncate">{order['Driver Name']}</p>
                                        </div>
                                    </div>
                                )}
                                {order['Tracking Number'] && (
                                    <div className="space-y-2">
                                        <label className="text-[8px] sm:text-[9px] font-black text-[#848E9C] uppercase tracking-[0.2em] sm:tracking-[0.25em] ml-1 flex items-center gap-2">
                                            <Hash size={10} /> Tracking Identification
                                        </label>
                                        <div 
                                            onClick={() => handleCopy(order['Tracking Number'] || '', 'tracking')}
                                            className="bg-[#0B0E11] border border-[#2B3139] p-3 sm:p-4 rounded-xl flex justify-between items-center group cursor-pointer hover:border-[#0ECB81]/50 transition-all"
                                        >
                                            <p className="text-[10px] sm:text-[11px] font-mono font-black text-[#0ECB81] tracking-wider uppercase truncate mr-2">{order['Tracking Number']}</p>
                                            {copiedField === 'tracking' ? <Check size={12} className="text-[#0ECB81] shrink-0" /> : <Copy size={12} className="text-[#848E9C] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="absolute bottom-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tl from-[#FCD535]/10 to-transparent pointer-events-none rounded-br-2xl"></div>
                        </div>

                        {/* Digital Proof: Package Photo */}
                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-1 h-3.5 sm:w-1.5 sm:h-4 bg-[#848E9C] rounded-full"></div>
                                <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#848E9C]">Package Evidence</h3>
                            </div>
                            {getOptimisticPackagePhoto(order['Order ID'], order['Package Photo']) ? (
                                <>
                                    <div className="relative group aspect-square rounded-2xl border-2 border-[#2B3139] bg-[#0B0E11] cursor-pointer overflow-hidden shadow-2xl transition-all hover:border-[#FCD535]/50" onClick={() => previewImage(getOptimisticPackagePhoto(order['Order ID'], order['Package Photo']))}>
                                   <img src={getOptimisticPackagePhoto(order['Order ID'], order['Package Photo'])} className="w-full h-full object-cover transition-all duration-1000 sm:grayscale sm:group-hover:grayscale-0 group-hover:scale-110" alt="Package Proof" />
                                   <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px]">
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 border-2 border-[#FCD535] bg-[#0B0E11]/90 rounded-xl sm:rounded-2xl flex items-center justify-center text-[#FCD535] shadow-[0_0_30px_rgba(252,213,53,0.3)] scale-75 group-hover:scale-100 transition-all duration-500">
                                            <ExternalLink size={24} className="sm:w-7 sm:h-7" />
                                        </div>
                                    </div>
                                    <div className="absolute inset-x-0 h-[2px] bg-[#FCD535]/70 shadow-[0_0_15px_#FCD535] top-0 animate-[scan_4s_linear_infinite] z-20"></div>
                                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-black/60 backdrop-blur-md px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 sm:gap-2">
                                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-[#0ECB81] rounded-full animate-pulse"></div>
                                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white">Encrypted Proof</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="aspect-square rounded-2xl border-2 border-dashed border-[#2B3139] flex flex-col items-center justify-center gap-4 sm:gap-5 text-[#848E9C] bg-[#1E2329]/30 group hover:border-[#FCD535]/30 transition-all">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#1E2329] border border-[#2B3139] rounded-xl sm:rounded-2xl flex items-center justify-center opacity-40 group-hover:opacity-100 group-hover:scale-110 duration-500 shadow-xl">
                                        <Package size={24} className="sm:w-8 sm:h-8" />
                                    </div>
                                    <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] opacity-40 group-hover:opacity-100 transition-opacity">Awaiting Assets</p>
                                </div>
                            )}
                        </div>

                        {/* Digital Proof: Delivery Photo */}
                        {order['Delivery Photo URL'] && (
                            <div className="space-y-3 sm:space-y-4">
                                <div className="flex items-center gap-3 ml-2">
                                    <div className="w-1 h-3.5 sm:w-1.5 sm:h-4 bg-[#0ECB81] rounded-full"></div>
                                    <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#0ECB81]">Delivery Proof</h3>
                                </div>
                                <div className="relative group aspect-square rounded-2xl border-2 border-[#0ECB81]/30 bg-[#0B0E11] cursor-pointer overflow-hidden shadow-2xl transition-all hover:border-[#0ECB81]/50" onClick={() => previewImage(convertGoogleDriveUrl(order['Delivery Photo URL']!))}>
                                    <img src={convertGoogleDriveUrl(order['Delivery Photo URL']!)} className="w-full h-full object-cover transition-all duration-1000 sm:grayscale sm:group-hover:grayscale-0 group-hover:scale-110" alt="Delivery Proof" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px]">
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 border-2 border-[#0ECB81] bg-[#0B0E11]/90 rounded-xl sm:rounded-2xl flex items-center justify-center text-[#0ECB81] shadow-[0_0_30px_rgba(14,203,129,0.3)] scale-75 group-hover:scale-100 transition-all duration-500">
                                            <ExternalLink size={24} className="sm:w-7 sm:h-7" />
                                        </div>
                                    </div>
                                    <div className="absolute inset-x-0 h-[2px] bg-[#0ECB81]/70 shadow-[0_0_15px_#0ECB81] top-0 animate-[scan_4s_linear_infinite] z-20"></div>
                                </div>
                            </div>
                        )}

                        {/* Digital Proof: Return Photo */}
                        {order['Return Photo'] && (
                            <div className="space-y-3 sm:space-y-4">
                                <div className="flex items-center gap-3 ml-2">
                                    <div className="w-1 h-3.5 sm:w-1.5 sm:h-4 bg-purple-500 rounded-full"></div>
                                    <h3 className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em] text-purple-400">Return Evidence (រូប Return)</h3>
                                </div>
                                <div className="relative group aspect-square rounded-2xl border-2 border-purple-500/30 bg-[#0B0E11] cursor-pointer overflow-hidden shadow-2xl transition-all hover:border-purple-500/50" onClick={() => previewImage(convertGoogleDriveUrl(order['Return Photo']!))}>
                                    <img src={convertGoogleDriveUrl(order['Return Photo']!)} className="w-full h-full object-cover transition-all duration-1000 sm:grayscale sm:group-hover:grayscale-0 group-hover:scale-110" alt="Return Evidence" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px]">
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 border-2 border-purple-500 bg-[#0B0E11]/90 rounded-xl sm:rounded-2xl flex items-center justify-center text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)] scale-75 group-hover:scale-100 transition-all duration-500">
                                            <ExternalLink size={24} className="sm:w-7 sm:h-7" />
                                        </div>
                                    </div>
                                    <div className="absolute inset-x-0 h-[2px] bg-purple-500/70 shadow-[0_0_15px_#a855f7] top-0 animate-[scan_4s_linear_infinite] z-20"></div>
                                    <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-black/60 backdrop-blur-md px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-white/10 flex items-center gap-1.5 sm:gap-2">
                                        <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                                        <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white">Return Verified</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Settlement Summary: High-Impact Card */}
                        <div className="bg-[#1E2329] border-2 border-[#2B3139] p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden group hover:border-[#FCD535]/40 transition-all">
                            <div className="space-y-4 sm:space-y-5 relative z-10">
                                <div className="flex justify-between items-center pb-4 sm:pb-5 border-b border-[#2B3139] border-dashed">
                                    <div className="flex items-center gap-2">
                                        <Box size={12} className="text-[#848E9C] sm:w-3.5 sm:h-3.5" />
                                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#848E9C]">Asset Subtotal</span>
                                    </div>
                                    <span className="text-base sm:text-lg font-mono font-black text-[#EAECEF] tabular-nums">${(Number(order.Subtotal) || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pb-4 sm:pb-5 border-b border-[#2B3139] border-dashed">
                                    <div className="flex items-center gap-2">
                                        <Truck size={12} className="text-[#848E9C] sm:w-3.5 sm:h-3.5" />
                                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-[#848E9C]">Logistics Fee</span>
                                    </div>
                                    <span className="text-base sm:text-lg font-mono font-black text-[#EAECEF] tabular-nums">${(Number(order['Shipping Fee (Customer)']) || 0).toFixed(2)}</span>
                                </div>
                                <div className="pt-2 sm:pt-3">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                                <div className="w-1.5 h-3.5 sm:w-2 sm:h-4 bg-[#FCD535] rounded-sm"></div>
                                                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#FCD535]">Grand Settlement</span>
                                            </div>
                                            <div className="text-[8px] sm:text-[10px] font-bold text-[#848E9C] uppercase tracking-wider ml-3 sm:ml-4 flex items-center gap-1.5 sm:gap-2">
                                                <CreditCard size={9} className="sm:w-2.5 sm:h-2.5" /> Final Amount (USD)
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="text-2xl sm:text-4xl font-mono font-black text-[#FCD535] tabular-nums drop-shadow-[0_0_15px_rgba(252,213,53,0.3)] sm:group-hover:scale-105 transition-transform leading-none sm:leading-normal">
                                                ${(Number(order['Grand Total']) || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {(order as any)['Delivery Unpaid'] > 0 && (
                                    <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-[#F6465D]/10 border border-[#F6465D]/30 rounded-xl flex items-center gap-3 sm:gap-4 animate-pulse">
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#F6465D]/20 rounded-lg flex items-center justify-center text-[#F6465D] shrink-0">
                                            <Zap size={16} className="sm:w-5 sm:h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[8px] sm:text-[10px] font-black text-[#F6465D] uppercase tracking-[0.1em] sm:tracking-[0.2em] truncate">Collect Cash (បង់ប្រាក់ផ្ទាល់)</p>
                                            <p className="text-sm sm:text-lg font-mono font-black text-white mt-0.5 truncate">COLLECT: ${(order as any)['Delivery Unpaid'].toFixed(2)}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-bl from-[#FCD535]/5 to-transparent pointer-events-none rounded-bl-full"></div>
                            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-[#0ECB81]/5 blur-3xl rounded-full pointer-events-none group-hover:bg-[#0ECB81]/10 transition-all"></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Strip */}
            <div className="p-4 sm:p-6 border-t border-[#2B3139] bg-[#1E2329] flex flex-col sm:flex-row justify-end items-center gap-4 sm:gap-6">
                <p className="text-[8px] sm:text-[10px] font-mono text-[#848E9C] uppercase tracking-widest opacity-40 hidden sm:block">System encryption active // secure protocol enabled</p>
                <button 
                    onClick={onClose} 
                    className="w-full sm:w-auto px-6 sm:px-10 py-3.5 sm:py-4 bg-[#2B3139] hover:bg-[#FCD535] text-[#EAECEF] hover:text-[#0B0E11] font-black uppercase text-[10px] sm:text-xs tracking-[0.3em] sm:tracking-[0.4em] rounded-xl transition-all active:scale-[0.95] border border-[#474D57] hover:border-[#FCD535] shadow-xl hover:shadow-[#FCD535]/20 group flex items-center justify-center gap-3"
                >
                    <span>Terminate System View</span>
                    <Zap size={12} className="sm:w-3.5 sm:h-3.5 group-hover:fill-current" />
                </button>
            </div>
        </div>
    );

    if (inline) return content;

    return (
        <Modal isOpen={true} onClose={onClose} fullScreen={true}>
            {content}
            <style>{`
                @keyframes scan {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(100%); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #0B0E11;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #2B3139;
                    border-radius: 10px;
                    border: 1px solid #0B0E11;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #FCD535;
                }
            `}</style>
        </Modal>
    );
};

export default OrderDetailModal;
