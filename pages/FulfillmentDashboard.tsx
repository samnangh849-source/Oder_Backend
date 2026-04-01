import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import { useFulfillment } from '@/hooks/useFulfillment';
import Spinner from '@/components/common/Spinner';
import { convertGoogleDriveUrl } from '@/utils/fileUtils';
import { ParsedOrder, FulfillmentStatus } from '@/types';
import Modal from '@/components/common/Modal';

const tClasses = {
    surface: 'bg-[#1E2329] border border-[#2B3139]',
    surfaceHover: 'hover:bg-[#2B3139] transition-colors duration-200',
    input: 'bg-[#0B0E11] border border-[#2B3139] focus:border-[#FCD535] outline-none text-xs px-3 py-2 rounded-[2px] text-[#EAECEF]',
    btnYellow: 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-[#0B0E11] font-bold rounded-[2px] px-4 py-2 transition-all active:scale-[0.98]',
    btnGhost: 'bg-transparent border border-[#2B3139] text-[#EAECEF] hover:bg-[#2B3139] rounded-[2px] px-4 py-2 transition-all',
};

const OrderNode: React.FC<{ 
    order: ParsedOrder; 
    isLoading: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onView: (order: ParsedOrder) => void;
}> = ({ order, isLoading, isSelected, onSelect, onView }) => {
    const status = order.FulfillmentStatus || 'Pending';
    const statusColor = status === 'Delivered' ? 'text-[#0ECB81]' : status === 'Shipped' ? 'text-[#FCD535]' : 'text-[#848E9C]';

    return (
        <div 
            className={`${tClasses.surface} ${tClasses.surfaceHover} p-4 cursor-pointer relative group ${isSelected ? 'border-[#FCD535]/50' : ''}`}
            onClick={() => onView(order)}
        >
            {isLoading && <div className="absolute inset-0 bg-[#0B0E11]/60 flex items-center justify-center z-10"><Spinner size="sm" /></div>}
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => onSelect(order['Order ID'])}
                        onClick={e => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded-[1px] border-[#2B3139] bg-[#0B0E11] text-[#FCD535] focus:ring-0"
                    />
                    <span className="text-[11px] font-mono text-[#FCD535] font-bold">{order['Order ID'].substring(0, 8)}</span>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${statusColor}`}>{status}</span>
            </div>
            <div className="space-y-2">
                <p className="text-xs font-bold text-[#EAECEF] truncate uppercase">{order['Customer Name']}</p>
                <div className="flex justify-between items-center pt-2 border-t border-[#2B3139]/50">
                    <span className="text-[10px] font-mono text-[#848E9C]">{order['Customer Phone']}</span>
                    <span className="text-[11px] font-black text-[#EAECEF]">${(Number(order['Grand Total']) || 0).toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
};

const FulfillmentDashboard: React.FC<{ orders: ParsedOrder[], onOpenDeliveryList?: () => void }> = ({ orders }) => {
    const { refreshData, appData } = useContext(AppContext);
    const [selectedFacility, setSelectedFacility] = useState<string>('');
    const [activeStatus, setActiveStatus] = useState<FulfillmentStatus>('Pending');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [viewingOrder, setViewingOrder] = useState<ParsedOrder | null>(null);

    const facilityOrders = useMemo(() => {
        if (!selectedFacility) return [];
        return orders.filter(o => (o['Fulfillment Store'] || 'Unassigned').trim().toLowerCase() === selectedFacility.trim().toLowerCase());
    }, [orders, selectedFacility]);

    const { ordersByStatus, updateStatus, loadingId } = useFulfillment(facilityOrders, refreshData);
    const availableFacilities = useMemo(() => appData.stores?.map((s: any) => s.StoreName) || [], [appData.stores]);

    const filteredList = useMemo(() => {
        let list = ordersByStatus[activeStatus] || [];
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(o => o['Order ID'].toLowerCase().includes(q) || (o['Customer Name'] || '').toLowerCase().includes(q) || (o['Customer Phone'] || '').includes(q));
        }
        return list.sort((a, b) => b['Order ID'].localeCompare(a['Order ID']));
    }, [activeStatus, ordersByStatus, searchTerm]);

    if (!selectedFacility) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 bg-[#0B0E11]">
                <div className="w-full max-w-sm space-y-6">
                    <div className="text-center space-y-1">
                        <h2 className="text-xl font-black text-[#EAECEF] uppercase tracking-tighter">System Entry</h2>
                        <p className="text-[11px] text-[#848E9C] uppercase tracking-widest font-medium">Select Operational Node</p>
                    </div>
                    <div className="space-y-1">
                        {availableFacilities.map(f => (
                            <button 
                                key={f} 
                                onClick={() => setSelectedFacility(f)}
                                className="w-full p-4 bg-[#1E2329] border border-[#2B3139] hover:border-[#FCD535] flex justify-between items-center transition-all group"
                            >
                                <span className="text-xs font-bold text-[#EAECEF] uppercase">{f}</span>
                                <span className="text-[#FCD535] opacity-0 group-hover:opacity-100 transition-opacity">PROCEED →</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#0B0E11] font-sans">
            {/* Status Indicator Bar */}
            <div className="h-12 flex items-center border-b border-[#2B3139] bg-[#1E2329]/30 px-4 gap-6 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 pr-4 border-r border-[#2B3139]">
                    <span className="text-[10px] font-black text-[#FCD535] uppercase">{selectedFacility}</span>
                    <button onClick={() => setSelectedFacility('')} className="text-[10px] text-[#848E9C] hover:text-[#EAECEF]">CHANGE</button>
                </div>

                {['Pending', 'Ready to Ship', 'Shipped', 'Delivered'].map(status => {
                    const isActive = activeStatus === status;
                    const count = facilityOrders.filter(o => (o.FulfillmentStatus || 'Pending') === status).length;
                    return (
                        <button 
                            key={status}
                            onClick={() => setActiveStatus(status as any)}
                            className={`flex items-center gap-3 transition-all ${isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                        >
                            <span className="text-[10px] font-bold text-[#848E9C] uppercase tracking-wider">{status}</span>
                            <span className="text-[12px] font-black font-mono text-[#EAECEF] bg-[#2B3139] px-1.5 rounded">{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Terminal Actions */}
            <div className="p-3 flex justify-between items-center bg-[#1E2329]/10 border-b border-[#2B3139]">
                <div className="relative w-64">
                    <input 
                        type="text" placeholder="FILTER_BY_ID_OR_NAME..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        className={`${tClasses.input} w-full pl-8 font-mono`}
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#848E9C]">🔍</div>
                </div>
                <button onClick={() => refreshData()} className={tClasses.btnGhost + " px-2"}>
                    RE-SYNC_CORE
                </button>
            </div>

            {/* Node Grid */}
            <div className="flex-1 overflow-y-auto t-scroll p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                    {filteredList.map(order => (
                        <OrderNode 
                            key={order['Order ID']} order={order}
                            isLoading={loadingId === order['Order ID']}
                            isSelected={selectedIds.has(order['Order ID'])}
                            onSelect={(id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                            onView={setViewingOrder}
                        />
                    ))}
                </div>
            </div>

            {/* System Modal */}
            {viewingOrder && (
                <Modal isOpen={true} onClose={() => setViewingOrder(null)} maxWidth="max-w-xl">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 space-y-6">
                        <div className="flex justify-between items-start border-b border-[#2B3139] pb-4">
                            <div>
                                <h3 className="text-md font-black text-[#EAECEF] uppercase font-mono">NODE_SPEC: {viewingOrder['Order ID'].substring(0, 16)}</h3>
                                <p className="text-[9px] text-[#848E9C] mt-1 font-bold">MODE: OPERATIONAL_READ_ONLY</p>
                            </div>
                            <button onClick={() => setViewingOrder(null)} className="text-[#848E9C] hover:text-[#EAECEF]">✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#0B0E11] p-4 border border-[#2B3139] space-y-2">
                                <p className="text-[9px] font-bold text-[#848E9C] uppercase">Consignee</p>
                                <p className="text-xs font-bold text-[#EAECEF] uppercase">{viewingOrder['Customer Name']}</p>
                                <p className="text-xs font-mono text-[#FCD535]">{viewingOrder['Customer Phone']}</p>
                            </div>
                            <div className="bg-[#0B0E11] p-4 border border-[#2B3139] space-y-2">
                                <p className="text-[9px] font-bold text-[#848E9C] uppercase">Destination</p>
                                <p className="text-[11px] text-[#EAECEF] leading-tight">{viewingOrder.Location}</p>
                            </div>
                        </div>
                        <button onClick={() => setViewingOrder(null)} className={tClasses.btnYellow + " w-full"}>DISMISS_NODE</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FulfillmentDashboard;
