import React, { useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { ParsedOrder } from '@/types';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl, getOptimisticPackagePhoto } from '@/utils/fileUtils';

const B_BG_MAIN = 'bg-[#0B0E11]';
const B_BG_PANEL = 'bg-[#181A20]';
const B_BORDER = 'border-[#2B3139]';
const B_TEXT_PRIMARY = 'text-[#EAECEF]';
const B_TEXT_SECONDARY = 'text-[#848E9C]';
const B_ACCENT = 'text-[#FCD535]';
const B_GREEN = 'text-[#0ECB81]';

interface MobilePackagingHubProps {
    orders: ParsedOrder[];
    activeTab: string;
    setActiveTab: (tab: any) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onPack: (order: ParsedOrder) => void;
    onShip: (order: ParsedOrder) => void;
    onUndo: (order: ParsedOrder) => void;
    onUndoShipped: (order: ParsedOrder) => void;
    onView: (order: ParsedOrder) => void;
    onPrintManifest: () => void;
    onSwitchHub: () => void;
    onExit: () => void;
    selectedStore: string;
    progressStats: { packedByUserToday: number, storeTotalToday: number, progressPercentage: number };
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

const MobilePackagingHub: React.FC<MobilePackagingHubProps> = ({
    orders, activeTab, setActiveTab, searchTerm, setSearchTerm,
    onPack, onShip, onUndo, onUndoShipped, onView, onPrintManifest, onSwitchHub, onExit, selectedStore,
    progressStats, setIsFilterModalOpen, loadingActionId, tabCounts,
    selectedOrderIds, toggleOrderSelection, clearSelection, onBulkShip, isBulkProcessing,
    onToggleSelectAll
}) => {
    const { previewImage: showFullImage } = useContext(AppContext);

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
        <div className={`flex flex-col h-screen ${B_BG_MAIN} font-sans`}>
            {/* Minimal Mobile Header */}
            <div className={`flex-shrink-0 border-b ${B_BORDER} ${B_BG_PANEL}`}>
                <div className="flex items-center justify-between p-3">
                    <div>
                        <h2 className={`text-sm font-bold ${B_ACCENT}`}>HUB OPS</h2>
                        <span className={`text-[10px] font-bold ${B_TEXT_SECONDARY} uppercase`}>{selectedStore}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onSwitchHub} className={`p-1.5 ${B_BG_MAIN} border ${B_BORDER} rounded-sm text-[#848E9C]`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeWidth={2}/></svg>
                        </button>
                        <button onClick={onExit} className={`p-1.5 bg-[#F6465D]/10 text-[#F6465D] border border-[#F6465D]/20 rounded-sm`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={2}/></svg>
                        </button>
                    </div>
                </div>

                <div className="flex">
                    {[
                        { id: 'Pending', label: 'Pending', count: tabCounts.pending },
                        { id: 'Ready to Ship', label: 'Ready', count: tabCounts.ready },
                        { id: 'Shipped', label: 'Shipped', count: tabCounts.shipped }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex flex-col items-center justify-center flex-1 py-1 border-b-2 transition-colors ${activeTab === tab.id ? `border-[#FCD535] text-[#FCD535]` : `border-transparent ${B_TEXT_SECONDARY}`}`}
                        >
                            <span className="text-[11px] font-bold uppercase">{tab.label}</span>
                            <span className={`text-[10px] font-mono mt-0.5 ${activeTab === tab.id ? 'text-[#FCD535]' : 'text-[#848E9C]'}`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Sticky Mobile Search/Filter */}
            <div className={`flex-shrink-0 p-3 border-b ${B_BORDER} ${B_BG_MAIN} flex gap-2 sticky z-20 shadow-md`}>
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        placeholder="Search operations..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-8 pr-3 py-2 ${B_BG_PANEL} border ${B_BORDER} rounded-sm text-xs ${B_TEXT_PRIMARY} placeholder:text-[#848E9C] focus:border-[#FCD535] outline-none transition-colors`}
                    />
                    <div className={`absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none ${B_TEXT_SECONDARY}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
                <button onClick={() => setIsFilterModalOpen(true)} className={`px-3 py-2 ${B_BG_PANEL} border ${B_BORDER} rounded-sm ${B_TEXT_SECONDARY} flex items-center justify-center`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                </button>
                {activeTab === 'Ready to Ship' && (
                    <div className="flex items-center gap-2">
                        {orders.length > 0 && (
                            <button 
                                onClick={() => onToggleSelectAll(orders)}
                                className={`p-2 bg-[#181A20] border ${orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'border-[#FCD535] text-[#FCD535]' : 'border-[#2B3139] text-[#848E9C]'} rounded-sm flex items-center gap-1 transition-colors`}
                            >
                                <span className="text-[9px] font-bold uppercase">{orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'None' : 'All'}</span>
                            </button>
                        )}
                        <button onClick={onPrintManifest} className={`p-2 bg-[#181A20] border border-[#FCD535]/30 rounded-sm hover:border-[#FCD535] transition-all`}>
                            <svg className="w-4 h-4 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </button>
                        {activeTab === 'Ready to Ship' && selectedOrderIds.size > 0 && (
                            <button 
                                onClick={onBulkShip}
                                disabled={isBulkProcessing}
                                className={`px-4 py-2 bg-[#0ECB81] hover:bg-[#0CA66B] text-[#0B0E11] text-[10px] font-bold rounded-sm flex items-center gap-2 transition-all animate-fade-in-down whitespace-nowrap`}
                            >
                                {isBulkProcessing ? <Spinner size="sm" /> : (
                                    <>
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        SHIP ({selectedOrderIds.size})
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Scrollable Order List */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar p-3 relative z-10 space-y-4 pb-24`}>
                {Object.entries(groups).map(([date, groupOrders]: [string, any]) => (
                    <div key={date}>
                        <h3 className={`text-[10px] font-bold ${B_TEXT_SECONDARY} uppercase border-b ${B_BORDER} pb-1 mb-2 px-1`}>{date}</h3>
                        <div className="space-y-2">
                            {groupOrders.map((order: ParsedOrder) => (
                                <div 
                                    key={order['Order ID']} 
                                    className={`${B_BG_PANEL} border ${B_BORDER} flex flex-col relative transition-all ${selectedOrderIds.has(order['Order ID']) ? 'border-[#FCD535]/50 bg-[#FCD535]/5 shadow-[0_4px_12px_rgba(252,213,53,0.05)]' : ''}`}
                                    onClick={() => onView(order)}
                                >
                                    {loadingActionId === order['Order ID'] && (
                                        <div className={`absolute inset-0 ${B_BG_MAIN}/80 z-50 flex items-center justify-center`}><Spinner size="sm" /></div>
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

                                    <div className={`px-3 py-2 border-b ${B_BORDER} flex justify-between items-center ${activeTab === 'Ready to Ship' ? 'pt-10' : ''}`}>
                                        <span className={`text-xs font-mono font-medium ${B_TEXT_PRIMARY}`}>{order['Order ID'].substring(0, 10)}</span>
                                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm border ${B_BORDER} ${B_TEXT_SECONDARY}`}>T-{order.Team}</span>
                                    </div>

                                    <div className="p-3">
                                        <div className="flex gap-3">
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <h4 className={`text-sm font-bold ${B_TEXT_PRIMARY} truncate uppercase flex items-center gap-1`}>
                                                    {order['Customer Name']}
                                                    {getOptimisticPackagePhoto(order['Order ID'], order['Package Photo']) && <span title="Photo Verified" className="text-[10px]">📸</span>}
                                                </h4>
                                                <div className="flex justify-between items-center mt-0.5">
                                                    <p className={`text-[11px] ${B_TEXT_SECONDARY} font-mono`}>{order['Customer Phone']}</p>
                                                    {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                                                        <p className={`text-[9px] ${B_ACCENT} font-bold uppercase truncate max-w-[80px]`}>{order['Driver Name'] || 'TBD'}</p>
                                                    )}
                                                </div>
                                                <p className={`text-[11px] ${B_TEXT_SECONDARY} mt-2 truncate max-w-[150px]`}>{order.Location}</p>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <p className={`text-sm font-mono font-bold ${B_GREEN}`}>${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                                                <span className={`mt-1 text-[9px] font-bold uppercase rounded-sm border ${B_BORDER} px-1 text-center min-w-[50px]
                                                    ${order['Payment Status']?.toLowerCase() === 'paid' ? 'text-[#0ECB81]' : 'text-[#FCD535]'}
                                                `}>
                                                    {order['Payment Status'] || 'Unpaid'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`p-2 border-t ${B_BORDER} flex gap-2`}>
                                        <button onClick={(e) => { e.stopPropagation(); onView(order); }} className={`flex-1 py-1.5 bg-[#2B3139] text-[#EAECEF] rounded-sm text-xs font-medium`}>View Info</button>
                                        {activeTab === 'Pending' && <button onClick={(e) => { e.stopPropagation(); onPack(order); }} className={`flex-1 py-1.5 bg-[#FCD535] text-[#0B0E11] rounded-sm text-xs font-bold uppercase`}>Pack Order</button>}
                                        {activeTab === 'Ready to Ship' && (
                                            <>
                                                <button onClick={(e) => { e.stopPropagation(); onUndo(order); }} className={`w-20 py-1.5 bg-[#F6465D]/10 text-[#F6465D] rounded-sm text-[10px] font-bold uppercase`}>Undo</button>
                                                <button onClick={(e) => { e.stopPropagation(); onShip(order); }} className={`flex-1 py-1.5 bg-[#0ECB81] text-[#0B0E11] rounded-sm text-xs font-bold uppercase`}>Ship Order</button>
                                            </>
                                        )}
                                        {activeTab === 'Shipped' && (
                                            <button onClick={(e) => { e.stopPropagation(); onUndoShipped(order); }} className={`w-20 py-1.5 bg-[#F6465D]/10 text-[#F6465D] rounded-sm text-[10px] font-bold uppercase`}>Undo</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Sticky Bottom Stats Nav */}
            <div className={`fixed bottom-0 left-0 right-0 h-16 ${B_BG_PANEL} border-t ${B_BORDER} z-40 px-4 flex items-center justify-between`}>
                <div className="flex flex-col">
                    <span className={`text-[10px] font-bold ${B_TEXT_SECONDARY} uppercase`}>Packs Authored</span>
                    <span className={`text-lg font-mono font-bold ${B_GREEN}`}>{progressStats.packedByUserToday}</span>
                </div>
                
                <div className="flex flex-col items-end w-32 border-l border-[#2B3139] pl-3">
                    <div className="flex justify-between w-full text-[10px] uppercase font-bold mb-1">
                        <span className={B_TEXT_SECONDARY}>Hub Sync</span>
                        <span className={B_GREEN}>{progressStats.progressPercentage}%</span>
                    </div>
                    <div className={`h-1.5 w-full ${B_BG_MAIN} overflow-hidden rounded-full`}>
                        <div className="h-full bg-[#0ECB81] transition-all duration-1000" style={{ width: `${progressStats.progressPercentage}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobilePackagingHub;
