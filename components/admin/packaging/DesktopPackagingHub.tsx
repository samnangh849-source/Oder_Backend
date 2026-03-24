import React, { useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { ParsedOrder } from '@/types';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

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
    onView: (order: ParsedOrder) => void;
    onPrintManifest: () => void;
    onSwitchHub: () => void;
    onExit: () => void;
    selectedStore: string;
    progressStats: { packedByUserToday: number, storeTotalToday: number, progressPercentage: number };
    viewMode: 'card' | 'list';
    setViewMode: (mode: 'card' | 'list') => void;
    setIsFilterModalOpen: (open: boolean) => void;
    loadingActionId: string | null;
    tabCounts: { pending: number, ready: number, shipped: number };
    selectedOrderIds: Set<string>;
    toggleOrderSelection: (id: string) => void;
    clearSelection: () => void;
    onBulkShip: () => void;
    isBulkProcessing: boolean;
    onToggleSelectAll: (orders: ParsedOrder[]) => void;
}

const DesktopPackagingHub: React.FC<DesktopPackagingHubProps> = ({
    orders, activeTab, setActiveTab, searchTerm, setSearchTerm,
    onPack, onShip, onView, onPrintManifest, onSwitchHub, onExit, selectedStore,
    progressStats, viewMode, setViewMode, setIsFilterModalOpen, loadingActionId, tabCounts,
    selectedOrderIds, toggleOrderSelection, clearSelection, onBulkShip, isBulkProcessing,
    onToggleSelectAll
}) => {
    const { appData, previewImage: showFullImage } = useContext(AppContext);

    const getSafeDateObj = (dateStr: string) => {
        if (!dateStr) return new Date();
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const groups = useMemo(() => {
        const sorted = [...orders].sort((a, b) => getSafeDateObj(b.Timestamp).getTime() - getSafeDateObj(a.Timestamp).getTime());
        const result: { [key: string]: ParsedOrder[] } = {};
        if (activeTab === 'Pending') {
            sorted.forEach(order => {
                const date = order.Timestamp ? getSafeDateObj(order.Timestamp).toLocaleDateString('km-KH', { month: 'short', day: 'numeric' }) : 'Recent';
                if (!result[date]) result[date] = [];
                result[date].push(order);
            });
        } else {
            result['Order Stream'] = sorted;
        }
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
                        { id: 'Shipped', label: 'Shipped Log', count: tabCounts.shipped }
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
                                className={`w-full pl-8 pr-4 py-1.5 ${B_BG_MAIN} border ${B_BORDER} text-xs ${B_TEXT_PRIMARY} placeholder:text-[#848E9C] focus:border-[#FCD535] rounded-sm transition-colors outline-none`}
                            />
                            <div className={`absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none ${B_TEXT_SECONDARY}`}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <button onClick={() => setIsFilterModalOpen(true)} className={`px-3 py-1.5 ${B_BG_MAIN} hover:bg-[#2B3139] ${B_TEXT_PRIMARY} text-xs font-medium border ${B_BORDER} rounded-sm flex items-center gap-1.5 whitespace-nowrap`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                            Filters
                        </button>
                        {activeTab === 'Ready to Ship' && (
                            <div className="flex items-center gap-3">
                                {viewMode === 'card' && orders.length > 0 && (
                                    <button 
                                        onClick={() => onToggleSelectAll(orders)}
                                        className={`px-3 py-2 border ${orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'border-[#2B3139] text-[#848E9C]'} text-[11px] font-bold rounded-sm uppercase tracking-wider transition-colors whitespace-nowrap`}
                                    >
                                        {orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'Deselect All' : 'Select All'}
                                    </button>
                                )}
                                <button onClick={onPrintManifest} className={`px-4 py-2 border border-[#FCD535]/50 hover:bg-[#FCD535] group transition-all rounded-sm flex items-center gap-2 whitespace-nowrap`}>
                                <svg className="w-4 h-4 text-[#FCD535] group-hover:text-[#0B0E11]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                <span className="text-[#FCD535] group-hover:text-[#0B0E11] text-xs font-bold uppercase tracking-wider">Print Manifest</span>
                            </button>
                            {activeTab === 'Ready to Ship' && selectedOrderIds.size > 0 && (
                                <button 
                                    onClick={onBulkShip}
                                    disabled={isBulkProcessing}
                                    className={`px-4 py-2 bg-[#0ECB81] hover:bg-[#0CA66B] text-[#0B0E11] text-xs font-bold rounded-sm flex items-center gap-2 transition-all animate-fade-in-down whitespace-nowrap`}
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

                    <div className="flex bg-[#0B0E11] p-0.5 border border-[#2B3139] rounded-sm">
                        <button onClick={() => setViewMode('card')} className={`p-1.5 rounded-sm transition-all ${viewMode === 'card' ? 'bg-[#2B3139] text-[#EAECEF]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-sm transition-all ${viewMode === 'list' ? 'bg-[#2B3139] text-[#EAECEF]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg></button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 pt-4">
                    {orders.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center p-10 ${B_TEXT_SECONDARY} text-xs mt-10`}><span className="text-3xl mb-2 opacity-50">📂</span>No Operations in Queue</div>
                    ) : (
                        <div className="space-y-8 pb-20">
                            {Object.entries(groups).map(([date, groupOrders]: [string, any]) => (
                                <section key={date} className="space-y-4">
                                    <div className={`text-xs font-bold ${B_TEXT_PRIMARY} px-1 pb-1 border-b ${B_BORDER} flex justify-between`}>
                                        <span>{date}</span>
                                        <span className={B_TEXT_SECONDARY}>{groupOrders.length} records</span>
                                    </div>

                                    {viewMode === 'list' && (
                                        <div className={`grid grid-cols-12 gap-2 px-3 py-1 text-[10px] font-bold ${B_TEXT_SECONDARY} uppercase`}>
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
                                                    <span className={`text-[10px] font-bold ${B_TEXT_SECONDARY} uppercase tracking-widest`}>#</span>
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
                                        {groupOrders.map((order, idx) => (
                                            viewMode === 'card' ? (
                        <div 
                            key={order['Order ID']} 
                            className={`${B_BG_PANEL} border ${B_BORDER} hover:border-[#FCD535]/30 group transition-all relative cursor-pointer`}
                            onClick={() => activeTab === 'Ready to Ship' ? toggleOrderSelection(order['Order ID']) : onView(order)}
                        >
                            {loadingActionId === order['Order ID'] && (
                                <div className="absolute inset-0 bg-[#0B0E11]/80 z-50 flex items-center justify-center"><Spinner size="sm" /></div>
                            )}
                            {activeTab === 'Ready to Ship' && (
                                <div className="absolute top-3 left-3 z-10">
                                    <div className={`w-5 h-5 border-2 rounded-sm transition-colors flex items-center justify-center ${selectedOrderIds.has(order['Order ID']) ? 'bg-[#FCD535] border-[#FCD535]' : 'border-gray-600 bg-black/20'}`}>
                                        {selectedOrderIds.has(order['Order ID']) && (
                                            <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className={`px-3 py-2 border-b ${B_BORDER} flex justify-between items-center ${activeTab === 'Ready to Ship' ? 'pt-10' : ''}`}>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-mono ${B_TEXT_SECONDARY}`}>{(idx + 1).toString().padStart(2, '0')}</span>
                                                            <span className={`text-xs font-mono font-medium ${B_TEXT_PRIMARY}`}>{order['Order ID'].substring(0, 10)}</span>
                                                        </div>
                                                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${order.Team === 'A' ? 'bg-blue-900/40 text-blue-400' : 'bg-purple-900/40 text-purple-400'}`}>T-{order.Team}</span>
                                                    </div>
                                                    
                                                    <div className="p-3 flex gap-3 flex-grow">
                                                        <img src={convertGoogleDriveUrl(order.Products[0]?.image)} className={`w-12 h-12 object-cover ${B_BG_MAIN} border ${B_BORDER} flex-shrink-0 rounded-sm`} alt="" />
                                                        <div className="flex flex-col flex-grow min-w-0">
                                                            <p className={`text-xs font-medium ${B_TEXT_PRIMARY} truncate uppercase`}>{order['Customer Name']}</p>
                                                            <p className={`text-[10px] font-mono ${B_TEXT_SECONDARY}`}>{order['Customer Phone']}</p>
                                                            <div className="flex justify-between items-end mt-auto pt-1">
                                                                <div className="flex flex-col">
                                                                    <span className={`text-[10px] ${B_TEXT_SECONDARY} truncate max-w-[80px]`}>{order.Location}</span>
                                                                    {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                                                                        <span className={`text-[9px] ${B_ACCENT} font-bold mt-0.5`}>D: {order['Driver Name'] || 'TBD'}</span>
                                                                    )}
                                                                </div>
                                                                {order['Package Photo URL'] && (
                                                                     <svg className={`w-4 h-4 mr-1 ${B_GREEN}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                )}
                                                                <span className={`text-xs font-mono font-bold ${B_GREEN}`}>${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={`p-2 border-t ${B_BORDER} bg-[#0B0E11] grid ${activeTab === 'Pending' || activeTab === 'Ready to Ship' ? 'grid-cols-2 gap-2' : 'grid-cols-1'}`}>
                                                        <button onClick={(e) => { e.stopPropagation(); onView(order); }} className={`w-full py-1.5 bg-[#2B3139] hover:bg-[#3B424A] ${B_TEXT_PRIMARY} text-[10px] font-medium transition-colors rounded-sm`}>Details</button>
                                                        {activeTab === 'Pending' && <button onClick={(e) => { e.stopPropagation(); onPack(order); }} className={`w-full py-1.5 ${B_ACCENT_BG} text-[10px] font-bold uppercase transition-colors rounded-sm`}>Pack</button>}
                                                        {activeTab === 'Ready to Ship' && <button onClick={(e) => { e.stopPropagation(); onShip(order); }} className={`w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold uppercase transition-colors rounded-sm`}>Ship</button>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={order['Order ID']} className={`${B_BG_PANEL} border ${B_BORDER} ${B_BG_HOVER} transition-colors grid grid-cols-12 items-center gap-2 p-2 relative group cursor-pointer`} onClick={() => onView(order)}>
                                                    {loadingActionId === order['Order ID'] && (
                                                        <div className="absolute inset-0 bg-[#0B0E11]/80 z-50 flex items-center justify-center"><Spinner size="sm" /></div>
                                                    )}
                                                    <div className="col-span-1 text-[10px] font-mono text-[#848E9C] pl-1">{(idx + 1).toString().padStart(2, '0')}</div>
                                                    <div className="col-span-4 flex items-center gap-3 w-min-0">
                                                        <img src={convertGoogleDriveUrl(order.Products[0]?.image)} className={`w-8 h-8 object-cover ${B_BG_MAIN} border ${B_BORDER} flex-shrink-0 rounded-sm`} alt="" />
                                                        <div className="min-w-0">
                                                            <p className={`text-xs font-medium ${B_TEXT_PRIMARY} truncate uppercase`}>{order['Customer Name']}</p>
                                                            <p className={`text-[10px] font-mono ${B_TEXT_SECONDARY} truncate`}>{order['Order ID'].substring(0,10)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 min-w-0">
                                                        <p className={`text-xs ${B_TEXT_PRIMARY} truncate`}>{order.Location}</p>
                                                        <div className="flex items-center gap-2">
                                                            <p className={`text-[9px] ${B_TEXT_SECONDARY} uppercase`}>{order.Team} Team</p>
                                                            {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                                                                <p className={`text-[9px] ${B_ACCENT} font-bold uppercase truncate`}>{order['Driver Name'] || 'TBD'}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <p className={`text-xs font-mono font-bold ${B_GREEN}`}>${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                                                        <p className={`text-[9px] uppercase ${order['Payment Status']?.toLowerCase() === 'paid' ? 'text-[#0ECB81]' : 'text-[#FCD535]'}`}>{order['Payment Status'] || 'Unpaid'}</p>
                                                    </div>
                                                    <div className="col-span-3 flex justify-end items-center gap-2">
                                                        <button onClick={(e) => { e.stopPropagation(); onView(order); }} className={`px-3 py-1 bg-[#2B3139] hover:bg-[#3B424A] ${B_TEXT_PRIMARY} text-[10px] font-medium rounded-sm transition-colors`}>View</button>
                                                        {activeTab === 'Pending' && <button onClick={(e) => { e.stopPropagation(); onPack(order); }} className={`px-4 py-1 ${B_ACCENT_BG} text-[10px] font-bold uppercase rounded-sm`}>Pack</button>}
                                                        {activeTab === 'Ready to Ship' && <button onClick={(e) => { e.stopPropagation(); onShip(order); }} className={`px-4 py-1 bg-amber-500 hover:bg-amber-400 text-[#0B0E11] text-[10px] font-bold uppercase rounded-sm`}>Ship</button>}
                                                    </div>
                                                </div>
                                            )
                                        ))}
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
