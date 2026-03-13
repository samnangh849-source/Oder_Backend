import React, { useContext, useState, useMemo } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import Spinner from '../common/Spinner';
import { MobileGrandTotalCard } from './OrderGrandTotal';

interface OrdersListMobileProps {
    orders: ParsedOrder[];
    totals: { grandTotal: number; internalCost: number; count: number; paidCount: number; unpaidCount: number };
    visibleColumns?: Set<string>;
    selectedIds: Set<string>;
    onToggleSelect?: (id: string) => void;
    onEdit?: (order: ParsedOrder) => void;
    onView?: (order: ParsedOrder) => void;
    handlePrint: (order: ParsedOrder) => void;
    handleCopy: (id: string) => void;
    handleCopyTemplate: (order: ParsedOrder) => void;
    copiedId: string | null;
    copiedTemplateId: string | null;
    toggleOrderVerified: (id: string, currentStatus: boolean) => void;
    updatingIds: Set<string>;
    groupBy?: string;
}

const OrdersListMobile: React.FC<OrdersListMobileProps> = ({
    orders, totals, selectedIds, onToggleSelect, onEdit, onView,
    handlePrint, toggleOrderVerified, updatingIds, groupBy = 'none'
}) => {
    const { currentUser, hasPermission } = useContext(AppContext);
    const [displayCount, setDisplayCount] = useState(20);
    
    const visibleOrders = useMemo(() => orders.slice(0, displayCount), [orders, displayCount]);
    
    const groupedData = useMemo(() => {
        if (groupBy === 'none') return [{ label: '', orders: visibleOrders }];
        const groups: Record<string, ParsedOrder[]> = {};
        visibleOrders.forEach(o => { 
            const key = String((o as any)[groupBy] || 'Unassigned'); 
            if (!groups[key]) groups[key] = []; 
            groups[key].push(o); 
        });
        return Object.entries(groups).map(([label, items]) => ({ label, orders: items }));
    }, [visibleOrders, groupBy]);

    const handleLoadMore = () => setDisplayCount(prev => prev + 20);

    const getSafeDateObj = (dateStr: string) => {
        if (!dateStr) return new Date();
        const manualMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (manualMatch) return new Date(parseInt(manualMatch[1]), parseInt(manualMatch[2]) - 1, parseInt(manualMatch[3]), parseInt(manualMatch[4]), parseInt(manualMatch[5]));
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const canEditOrder = (order: ParsedOrder) => {
        if (!currentUser) return false;
        const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
        if (isVerified) return currentUser.IsSystemAdmin || currentUser.Role === 'Admin';
        if (currentUser.IsSystemAdmin) return true;
        if (!hasPermission('edit_order')) return false;
        const userTeams = (currentUser.Team || '').split(',').map(t => t.trim());
        if (!userTeams.includes(order.Team)) return false;
        const orderTime = getSafeDateObj(order.Timestamp).getTime();
        return (Date.now() - orderTime) < 43200000;
    };

    const getSafeDateString = (dateStr: string) => {
        const d = getSafeDateObj(dateStr);
        return d.toLocaleDateString('km-KH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col space-y-6">
            <style>{`
                .order-card-new { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .order-card-new:active { transform: scale(0.97); background: rgba(30, 41, 59, 0.6); }
                .status-pill { padding: 4px 10px; border-radius: 99px; font-size: 9px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
                .order-id-badge { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 10px; color: rgba(255,255,255,0.4); }
                .glass-button { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.2s ease; }
                .glass-button:active { background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); }
            `}</style>

            <div className="px-2">
                <MobileGrandTotalCard totals={totals} />
            </div>

            {groupedData.map((group, gIdx) => (
                <div key={gIdx} className="space-y-4">
                    {group.label && (
                        <div className="flex items-center gap-4 px-2">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">{group.label}</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/20 to-transparent"></div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 gap-4">
                        {group.orders.map((order) => {
                            const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                            const isSelected = selectedIds.has(order['Order ID']);
                            const isPaid = order['Payment Status'] === 'Paid';
                            
                            return (
                                <div 
                                    key={order['Order ID']} 
                                    onClick={() => onView && onView(order)}
                                    className={`order-card-new relative overflow-hidden rounded-[2rem] p-5 ${isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}`}
                                >
                                    {/* Selection Glow */}
                                    {isSelected && <div className="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none"></div>}

                                    {/* Top Row: Meta & Status */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            {onToggleSelect && (
                                                <input 
                                                    type="checkbox" 
                                                    className="h-5 w-5 rounded-full border-white/10 bg-white/5 text-blue-500 focus:ring-offset-0 focus:ring-0 transition-all cursor-pointer" 
                                                    checked={isSelected} 
                                                    onChange={() => onToggleSelect(order['Order ID'])} 
                                                />
                                            )}
                                            <div className="order-id-badge">#{order['Order ID'].substring(0, 8)}</div>
                                        </div>
                                        <div className={`status-pill ${isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                            {order['Payment Status']}
                                        </div>
                                    </div>

                                    {/* Middle Row: Customer Info & Price */}
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h3 className="text-lg font-black text-white truncate leading-tight mb-1">{order['Customer Name']}</h3>
                                            <div className="flex flex-wrap items-center gap-y-1 gap-x-3">
                                                <span className="text-[12px] font-bold text-blue-400 tracking-tight">{order['Customer Phone']}</span>
                                                <div className="w-1 h-1 bg-white/10 rounded-full"></div>
                                                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide truncate max-w-[120px]">{order.Location || 'General'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-black text-white tracking-tighter italic">
                                                <span className="text-sm align-top mr-0.5">$</span>
                                                {(Number(order['Grand Total']) || 0).toFixed(2)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Product Summary */}
                                    <div className="mb-5 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                                        <div className="flex flex-wrap gap-2">
                                            {order.Products.slice(0, 3).map((p, i) => (
                                                <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                                                    <span className="text-[10px] font-bold text-blue-400">x{p.quantity}</span>
                                                    <span className="text-[10px] font-medium text-gray-400 truncate max-w-[80px]">{p.name}</span>
                                                </div>
                                            ))}
                                            {order.Products.length > 3 && (
                                                <div className="text-[10px] font-bold text-gray-600 self-center pl-1">+{order.Products.length - 3} more</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Row: Date & Actions */}
                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{getSafeDateString(order.Timestamp)}</span>
                                            <span className="text-[9px] font-bold text-blue-500/60 uppercase tracking-tighter mt-0.5">{order.Page || 'Direct Order'}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handlePrint(order)} 
                                                className="glass-button p-3 rounded-xl text-gray-400 hover:text-white"
                                                title="Print Label"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            </button>
                                            
                                            {canEditOrder(order) && (
                                                <button 
                                                    onClick={() => onEdit && onEdit(order)} 
                                                    className="glass-button p-3 rounded-xl text-gray-400 hover:text-blue-400"
                                                    title="Edit Order"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                            )}

                                            <button 
                                                onClick={() => toggleOrderVerified(order['Order ID'], isVerified)}
                                                className={`glass-button p-3 rounded-xl transition-all ${isVerified ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : 'text-gray-400 hover:text-white'}`}
                                                title="Verify Order"
                                            >
                                                {updatingIds.has(order['Order ID']) ? (
                                                    <Spinner size="xs" />
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
            
            {displayCount < orders.length && (
                <div className="flex justify-center pt-8 pb-12">
                    <button 
                        onClick={handleLoadMore} 
                        className="px-12 py-4 bg-white/5 text-gray-500 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] border border-white/10 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                    >
                        Load More Records
                    </button>
                </div>
            )}
        </div>
    );
};

export default OrdersListMobile;
