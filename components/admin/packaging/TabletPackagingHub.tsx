import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '@/context/AppContext';
import { ParsedOrder } from '@/types';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl, getOptimisticPackagePhoto } from '@/utils/fileUtils';
import { safeParseDate } from '@/utils/dateUtils';
import Modal from '@/components/common/Modal';

const B_BG_MAIN = 'bg-[#0B0E11]';
const B_BG_PANEL = 'bg-[#181A20]';
const B_BORDER = 'border-[#2B3139]';
const B_TEXT_PRIMARY = 'text-[#EAECEF]';
const B_TEXT_SECONDARY = 'text-[#848E9C]';
const B_ACCENT = 'text-[#FCD535]';

interface TabletPackagingHubProps {
    orders: ParsedOrder[];
    activeTab: string;
    setActiveTab: (tab: any) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onPack: (order: ParsedOrder) => void;
    onShip: (order: ParsedOrder) => void;
    onUndo: (order: ParsedOrder) => void;
    onUndoShipped: (order: ParsedOrder) => void;
    onUnpack: (order: ParsedOrder, skipConfirm?: boolean) => void;
    onView: (order: ParsedOrder) => void;
    onPrintManifest: () => void;
    onSwitchHub: () => void;
    onExit: () => void;
    shippingFilter: string;
    setShippingFilter: (filter: string) => void;
    teamFilter: string;
    setTeamFilter: (filter: string) => void;
    selectedStore: string;
    progressStats: { packedByUserToday: number, storeTotalToday: number, progressPercentage: number };
    shippingCounts?: { [key: string]: number };
    setIsFilterModalOpen: (open: boolean) => void;
    loadingActionId: string | null;
    tabCounts: { pending: number, ready: number, shipped: number, returned: number, cancelled: number };
    selectedOrderIds: Set<string>;
    toggleOrderSelection: (id: string) => void;
    clearSelection: () => void;
    onBulkShip: () => void;
    isBulkProcessing: boolean;
    onToggleSelectAll: (orders: ParsedOrder[]) => void;
    onConfirmReturn?: (order: ParsedOrder) => void;
    onCloseShift?: () => void;
    isViewOnly?: boolean;
    activeShift?: any;
}

