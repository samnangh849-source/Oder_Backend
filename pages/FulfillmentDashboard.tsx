import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { useFulfillment } from '@/hooks/useFulfillment';
import Spinner from '@/components/common/Spinner';
import Modal from '@/components/common/Modal';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { ParsedOrder, FulfillmentStatus } from '@/types';
import OrderDetailModal from '@/components/orders/OrderDetailModal';
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    ClipboardList,
    Eye,
    Filter,
    Grid3X3,
    List,
    PackageCheck,
    RefreshCw,
    RotateCcw,
    Search,
    Truck,
    Warehouse,
    XCircle
} from 'lucide-react';

const B_BG_MAIN = 'bg-[#0B0E11]';
const B_BG_PANEL = 'bg-[#181A20]';
const B_BG_HOVER = 'hover:bg-[#2B3139]';
const B_BORDER = 'border-[#2B3139]';
const B_TEXT_PRIMARY = 'text-[#EAECEF]';
const B_TEXT_SECONDARY = 'text-[#848E9C]';
const B_ACCENT = 'text-[#FCD535]';
const B_ACCENT_BG = 'bg-[#FCD535] text-[#0B0E11] hover:bg-[#E5C02A]';
const B_GREEN = 'text-[#0ECB81]';
const B_RED = 'text-[#F6465D]';

type HubStatus = Extract<FulfillmentStatus, 'Pending' | 'Processing' | 'Ready to Ship' | 'Shipped' | 'Delivered' | 'Returned' | 'Cancelled'>;
type ViewMode = 'card' | 'list';

const HUB_STATUSES: Array<{ id: HubStatus; label: string; shortLabel: string }> = [
    { id: 'Pending', label: 'Pending Queue', shortLabel: 'Pending' },
    { id: 'Processing', label: 'Processing', shortLabel: 'Process' },
    { id: 'Ready to Ship', label: 'Ready Dispatch', shortLabel: 'Ready' },
    { id: 'Shipped', label: 'Outbound', shortLabel: 'Shipped' },
    { id: 'Delivered', label: 'Delivered', shortLabel: 'Done' },
    { id: 'Returned', label: 'Returned', shortLabel: 'Return' },
    { id: 'Cancelled', label: 'Canceled', shortLabel: 'Cancel' }
];

const normalizeStatus = (order: ParsedOrder): HubStatus => {
    const status = (order.FulfillmentStatus || (order as any)['Fulfillment Status'] || 'Pending') as FulfillmentStatus;
    if (status === 'Scheduled') return 'Pending';
    if (HUB_STATUSES.some(s => s.id === status)) return status as HubStatus;
    return 'Pending';
};

const formatMoney = (value: unknown) => `$${(Number(value) || 0).toFixed(2)}`;

const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('855')) cleaned = cleaned.substring(3);
    if (cleaned && !cleaned.startsWith('0')) cleaned = `0${cleaned}`;
    return cleaned;
};

const getEffectiveTime = (order: ParsedOrder, status: HubStatus) => {
    if (status === 'Delivered') return order['Delivered Time'] || order['Dispatched Time'] || order.Timestamp;
    if (status === 'Shipped') return order['Dispatched Time'] || order.Timestamp;
    if (status === 'Ready to Ship') return order['Packed Time'] || order.Timestamp;
    if (status === 'Returned') return order['Return Received Time'] || order.Timestamp;
    return order.Timestamp;
};

const statusTone = (status: HubStatus) => {
    if (status === 'Delivered') return 'text-[#0ECB81] bg-[#0ECB81]/10 border-[#0ECB81]/20';
    if (status === 'Shipped') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    if (status === 'Ready to Ship') return 'text-[#FCD535] bg-[#FCD535]/10 border-[#FCD535]/20';
    if (status === 'Returned') return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    if (status === 'Cancelled') return 'text-[#F6465D] bg-[#F6465D]/10 border-[#F6465D]/20';
    if (status === 'Processing') return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    return 'text-[#848E9C] bg-[#2B3139]/50 border-[#2B3139]';
};

const actionForStatus = (status: HubStatus) => {
    if (status === 'Ready to Ship') return { label: 'Ship', next: 'Shipped' as FulfillmentStatus, icon: Truck };
    if (status === 'Shipped') return { label: 'Deliver', next: 'Delivered' as FulfillmentStatus, icon: CheckCircle2 };
    return null;
};

interface FulfillmentDashboardProps {
    orders: ParsedOrder[];
    onOpenDeliveryList?: () => void;
    onExit?: () => void;
}

