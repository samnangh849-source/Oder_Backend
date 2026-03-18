
import React, { useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { ParsedOrder } from '@/types';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

interface MobilePackagingHubProps {
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
    setIsFilterModalOpen: (open: boolean) => void;
    loadingActionId: string | null;
}

const MobilePackagingHub: React.FC<MobilePackagingHubProps> = ({
    orders, activeTab, setActiveTab, searchTerm, setSearchTerm,
    onPack, onShip, onView, onSwitchHub, onExit, selectedStore,
    sessionStats, setIsFilterModalOpen, loadingActionId
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
        <div className="flex flex-col h-screen bg-black text-white overflow-hidden font-custom">
            {/* Gradient Header */}
            <header className="flex-shrink-0 pt-12 pb-6 px-6 bg-gradient-to-b from-blue-900/40 to-black">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-white italic tracking-tight">Packaging Hub</h2>
                        <p className="text-[11px] text-blue-400 font-black uppercase tracking-widest">{selectedStore}</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onSwitchHub} title="Switch Hub" className="w-11 h-11 bg-white/10 rounded-xl flex items-center justify-center border border-white/5 active:scale-90 shadow-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeWidth={3}/></svg>
                        </button>
                        <button onClick={onExit} title="Exit Hub" className="w-11 h-11 bg-red-600/20 text-red-400 rounded-xl flex items-center justify-center border border-red-500/30 active:scale-90 shadow-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={3}/></svg>
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
                    {[
                        { id: 'Pending', label: 'រង់ចាំវេចខ្ចប់', icon: '📥' },
                        { id: 'Ready to Ship', label: 'ខ្ចប់រួចរាល់', icon: '📦' },
                        { id: 'Shipped', label: 'បានបញ្ចេញ', icon: '🚚' }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-3 rounded-full whitespace-nowrap text-[12px] font-black uppercase tracking-widest border transition-all ${activeTab === tab.id ? 'bg-white text-black border-white shadow-xl' : 'bg-white/5 text-gray-400 border-white/5'}`}
                        >
                            <span className="mr-2 text-base">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Sticky Search Bar */}
            <div className="px-6 py-5 bg-black/80 backdrop-blur-xl border-b border-white/5 flex gap-3">
                <div className="relative flex-grow">
                    <input 
                        type="text" 
                        placeholder="ស្វែងរក..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-white/10 border-transparent rounded-2xl text-sm font-bold text-white placeholder:text-gray-500 focus:bg-white/15 transition-all outline-none shadow-inner"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3.5}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
                <button onClick={() => setIsFilterModalOpen(true)} className="w-14 h-14 bg-white/10 text-white rounded-2xl flex items-center justify-center border border-white/5 active:scale-95 shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                </button>
            </div>

            {/* Mobile Scrollable Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="space-y-12 pb-32">
                    {Object.entries(groups).map(([date, groupOrders]) => (
                        <section key={date} className="space-y-4">
                            <h3 className="text-xl font-black text-white italic tracking-tight">{date}</h3>
                            <div className="space-y-4">
                                {groupOrders.map((order, idx) => (
                                    <div key={order['Order ID']} className="group bg-[#121212] active:bg-[#1a1a1a] p-4 rounded-2xl transition-all relative flex gap-4 shadow-xl border border-white/5">
                                        {loadingActionId === order['Order ID'] && (
                                            <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center rounded-2xl backdrop-blur-sm"><Spinner /></div>
                                        )}
                                        
                                        <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden shadow-lg relative" onClick={() => showFullImage(convertGoogleDriveUrl(order.Products[0]?.image))}>
                                            <img 
                                                src={convertGoogleDriveUrl(order.Products[0]?.image)} 
                                                className="w-full h-full object-cover" 
                                                alt="" 
                                            />
                                            {/* Serial Number Badge */}
                                            <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-black/60 backdrop-blur-md rounded-md flex items-center justify-center border border-white/10 z-20">
                                                <span className="text-xs font-black text-white">{idx + 1}</span>
                                            </div>
                                        </div>

                                        <div className="flex-grow min-w-0 flex flex-col justify-between py-1">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${order.Team === 'A' ? 'bg-blue-600' : 'bg-purple-600'}`}>{order.Team} TEAM</span>
                                                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${order['Payment Status']?.toLowerCase() === 'paid' ? 'bg-[#1DB954]/20 text-[#1DB954]' : 'bg-amber-600/20 text-amber-400'}`}>{order['Payment Status'] || 'Unpaid'}</span>
                                                </div>
                                                <h4 className="text-white font-black text-xs truncate uppercase tracking-tight">{order['Customer Name']}</h4>
                                                <p className="text-gray-500 text-xs font-mono">{order['Customer Phone']}</p>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[#1DB954] font-mono font-black text-[11px]">${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => onView(order)} className="p-2 bg-white/5 text-gray-500 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={3}/></svg></button>
                                                    {activeTab === 'Pending' && <button onClick={() => onPack(order)} className="px-4 py-2 bg-[#1DB954] text-black rounded-lg text-[11px] font-black uppercase tracking-widest">Pack</button>}
                                                    {activeTab === 'Ready to Ship' && <button onClick={() => onShip(order)} className="px-4 py-2 bg-amber-500 text-black rounded-lg text-[11px] font-black uppercase tracking-widest">Ship</button>}
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

            {/* Mobile Footer Stats */}
            <footer className="flex-shrink-0 bg-black/90 backdrop-blur-2xl border-t border-white/5 p-6 pb-10 flex justify-around items-center">
                <div className="text-center">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Session Packed</p>
                    <p className="text-xl font-black text-[#1DB954] font-mono tracking-tighter">{sessionStats.packed}</p>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div className="text-center">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Remaining</p>
                    <p className="text-xl font-black text-blue-400 font-mono tracking-tighter">{orders.filter(o => o.FulfillmentStatus === 'Pending').length}</p>
                </div>
            </footer>
        </div>
    );
};

export default MobilePackagingHub;