const TabletPackagingHub: React.FC<TabletPackagingHubProps> = ({
    orders, activeTab, setActiveTab, searchTerm, setSearchTerm,
    onPack, onShip, onUndo, onUndoShipped, onView, onPrintManifest, onSwitchHub, onExit,
    shippingFilter, setShippingFilter, teamFilter, setTeamFilter,
    shippingCounts,
    selectedStore,
    progressStats, setIsFilterModalOpen, loadingActionId, tabCounts,
    selectedOrderIds, toggleOrderSelection, clearSelection, onBulkShip, isBulkProcessing,
    onToggleSelectAll, onConfirmReturn, onCloseShift, isViewOnly, activeShift, onUnpack
}) => {
    const { previewImage: showFullImage, appData } = useContext(AppContext);
    const [unpackTarget, setUnpackTarget] = useState<ParsedOrder | null>(null);

    const isAnyFilterActive = !!(shippingFilter || teamFilter);

    const handleCopy = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        console.log(`Copied ${label}: ${text}`);
    };

    const formatPhoneNumber = (phone: string) => {
        if (!phone) return '';
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('855')) {
            cleaned = cleaned.substring(3);
        }
        if (!cleaned.startsWith('0')) {
            cleaned = '0' + cleaned;
        }
        return cleaned;
    };

    const getCarrierLogo = (phone: string) => {
        const formatted = formatPhoneNumber(phone);
        if (!formatted) return null;
        const prefix2 = formatted.substring(1, 3);
        const prefix3 = formatted.substring(1, 4);
        const carrier = appData.phoneCarriers?.find(c => {
            const prefixes = String(c.Prefixes || '').split(',').map(p => p.trim()).filter(Boolean);
            return prefixes.includes(prefix2) || prefixes.includes(prefix3);
        });
        return carrier?.CarrierLogoURL ? convertGoogleDriveUrl(carrier.CarrierLogoURL) : null;
    };

    const getBankLogo = (bankName: string) => {
        const bank = appData.bankAccounts?.find(b => b.BankName === bankName);
        return bank?.LogoURL ? convertGoogleDriveUrl(bank.LogoURL) : null;
    };

    const getShippingLogo = (methodName: string) => {
        const method = appData.shippingMethods?.find(m => m.MethodName === methodName);
        return method?.LogoURL ? convertGoogleDriveUrl(method.LogoURL) : null;
    };

    const getDriverImage = (driverName: string) => {
        const driver = appData.drivers?.find(d => d.DriverName === driverName);
        return driver?.ImageURL ? convertGoogleDriveUrl(driver.ImageURL) : null;
    };

    const extractTime = (dateStr: string) => {
        if (!dateStr) return "";
        const date = safeParseDate(dateStr);
        if (date) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        }
        const match = String(dateStr).match(/(\d{1,2}:\d{2})/);
        return match ? match[1] : dateStr;
    };

    const getSafeDateObj = (dateStr: string) => {
        if (!dateStr) return new Date();
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const groups = useMemo(() => {
        const getEffectiveDate = (order: ParsedOrder) => {
            if (activeTab === 'Shipped') return order['Dispatched Time'] || order.Timestamp;
            if (activeTab === 'Ready to Ship') return order['Packed Time'] || order.Timestamp;
            return order.Timestamp;
        };

        const sorted = [...orders].sort((a, b) => 
            getSafeDateObj(getEffectiveDate(b)).getTime() - getSafeDateObj(getEffectiveDate(a)).getTime()
        );

        const result: { [key: string]: ParsedOrder[] } = {};
        sorted.forEach(order => {
            const dateStr = getEffectiveDate(order);
            const date = dateStr ? getSafeDateObj(dateStr).toLocaleDateString('km-KH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent';
            if (!result[date]) result[date] = [];
            result[date].push(order);
        });
        return result;
    }, [orders, activeTab]);

    return (
        <div className={`flex h-screen ${B_BG_MAIN} font-sans`}>
            {/* Slim Technical Sidebar */}
            <aside className={`w-16 flex flex-col flex-shrink-0 border-r ${B_BORDER} ${B_BG_PANEL}`}>
                <div className={`h-14 flex items-center justify-center border-b ${B_BORDER} text-[#FCD535] font-bold text-sm`}>
                    OP
                </div>
                
                <nav className="flex flex-col py-2 gap-2 mt-2">
                    {[
                        { id: 'Pending', icon: '📥', label: 'Pending', count: tabCounts.pending },
                        { id: 'Ready to Ship', icon: '📦', label: 'Ready', count: tabCounts.ready },
                        { id: 'Shipped', icon: '🚚', label: 'Shipped', count: tabCounts.shipped },
                        { id: 'Returned', icon: '🔄', label: 'Return', count: tabCounts.returned },
                        { id: 'Cancelled', icon: '🚫', label: 'Canceled', count: tabCounts.cancelled }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full h-12 flex items-center justify-center transition-colors border-l-2 relative ${activeTab === tab.id ? `border-[#FCD535] text-[#FCD535] ${B_BG_MAIN}` : `border-transparent ${B_TEXT_SECONDARY} hover:text-[#EAECEF]`}`}
                            title={tab.label}
                        >
                            <span className="text-xl">{tab.icon}</span>
                            {tab.count > 0 && (
                                <span className={`absolute top-1 right-1 px-1 rounded-sm text-[8px] font-bold ${activeTab === tab.id ? 'bg-[#FCD535] text-black' : 'bg-[#2B3139] text-[#EAECEF]'}`}>
                                    {tab.count > 99 ? '99+' : tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="flex-grow flex flex-col items-center justify-center gap-6 pb-2">
                    <div className="text-center">
                        <p className={`text-[8px] font-bold ${B_TEXT_SECONDARY} uppercase`}>Packs</p>
                        <p className={`text-sm font-bold text-[#0ECB81] font-mono`}>{progressStats.packedByUserToday}</p>
                    </div>
                    {activeShift && !isViewOnly && (
                        <button 
                            onClick={onCloseShift}
                            className="flex flex-col items-center justify-center gap-1 w-12 py-2 bg-[#F6465D] text-white rounded-xl shadow-lg shadow-[#F6465D]/20 hover:scale-105 transition-all animate-pulse active:scale-95"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-[8px] font-black uppercase">បិទវេន</span>
                        </button>
                    )}
                    {activeShift && isViewOnly && (
                         <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 text-blue-500 rounded-lg" title={`View Only: ${activeShift.OpenedBy}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                    )}
                </div>

                <div className="mt-auto flex flex-col border-t border-[#2B3139]">
                    <button onClick={onSwitchHub} title="Switch Hub" className={`w-full h-14 flex items-center justify-center text-[#848E9C] hover:text-white transition-colors`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeWidth={2}/></svg>
                    </button>
                    <button onClick={onExit} title="Exit Hub" className={`w-full h-14 flex items-center justify-center text-[#F6465D] hover:bg-[#F6465D]/10 transition-colors`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={2}/></svg>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className={`flex-shrink-0 h-14 px-4 flex items-center justify-between ${B_BG_PANEL} border-b ${B_BORDER}`}>
                    <div className="flex items-center gap-3 flex-grow max-w-sm">
                        <div className="relative w-full max-w-xs">
                            <input 
                                type="text" 
                                placeholder="Query..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full pl-8 pr-3 py-1.5 ${B_BG_MAIN} border ${B_BORDER} rounded-sm text-sm ${B_TEXT_PRIMARY} placeholder:text-[#848E9C] focus:border-[#FCD535] outline-none transition-colors`}
                            />
                            <div className={`absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none ${B_TEXT_SECONDARY}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsFilterModalOpen(true)} 
                            className={`px-3 py-1.5 rounded-sm flex items-center justify-center transition-all border relative ${
                                isAnyFilterActive 
                                    ? 'bg-[#FCD535]/10 border-[#FCD535] text-[#FCD535] shadow-[0_0_10px_rgba(252,213,53,0.1)]' 
                                    : `${B_BG_MAIN} border ${B_BORDER} text-[#848E9C] hover:text-[#EAECEF]`
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            {isAnyFilterActive && (
                                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#FCD535] rounded-full animate-pulse shadow-[0_0_8px_rgba(252,213,53,0.5)]"></span>
                            )}
                        </button>

                        {/* Shipping Method Shortcuts (Tablet) */}
                        {(activeTab === 'Pending' || activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                            <div className="flex items-center gap-2 border-l border-[#2B3139] pl-3 ml-1 overflow-x-auto no-scrollbar py-1">
                                <button 
                                    onClick={() => setShippingFilter('')}
                                    className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border ${!shippingFilter ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'bg-[#181A20] border-[#2B3139] text-[#848E9C]'}`}
                                >
                                    ALL
                                </button>
                                {appData.shippingMethods?.filter((m: any) => m.Status !== 'Inactive').map((method: any) => (
                                    <button
                                        key={method.MethodName}
                                        onClick={() => setShippingFilter(shippingFilter === method.MethodName ? '' : method.MethodName)}
                                        className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-2 ${shippingFilter === method.MethodName ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'bg-[#181A20] border-[#2B3139] text-[#848E9C]'}`}
                                    >
                                        {method.LogoURL && <img src={convertGoogleDriveUrl(method.LogoURL)} alt="" className="w-4 h-4 object-contain" />}
                                        {method.MethodName}
                                    </button>
                                ))}
                            </div>
                        )}
                        {activeTab === 'Ready to Ship' && (
                            <div className="flex items-center gap-3">
                                {orders.length > 0 && (
                                    <button 
                                        onClick={() => onToggleSelectAll(orders)}
                                        className={`px-3 py-2 border ${orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'border-[#2B3139] text-[#848E9C]'} text-xs font-bold rounded-sm uppercase tracking-wider transition-colors whitespace-nowrap`}
                                    >
                                        {orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'Deselect All' : 'Select All'}
                                    </button>
                                )}
                                <button onClick={onPrintManifest} className={`px-4 py-2 border border-[#FCD535]/50 hover:bg-[#FCD535] group transition-all rounded-sm flex items-center gap-2 whitespace-nowrap`}>
                                    <svg className="w-4 h-4 text-[#FCD535] group-hover:text-[#0B0E11]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    <span className="text-[#FCD535] group-hover:text-[#0B0E11] text-sm font-bold uppercase tracking-wider">Print Manifest</span>
                                </button>
                                {activeTab === 'Ready to Ship' && selectedOrderIds.size > 0 && (
                                    <button 
                                        onClick={onBulkShip}
                                        disabled={isBulkProcessing}
                                        className={`px-4 py-2 bg-[#0ECB81] hover:bg-[#0CA66B] text-[#0B0E11] text-sm font-bold rounded-sm flex items-center gap-2 transition-all animate-fade-in-down whitespace-nowrap`}
                                    >
                                        {isBulkProcessing ? <Spinner size="sm" /> : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                SHIP SELECTED ({selectedOrderIds.size})
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="ml-4 flex flex-col items-end">
                        <span className={`text-xs font-bold ${B_ACCENT} uppercase`}>{selectedStore}</span>
                    </div>
                </header>

                <div className={`flex-1 overflow-y-auto custom-scrollbar p-5 relative z-10`}>
                    <div className="space-y-6 pb-20">
                        {Object.entries(groups).map(([date, groupOrders]: [string, any]) => (
                            <section key={date} className="space-y-3">
                                <h3 className={`text-sm font-bold ${B_TEXT_PRIMARY} border-b ${B_BORDER} pb-1 px-1`}>{date}</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {groupOrders.map((order, idx) => {
                                        const fs = order.FulfillmentStatus || order['Fulfillment Status'] || 'Pending';
                                        const isCancelled = fs === 'Cancelled';
                                        const isReturned = fs === 'Returned';
                                        
                                        return (
                                        <div 
                                            key={order['Order ID']} 
                                            className={`${B_BG_PANEL} border ${B_BORDER} flex flex-col relative group cursor-pointer ${selectedOrderIds.has(order['Order ID']) ? 'ring-1 ring-[#FCD535]/50' : ''} ${isCancelled ? 'bg-red-950/20 border-red-500/30' : isReturned ? 'bg-purple-950/20 border-purple-500/30' : ''}`}
                                            onClick={() => onView(order)}
                                        >
                                            {/* Watermark Overlay */}
                                            {(isCancelled || isReturned) && (
                                                <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[100] overflow-hidden`}>
                                                    <div className={`rotate-[-12deg] font-black text-3xl tracking-[0.1em] whitespace-nowrap opacity-25 ${isCancelled ? 'text-red-500' : 'text-purple-400'}`}>
                                                        {isCancelled ? 'CANCELLED' : 'RETURNED'}
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'Ready to Ship' && (
                                <div className="absolute top-4 left-4 z-10" onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order['Order ID']); }}>
                                    <div className={`w-5 h-5 border-2 rounded-sm transition-colors flex items-center justify-center ${selectedOrderIds.has(order['Order ID']) ? 'bg-[#FCD535] border-[#FCD535]' : 'border-gray-600 bg-black/20'}`}>
                                        {selectedOrderIds.has(order['Order ID']) && (
                                            <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                        )}
                                    </div>
                                </div>
                            )}

                            {loadingActionId === order['Order ID'] && (
                                                <div className={`absolute inset-0 ${B_BG_MAIN}/80 z-50 flex items-center justify-center`}><Spinner size="sm" /></div>
                                            )}
                                            
                                            <div className={`p-2 border-b ${B_BORDER} flex justify-between items-center ${activeTab === 'Ready to Ship' ? 'pt-10' : ''}`}>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-mono ${B_TEXT_SECONDARY}`}>{(idx + 1).toString().padStart(2, '0')}</span>
                                                    <span 
                                                        onClick={(e) => { e.stopPropagation(); handleCopy(order['Order ID'], 'ID'); }}
                                                        className={`text-xs font-mono font-medium ${B_TEXT_PRIMARY} cursor-pointer hover:text-[#FCD535] transition-colors`}
                                                    >
                                                        {order['Order ID'].substring(0, 10)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {activeTab === 'Pending' && (
                                                        <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-sm border border-white/5">
                                                            <span className={`text-[8px] font-bold ${B_TEXT_SECONDARY} uppercase tracking-tight`}>Order: {extractTime(order.Timestamp)}</span>
                                                        </div>
                                                    )}
                                                    {activeTab === 'Ready to Ship' && order['Packed Time'] && (
                                                        <div className="flex items-center gap-1 bg-[#0ECB81]/5 px-2 py-0.5 rounded-sm border border-[#0ECB81]/10">
                                                            <span className={`text-[8px] font-black text-[#0ECB81] uppercase tracking-tight`}>Packed: {extractTime(order['Packed Time'])}</span>
                                                        </div>
                                                    )}
                                                    {activeTab === 'Shipped' && order['Dispatched Time'] && (
                                                        <div className="flex items-center gap-1 bg-blue-500/5 px-2 py-0.5 rounded-sm border border-blue-500/10">
                                                            <span className={`text-[8px] font-black text-blue-400 uppercase tracking-tight`}>Shipped: {extractTime(order['Dispatched Time'])}</span>
                                                        </div>
                                                    )}
                                                    {activeTab === 'Returned' && (
                                                        <div className="flex items-center gap-1 bg-purple-500/5 px-2 py-0.5 rounded-sm border border-purple-500/10">
                                                            <span className={`text-[8px] font-black text-purple-400 uppercase tracking-tight`}>Returned</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5">
                                                        {getShippingLogo(order['Internal Shipping Method']) && (
                                                            <img src={getShippingLogo(order['Internal Shipping Method'])!} className="w-5 h-5 object-contain p-0.5 bg-white rounded-sm shadow-sm" alt="" />
                                                        )}
                                                        <span className={`text-[8px] uppercase font-bold px-1 rounded-sm border ${B_BORDER} ${B_TEXT_SECONDARY}`}>{order.Team}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="px-2 pb-2">
                                                <h4 
                                                    onClick={(e) => { e.stopPropagation(); handleCopy(order['Customer Name'], 'Name'); }}
                                                    className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate uppercase flex items-center gap-2 cursor-pointer hover:text-[#FCD535] transition-colors`}
                                                >
                                                    {order['Customer Name']}
                                                    {getOptimisticPackagePhoto(order['Order ID'], order['Package Photo']) && <span title="Photo Verified">📸</span>}
                                                </h4>
                                                <div className="flex justify-between items-center mt-0.5">
                                                    <div 
                                                        onClick={(e) => { e.stopPropagation(); handleCopy(formatPhoneNumber(order['Customer Phone']), 'Phone'); }}
                                                        className="flex items-center gap-1.5 cursor-pointer hover:text-[#FCD535] transition-colors group"
                                                    >
                                                        {getCarrierLogo(order['Customer Phone']) && (
                                                            <img src={getCarrierLogo(order['Customer Phone'])!} className="w-3.5 h-3.5 object-contain rounded-full bg-white/10" alt="" />
                                                        )}
                                                        <p className={`text-sm font-bold ${B_TEXT_PRIMARY} font-mono group-hover:text-[#FCD535]`}>{formatPhoneNumber(order['Customer Phone'])}</p>
                                                    </div>
                                                    {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                                                        <div className="flex flex-col items-end gap-1 truncate max-w-[130px]">
                                                            <div className="flex items-center gap-2 w-full justify-end">
                                                                {order['Driver Name'] ? (
                                                                    <>
                                                                        {getDriverImage(order['Driver Name']) && (
                                                                            <img src={getDriverImage(order['Driver Name'])!} className="w-4 h-4 object-cover rounded-full border border-white/10" alt="" />
                                                                        )}
                                                                        <p className={`text-xs ${B_ACCENT} font-black uppercase truncate max-w-[80px]`}>{order['Driver Name']}</p>
                                                                    </>
                                                                ) : order['Internal Shipping Details'] ? (
                                                                    <p className={`text-[10px] ${B_TEXT_SECONDARY} font-black italic uppercase truncate`}>ដឹកដោយ: {order['Internal Shipping Details']}</p>
                                                                ) : null}
                                                            </div>
                                                            <div className="bg-[#FCD535]/10 px-2 py-0.5 rounded-sm border border-[#FCD535]/20 shadow-sm">
                                                                <p className={`text-xs font-black text-[#FCD535] uppercase truncate w-full text-right`}>P: {order['Packed By'] || 'N/A'}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="mt-2.5 flex flex-col gap-1 mb-2.5">
                                                    <p className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate`}>{order.Location}</p>
                                                    <p className={`text-xs ${B_TEXT_SECONDARY} font-medium truncate`} title={order['Address Details']}>{order['Address Details']}</p>
                                                </div>
                                                <div className={`flex justify-between items-center mt-2 pt-2 border-t ${B_BORDER}`}>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`text-xs font-mono font-bold text-[#0ECB81]`}>${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                                                            {getBankLogo(order['Payment Info']) && (
                                                                <img src={getBankLogo(order['Payment Info'])!} className="w-3 h-3 object-contain rounded-sm bg-white" alt="" />
                                                            )}
                                                        </div>
                                                        <span className={`text-[8px] uppercase ${order['Payment Status']?.toLowerCase() === 'paid' ? 'text-[#0ECB81]' : 'text-[#FCD535]'}`}>{order['Payment Status'] || 'Unpaid'}</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); onView(order); }} className={`px-2 py-1 bg-[#2B3139] text-[#EAECEF] rounded-sm text-xs`}>View</button>
                                                        {activeTab === 'Cancelled' && order['Return Received By'] && (
                                                            <div className="flex items-center justify-center border border-[#FCD535]/20 bg-[#FCD535]/5 rounded-sm px-2 overflow-hidden">
                                                                <span className="text-[9px] font-black text-[#FCD535] uppercase truncate" title={order['Return Received By']}>
                                                                    Confirm by: {order['Return Received By']}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {!isCancelled && (
                                                            <>
                                                                {activeTab === 'Pending' && <button onClick={(e) => { e.stopPropagation(); onPack(order); }} className={`px-3 py-1 bg-[#FCD535] text-[#0B0E11] rounded-sm text-xs font-bold uppercase`}>Pack</button>}
                                                                {activeTab === 'Ready to Ship' && (
                                                                    <>
                                                                        <button onClick={(e) => { e.stopPropagation(); onUndo(order); }} className={`px-2 py-1 bg-[#F6465D]/10 text-[#F6465D] rounded-sm text-xs font-bold uppercase`}>Undo</button>
                                                                        <button onClick={(e) => { e.stopPropagation(); onShip(order); }} className={`px-3 py-1 bg-[#0ECB81] text-[#0B0E11] rounded-sm text-xs font-bold uppercase`}>Ship</button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                        {isCancelled && activeTab !== 'Cancelled' && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setUnpackTarget(order); }} 
                                                                className={`px-3 py-1 bg-red-600 text-white rounded-sm text-[10px] font-bold uppercase shadow-lg shadow-red-600/20 transition-all active:scale-95`}
                                                            >
                                                                {!!(order['Packed By'] || order['Packed Time']) ? 'ហែកកញ្ចប់' : 'បញ្ជាក់ការបោះបង់'}
                                                            </button>
                                                        )}
                                                        {activeTab === 'Shipped' && (
                                                            <button onClick={(e) => { e.stopPropagation(); onUndoShipped(order); }} className={`px-2 py-1 bg-[#F6465D]/10 text-[#F6465D] rounded-sm text-xs font-bold uppercase`}>Undo</button>
                                                        )}
                                                        {activeTab === 'Returned' && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onConfirmReturn?.(order); }} 
                                                                disabled={!!order['Return Received By']}
                                                                className={`px-3 py-1 ${order['Return Received By'] ? 'bg-gray-500/20 text-gray-500' : 'bg-purple-500 text-white font-bold'} rounded-sm text-xs uppercase transition-colors`}
                                                            >
                                                                {order['Return Received By'] ? 'Received' : 'Confirm'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </main>

            {unpackTarget && (
                <Modal isOpen={true} onClose={() => setUnpackTarget(null)} maxWidth="max-w-md">
                    <div className={`${B_BG_PANEL} p-6 space-y-6 rounded-sm border ${B_BORDER} shadow-2xl`}>
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-wider">
                                    {!!(unpackTarget['Packed By'] || unpackTarget['Packed Time']) ? 'បញ្ជាក់ការហែកកញ្ចប់' : 'បញ្ជាក់ការបោះបង់'}
                                </h3>
                                <p className="text-[#848E9C] text-sm mt-2">
                                    {!!(unpackTarget['Packed By'] || unpackTarget['Packed Time']) 
                                        ? 'តើអ្នកប្រាកដថាបានហែកកញ្ចប់ និងទុកឥវ៉ាន់ចូលស្តុកវិញរួចរាល់ហើយមែនទេ?' 
                                        : 'តើអ្នកប្រាកដថាចង់បោះបង់ការវេចខ្ចប់លើការកុម្ម៉ង់នេះមែនទេ?'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-[#0B0E11]/50 p-4 rounded-sm border border-[#2B3139] space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-[#848E9C] uppercase font-bold">Order ID</span>
                                <span className="text-xs text-[#EAECEF] font-mono">{unpackTarget['Order ID'].substring(0, 12)}...</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-[#848E9C] uppercase font-bold">Customer</span>
                                <span className="text-xs text-[#EAECEF] font-bold">{unpackTarget['Customer Name']}</span>
                            </div>
                            {unpackTarget['Cancel Reason'] && (
                                <div className="pt-2 border-t border-[#2B3139]">
                                    <span className="text-[10px] text-red-400 uppercase font-black block mb-1 text-left">Reason for Cancellation</span>
                                    <p className="text-sm text-red-400 font-bold text-left">{unpackTarget['Cancel Reason']}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setUnpackTarget(null)} 
                                className="flex-1 py-3 bg-[#2B3139] text-[#EAECEF] font-bold rounded-sm hover:bg-[#3B424A] transition-all uppercase text-xs"
                            >
                                បោះបង់
                            </button>
                            <button
                                onClick={() => {
                                    onUnpack(unpackTarget, true);
                                    setUnpackTarget(null);
                                }}
                                className="flex-[1.5] py-3 bg-red-600 text-white font-bold rounded-sm hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 uppercase text-xs"
                            >
                                {!!(unpackTarget['Packed By'] || unpackTarget['Packed Time']) ? 'ហែកកញ្ចប់រួចរាល់' : 'បញ្ជាក់ការបោះបង់'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default TabletPackagingHub;