const FulfillmentDashboard: React.FC<FulfillmentDashboardProps> = ({ orders, onOpenDeliveryList, onExit }) => {
    const { refreshData, appData, currentUser } = useContext(AppContext);
    const [selectedFacility, setSelectedFacility] = useState('');
    const [activeStatus, setActiveStatus] = useState<HubStatus>('Pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [shippingFilter, setShippingFilter] = useState('');
    const [teamFilter, setTeamFilter] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('card');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    const allOrdersMapped = useMemo(() => {
        return orders
            .filter((o: any) => o && o['Order ID'] && o['Order ID'] !== 'Opening_Balance')
            .map((o: any) => ({
                ...o,
                Products: Array.isArray(o.Products) ? o.Products : [],
                FulfillmentStatus: (o['Fulfillment Status'] || o.FulfillmentStatus || 'Pending') as FulfillmentStatus
            })) as ParsedOrder[];
    }, [orders]);

    const facilityOrders = useMemo(() => {
        if (!selectedFacility) return [];
        return allOrdersMapped.filter(o =>
            (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === selectedFacility.trim().toLowerCase()
        );
    }, [allOrdersMapped, selectedFacility]);

    const { updateStatus, loadingId } = useFulfillment(facilityOrders, refreshData);

    const availableFacilities = useMemo(() => {
        const configured = appData.stores?.map((s: any) => s.StoreName).filter(Boolean) || [];
        const fromOrders = allOrdersMapped.map(o => o['Fulfillment Store']).filter(Boolean);
        return Array.from(new Set([...configured, ...fromOrders])).sort();
    }, [appData.stores, allOrdersMapped]);

    const availableTeams = useMemo(() => {
        const teams = new Set<string>();
        facilityOrders.forEach(o => { if (o.Team) teams.add(o.Team); });
        return Array.from(teams).sort();
    }, [facilityOrders]);

    const tabCounts = useMemo(() => {
        const counts = HUB_STATUSES.reduce((acc, status) => ({ ...acc, [status.id]: 0 }), {} as Record<HubStatus, number>);
        facilityOrders.forEach(order => {
            counts[normalizeStatus(order)] += 1;
        });
        return counts;
    }, [facilityOrders]);

    const baseStatusOrders = useMemo(() => {
        return facilityOrders.filter(order => normalizeStatus(order) === activeStatus);
    }, [facilityOrders, activeStatus]);

    const shippingCounts = useMemo(() => {
        const counts: Record<string, number> = { all: baseStatusOrders.length };
        baseStatusOrders.forEach(order => {
            const method = order['Internal Shipping Method'] || 'Unassigned';
            counts[method] = (counts[method] || 0) + 1;
        });
        return counts;
    }, [baseStatusOrders]);

    const filteredOrders = useMemo(() => {
        let list = [...baseStatusOrders];
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            list = list.filter(o =>
                (o['Order ID'] || '').toLowerCase().includes(q) ||
                (o['Customer Name'] || '').toLowerCase().includes(q) ||
                (o['Customer Phone'] || '').toLowerCase().includes(q) ||
                (o.Location || '').toLowerCase().includes(q) ||
                (o['Internal Shipping Method'] || '').toLowerCase().includes(q)
            );
        }
        if (shippingFilter) list = list.filter(o => (o['Internal Shipping Method'] || 'Unassigned') === shippingFilter);
        if (teamFilter) list = list.filter(o => o.Team === teamFilter);

        return list.sort((a, b) => {
            const at = new Date(getEffectiveTime(a, activeStatus) || '').getTime() || 0;
            const bt = new Date(getEffectiveTime(b, activeStatus) || '').getTime() || 0;
            if (bt !== at) return bt - at;
            return (b['Order ID'] || '').localeCompare(a['Order ID'] || '');
        });
    }, [baseStatusOrders, searchTerm, shippingFilter, teamFilter, activeStatus]);

    const groupedOrders = useMemo(() => {
        const groups: Record<string, ParsedOrder[]> = {};
        filteredOrders.forEach(order => {
            const rawDate = getEffectiveTime(order, activeStatus);
            const d = rawDate ? new Date(rawDate) : null;
            const key = d && !Number.isNaN(d.getTime())
                ? d.toLocaleDateString('km-KH', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Recent';
            if (!groups[key]) groups[key] = [];
            groups[key].push(order);
        });
        return groups;
    }, [filteredOrders, activeStatus]);

    const selectedOrders = useMemo(() => filteredOrders.filter(o => selectedIds.has(o['Order ID'])), [filteredOrders, selectedIds]);
    const activeFilterCount = (shippingFilter ? 1 : 0) + (teamFilter ? 1 : 0);
    const activeAction = actionForStatus(activeStatus);
    const completionRate = facilityOrders.length > 0
        ? Math.round(((tabCounts.Delivered + tabCounts.Shipped) / facilityOrders.length) * 100)
        : 0;

    const getShippingLogo = (methodName: string) => {
        const method = appData.shippingMethods?.find((m: any) => m.MethodName === methodName);
        return method?.LogoURL ? convertGoogleDriveUrl(method.LogoURL) : '';
    };

    const copyValue = async (text: string) => {
        if (!text) return;
        await navigator.clipboard?.writeText(text);
    };

    const toggleOrderSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (filteredOrders.length === 0) return;
        const allSelected = filteredOrders.every(o => selectedIds.has(o['Order ID']));
        setSelectedIds(prev => {
            const next = new Set(prev);
            filteredOrders.forEach(o => allSelected ? next.delete(o['Order ID']) : next.add(o['Order ID']));
            return next;
        });
    };

    const extraDataForStatus = (order: ParsedOrder, status: FulfillmentStatus) => {
        const user = currentUser?.FullName || currentUser?.UserName || 'System';
        const now = new Date().toLocaleString('km-KH');
        if (status === 'Processing') return { 'Processing By': user, 'Processing Time': now };
        if (status === 'Ready to Ship') return { 'Packed By': order['Packed By'] || user, 'Packed Time': order['Packed Time'] || now };
        if (status === 'Shipped') return { 'Dispatched By': user, 'Dispatched Time': now };
        if (status === 'Delivered') return { 'Delivered Time': now };
        if (status === 'Pending') {
            return {
                'Packed By': '',
                'Packed Time': '',
                'Dispatched By': '',
                'Dispatched Time': '',
                'Delivered Time': ''
            };
        }
        return {};
    };

    const applyStatus = async (order: ParsedOrder, status: FulfillmentStatus) => {
        await updateStatus(order['Order ID'], status, extraDataForStatus(order, status));
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(order['Order ID']);
            return next;
        });
    };

    const handleBulkAdvance = async () => {
        if (!activeAction || selectedOrders.length === 0) return;
        const confirmed = window.confirm(`Move ${selectedOrders.length} orders to ${activeAction.next}?`);
        if (!confirmed) return;
        setBulkLoading(true);
        try {
            for (const order of selectedOrders) {
                await updateStatus(order['Order ID'], activeAction.next, extraDataForStatus(order, activeAction.next));
            }
            setSelectedIds(new Set());
        } finally {
            setBulkLoading(false);
        }
    };

    const handleReset = async (order: ParsedOrder, status: FulfillmentStatus) => {
        const confirmed = window.confirm(`Move order ${order['Order ID'].substring(0, 10)} back to ${status}?`);
        if (!confirmed) return;
        await applyStatus(order, status);
    };

    if (!selectedFacility) {
        return (
            <div className={`flex flex-col items-center justify-center h-full p-6 ${B_BG_MAIN} font-sans relative overflow-hidden`}>
                {onExit && (
                    <div className="absolute top-0 left-0 p-6 z-50">
                        <button
                            onClick={onExit}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all active:scale-[0.98] group"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                            <span className="text-sm font-bold uppercase tracking-wider">Back</span>
                        </button>
                    </div>
                )}
                <div className="w-full max-w-md space-y-12 text-center relative z-10 animate-fade-in">
                    <div className="space-y-4">
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 rounded-[2rem] bg-[#FCD535]/10 border border-[#FCD535]/20 flex items-center justify-center shadow-[0_0_50px_rgba(252,213,53,0.1)]">
                                <Warehouse className="w-10 h-10 text-[#FCD535]" strokeWidth={2} />
                            </div>
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-[0.2em] drop-shadow-2xl">Operations Hub</h2>
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-[1px] w-8 bg-white/10"></div>
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Select active node</p>
                            <div className="h-[1px] w-8 bg-white/10"></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {availableFacilities.map((facility, idx) => (
                            <button
                                key={facility}
                                onClick={() => {
                                    setSelectedFacility(facility);
                                    setActiveStatus('Pending');
                                    setSearchTerm('');
                                    setShippingFilter('');
                                    setTeamFilter('');
                                    setSelectedIds(new Set());
                                }}
                                className="group relative overflow-hidden bg-white/[0.03] hover:bg-[#FCD535] border border-white/5 hover:border-[#FCD535] w-full p-8 flex justify-between items-center transition-all duration-500 rounded-2xl active:scale-[0.98] shadow-2xl"
                                style={{ animationDelay: `${idx * 100}ms` }}
                            >
                                <div className="flex flex-col items-start gap-1 relative z-10">
                                    <span className="text-[10px] font-black text-gray-500 group-hover:text-black/40 uppercase tracking-widest transition-colors">Select Node</span>
                                    <span className="text-xl font-black text-white group-hover:text-black uppercase tracking-[0.1em] transition-colors">{facility}</span>
                                </div>
                                <div className="relative z-10 w-12 h-12 rounded-xl bg-white/5 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                    <ArrowRight className="w-6 h-6 text-[#FCD535] group-hover:text-black group-hover:translate-x-1 transition-all" />
                                </div>
                            </button>
                        ))}
                        {availableFacilities.length === 0 && (
                            <div className="p-12 rounded-2xl border border-dashed border-white/10 text-gray-600">
                                <p className="text-sm font-bold uppercase tracking-widest">No Active Nodes Found</p>
                            </div>
                        )}
                    </div>

                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] pt-8">Authorized Operations Only</p>
                </div>
            </div>
        );
    }

    const renderActionButtons = (order: ParsedOrder, compact = false) => {
        const ActionIcon = activeAction?.icon;
        const hasUndo = activeStatus === 'Ready to Ship' || activeStatus === 'Shipped';
        const buttonCount = 1 + (activeAction ? 1 : 0) + (hasUndo ? 1 : 0);
        const gridClass = buttonCount >= 3 ? 'grid-cols-3' : buttonCount === 2 ? 'grid-cols-2' : 'grid-cols-1';
        return (
            <div className={`grid gap-2 ${gridClass}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); setViewingOrder(order); }}
                    className={`py-1.5 bg-[#2B3139] hover:bg-[#3B424A] ${B_TEXT_PRIMARY} text-xs font-medium transition-colors rounded-sm flex items-center justify-center gap-1.5`}
                >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                </button>
                {activeAction && (
                    <button
                        onClick={(e) => { e.stopPropagation(); applyStatus(order, activeAction.next); }}
                        disabled={loadingId === order['Order ID']}
                        className={`py-1.5 ${B_ACCENT_BG} text-xs font-bold uppercase transition-colors rounded-sm flex items-center justify-center gap-1.5 disabled:opacity-60`}
                    >
                        {loadingId === order['Order ID'] ? <Spinner size="sm" /> : ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
                        {activeAction.label}
                    </button>
                )}
                {activeStatus === 'Ready to Ship' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleReset(order, 'Pending'); }}
                        className={`py-1.5 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 ${B_RED} text-xs font-bold uppercase transition-colors rounded-sm flex items-center justify-center gap-1.5`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Undo
                    </button>
                )}
                {activeStatus === 'Shipped' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleReset(order, 'Ready to Ship'); }}
                        className={`py-1.5 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 ${B_RED} text-xs font-bold uppercase transition-colors rounded-sm flex items-center justify-center gap-1.5`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Undo
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className={`flex h-full ${B_BG_MAIN} font-sans overflow-hidden`}>
            <aside className={`w-64 hidden lg:flex flex-col flex-shrink-0 border-r ${B_BORDER} ${B_BG_PANEL}`}>
                <div className={`p-4 border-b ${B_BORDER}`}>
                    <h2 className={`text-xl font-bold ${B_ACCENT}`}>HUB OPS</h2>
                    <p className={`text-[10px] uppercase font-medium ${B_TEXT_SECONDARY} mt-0.5`}>{selectedFacility}</p>
                </div>

                <nav className={`flex flex-col py-2 border-b ${B_BORDER}`}>
                    {HUB_STATUSES.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveStatus(tab.id);
                                setSelectedIds(new Set());
                            }}
                            className={`flex items-center justify-between px-4 py-2.5 transition-colors text-xs font-medium border-l-2 ${activeStatus === tab.id ? `${B_BG_MAIN} border-[#FCD535] ${B_TEXT_PRIMARY}` : `border-transparent ${B_TEXT_SECONDARY} ${B_BG_HOVER} hover:text-white`}`}
                        >
                            <span>{tab.label}</span>
                            <span className={B_TEXT_PRIMARY}>{tabCounts[tab.id]}</span>
                        </button>
                    ))}
                </nav>

                <div className="flex-grow p-4 space-y-4">
                    <p className={`text-[10px] font-bold ${B_TEXT_SECONDARY} uppercase`}>Live Telemetry</p>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className={B_TEXT_SECONDARY}>Ops Load</span>
                            <span className={`font-mono ${B_TEXT_PRIMARY}`}>{facilityOrders.length}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className={B_TEXT_SECONDARY}>Ready</span>
                            <span className={`font-mono ${B_ACCENT}`}>{tabCounts['Ready to Ship']}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className={B_TEXT_SECONDARY}>Delivered</span>
                            <span className={`font-mono ${B_GREEN}`}>{tabCounts.Delivered}</span>
                        </div>
                    </div>

                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-1 text-[10px]">
                            <span className={B_TEXT_SECONDARY}>Completion</span>
                            <span className={`font-mono ${B_GREEN}`}>{completionRate}%</span>
                        </div>
                        <div className={`h-[3px] w-full ${B_BG_MAIN} overflow-hidden`}>
                            <div className="h-full bg-[#0ECB81] transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto p-4 flex flex-col gap-2">
                    <button onClick={() => setSelectedFacility('')} className={`w-full py-2 bg-[#2B3139] hover:bg-[#3B424A] ${B_TEXT_PRIMARY} text-xs font-medium transition-colors rounded-sm`}>
                        Switch Hub
                    </button>
                    <button onClick={() => refreshData()} className={`w-full py-2 bg-[#0ECB81]/10 hover:bg-[#0ECB81]/20 ${B_GREEN} text-xs font-medium transition-colors rounded-sm flex items-center justify-center gap-2`}>
                        <RefreshCw className="w-3.5 h-3.5" />
                        Re-Sync Core
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className={`flex-shrink-0 min-h-14 px-3 lg:px-4 py-2 flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative z-10 ${B_BG_PANEL} border-b ${B_BORDER}`}>
                    <div className="flex items-center gap-3 flex-grow min-w-0">
                        <button
                            onClick={() => setSelectedFacility('')}
                            className="lg:hidden p-2 bg-[#0B0E11] border border-[#2B3139] rounded-sm text-[#848E9C] hover:text-[#EAECEF]"
                            title="Switch Hub"
                        >
                            <Warehouse className="w-4 h-4" />
                        </button>
                        <div className="relative flex-grow max-w-xl">
                            <input
                                type="text"
                                placeholder="Query ID, Name, Phone, Location..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full pl-8 pr-4 py-1.5 ${B_BG_MAIN} border ${B_BORDER} text-sm ${B_TEXT_PRIMARY} placeholder:text-[#848E9C] focus:border-[#FCD535] rounded-sm transition-colors outline-none`}
                            />
                            <div className={`absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none ${B_TEXT_SECONDARY}`}>
                                <Search className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="hidden md:flex bg-[#0B0E11] p-0.5 border border-[#2B3139] rounded-sm">
                            <button onClick={() => setViewMode('card')} className={`p-2 rounded-sm transition-all ${viewMode === 'card' ? 'bg-[#2B3139] text-[#EAECEF]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`} title="Card View"><Grid3X3 className="w-4 h-4" /></button>
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-sm transition-all ${viewMode === 'list' ? 'bg-[#2B3139] text-[#EAECEF]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`} title="List View"><List className="w-4 h-4" /></button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setIsFilterModalOpen(true)}
                            className={`px-4 py-1.5 rounded-sm flex items-center gap-2.5 transition-all border text-[11px] font-bold uppercase tracking-wider whitespace-nowrap ${
                                activeFilterCount > 0
                                    ? 'bg-[#FCD535]/10 border-[#FCD535] text-[#FCD535] shadow-[0_0_15px_rgba(252,213,53,0.05)]'
                                    : `${B_BG_MAIN} border-[#2B3139] ${B_TEXT_SECONDARY} hover:border-[#FCD535]/50 hover:text-[#EAECEF]`
                            }`}
                        >
                            <div className="relative">
                                <Filter className="w-3.5 h-3.5" />
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#FCD535] rounded-full animate-pulse shadow-[0_0_8px_rgba(252,213,53,0.5)]"></span>
                                )}
                            </div>
                            <span>Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="flex items-center justify-center w-4 h-4 bg-[#FCD535] text-[#0B0E11] text-[9px] font-black rounded-full ml-0.5">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>
                        {onOpenDeliveryList && (
                            <button
                                onClick={onOpenDeliveryList}
                                className="px-3 py-2 border border-[#FCD535]/50 hover:bg-[#FCD535] text-[#FCD535] hover:text-[#0B0E11] text-[11px] font-bold uppercase rounded-sm flex items-center gap-2 whitespace-nowrap"
                            >
                                <ClipboardList className="w-3.5 h-3.5" />
                                Delivery List
                            </button>
                        )}
                        {filteredOrders.length > 0 && activeAction && (
                            <button
                                onClick={toggleSelectAll}
                                className={`px-3 py-2 border ${filteredOrders.every(o => selectedIds.has(o['Order ID'])) ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'border-[#2B3139] text-[#848E9C]'} text-[11px] font-bold rounded-sm uppercase transition-colors whitespace-nowrap`}
                            >
                                {filteredOrders.every(o => selectedIds.has(o['Order ID'])) ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                        {selectedOrders.length > 0 && activeAction && (
                            <button
                                onClick={handleBulkAdvance}
                                disabled={bulkLoading}
                                className="px-4 py-2 bg-[#0ECB81] hover:bg-[#0CA66B] text-[#0B0E11] text-[11px] font-bold rounded-sm flex items-center gap-2 transition-all whitespace-nowrap disabled:opacity-60"
                            >
                                {bulkLoading ? <Spinner size="sm" /> : <activeAction.icon className="w-4 h-4" />}
                                {activeAction.label} Selected ({selectedOrders.length})
                            </button>
                        )}
                    </div>
                </header>

                <div className={`flex-shrink-0 px-3 lg:px-8 py-3 bg-[#181A20] border-b ${B_BORDER} flex items-center gap-3 overflow-x-auto no-scrollbar`}>
                    <span className={`text-xs font-black ${B_TEXT_SECONDARY} uppercase tracking-[0.2em] mr-2 whitespace-nowrap`}>Shipping Filter:</span>
                    <button
                        onClick={() => setShippingFilter('')}
                        className={`px-4 py-2 rounded-sm text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-2 ${!shippingFilter ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-[0_0_15px_rgba(252,213,53,0.2)]' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50 hover:text-[#EAECEF]'}`}
                    >
                        All Carriers
                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${!shippingFilter ? 'bg-black/10 text-black' : 'bg-[#2B3139] text-[#848E9C]'}`}>
                            {shippingCounts.all || 0}
                        </span>
                    </button>
                    {appData.shippingMethods?.filter((m: any) => m.Status !== 'Inactive').map((method: any) => {
                        const count = shippingCounts[method.MethodName] || 0;
                        const isActive = shippingFilter === method.MethodName;
                        return (
                            <button
                                key={method.MethodName}
                                onClick={() => setShippingFilter(isActive ? '' : method.MethodName)}
                                className={`px-4 py-2 rounded-sm text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-2.5 ${isActive ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-[0_0_15px_rgba(252,213,53,0.2)]' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50 hover:text-[#EAECEF]'}`}
                            >
                                {method.LogoURL && <img src={convertGoogleDriveUrl(method.LogoURL)} alt="" className="w-5 h-5 object-contain" />}
                                <span>{method.MethodName}</span>
                                {count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-black/10 text-black' : 'bg-[#2B3139] text-[#848E9C]'}`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="lg:hidden flex-shrink-0 bg-[#181A20] border-b border-[#2B3139] px-3 py-2 overflow-x-auto no-scrollbar flex gap-2">
                    {HUB_STATUSES.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveStatus(tab.id);
                                setSelectedIds(new Set());
                            }}
                            className={`px-3 py-2 border rounded-sm text-[11px] font-black uppercase whitespace-nowrap ${activeStatus === tab.id ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C]'}`}
                        >
                            {tab.shortLabel} {tabCounts[tab.id]}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto t-scroll custom-scrollbar p-4 md:p-6 lg:p-8 pt-4">
                    {filteredOrders.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center p-10 ${B_TEXT_SECONDARY} text-sm mt-10`}>
                            <ClipboardList className="w-10 h-10 mb-3 opacity-40" />
                            <span>No Operations in Queue</span>
                        </div>
                    ) : (
                        <div className="space-y-8 pb-20">
                            {(Object.entries(groupedOrders) as Array<[string, ParsedOrder[]]>).map(([date, groupOrders]) => (
                                <section key={date} className="space-y-4">
                                    <div className={`text-sm font-bold ${B_TEXT_PRIMARY} px-1 pb-1 border-b ${B_BORDER} flex justify-between`}>
                                        <span>{date}</span>
                                        <span className={B_TEXT_SECONDARY}>{groupOrders.length} records</span>
                                    </div>

                                    {viewMode === 'list' && (
                                        <div className={`hidden md:grid grid-cols-12 gap-2 px-3 py-1 text-xs font-bold ${B_TEXT_SECONDARY} uppercase`}>
                                            <div className="col-span-1">#</div>
                                            <div className="col-span-4">Asset / Node</div>
                                            <div className="col-span-2">Location</div>
                                            <div className="col-span-2">Value / Status</div>
                                            <div className="col-span-3 text-right">Action</div>
                                        </div>
                                    )}

                                    <div className={viewMode === 'card'
                                        ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-4 gap-3'
                                        : 'flex flex-col gap-1'
                                    }>
                                        {groupOrders.map((order, idx) => {
                                            const status = normalizeStatus(order);
                                            const isSelected = selectedIds.has(order['Order ID']);
                                            const productImage = order.Products?.[0]?.image ? convertGoogleDriveUrl(order.Products[0].image) : '';
                                            const shippingLogo = getShippingLogo(order['Internal Shipping Method']);
                                            const loading = loadingId === order['Order ID'];

                                            if (viewMode === 'list') {
                                                return (
                                                    <div
                                                        key={order['Order ID']}
                                                        onClick={() => setViewingOrder(order)}
                                                        className={`${B_BG_PANEL} border ${B_BORDER} ${B_BG_HOVER} transition-colors grid grid-cols-12 items-center gap-2 p-2 relative group cursor-pointer`}
                                                    >
                                                        {loading && <div className="absolute inset-0 bg-[#0B0E11]/80 z-50 flex items-center justify-center"><Spinner size="sm" /></div>}
                                                        <div className="col-span-1 flex items-center gap-2 pl-1">
                                                            {activeAction && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order['Order ID']); }}
                                                                    className={`w-4 h-4 border-2 rounded-sm transition-colors flex items-center justify-center ${isSelected ? 'bg-[#FCD535] border-[#FCD535]' : 'border-gray-600 bg-black/20'}`}
                                                                >
                                                                    {isSelected && <CheckCircle2 className="w-3 h-3 text-black" strokeWidth={4} />}
                                                                </button>
                                                            )}
                                                            <span className="text-xs font-mono text-[#848E9C]">{(idx + 1).toString().padStart(2, '0')}</span>
                                                        </div>
                                                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                                                            {productImage ? <img src={productImage} className={`w-10 h-10 object-cover ${B_BG_MAIN} border ${B_BORDER} flex-shrink-0 rounded-sm`} alt="" /> : <div className={`w-10 h-10 ${B_BG_MAIN} border ${B_BORDER} flex-shrink-0 rounded-sm flex items-center justify-center text-[#848E9C]`}><PackageCheck className="w-4 h-4" /></div>}
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <p className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate uppercase`}>{order['Customer Name']}</p>
                                                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${order.Team === 'A' ? 'bg-blue-900/40 text-blue-400' : 'bg-purple-900/40 text-purple-400'}`}>T-{order.Team}</span>
                                                                </div>
                                                                <button onClick={(e) => { e.stopPropagation(); copyValue(order['Order ID']); }} className={`text-xs font-mono ${B_TEXT_SECONDARY} truncate hover:text-[#FCD535]`}>
                                                                    {order['Order ID']}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-2 min-w-0">
                                                            <p className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate`}>{order.Location}</p>
                                                            <p className={`text-xs ${B_TEXT_SECONDARY} truncate`}>{order['Address Details']}</p>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <p className={`text-sm font-mono font-bold ${B_GREEN}`}>{formatMoney(order['Grand Total'])}</p>
                                                            <span className={`inline-flex mt-1 px-2 py-0.5 border rounded-sm text-[9px] font-black uppercase ${statusTone(status)}`}>{status}</span>
                                                        </div>
                                                        <div className="col-span-3">
                                                            {renderActionButtons(order, true)}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={order['Order ID']}
                                                    className={`${B_BG_PANEL} border ${isSelected ? 'border-[#FCD535]' : B_BORDER} hover:border-[#FCD535]/30 group transition-all relative cursor-pointer`}
                                                    onClick={() => setViewingOrder(order)}
                                                >
                                                    {loading && <div className="absolute inset-0 bg-[#0B0E11]/80 z-50 flex items-center justify-center"><Spinner size="sm" /></div>}
                                                    {activeAction && (
                                                        <div className="absolute top-3 left-3 z-10" onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order['Order ID']); }}>
                                                            <div className={`w-5 h-5 border-2 rounded-sm transition-colors flex items-center justify-center ${isSelected ? 'bg-[#FCD535] border-[#FCD535]' : 'border-gray-600 bg-black/20'}`}>
                                                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-black" strokeWidth={4} />}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className={`px-3 py-1.5 border-b ${B_BORDER} flex justify-between items-center ${activeAction ? 'pt-10' : ''}`}>
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className={`text-xs font-mono ${B_TEXT_SECONDARY}`}>{(idx + 1).toString().padStart(2, '0')}</span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); copyValue(order['Order ID']); }}
                                                                className={`text-sm font-mono font-medium ${B_TEXT_PRIMARY} truncate hover:text-[#FCD535] transition-colors`}
                                                            >
                                                                {order['Order ID'].substring(0, 10)}
                                                            </button>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${order.Team === 'A' ? 'bg-blue-900/40 text-blue-400' : 'bg-purple-900/40 text-purple-400'}`}>T-{order.Team}</span>
                                                            {shippingLogo && <img src={shippingLogo} className="w-5 h-5 object-contain p-0.5 bg-white rounded-sm shadow-sm" alt="" />}
                                                        </div>
                                                    </div>

                                                    <div className="p-3 flex gap-3">
                                                        {productImage ? <img src={productImage} className={`w-14 h-14 object-cover ${B_BG_MAIN} border ${B_BORDER} flex-shrink-0 rounded-sm`} alt="" /> : <div className={`w-14 h-14 ${B_BG_MAIN} border ${B_BORDER} flex-shrink-0 rounded-sm flex items-center justify-center text-[#848E9C]`}><PackageCheck className="w-5 h-5" /></div>}
                                                        <div className="flex flex-col flex-grow min-w-0">
                                                            <p className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate uppercase`}>{order['Customer Name']}</p>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); copyValue(formatPhoneNumber(order['Customer Phone'])); }}
                                                                className={`text-left text-sm font-mono font-bold ${B_TEXT_PRIMARY} hover:text-[#FCD535] transition-colors`}
                                                            >
                                                                {formatPhoneNumber(order['Customer Phone'])}
                                                            </button>
                                                            <div className="flex justify-between items-end mt-auto pt-2 gap-3">
                                                                <div className="min-w-0">
                                                                    <span className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate block max-w-[180px]`}>{order.Location}</span>
                                                                    <span className={`text-xs ${B_TEXT_SECONDARY} font-medium truncate block max-w-[180px]`} title={order['Address Details']}>{order['Address Details']}</span>
                                                                    <span className={`inline-flex mt-2 px-2 py-0.5 border rounded-sm text-[9px] font-black uppercase ${statusTone(status)}`}>{status}</span>
                                                                </div>
                                                                <div className="flex flex-col items-end">
                                                                    <span className={`text-[10px] uppercase ${order['Payment Status']?.toLowerCase() === 'paid' ? 'text-[#0ECB81]' : 'text-[#FCD535]'}`}>{order['Payment Status'] || 'Unpaid'}</span>
                                                                    <span className={`text-sm font-mono font-bold ${B_GREEN}`}>{formatMoney(order['Grand Total'])}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={`p-2 border-t ${B_BORDER} bg-[#0B0E11]`}>
                                                        {renderActionButtons(order)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {isFilterModalOpen && (
                <Modal isOpen={true} onClose={() => setIsFilterModalOpen(false)} maxWidth="max-w-lg">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 space-y-6 rounded-2xl">
                        <div className="flex justify-between items-center border-b border-[#2B3139] pb-4">
                            <h3 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Filter className="w-5 h-5 text-[#FCD535]" />
                                OPS FILTERS
                            </h3>
                            <button onClick={() => setIsFilterModalOpen(false)} className="text-[#848E9C] hover:text-white transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Select Team</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                                    <button
                                        onClick={() => setTeamFilter('')}
                                        className={`py-3 rounded-xl text-xs font-bold uppercase transition-all border ${!teamFilter ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50'}`}
                                    >
                                        All Teams
                                    </button>
                                    {availableTeams.map(team => (
                                        <button
                                            key={team}
                                            onClick={() => setTeamFilter(team)}
                                            className={`py-3 rounded-xl text-xs font-bold uppercase transition-all border ${teamFilter === team ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50'}`}
                                        >
                                            Team {team}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Shipping Carrier</p>
                                <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                                    <button
                                        onClick={() => setShippingFilter('')}
                                        className={`px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all border ${!shippingFilter ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50'}`}
                                    >
                                        All Carriers
                                    </button>
                                    {appData.shippingMethods?.filter((m: any) => m.Status !== 'Inactive').map((method: any) => (
                                        <button
                                            key={method.MethodName}
                                            onClick={() => setShippingFilter(method.MethodName)}
                                            className={`px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all border flex items-center gap-2 ${shippingFilter === method.MethodName ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-lg shadow-[#FCD535]/10' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50'}`}
                                        >
                                            {method.LogoURL && <img src={convertGoogleDriveUrl(method.LogoURL)} alt="" className="w-4 h-4 object-contain" />}
                                            <span className="truncate">{method.MethodName}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Quick Actions</p>
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setShippingFilter('');
                                        setTeamFilter('');
                                        setIsFilterModalOpen(false);
                                    }}
                                    className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                                >
                                    Reset All Filters
                                </button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                onClick={() => setIsFilterModalOpen(false)}
                                className="w-full py-4 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black font-black text-xs uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-[#FCD535]/10 transition-all active:scale-[0.98]"
                            >
                                Apply Configuration
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {viewingOrder && <OrderDetailModal order={viewingOrder} onClose={() => setViewingOrder(null)} />}
        </div>
    );
};

export default FulfillmentDashboard;
