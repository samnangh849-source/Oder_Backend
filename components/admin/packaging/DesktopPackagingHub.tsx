import React, { useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { ParsedOrder } from '@/types';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl, getOptimisticPackagePhoto } from '@/utils/fileUtils';
import { safeParseDate } from '@/utils/dateUtils';

// --- Theme Constants ---
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

interface DesktopPackagingHubProps {
    orders: ParsedOrder[];
    activeTab: string;
    setActiveTab: (tab: any) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onPack: (order: ParsedOrder) => void;
    onShip: (order: ParsedOrder) => void;
    onUndo: (order: ParsedOrder) => void;
    onUndoShipped: (order: ParsedOrder) => void;
    onUnpack: (order: ParsedOrder) => void;
    onView: (order: ParsedOrder) => void;
    onPrintManifest: () => void;
    onSwitchHub: () => void;
    onExit: () => void;
    shippingFilter: string;
    setShippingFilter: (filter: string) => void;
    selectedStore: string;
    progressStats: { packedByUserToday: number, storeTotalToday: number, progressPercentage: number };
    viewMode: 'card' | 'list';
    setViewMode: (mode: 'card' | 'list') => void;
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

const DesktopPackagingHub: React.FC<DesktopPackagingHubProps> = ({
    orders, activeTab, setActiveTab, searchTerm, setSearchTerm,
    onPack, onShip, onUndo, onUndoShipped, onView, onPrintManifest, onSwitchHub, onExit,
    shippingFilter, setShippingFilter,
    selectedStore,
    progressStats, viewMode, setViewMode, setIsFilterModalOpen, loadingActionId, tabCounts,
    selectedOrderIds, toggleOrderSelection, clearSelection, onBulkShip, isBulkProcessing,
    onToggleSelectAll, onConfirmReturn, onCloseShift, isViewOnly, activeShift
}) => {
    const { appData, previewImage: showFullImage } = useContext(AppContext);

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
            const prefixes = c.Prefixes.split(',').map(p => p.trim());
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
        // Fallback for custom or partial strings
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
            {/* Binance Style Side Panel */}
            <aside className={`w-64 flex flex-col flex-shrink-0 border-r ${B_BORDER} ${B_BG_PANEL}`}>
                <div className={`p-4 border-b ${B_BORDER}`}>
                    <h2 className={`text-xl font-bold ${B_ACCENT}`}>HUB OPS</h2>
                    <p className={`text-[10px] uppercase font-medium ${B_TEXT_SECONDARY} mt-0.5`}>{selectedStore}</p>
                </div>
                
                <nav className={`flex flex-col py-2 border-b ${B_BORDER}`}>
                    {[
                        { id: 'Pending', label: 'Pending Pack', count: tabCounts.pending },
                        { id: 'Ready to Ship', label: 'Ready for Dispatch', count: tabCounts.ready },
                        { id: 'Shipped', label: 'Shipped Log', count: tabCounts.shipped },
                        { id: 'Returned', label: 'Return', count: tabCounts.returned || 0 },
                        { id: 'Cancelled', label: 'Canceled', count: tabCounts.cancelled || 0 }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center justify-between px-4 py-2.5 transition-colors text-xs font-medium border-l-2 ${activeTab === tab.id ? `${B_BG_MAIN} border-[#FCD535] ${B_TEXT_PRIMARY}` : `border-transparent ${B_TEXT_SECONDARY} ${B_BG_HOVER} hover:text-white`}`}
                        >
                            <span>{tab.label}</span>
                            <span className={B_TEXT_PRIMARY}>{tab.count}</span>
                        </button>
                    ))}
                </nav>

                <div className="flex-grow p-4 space-y-4">
                    <p className={`text-[10px] font-bold ${B_TEXT_SECONDARY} uppercase`}>Live Telemetry</p>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                            <span className={B_TEXT_SECONDARY}>Ops Load</span>
                            <span className={`font-mono ${B_TEXT_PRIMARY}`}>{orders.length}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className={B_TEXT_SECONDARY}>Personal Packs</span>
                            <span className={`font-mono ${B_GREEN}`}>{progressStats.packedByUserToday}</span>
                        </div>
                    </div>
                    
                    <div className="pt-2">
                        <div className="flex justify-between items-center mb-1 text-[10px]">
                            <span className={B_TEXT_SECONDARY}>Hub Progress</span>
                            <span className={`font-mono ${B_GREEN}`}>{progressStats.progressPercentage}%</span>
                        </div>
                        <div className={`h-[3px] w-full ${B_BG_MAIN} overflow-hidden`}>
                            <div className="h-full bg-[#0ECB81] transition-all duration-1000" style={{ width: `${progressStats.progressPercentage}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto p-4 flex flex-col gap-2">
                    {activeShift && (
                        <div className={`p-3 ${B_BG_MAIN} border ${B_BORDER} rounded-sm mb-2`}>
                            <p className={`text-[10px] uppercase font-bold ${B_TEXT_SECONDARY} mb-1`}>Active Shift</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse"></div>
                                <p className={`text-xs font-bold ${B_TEXT_PRIMARY}`}>{activeShift.OpenedBy}</p>
                            </div>
                            <p className={`text-[9px] ${B_TEXT_SECONDARY} mt-1`}>Started: {new Date(activeShift.OpenedAt).toLocaleTimeString('km-KH')}</p>
                            {isViewOnly ? (
                                <div className="mt-2 py-1 px-2 bg-blue-500/10 border border-blue-500/20 rounded-sm">
                                    <p className="text-[9px] text-blue-400 font-bold uppercase">View Only Mode</p>
                                </div>
                            ) : (
                                <button 
                                    onClick={onCloseShift}
                                    className="mt-3 w-full py-2 bg-[#F6465D] hover:bg-[#F6465D]/90 text-white text-xs font-bold rounded-sm transition-colors uppercase tracking-wider shadow-lg shadow-[#F6465D]/10"
                                >
                                    🔴 Close Shift
                                </button>
                            )}
                        </div>
                    )}
                    <button onClick={onSwitchHub} className={`w-full py-2 bg-[#2B3139] hover:bg-[#3B424A] ${B_TEXT_PRIMARY} text-xs font-medium transition-colors rounded-sm`}>
                        Switch Hub
                    </button>
                    <button onClick={onExit} className={`w-full py-2 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 ${B_RED} text-xs font-medium transition-colors rounded-sm`}>
                        Exit Module
                    </button>
                </div>
            </aside>

            {/* Main Market/Order View */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                {/* Minimal Top Nav */}
                <header className={`flex-shrink-0 h-14 px-4 flex items-center justify-between relative z-10 ${B_BG_PANEL} border-b ${B_BORDER}`}>
                    <div className="flex items-center gap-4 flex-grow max-w-lg">
                        <div className="relative w-full">
                            <input 
                                type="text" 
                                placeholder="Query ID, Name, Phone..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full pl-8 pr-4 py-1.5 ${B_BG_MAIN} border ${B_BORDER} text-sm ${B_TEXT_PRIMARY} placeholder:text-[#848E9C] focus:border-[#FCD535] rounded-sm transition-colors outline-none`}
                            />
                            <div className={`absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none ${B_TEXT_SECONDARY}`}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <button onClick={() => setIsFilterModalOpen(true)} className={`px-3 py-1.5 ${B_BG_MAIN} hover:bg-[#2B3139] ${B_TEXT_PRIMARY} text-sm font-medium border ${B_BORDER} rounded-sm flex items-center gap-1.5 whitespace-nowrap`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {activeTab === 'Ready to Ship' && (
                            <div className="flex items-center gap-3 mr-4">
                                {viewMode === 'card' && orders.length > 0 && (
                                    <button 
                                        onClick={() => onToggleSelectAll(orders)}
                                        className={`px-3 py-2 border ${orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'border-[#2B3139] text-[#848E9C]'} text-[12px] font-bold rounded-sm uppercase tracking-wider transition-colors whitespace-nowrap`}
                                    >
                                        {orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'Deselect All' : 'Select All'}
                                    </button>
                                )}
                                <button onClick={onPrintManifest} className={`px-4 py-2 border border-[#FCD535]/50 hover:bg-[#FCD535] group transition-all rounded-sm flex items-center gap-2 whitespace-nowrap`}>
                                    <svg className="w-4 h-4 text-[#FCD535] group-hover:text-[#0B0E11]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                    <span className="text-[#FCD535] group-hover:text-[#0B0E11] text-sm font-bold uppercase tracking-wider">Print Manifest</span>
                                </button>
                                {selectedOrderIds.size > 0 && (
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
                        <div className="flex bg-[#0B0E11] p-0.5 border border-[#2B3139] rounded-sm">
                            <button onClick={() => setViewMode('card')} className={`p-2 rounded-sm transition-all ${viewMode === 'card' ? 'bg-[#2B3139] text-[#EAECEF]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg></button>
                            <button onClick={() => setViewMode('list')} className={`p-2 rounded-sm transition-all ${viewMode === 'list' ? 'bg-[#2B3139] text-[#EAECEF]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg></button>
                        </div>
                    </div>
                </header>

                {/* Shipping Method Shortcuts Bar (Desktop) */}
                {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                    <div className={`flex-shrink-0 px-8 py-3 bg-[#181A20] border-b ${B_BORDER} flex items-center gap-3 overflow-x-auto no-scrollbar`}>
                        <span className={`text-xs font-black ${B_TEXT_SECONDARY} uppercase tracking-[0.2em] mr-2`}>Shipping Filter:</span>
                        <button 
                            onClick={() => setShippingFilter('')}
                            className={`px-4 py-2 rounded-sm text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border ${!shippingFilter ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-[0_0_15px_rgba(252,213,53,0.2)]' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50 hover:text-[#EAECEF]'}`}
                        >
                            ALL CARRIERS
                        </button>
                        {appData.shippingMethods?.filter((m: any) => m.Status !== 'Inactive').map((method: any) => (
                            <button
                                key={method.MethodName}
                                onClick={() => setShippingFilter(shippingFilter === method.MethodName ? '' : method.MethodName)}
                                className={`px-4 py-2 rounded-sm text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-2.5 ${shippingFilter === method.MethodName ? 'bg-[#FCD535] border-[#FCD535] text-black shadow-[0_0_15px_rgba(252,213,53,0.2)]' : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#FCD535]/50 hover:text-[#EAECEF]'}`}
                            >
                                {method.LogoURL && <img src={convertGoogleDriveUrl(method.LogoURL)} alt="" className="w-5 h-5 object-contain" />}
                                {method.MethodName}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 pt-4">
                    {orders.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center p-10 ${B_TEXT_SECONDARY} text-sm mt-10`}><span className="text-3xl mb-2 opacity-50">📂</span>No Operations in Queue</div>
                    ) : (
                        <div className="space-y-8 pb-20">
                            {Object.entries(groups).map(([date, groupOrders]: [string, any]) => (
                                <section key={date} className="space-y-4">
                                    <div className={`text-sm font-bold ${B_TEXT_PRIMARY} px-1 pb-1 border-b ${B_BORDER} flex justify-between`}>
                                        <span>{date}</span>
                                        <span className={B_TEXT_SECONDARY}>{groupOrders.length} records</span>
                                    </div>

                                    {viewMode === 'list' && (
                                        <div className={`grid grid-cols-12 gap-2 px-3 py-1 text-xs font-bold ${B_TEXT_SECONDARY} uppercase`}>
                                            <div className="col-span-1">
                                                {activeTab === 'Ready to Ship' ? (
                                                    <button 
                                                        onClick={() => onToggleSelectAll(orders)}
                                                        className={`w-5 h-5 border-2 rounded-sm transition-colors flex items-center justify-center ${orders.length > 0 && orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'bg-[#FCD535] border-[#FCD535]' : 'border-gray-600'}`}
                                                    >
                                                        {orders.length > 0 && orders.every(o => selectedOrderIds.has(o['Order ID'])) && (
                                                            <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className={`text-xs font-bold ${B_TEXT_SECONDARY} uppercase tracking-widest`}>#</span>
                                                )}
                                            </div>
                                            <div className="col-span-4">Asset / Node</div>
                                            <div className="col-span-2">Location</div>
                                            <div className="col-span-2">Value / Status</div>
                                            <div className="col-span-3 text-right">Action</div>
                                        </div>
                                    )}

                                    <div className={viewMode === 'card' 
                                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 min-[1900px]:grid-cols-5 gap-3" 
                                        : "flex flex-col gap-1"
                                    }>
                                        {groupOrders.map((order, idx) => {
                                            const fs = order.FulfillmentStatus || order['Fulfillment Status'] || 'Pending';
                                            const isCancelled = fs === 'Cancelled';
                                            const isReturned = fs === 'Returned';
                                            return (
                                            viewMode === 'card' ? (
                        <div 
                            key={order['Order ID']} 
                            className={`${B_BG_PANEL} border ${B_BORDER} hover:border-[#FCD535]/30 group transition-all relative cursor-pointer ${isCancelled ? 'bg-red-950/20 border-red-500/30' : isReturned ? 'bg-purple-950/20 border-purple-500/30' : ''}`}
                            onClick={() => onView(order)}
                        >
                            {/* Watermark Overlay */}
                            {(isCancelled || isReturned) && (
                                <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[100] overflow-hidden`}>
                                    <div className={`rotate-[-12deg] font-black text-3xl tracking-[0.1em] whitespace-nowrap opacity-25 ${isCancelled ? 'text-red-500' : 'text-purple-400'}`}>
                                        {isCancelled ? 'CANCELLED' : 'RETURNED'}
                                    </div>
                                    {isCancelled && order['Cancel Reason'] && (
                                        <div className="rotate-[-12deg] bg-red-600/10 border border-red-500/20 px-2 py-0.5 rounded-sm mt-1 max-w-[80%]">
                                            <p className="text-[10px] font-bold text-red-400 truncate uppercase">Reason: {order['Cancel Reason']}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {loadingActionId === order['Order ID'] && (
                                <div className="absolute inset-0 bg-[#0B0E11]/80 z-50 flex items-center justify-center"><Spinner size="sm" /></div>
                            )}
                            {activeTab === 'Ready to Ship' && (
                                <div className="absolute top-3 left-3 z-10" onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order['Order ID']); }}>
                                    <div className={`w-5 h-5 border-2 rounded-sm transition-colors flex items-center justify-center ${selectedOrderIds.has(order['Order ID']) ? 'bg-[#FCD535] border-[#FCD535]' : 'border-gray-600 bg-black/20'}`}>
                                        {selectedOrderIds.has(order['Order ID']) && (
                                            <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className={`px-3 py-1.5 border-b ${B_BORDER} flex justify-between items-center ${activeTab === 'Ready to Ship' ? 'pt-10' : ''}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-mono ${B_TEXT_SECONDARY}`}>{(idx + 1).toString().padStart(2, '0')}</span>
                                                            <span 
                                                                onClick={(e) => { e.stopPropagation(); handleCopy(order['Order ID'], 'ID'); }}
                                                                className={`text-sm font-mono font-medium ${B_TEXT_PRIMARY} cursor-pointer hover:text-[#FCD535] transition-colors`}
                                                            >
                                                                {order['Order ID'].substring(0, 10)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {activeTab === 'Pending' && (
                                                                <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-sm border border-white/5">
                                                                    <span className={`text-[9px] font-bold ${B_TEXT_SECONDARY} uppercase tracking-tight`}>Order: {extractTime(order.Timestamp)}</span>
                                                                </div>
                                                            )}
                                                            {activeTab === 'Ready to Ship' && order['Packed Time'] && (
                                                                <div className="flex items-center gap-1 bg-[#0ECB81]/5 px-2 py-0.5 rounded-sm border border-[#0ECB81]/10">
                                                                    <span className={`text-[9px] font-black text-[#0ECB81] uppercase tracking-tight`}>Packed: {extractTime(order['Packed Time'])}</span>
                                                                </div>
                                                            )}
                                                            {activeTab === 'Shipped' && order['Dispatched Time'] && (
                                                                <div className="flex items-center gap-1 bg-blue-500/5 px-2 py-0.5 rounded-sm border border-blue-500/10">
                                                                    <span className={`text-[9px] font-black text-blue-400 uppercase tracking-tight`}>Shipped: {extractTime(order['Dispatched Time'])}</span>
                                                                </div>
                                                            )}
                                                            {activeTab === 'Returned' && (
                                                                <div className="flex items-center gap-1 bg-purple-500/5 px-2 py-0.5 rounded-sm border border-purple-500/10">
                                                                    <span className={`text-[9px] font-black text-purple-400 uppercase tracking-tight`}>Returned</span>
                                                                </div>
                                                            )}
                                                            <div className="flex items-center gap-1.5">
                                                                {getShippingLogo(order['Internal Shipping Method']) && (
                                                                    <img src={getShippingLogo(order['Internal Shipping Method'])!} className="w-5 h-5 object-contain p-0.5 bg-white rounded-sm shadow-sm" alt="" />
                                                                )}
                                                                <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${order.Team === 'A' ? 'bg-blue-900/40 text-blue-400' : 'bg-purple-900/40 text-purple-400'}`}>T-{order.Team}</span>
                                                            </div>
                                                        </div>
                                                        </div>

                                                        <div className="p-3 flex gap-3 flex-grow">
                                                        <img src={convertGoogleDriveUrl(order.Products[0]?.image)} className={`w-14 h-14 object-cover ${B_BG_MAIN} border ${B_BORDER} flex-shrink-0 rounded-sm`} alt="" />
                                                        <div className="flex flex-col flex-grow min-w-0">
                                                            <p 
                                                                onClick={(e) => { e.stopPropagation(); handleCopy(order['Customer Name'], 'Name'); }}
                                                                className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate uppercase cursor-pointer hover:text-[#FCD535] transition-colors`}
                                                            >
                                                                {order['Customer Name']}
                                                            </p>
                                                            <div 
                                                                onClick={(e) => { e.stopPropagation(); handleCopy(formatPhoneNumber(order['Customer Phone']), 'Phone'); }}
                                                                className="flex items-center gap-1.5 cursor-pointer hover:text-[#FCD535] transition-colors group mt-0.5"
                                                            >
                                                                {getCarrierLogo(order['Customer Phone']) && (
                                                                    <img src={getCarrierLogo(order['Customer Phone'])!} className="w-4 h-4 object-contain rounded-full bg-white/10" alt="" />
                                                                )}
                                                                <p className={`text-sm font-mono font-bold ${B_TEXT_PRIMARY} group-hover:text-[#FCD535]`}>{formatPhoneNumber(order['Customer Phone'])}</p>
                                                            </div>
                                                            <div className="flex justify-between items-end mt-auto pt-2">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate max-w-[150px]`}>{order.Location}</span>
                                                                    <span className={`text-xs ${B_TEXT_SECONDARY} font-medium truncate max-w-[150px]`} title={order['Address Details']}>{order['Address Details']}</span>

                                                                    {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                                                                        <div className="space-y-1.5 mt-2">
                                                                            <div className="flex items-center gap-2">
                                                                                {order['Driver Name'] ? (
                                                                                    <>
                                                                                        {getDriverImage(order['Driver Name']) && (
                                                                                            <img src={getDriverImage(order['Driver Name'])!} className="w-4 h-4 object-cover rounded-full border-2 border-[#2B3139]" alt="" />
                                                                                        )}
                                                                                        <span className={`text-xs ${B_ACCENT} font-black uppercase tracking-tight`}>D: {order['Driver Name']}</span>
                                                                                    </>
                                                                                ) : order['Internal Shipping Details'] ? (
                                                                                    <span className={`text-[11px] ${B_TEXT_SECONDARY} font-black italic uppercase tracking-wide`}>ដឹកដោយ: {order['Internal Shipping Details']}</span>
                                                                                ) : null}
                                                                            </div>
                                                                            <div className="flex flex-col gap-1">
                                                                                <div className="flex items-center gap-2 bg-[#FCD535]/5 border border-[#FCD535]/20 px-2.5 py-1 rounded-sm shadow-inner">
                                                                                    <div className="w-2.5 h-2.5 bg-[#FCD535] rounded-full flex items-center justify-center text-[7px] font-black text-black">P</div>
                                                                                    <span className={`text-[10px] font-bold text-[#FCD535] truncate max-w-[100px] uppercase tracking-wide`}>P: {order['Packed By'] || 'N/A'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>                                                                <div className="flex flex-col items-end">
                                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                                        {getBankLogo(order['Payment Info']) && (
                                                                            <img src={getBankLogo(order['Payment Info'])!} className="w-3.5 h-3.5 object-contain rounded-sm bg-white" alt="" />
                                                                        )}
                                                                        <span className={`text-[10px] uppercase ${order['Payment Status']?.toLowerCase() === 'paid' ? 'text-[#0ECB81]' : 'text-[#FCD535]'}`}>{order['Payment Status'] || 'Unpaid'}</span>
                                                                    </div>
                                                                    <span className={`text-sm font-mono font-bold ${B_GREEN}`}>${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={`p-2 border-t ${B_BORDER} bg-[#0B0E11] grid ${activeTab === 'Pending' ? 'grid-cols-2 gap-2' : activeTab === 'Ready to Ship' ? 'grid-cols-3 gap-2' : 'grid-cols-2 gap-2'}`}>
                                                        <button onClick={(e) => { e.stopPropagation(); onView(order); }} className={`w-full py-1.5 bg-[#2B3139] hover:bg-[#3B424A] ${B_TEXT_PRIMARY} text-xs font-medium transition-colors rounded-sm`}>Details</button>
                                                        {!isCancelled && (
                                                            <>
                                                                {activeTab === 'Pending' && <button onClick={(e) => { e.stopPropagation(); onPack(order); }} className={`w-full py-1.5 ${B_ACCENT_BG} text-xs font-bold uppercase transition-colors rounded-sm`}>Pack</button>}
                                                                {activeTab === 'Ready to Ship' && (
                                                                    <>
                                                                        <button onClick={(e) => { e.stopPropagation(); onUndo(order); }} className={`w-full py-1.5 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 ${B_RED} text-xs font-bold uppercase transition-colors rounded-sm`}>Undo</button>
                                                                        <button onClick={(e) => { e.stopPropagation(); onShip(order); }} className={`w-full py-1.5 ${B_ACCENT_BG} text-xs font-bold uppercase transition-colors rounded-sm`}>Ship</button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                        {isCancelled && activeTab !== 'Cancelled' && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onUnpack(order); }} 
                                                                className={`w-full py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase transition-colors rounded-sm shadow-lg shadow-red-600/20`}
                                                            >
                                                                {!!(order['Packed By'] || order['Packed Time']) ? 'ហែកកញ្ចប់' : 'Confirm Cancel'}
                                                            </button>
                                                        )}
                                                        {activeTab === 'Shipped' && (
                                                            <button onClick={(e) => { e.stopPropagation(); onUndoShipped(order); }} className={`w-full py-1.5 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 ${B_RED} text-xs font-bold uppercase transition-colors rounded-sm`}>Undo</button>
                                                        )}
                                                        {activeTab === 'Returned' && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onConfirmReturn?.(order); }} 
                                                                disabled={!!order['Return Received By']}
                                                                className={`w-full py-1.5 ${order['Return Received By'] ? 'bg-gray-500/20 text-gray-500' : 'bg-purple-500 text-white hover:bg-purple-600'} text-xs font-bold uppercase transition-colors rounded-sm`}
                                                            >
                                                                {order['Return Received By'] ? 'Received' : 'Confirm Receipt'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={order['Order ID']} className={`${B_BG_PANEL} border ${B_BORDER} ${B_BG_HOVER} transition-colors grid grid-cols-12 items-center gap-2 p-2 relative group cursor-pointer ${isCancelled ? 'bg-red-950/20 border-red-500/30' : isReturned ? 'bg-purple-950/20 border-purple-500/30' : ''}`} onClick={() => onView(order)}>
                                                    {/* Watermark Overlay */}
                                                    {(isCancelled || isReturned) && (
                                                        <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[100] overflow-hidden`}>
                                                            <div className={`rotate-[-12deg] font-black text-4xl tracking-[0.2em] whitespace-nowrap opacity-25 ${isCancelled ? 'text-red-500' : 'text-purple-400'}`}>
                                                                {isCancelled ? 'CANCELLED' : 'RETURNED'}
                                                            </div>
                                                            {isCancelled && order['Cancel Reason'] && (
                                                                <div className="rotate-[-12deg] bg-red-600/10 border border-red-500/20 px-4 py-1 rounded-sm mt-2 max-w-[80%]">
                                                                    <p className="text-xs font-bold text-red-400 truncate uppercase">Reason: {order['Cancel Reason']}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {loadingActionId === order['Order ID'] && (
                                                        <div className="absolute inset-0 bg-[#0B0E11]/80 z-50 flex items-center justify-center"><Spinner size="sm" /></div>
                                                    )}
                                                    <div className="col-span-1 flex flex-col items-start gap-1 pl-1">
                                                        {activeTab === 'Ready to Ship' && (
                                                            <div 
                                                                onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order['Order ID']); }}
                                                                className={`w-4 h-4 border-2 rounded-sm transition-colors flex items-center justify-center cursor-pointer ${selectedOrderIds.has(order['Order ID']) ? 'bg-[#FCD535] border-[#FCD535]' : 'border-gray-600 bg-black/20'}`}
                                                            >
                                                                {selectedOrderIds.has(order['Order ID']) && (
                                                                    <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                                                )}
                                                            </div>
                                                        )}
                                                        {(!selectedOrderIds.has(order['Order ID']) || activeTab !== 'Ready to Ship') && (
                                                            <div className="text-xs font-mono text-[#848E9C]">{(idx + 1).toString().padStart(2, '0')}</div>
                                                        )}
                                                    </div>
                                                    <div className="col-span-4 flex items-center gap-3 w-min-0">
                                                        <img src={convertGoogleDriveUrl(order.Products[0]?.image)} className={`w-10 h-10 object-cover ${B_BG_MAIN} border ${B_BORDER} flex-shrink-0 rounded-sm`} alt="" />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p 
                                                                    onClick={(e) => { e.stopPropagation(); handleCopy(order['Customer Name'], 'Name'); }}
                                                                    className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate uppercase cursor-pointer hover:text-[#FCD535]`}
                                                                >
                                                                    {order['Customer Name']}
                                                                </p>
                                                                <div 
                                                                    onClick={(e) => { e.stopPropagation(); handleCopy(formatPhoneNumber(order['Customer Phone']), 'Phone'); }}
                                                                    className="flex items-center gap-1.5 cursor-pointer hover:text-[#FCD535] group"
                                                                >
                                                                    {getCarrierLogo(order['Customer Phone']) && (
                                                                        <img src={getCarrierLogo(order['Customer Phone'])!} className="w-4 h-4 object-contain rounded-full bg-white/10" alt="" />
                                                                    )}
                                                                    <p className={`text-sm font-mono font-bold ${B_TEXT_PRIMARY} group-hover:text-[#FCD535]`}>{formatPhoneNumber(order['Customer Phone'])}</p>
                                                                </div>
                                                            </div>
                                                            <span 
                                                                onClick={(e) => { e.stopPropagation(); handleCopy(order['Order ID'], 'ID'); }}
                                                                className={`text-xs font-mono ${B_TEXT_SECONDARY} truncate cursor-pointer hover:text-[#FCD535] transition-colors`}
                                                            >
                                                                {order['Order ID'].substring(0,10)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 min-w-0">
                                                        <p className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate`}>{order.Location}</p>
                                                        <p className={`text-xs ${B_TEXT_SECONDARY} font-medium truncate`} title={order['Address Details']}>{order['Address Details']}</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <p className={`text-[10px] ${B_TEXT_SECONDARY} uppercase font-bold`}>{order.Team} Team</p>
                                                            {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                                                                <div className="flex flex-col gap-1.5">
                                                                    <div className="flex items-center gap-2 truncate">
                                                                        {order['Driver Name'] ? (
                                                                            <>
                                                                                {getDriverImage(order['Driver Name']) && (
                                                                                    <img src={getDriverImage(order['Driver Name'])!} className="w-4 h-4 object-cover rounded-full border border-white/10" alt="" />
                                                                                )}
                                                                                <p className={`text-xs ${B_ACCENT} font-black uppercase truncate`}>{order['Driver Name']}</p>
                                                                            </>
                                                                        ) : order['Internal Shipping Details'] ? (
                                                                            <p className={`text-[10px] ${B_TEXT_SECONDARY} font-black italic uppercase truncate`}>ដឹកដោយ: {order['Internal Shipping Details']}</p>
                                                                        ) : null}
                                                                    </div>
                                                                    <div className="flex items-center gap-2 bg-[#FCD535]/10 px-2 py-0.5 rounded-sm w-fit max-w-[140px]">
                                                                        <p className={`text-xs font-black text-[#FCD535] uppercase truncate`}>P: {order['Packed By'] || 'N/A'}</p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className={`text-sm font-mono font-bold ${B_GREEN}`}>${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                                                            {getBankLogo(order['Payment Info']) && (
                                                                <img src={getBankLogo(order['Payment Info'])!} className="w-4 h-4 object-contain rounded-sm bg-white" alt="" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <p className={`text-[10px] uppercase ${order['Payment Status']?.toLowerCase() === 'paid' ? 'text-[#0ECB81]' : 'text-[#FCD535]'}`}>{order['Payment Status'] || 'Unpaid'}</p>
                                                            {getShippingLogo(order['Internal Shipping Method']) && (
                                                                <img src={getShippingLogo(order['Internal Shipping Method'])!} className="w-3.5 h-3.5 object-contain" alt="" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-3 flex justify-end items-center gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); onView(order); }} className={`px-3 py-1 bg-[#2B3139] hover:bg-[#3B424A] ${B_TEXT_PRIMARY} text-xs font-medium rounded-sm transition-colors`}>View</button>
                                                        {!isCancelled && (
                                                            <>
                                                                {activeTab === 'Pending' && <button onClick={(e) => { e.stopPropagation(); onPack(order); }} className={`px-4 py-1 ${B_ACCENT_BG} text-xs font-bold uppercase rounded-sm`}>Pack</button>}
                                                                {activeTab === 'Ready to Ship' && (
                                                                    <>
                                                                        <button onClick={(e) => { e.stopPropagation(); onUndo(order); }} className={`px-3 py-1 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 ${B_RED} text-xs font-bold uppercase rounded-sm transition-colors`}>Undo</button>
                                                                        <button onClick={(e) => { e.stopPropagation(); onShip(order); }} className={`px-4 py-1 ${B_ACCENT_BG} text-xs font-bold uppercase rounded-sm`}>Ship</button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                        {isCancelled && activeTab !== 'Cancelled' && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onUnpack(order); }} 
                                                                className={`px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase rounded-sm shadow-lg shadow-red-600/20`}
                                                            >
                                                                {!!(order['Packed By'] || order['Packed Time']) ? 'ហែកកញ្ចប់' : 'Confirm Cancel'}
                                                            </button>
                                                        )}
                                                        {activeTab === 'Shipped' && (
                                                            <button onClick={(e) => { e.stopPropagation(); onUndoShipped(order); }} className={`px-3 py-1 bg-[#F6465D]/10 hover:bg-[#F6465D]/20 ${B_RED} text-xs font-bold uppercase rounded-sm transition-colors`}>Undo</button>
                                                        )}
                                                        {activeTab === 'Returned' && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); onConfirmReturn?.(order); }} 
                                                                disabled={!!order['Return Received By']}
                                                                className={`px-3 py-1 ${order['Return Received By'] ? 'bg-gray-500/20 text-gray-500' : 'bg-purple-500 text-white hover:bg-purple-600'} text-xs font-bold uppercase rounded-sm transition-colors`}
                                                            >
                                                                {order['Return Received By'] ? 'Received' : 'Confirm Receipt'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default DesktopPackagingHub;
