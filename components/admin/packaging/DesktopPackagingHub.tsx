
import React, { useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { ParsedOrder } from '@/types';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

interface DesktopPackagingHubProps {
    orders: ParsedOrder[];
    activeTab: string;
    setActiveTab: (tab: any) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    onPack: (order: ParsedOrder) => void;
    onShip: (order: ParsedOrder) => void;
    onView: (order: ParsedOrder) => void;
    onSwitchHub: () => void;
    onExit: () => void;
    selectedStore: string;
    sessionStats: { packed: number, startTime: number };
    viewMode: 'card' | 'list';
    setViewMode: (mode: 'card' | 'list') => void;
    setIsFilterModalOpen: (open: boolean) => void;
    loadingActionId: string | null;
}

const DesktopPackagingHub: React.FC<DesktopPackagingHubProps> = ({
    orders, activeTab, setActiveTab, searchTerm, setSearchTerm,
    onPack, onShip, onView, onSwitchHub, onExit, selectedStore,
    sessionStats, viewMode, setViewMode, setIsFilterModalOpen, loadingActionId
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
                const date = order.Timestamp ? getSafeDateObj(order.Timestamp).toLocaleDateString('km-KH', { month: 'short', day: 'numeric' }) : 'ថ្មីៗ';
                if (!result[date]) result[date] = [];
                result[date].push(order);
            });
        } else {
            result['បញ្ជីឥវ៉ាន់'] = sorted;
        }
        return result;
    }, [orders, activeTab]);

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden font-custom">
            {/* Left Sidebar (Spotify Style) */}
            <aside className="w-72 flex flex-col p-2 gap-2 bg-black flex-shrink-0 border-r border-white/5">
                <div className="bg-[#121212] rounded-xl p-6 flex flex-col gap-6 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth={2.5}/></svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tighter uppercase italic">Packaging Hub</h2>
                            <p className="text-xs text-gray-400 font-black tracking-widest uppercase">{selectedStore}</p>
                        </div>
                    </div>
                    
                    <nav className="flex flex-col gap-1">
                        {[
                            { id: 'Pending', label: 'រង់ចាំវេចខ្ចប់', icon: '📥', count: orders.filter(o => o.FulfillmentStatus === 'Pending').length },
                            { id: 'Ready to Ship', label: 'ខ្ចប់រួចរាល់', icon: '📦', count: orders.filter(o => o.FulfillmentStatus === 'Ready to Ship').length },
                            { id: 'Shipped', label: 'បានបញ្ចេញ', icon: '🚚', count: orders.filter(o => o.FulfillmentStatus === 'Shipped').length }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 group ${activeTab === tab.id ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-xl group-hover:scale-110 transition-transform">{tab.icon}</span>
                                    <span className="text-[14px] font-black uppercase tracking-wider">{tab.label}</span>
                                </div>
                                {tab.count > 0 && <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400'}`}>{tab.count}</span>}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex-grow bg-[#121212] rounded-xl p-6 flex flex-col gap-6 shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">Operational Stats</h3>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981]"></div>
                    </div>
                    <div className="space-y-6 overflow-y-auto no-scrollbar">
                        <div className="bg-black/40 p-6 rounded-2xl border border-white/5 shadow-inner">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Packed Session</p>
                            <p className="text-4xl font-black text-[#1DB954] font-mono tracking-tighter">{sessionStats.packed}</p>
                            <div className="h-1.5 w-full bg-white/5 rounded-full mt-4 overflow-hidden">
                                <div className="h-full bg-[#1DB954] shadow-[0_0_10px_rgba(29,185,84,0.5)]" style={{ width: '45%' }}></div>
                            </div>
                        </div>
                        <div className="bg-black/40 p-6 rounded-2xl border border-white/5 shadow-inner">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Queue Load</p>
                            <p className="text-4xl font-black text-blue-400 font-mono tracking-tighter">{orders.length}</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-auto">
                        <button onClick={onSwitchHub} className="py-4 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-black uppercase text-xs tracking-[0.2em] border border-white/5 transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeWidth={3}/></svg>
                            Switch Hub
                        </button>
                        <button onClick={onExit} className="py-4 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl font-black uppercase text-xs tracking-[0.2em] border border-red-500/20 transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={3}/></svg>
                            Exit Hub
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content (Spotify Style) */}
            <main className="flex-1 flex flex-col bg-black overflow-hidden relative">
                {/* Gradient Header Overlay */}
                <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-blue-900/20 via-transparent to-transparent pointer-events-none"></div>

                {/* Top Toolbar */}
                <header className="flex-shrink-0 h-20 px-8 flex items-center justify-between relative z-10 backdrop-blur-md bg-black/40 border-b border-white/5">
                    <div className="flex items-center gap-6 flex-grow max-w-2xl">
                        <div className="relative w-full group">
                            <input 
                                type="text" 
                                placeholder="ស្វែងរកតាមឈ្មោះ លេខទូរស័ព្ទ ឬលេខសម្គាល់..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-6 py-3.5 bg-white/5 border border-transparent rounded-full text-sm font-bold text-white placeholder:text-gray-500 focus:bg-white/10 focus:border-white/10 transition-all outline-none shadow-2xl"
                            />
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <button onClick={() => setIsFilterModalOpen(true)} className="p-3.5 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/5 transition-all shadow-xl active:scale-95">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex bg-white/5 p-1 rounded-full border border-white/5">
                            <button onClick={() => setViewMode('card')} className={`p-2.5 rounded-full transition-all ${viewMode === 'card' ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-white'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg></button>
                            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-white'}`}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg></button>
                        </div>
                    </div>
                </header>

                {/* Scrollable Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-4 relative z-10">
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[60vh] gap-6 text-gray-500 opacity-30">
                            <span className="text-9xl">📦</span>
                            <p className="text-xl font-black uppercase tracking-[0.4em]">Empty Operations</p>
                        </div>
                    ) : (
                        <div className="space-y-12 pb-20">
                            {Object.entries(groups).map(([date, groupOrders]) => (
                                <section key={date} className="space-y-6">
                                    <div className="flex items-center gap-4 px-2">
                                        <h2 className="text-2xl font-black text-white italic tracking-tight">{date}</h2>
                                        <div className="flex-grow h-px bg-white/5"></div>
                                        <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{groupOrders.length} items</span>
                                    </div>

                                    <div className={viewMode === 'card' 
                                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 min-[1900px]:grid-cols-5 gap-6" 
                                        : "flex flex-col gap-2"
                                    }>
                                        {groupOrders.map((order, idx) => (
                                            viewMode === 'card' ? (
                                                <div key={order['Order ID']} className="group bg-[#181818] hover:bg-[#282828] p-5 rounded-2xl transition-all duration-500 shadow-2xl relative border border-transparent hover:border-white/5">
                                                    {loadingActionId === order['Order ID'] && (
                                                        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center rounded-2xl backdrop-blur-sm"><Spinner /></div>
                                                    )}
                                                    
                                                    <div className="relative aspect-square mb-5 rounded-xl overflow-hidden shadow-2xl group/img">
                                                        <img 
                                                            src={convertGoogleDriveUrl(order.Products[0]?.image)} 
                                                            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110" 
                                                            alt="" 
                                                        />
                                                        {/* Serial Number Badge */}
                                                        <div className="absolute top-3 left-3 w-7 h-7 bg-black/60 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/10 z-20">
                                                            <span className="text-xs font-black text-white">{idx + 1}</span>
                                                        </div>
                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                            <button onClick={() => showFullImage(convertGoogleDriveUrl(order.Products[0]?.image))} className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center shadow-xl active:scale-90 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                                            </button>
                                                            <button onClick={() => onView(order)} className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xl active:scale-90 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 delay-75">
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            </button>
                                                        </div>
                                                        {activeTab === 'Pending' && (
                                                            <button 
                                                                onClick={() => onPack(order)}
                                                                className="absolute bottom-4 right-4 w-12 h-12 bg-[#1DB954] text-black rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(29,185,84,0.5)] transform translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 active:scale-95"
                                                            >
                                                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                            </button>
                                                        )}
                                                        {activeTab === 'Ready to Ship' && (
                                                            <button 
                                                                onClick={() => onShip(order)}
                                                                className="absolute bottom-4 right-4 w-12 h-12 bg-amber-500 text-black rounded-full flex items-center justify-center shadow-[0_8px_25px_rgba(245,158,11,0.5)] transform translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 active:scale-95"
                                                            >
                                                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded ${order.Team === 'A' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'}`}>{order.Team} TEAM</span>
                                                            <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded ${order['Payment Status']?.toLowerCase() === 'paid' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'}`}>
                                                                {order['Payment Status'] || 'Unpaid'}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-white font-black text-sm truncate uppercase tracking-tight pt-1">{order['Customer Name']}</h4>
                                                        <p className="text-gray-400 text-[11px] font-mono">{order['Customer Phone']}</p>
                                                        <div className="pt-2 flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 font-bold truncate max-w-[120px]">{order.Location}</span>
                                                            <span className="text-white font-mono font-black text-[11px]">${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={order['Order ID']} className="group bg-[#181818] hover:bg-[#282828] p-3 rounded-xl transition-all flex items-center gap-5 border border-transparent hover:border-white/5">
                                                    <div className="w-8 flex-shrink-0 text-center">
                                                        <span className="text-[11px] font-black text-gray-500 font-mono">{idx + 1}</span>
                                                    </div>
                                                    <img src={convertGoogleDriveUrl(order.Products[0]?.image)} className="w-12 h-12 rounded-lg object-cover shadow-lg" alt="" />
                                                    <div className="flex-grow min-w-0 grid grid-cols-4 items-center gap-6">
                                                        <div className="col-span-1 min-w-0">
                                                            <h4 className="text-white font-black text-sm truncate uppercase tracking-tight">{order['Customer Name']}</h4>
                                                            <p className="text-gray-500 text-xs font-mono">{order['Customer Phone']}</p>
                                                        </div>
                                                        <div className="col-span-1">
                                                            <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest">Location</p>
                                                            <p className="text-white text-xs font-bold truncate">{order.Location}</p>
                                                        </div>
                                                        <div className="col-span-1">
                                                            <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest">Payment</p>
                                                            <p className={`text-xs font-black uppercase ${order['Payment Status']?.toLowerCase() === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>{order['Payment Status'] || 'Unpaid'}</p>
                                                        </div>
                                                        <div className="col-span-1 text-right">
                                                            <p className="text-white font-mono font-black text-sm">${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {activeTab === 'Pending' && <button onClick={() => onPack(order)} className="px-4 py-2 bg-[#1DB954] text-black rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg">Pack</button>}
                                                        {activeTab === 'Ready to Ship' && <button onClick={() => onShip(order)} className="px-4 py-2 bg-amber-500 text-black rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg">Ship</button>}
                                                        <button onClick={() => onView(order)} className="p-2.5 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all border border-white/5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 5v.01M12 12v.01M12 19v.01" strokeWidth={3}/></svg></button>
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
