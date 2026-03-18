
import React, { useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { ParsedOrder } from '@/types';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';

interface TabletPackagingHubProps {
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

const TabletPackagingHub: React.FC<TabletPackagingHubProps> = ({
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
        <div className="flex h-screen bg-black text-white overflow-hidden font-custom">
            {/* Minimal Tablet Sidebar */}
            <aside className="w-20 flex flex-col p-2 gap-2 bg-black flex-shrink-0 border-r border-white/5">
                <div className="bg-[#121212] rounded-xl p-4 flex flex-col items-center gap-8 shadow-xl">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" strokeWidth={2.5}/></svg>
                    </div>
                    
                    <nav className="flex flex-col gap-4">
                        {[
                            { id: 'Pending', icon: '📥', label: 'Pending' },
                            { id: 'Ready to Ship', icon: '📦', label: 'Ready' },
                            { id: 'Shipped', icon: '🚚', label: 'Shipped' }
                        ].map(tab => (
                            <button 
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${activeTab === tab.id ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                                title={tab.label}
                            >
                                <span className="text-2xl">{tab.icon}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex-grow bg-[#121212] rounded-xl p-4 flex flex-col items-center gap-6 shadow-xl">
                    <div className="text-center">
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Packed</p>
                        <p className="text-base font-black text-[#1DB954] font-mono">{sessionStats.packed}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-1">Queue</p>
                        <p className="text-base font-black text-blue-400 font-mono">{orders.length}</p>
                    </div>
                    <div className="mt-auto flex flex-col gap-4">
                        <button onClick={onSwitchHub} title="Switch Hub" className="w-12 h-12 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl flex items-center justify-center border border-white/5 transition-all active:scale-95 shadow-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeWidth={3}/></svg>
                        </button>
                        <button onClick={onExit} title="Exit Hub" className="w-12 h-12 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl flex items-center justify-center border border-red-500/20 transition-all active:scale-95 shadow-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth={3}/></svg>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Tablet Main Content */}
            <main className="flex-1 flex flex-col bg-black overflow-hidden relative">
                <header className="flex-shrink-0 h-20 px-6 flex items-center justify-between relative z-10 backdrop-blur-md bg-black/40 border-b border-white/5">
                    <div className="flex items-center gap-4 flex-grow max-w-lg">
                        <div className="relative w-full">
                            <input 
                                type="text" 
                                placeholder="ស្វែងរក..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-transparent rounded-full text-sm font-bold text-white placeholder:text-gray-500 focus:bg-white/10 focus:border-white/10 transition-all outline-none"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>
                        <button onClick={() => setIsFilterModalOpen(true)} className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full border border-white/5 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        </button>
                    </div>
                    <div className="ml-4 flex flex-col items-end">
                        <h2 className="text-sm font-black text-white italic tracking-tight">{selectedStore}</h2>
                        <span className="text-xs font-black text-blue-400 uppercase tracking-widest">Active Stream</span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative z-10">
                    <div className="space-y-10 pb-20">
                        {Object.entries(groups).map(([date, groupOrders]) => (
                            <section key={date} className="space-y-4">
                                <h3 className="text-xl font-black text-white italic tracking-tight px-2">{date}</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupOrders.map((order, idx) => (
                                        <div key={order['Order ID']} className="group bg-[#181818] p-4 rounded-xl transition-all relative border border-white/5 flex flex-col gap-4">
                                            {loadingActionId === order['Order ID'] && (
                                                <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center rounded-xl backdrop-blur-sm"><Spinner /></div>
                                            )}
                                            
                                            <div className="relative aspect-video rounded-lg overflow-hidden shadow-lg">
                                                <img 
                                                    src={convertGoogleDriveUrl(order.Products[0]?.image)} 
                                                    className="w-full h-full object-cover" 
                                                    alt="" 
                                                    onClick={() => showFullImage(convertGoogleDriveUrl(order.Products[0]?.image))}
                                                />
                                                {/* Serial Number Badge */}
                                                <div className="absolute top-2 right-2 w-6 h-6 bg-black/60 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/10 z-20">
                                                    <span className="text-[11px] font-black text-white">{idx + 1}</span>
                                                </div>
                                                <div className="absolute top-2 left-2 flex gap-1">
                                                    <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${order.Team === 'A' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>{order.Team}</span>
                                                </div>
                                            </div>

                                            <div className="min-w-0">
                                                <h4 className="text-white font-black text-xs truncate uppercase tracking-tight">{order['Customer Name']}</h4>
                                                <p className="text-gray-400 text-xs font-mono">{order['Customer Phone']}</p>
                                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                                                    <span className="text-[#1DB954] font-mono font-black text-xs">${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => onView(order)} className="p-1.5 bg-white/5 text-gray-500 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg></button>
                                                        {activeTab === 'Pending' && <button onClick={() => onPack(order)} className="p-1.5 bg-[#1DB954] text-black rounded-lg"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg></button>}
                                                        {activeTab === 'Ready to Ship' && <button onClick={() => onShip(order)} className="p-1.5 bg-amber-500 text-black rounded-lg"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>}
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
