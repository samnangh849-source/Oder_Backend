import React, { useContext, useState, useMemo, useRef } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import Spinner from '../common/Spinner';
import { MobileGrandTotalCard } from './OrderGrandTotal';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { Edit2, Check, Truck, Warehouse, MapPin, Clock, Globe } from 'lucide-react';

interface OrdersListMobileProps {
    orders: ParsedOrder[];
    totals: { grandTotal: number; internalCost: number; count: number; paidCount: number; unpaidCount: number };
    visibleColumns?: Set<string>;
    selectedIds: Set<string>;
    isSelectionMode?: boolean;
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
    orders, totals, visibleColumns, selectedIds, isSelectionMode, onToggleSelect, onEdit, onView,
    handlePrint, toggleOrderVerified, updatingIds, groupBy = 'none', viewMode = 'card'
}) => {
    const { currentUser, hasPermission, advancedSettings, language } = useContext(AppContext);
    const { playClick, playPop } = useSoundEffects();
    const [displayCount, setDisplayCount] = useState(20);

    const isBinance = advancedSettings?.uiTheme === 'binance';
    
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
        <div className="flex flex-col space-y-6">
            <style>{`
                .premium-card {
                    background: linear-gradient(145deg, var(--cm-card-bg), #1c2127);
                    border: 1px solid var(--cm-border);
                    border-radius: 4px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                    position: relative;
                    overflow: hidden;
                }
                .status-bar {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                }
                .status-pill-v4 {
                    font-size: 9px;
                    font-weight: 900;
                    letter-spacing: 0.05em;
                    padding: 2px 8px;
                    border-radius: 2px;
                    text-transform: uppercase;
                }
                .info-label-v4 {
                    font-size: 8px;
                    font-weight: 800;
                    color: var(--cm-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 2px;
                }
                .info-value-v4 {
                    font-size: 11px;
                    font-weight: 700;
                    color: var(--cm-text-primary);
                }
                .list-row-v4 {
                    background: var(--cm-card-bg);
                    border-bottom: 1px solid var(--cm-border);
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .list-row-v4:active {
                    background: var(--cm-card-bg2);
                }
                .action-icon-btn {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    background: var(--cm-card-bg2);
                    border: 1px solid var(--cm-border);
                    color: var(--cm-text-muted);
                }
                .action-icon-btn.active {
                    color: var(--cm-accent);
                    border-color: var(--cm-accent);
                }
            `}</style>

            {groupedData.map((group, gIdx) => (
                <div key={gIdx} className="space-y-4">
                    {group.label && (
                        <div className="flex items-center gap-3 px-4">
                            <span className="text-[10px] font-black text-[var(--cm-accent)] uppercase tracking-[0.2em]">{group.label}</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-[var(--cm-border)] to-transparent"></div>
                        </div>
                    )}
                    
                    <div className={viewMode === 'card' ? "grid grid-cols-1 gap-4 px-4" : "flex flex-col border-y border-[var(--cm-border)]"}>
                        {group.orders.map((order, idx) => {
                            const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                            const isSelected = selectedIds.has(order['Order ID']);
                            const isPaid = order['Payment Status'] === 'Paid';
                            const orderTotal = Number(order['Grand Total']) || 0;
                            const displayIndex = idx + 1;

                            // Products logic
                            const products = Array.isArray(order.Products) ? order.Products : [];
                            const mainProduct = products[0];
                            const productCount = products.length;

                            if (viewMode === 'list') {
                                return (
                                    <div 
                                        key={order['Order ID']} 
                                        onClick={() => (isSelectionMode || selectedIds.size > 0) ? onToggleSelect?.(order['Order ID']) : onView?.(order)}
                                        className={`list-row-v4 ${isSelected ? 'bg-[var(--cm-accent-light)]' : ''}`}
                                    >
                                        <div className="status-bar" style={{ backgroundColor: isPaid ? 'var(--cm-green)' : 'var(--cm-red)' }}></div>
                                        
                                        <div className="w-6 shrink-0 text-center">
                                            {isSelectionMode ? (
                                                <div className={`w-5 h-5 rounded-sm flex items-center justify-center border ${isSelected ? 'bg-[var(--cm-accent)] border-[var(--cm-accent)]' : 'border-[var(--cm-border)]'}`}>
                                                    {isSelected && <Check size={12} color="var(--cm-accent-text)" strokeWidth={4} />}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black text-[var(--cm-text-muted)] font-mono opacity-50">{displayIndex}</span>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="text-[13px] font-black text-[var(--cm-text-primary)] truncate uppercase tracking-tight">{order['Customer Name']}</h3>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm ${isPaid ? 'bg-[var(--cm-green)]/10 text-[var(--cm-green)]' : 'bg-[var(--cm-red)]/10 text-[var(--cm-red)]'}`}>
                                                    {isPaid ? 'PAID' : 'UNPAID'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--cm-text-muted)]">
                                                <span className="text-[var(--cm-accent)]">{order['Customer Phone']}</span>
                                                <span className="opacity-20">•</span>
                                                <span className="truncate">{order.Location || 'N/A'}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <div className="text-[14px] font-black text-[var(--cm-text-primary)] italic tabular-nums leading-none">
                                                    <span className="text-[10px] text-[var(--cm-accent)] mr-0.5 font-sans">$</span>
                                                    {orderTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                                </div>
                                            </div>
                                            {canEditOrder(order) && (
                                                <button onClick={e => { e.stopPropagation(); onEdit?.(order); }} className="action-icon-btn">
                                                    <Edit2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div 
                                    key={order['Order ID']} 
                                    onClick={() => (selectedIds.size > 0 || isSelectionMode) ? onToggleSelect?.(order['Order ID']) : onView?.(order)}
                                    className={`premium-card p-4 transition-all ${isSelected ? 'ring-1 ring-[var(--cm-accent)] shadow-[0_0_15px_rgba(240,185,11,0.15)]' : ''}`}
                                >
                                    <div className="status-bar" style={{ backgroundColor: isPaid ? 'var(--cm-green)' : 'var(--cm-red)' }}></div>
                                    
                                    {/* Header Row */}
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            {isSelectionMode ? (
                                                <div className={`w-5 h-5 rounded-sm flex items-center justify-center border ${isSelected ? 'bg-[var(--cm-accent)] border-[var(--cm-accent)]' : 'border-[var(--cm-border)]'}`}>
                                                    {isSelected && <Check size={12} color="var(--cm-accent-text)" strokeWidth={4} />}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black text-[var(--cm-text-muted)] font-mono opacity-50">{displayIndex}</span>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-[var(--cm-text-primary)] tracking-tighter opacity-80">#{order['Order ID'].substring(0, 10)}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`status-pill-v4 ${isPaid ? 'bg-[var(--cm-green)]/10 text-[var(--cm-green)]' : 'bg-[var(--cm-red)]/10 text-[var(--cm-red)]'}`}>
                                                        {isPaid ? 'PAID' : 'UNPAID'}
                                                    </span>
                                                    {isVerified && <div className="flex items-center gap-1 text-[var(--cm-green)] text-[9px] font-black"><Check size={10} strokeWidth={4}/> VERIFIED</div>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[20px] font-black text-[var(--cm-text-primary)] italic tabular-nums leading-none tracking-tighter">
                                                <span className="text-[12px] text-[var(--cm-accent)] mr-0.5 font-sans">$</span>
                                                {orderTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Row */}
                                    <div className="flex gap-4 mb-5 pb-4 border-b border-[var(--cm-border)]/50">
                                        <div className="w-16 h-16 rounded bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] shrink-0 relative overflow-hidden">
                                            {mainProduct?.ProductImage ? (
                                                <img src={convertGoogleDriveUrl(mainProduct.ProductImage)} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[8px] text-[var(--cm-text-muted)] font-black">IMAGE</div>
                                            )}
                                            {productCount > 1 && (
                                                <div className="absolute bottom-0 right-0 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] text-[9px] font-black px-1.5 rounded-tl-sm">
                                                    +{productCount - 1}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-[15px] font-black text-[var(--cm-text-primary)] truncate uppercase tracking-tight mb-1">{order['Customer Name']}</h3>
                                            <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--cm-accent)] mb-1">
                                                <span>{order['Customer Phone']}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-[var(--cm-text-muted)] font-medium">
                                                <MapPin size={10} className="text-[var(--cm-red)] opacity-70" />
                                                <span className="truncate">{order.Location || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer Info & Actions */}
                                    <div className="flex items-end justify-between">
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1">
                                            <div>
                                                <div className="info-label-v4"><Warehouse size={8} className="inline mr-1" /> Warehouse</div>
                                                <div className="info-value-v4 truncate max-w-[80px]">{order['Fulfillment Store'] || '---'}</div>
                                            </div>
                                            <div>
                                                <div className="info-label-v4"><Truck size={8} className="inline mr-1" /> Driver</div>
                                                <div className="info-value-v4 truncate max-w-[80px]">{order['Driver Name'] || '---'}</div>
                                            </div>
                                            <div>
                                                <div className="info-label-v4"><Clock size={8} className="inline mr-1" /> Date</div>
                                                <div className="info-value-v4">{getSafeDateString(order.Timestamp).split(',')[0]}</div>
                                            </div>
                                            <div>
                                                <div className="info-label-v4"><Globe size={8} className="inline mr-1" /> Source</div>
                                                <div className="info-value-v4 truncate max-w-[80px] italic">{order.Page || 'System'}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 ml-4" onClick={e => e.stopPropagation()}>
                                            {canEditOrder(order) && (
                                                <button onClick={() => onEdit?.(order)} className="action-icon-btn w-10 h-10 active:scale-90 transition-transform">
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                            {showVerify && !isSelectionMode && (
                                                <button 
                                                    onClick={() => toggleOrderVerified(order['Order ID'], isVerified)}
                                                    className={`action-icon-btn w-10 h-10 ${isVerified ? 'active' : ''} active:scale-90 transition-transform`}
                                                >
                                                    {updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : <Check size={18} strokeWidth={3} />}
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
                <div className="flex justify-center pt-4 pb-2 px-4">
                    <button 
                        onClick={handleLoadMore} 
                        className="w-full py-3.5 bg-[#1E2329] text-[var(--cm-text-muted)] rounded-sm text-[11px] font-black uppercase tracking-[0.2em] border border-[var(--cm-border)] active:scale-[0.98] transition-all"
                    >
                        Load More Records
                    </button>
                </div>
            )}
            
            <div className="px-4 pb-12">
                <MobileGrandTotalCard totals={totals} />
            </div>
        </div>
    );
};

export default OrdersListMobile;
