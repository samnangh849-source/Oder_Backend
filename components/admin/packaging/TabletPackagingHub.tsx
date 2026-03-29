import React, { useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { ParsedOrder } from '@/types';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

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

const TabletPackagingHub: React.FC<TabletPackagingHubProps> = ({
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
        <div className={`flex h-screen ${B_BG_MAIN} font-sans`}>
            {/* Slim Technical Sidebar */}
            <aside className={`w-16 flex flex-col flex-shrink-0 border-r ${B_BORDER} ${B_BG_PANEL}`}>
                <div className={`h-14 flex items-center justify-center border-b ${B_BORDER} text-[#FCD535] font-bold text-xs`}>
                    OP
                </div>
                
                <nav className="flex flex-col py-2 gap-2 mt-2">
                    {[
                        { id: 'Pending', icon: '📥', label: 'Pending', count: tabCounts.pending },
                        { id: 'Ready to Ship', icon: '📦', label: 'Ready', count: tabCounts.ready },
                        { id: 'Shipped', icon: '🚚', label: 'Shipped', count: tabCounts.shipped }
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
                        <div className="relative w-full">
                            <input 
                                type="text" 
                                placeholder="Query..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className={`w-full pl-8 pr-3 py-1.5 ${B_BG_MAIN} border ${B_BORDER} rounded-sm text-xs ${B_TEXT_PRIMARY} placeholder:text-[#848E9C] focus:border-[#FCD535] outline-none transition-colors`}
                            />
                            <div className={`absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none ${B_TEXT_SECONDARY}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <button onClick={() => setIsFilterModalOpen(true)} className={`px-2 py-1.5 ${B_BG_MAIN} border ${B_BORDER} rounded-sm text-[#848E9C] hover:text-[#EAECEF] transition-colors`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        </button>
                        {activeTab === 'Ready to Ship' && (
                            <div className="flex items-center gap-3">
                                {orders.length > 0 && (
                                    <button 
                                        onClick={() => onToggleSelectAll(orders)}
                                        className={`px-3 py-2 border ${orders.every(o => selectedOrderIds.has(o['Order ID'])) ? 'bg-[#FCD535] border-[#FCD535] text-black' : 'border-[#2B3139] text-[#848E9C]'} text-[10px] font-bold rounded-sm uppercase tracking-wider transition-colors whitespace-nowrap`}
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
                    <div className="ml-4 flex flex-col items-end">
                        <span className={`text-[10px] font-bold ${B_ACCENT} uppercase`}>{selectedStore}</span>
                    </div>
                </header>

                <div className={`flex-1 overflow-y-auto custom-scrollbar p-5 relative z-10`}>
                    <div className="space-y-6 pb-20">
                        {Object.entries(groups).map(([date, groupOrders]: [string, any]) => (
                            <section key={date} className="space-y-3">
                                <h3 className={`text-xs font-bold ${B_TEXT_PRIMARY} border-b ${B_BORDER} pb-1 px-1`}>{date}</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {groupOrders.map((order, idx) => (
                                        <div 
                            key={order['Order ID']} 
                            className={`${B_BG_PANEL} border ${B_BORDER} flex flex-col relative group cursor-pointer ${selectedOrderIds.has(order['Order ID']) ? 'ring-1 ring-[#FCD535]/50' : ''}`}
                            onClick={() => activeTab === 'Ready to Ship' ? toggleOrderSelection(order['Order ID']) : onView(order)}
                        >
                            {activeTab === 'Ready to Ship' && (
                                <div className="absolute top-4 left-4 z-10">
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
                                                    <span className={`text-[10px] font-mono ${B_TEXT_SECONDARY}`}>{(idx + 1).toString().padStart(2, '0')}</span>
                                                    <span className={`text-[11px] font-mono font-medium ${B_TEXT_PRIMARY}`}>{order['Order ID'].substring(0, 10)}</span>
                                                </div>
                                                <span className={`text-[8px] uppercase font-bold px-1 rounded-sm border ${B_BORDER} ${B_TEXT_SECONDARY}`}>{order.Team}</span>
                                            </div>

                                            <div className="px-2 pb-2">
                                                <h4 className={`text-xs font-bold ${B_TEXT_PRIMARY} truncate uppercase flex items-center gap-2`}>
                                                    {order['Customer Name']}
                                                    {order['Package Photo URL'] && <span title="Photo Verified">📸</span>}
                                                </h4>
                                                <div className="flex justify-between items-center mt-0.5">
                                                    <p className={`text-[10px] ${B_TEXT_SECONDARY} font-mono`}>{order['Customer Phone']}</p>
                                                    {(activeTab === 'Ready to Ship' || activeTab === 'Shipped') && (
                                                        <p className={`text-[9px] ${B_ACCENT} font-bold uppercase truncate max-w-[80px]`}>{order['Driver Name'] || 'TBD'}</p>
                                                    )}
                                                </div>
                                                <div className={`flex justify-between items-center mt-2 pt-2 border-t ${B_BORDER}`}>
                                                    <span className={`text-[11px] font-mono font-bold text-[#0ECB81]`}>${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                                                    <div className="flex gap-1">
                                                        <button onClick={(e) => { e.stopPropagation(); onView(order); }} className={`px-2 py-1 bg-[#2B3139] text-[#EAECEF] rounded-sm text-[10px]`}>View</button>
                                                        {activeTab === 'Pending' && <button onClick={(e) => { e.stopPropagation(); onPack(order); }} className={`px-3 py-1 bg-[#FCD535] text-[#0B0E11] rounded-sm text-[10px] font-bold uppercase`}>Pack</button>}
                                                        {activeTab === 'Ready to Ship' && (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); onUndo(order); }} className={`px-2 py-1 bg-[#F6465D]/10 text-[#F6465D] rounded-sm text-[10px] font-bold uppercase`}>Undo</button>
                                                                <button onClick={(e) => { e.stopPropagation(); onShip(order); }} className={`px-3 py-1 bg-[#0ECB81] text-[#0B0E11] rounded-sm text-[10px] font-bold uppercase`}>Ship</button>
                                                            </>
                                                        )}
                                                        {activeTab === 'Shipped' && (
                                                            <button onClick={(e) => { e.stopPropagation(); onUndoShipped(order); }} className={`px-2 py-1 bg-[#F6465D]/10 text-[#F6465D] rounded-sm text-[10px] font-bold uppercase`}>Undo</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default TabletPackagingHub;
