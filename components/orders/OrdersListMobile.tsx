import React, { useContext, useState, useMemo, useRef } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import Spinner from '../common/Spinner';
import { MobileGrandTotalCard } from './OrderGrandTotal';
import { useSoundEffects } from '../../hooks/useSoundEffects';

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
    viewMode?: 'card' | 'list';
}

const OrdersListMobile: React.FC<OrdersListMobileProps> = ({
    orders, totals, visibleColumns, selectedIds, onToggleSelect, onEdit, onView,
    handlePrint, toggleOrderVerified, updatingIds, groupBy = 'none', viewMode = 'card'
}) => {
    const { currentUser, hasPermission } = useContext(AppContext);
    const { playClick, playPop, playSuccess } = useSoundEffects();
    const [displayCount, setDisplayCount] = useState(20);
    const longPressTimer = useRef<any>(null);
    
    const handleStartLongPress = (id: string) => {
        longPressTimer.current = setTimeout(() => {
            playPop();
            onToggleSelect?.(id);
        }, 600);
    };

    const handleEndLongPress = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
    
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

    const showVerify = !visibleColumns || visibleColumns.has('isVerified');

    return (
        <div className="flex flex-col space-y-4">
            <style>{`
                .order-card-v2 {
                    background: rgba(30, 41, 59, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    backdrop-filter: blur(16px);
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .order-card-v2:active {
                    transform: scale(0.98);
                    background: rgba(30, 41, 59, 0.5);
                }
                .order-row-v2 {
                    background: rgba(30, 41, 59, 0.2);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                    padding: 12px 16px;
                    transition: all 0.3s;
                }
                .order-row-v2:active {
                    background: rgba(255, 255, 255, 0.05);
                }
                .status-pill-v2 {
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 9px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .product-pill-v2 {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    padding: 4px 10px;
                    border-radius: 10px;
                    font-size: 10px;
                    font-weight: 600;
                }
                .action-btn-v2 {
                    width: 38px;
                    height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.4);
                    transition: all 0.2s;
                }
                .action-btn-v2:active {
                    transform: scale(0.9);
                    background: rgba(255, 255, 255, 0.1);
                }
            `}</style>

            {groupedData.map((group, gIdx) => (
                <div key={gIdx} className="space-y-3">
                    {group.label && (
                        <div className="flex items-center gap-3 px-3 mb-2">
                            <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-[0.3em]">{group.label}</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/10 to-transparent"></div>
                        </div>
                    )}
                    
                    <div className={viewMode === 'card' ? "grid grid-cols-1 gap-3 px-2" : "flex flex-col bg-white/[0.02] border border-white/5 rounded-[2rem] overflow-hidden"}>
                        {group.orders.map((order, idx) => {
                            const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                            const isSelected = selectedIds.has(order['Order ID']);
                            const isPaid = order['Payment Status'] === 'Paid';
                            const orderTotal = Number(order['Grand Total']) || 0;
                            const displayIndex = idx + 1;
                            
                            if (viewMode === 'list') {
                                return (
                                    <div 
                                        key={order['Order ID']} 
                                        onClick={() => {
                                            if (selectedIds.size > 0) {
                                                playClick();
                                                onToggleSelect?.(order['Order ID']);
                                            } else {
                                                onView?.(order);
                                            }
                                        }}
                                        onMouseDown={() => handleStartLongPress(order['Order ID'])}
                                        onMouseUp={handleEndLongPress}
                                        onTouchStart={() => handleStartLongPress(order['Order ID'])}
                                        onTouchEnd={handleEndLongPress}
                                        className={`order-row-v2 flex items-center justify-between gap-3 ${isSelected ? 'bg-blue-600/20 border-l-4 border-blue-500' : ''}`}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {isSelected ? (
                                                <div className="w-5 h-5 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-900/40">
                                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black text-blue-500/40 font-mono w-4 shrink-0 text-center">{displayIndex}</span>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-sm font-black text-white truncate uppercase tracking-tight">{order['Customer Name']}</h3>
                                                    <span className={`status-pill-v2 !py-0.5 !px-1.5 !rounded-md !text-[7px] ${isPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                                        {isPaid ? 'PAID' : 'COD'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500">
                                                    <span className="text-blue-400/80">{order['Customer Phone']}</span>
                                                    <span>•</span>
                                                    <span className="truncate max-w-[100px]">{order.Location || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-base font-black text-white italic tracking-tighter leading-none">
                                                <span className="text-[10px] text-blue-500 mr-0.5">$</span>
                                                {orderTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </div>
                                            <div className="text-[7px] font-black text-gray-600 uppercase tracking-widest mt-1">{getSafeDateString(order.Timestamp).split(',')[0]}</div>
                                        </div>
                                        {showVerify && (
                                            <div onClick={(e) => e.stopPropagation()} className="flex items-center ml-1">
                                                <button 
                                                    onClick={() => {
                                                        if (!isVerified) playSuccess();
                                                        toggleOrderVerified(order['Order ID'], isVerified);
                                                    }}
                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isVerified ? 'text-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-gray-700 active:bg-white/5'}`}
                                                >
                                                    {updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div 
                                    key={order['Order ID']} 
                                    onClick={() => onView && onView(order)}
                                    className={`order-card-v2 relative overflow-hidden rounded-[2rem] p-4 ${isSelected ? 'ring-2 ring-blue-500 bg-blue-500/10' : ''}`}
                                >
                                    {/* Glass Highlight */}
                                    <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none"></div>

                                    {/* Header: Index, ID & Price */}
                                    <div className="flex justify-between items-start mb-3 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-blue-500/40 font-mono italic">{displayIndex}</span>
                                            <span className="text-[9px] font-black text-gray-600 font-mono tracking-tighter bg-white/5 px-2 py-0.5 rounded-md">#{order['Order ID'].substring(0, 8)}</span>
                                            <div className={`status-pill-v2 !py-0.5 !px-2 !rounded-lg ${isPaid ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                                {order['Payment Status']}
                                            </div>
                                        </div>
                                        <div className="text-lg font-black text-white italic tracking-tighter">
                                            <span className="text-[10px] text-blue-500 mr-0.5">$</span>
                                            {orderTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>

                                    {/* Customer Info */}
                                    <div className="mb-3">
                                        <h3 className="text-base font-black text-white truncate tracking-tight mb-0.5 italic uppercase">{order['Customer Name']}</h3>
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="font-bold text-blue-400 tracking-tight">{order['Customer Phone']}</span>
                                            <span className="w-1 h-1 bg-white/10 rounded-full"></span>
                                            <span className="font-medium text-gray-500 truncate">{order.Location || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Compact Footer: Actions */}
                                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">{getSafeDateString(order.Timestamp)}</span>
                                            <span className="text-[8px] font-black text-blue-400/50 uppercase truncate max-w-[100px] mt-0.5">{order.Page || 'System'}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => handlePrint(order)} className="action-btn-v2 !w-9 !h-9">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            </button>
                                            {canEditOrder(order) && (
                                                <button onClick={() => onEdit && onEdit(order)} className="action-btn-v2 !w-9 !h-9">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                            )}
                                            {showVerify && (
                                                <button 
                                                    onClick={() => toggleOrderVerified(order['Order ID'], isVerified)}
                                                    className={`action-btn-v2 !w-9 !h-9 transition-all ${isVerified ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' : ''}`}
                                                >
                                                    {updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}
                                                </button>
                                            )}
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
