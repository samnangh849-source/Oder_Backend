import React, { useContext, useState, useMemo, memo } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { translations } from '../../translations';
import Spinner from '../common/Spinner';
import { MobileGrandTotalCard } from './OrderGrandTotal';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { getValidDate } from '../../utils/dateUtils';
import { Edit2, Check, Truck, Warehouse, MapPin, Clock, Globe, Package } from 'lucide-react';

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
    handleUpdateFulfillmentStatus: (id: string, newStatus: string) => void;
    handleSendTelegram: (id: string) => void;
    updatingIds: Set<string>;
    groupBy?: string;
    viewMode?: 'card' | 'list';
}

// --- Sub-components ---

const FulfillmentBadge = memo(({ status }: { status: string }) => {
    const fsC: Record<string, string> = { 
        'Pending': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', 
        'Scheduled': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
        'Ready to Ship': 'bg-blue-500/10 text-blue-500 border-blue-500/20', 
        'Shipped': 'bg-purple-500/10 text-purple-500 border-purple-500/20', 
        'Delivered': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', 
        'Cancelled': 'bg-red-500/10 text-red-500 border-red-500/20',
        'Returned': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    };
    
    return (
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm border uppercase tracking-wider ${fsC[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
            {status}
        </span>
    );
});

const TelegramStatusIcon = memo(({ 
    order, 
    handleSendTelegram, 
    isUpdating, 
    isBinance, 
    t 
}: { 
    order: ParsedOrder, 
    handleSendTelegram: (id: string) => void, 
    isUpdating: boolean, 
    isBinance: boolean, 
    t: any 
}) => {
    const id1 = order['Telegram Message ID 1'];
    const id2 = order['Telegram Message ID 2'];
    const isChecking = id1 === 'CHECKING';
    const isSent = (id1 && id2) && !isChecking;

    if (isSent) {
        return (
            <div className="flex items-center gap-1 text-emerald-500 text-[9px] font-black uppercase tracking-tighter" title={t.msg_sent}>
                <Check size={10} strokeWidth={4}/> {t.msg_sent}
            </div>
        );
    }

    if (isChecking) {
        return (
            <div className="flex items-center gap-1 text-blue-400 text-[9px] font-black uppercase tracking-tighter animate-pulse">
                <Spinner size="xs" className="scale-75" /> 
                <span className="hidden xs:inline">Checking...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 text-red-500 text-[9px] font-black uppercase tracking-tighter italic">
            {t.msg_not_sent}
        </div>
    );
});

const TelegramSendButton = memo(({ 
    orderId, 
    handleSendTelegram, 
    isUpdating, 
    isBinance 
}: { 
    orderId: string, 
    handleSendTelegram: (id: string) => void, 
    isUpdating: boolean, 
    isBinance: boolean 
}) => {
    return (
        <button 
            onClick={(e) => { e.stopPropagation(); handleSendTelegram(orderId); }} 
            className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all active:scale-90 ${
                isBinance 
                ? 'bg-[#FCD535] border-[#FCD535] text-[#181A20]' 
                : 'bg-blue-600/10 text-blue-500 border-blue-500/20 active:bg-blue-600 active:text-white'
            }`}
        >
            {isUpdating ? <Spinner size="xs" /> : <Globe size={18} strokeWidth={2.5} />}
        </button>
    );
});

// --- Main Component ---

const OrdersListMobile: React.FC<OrdersListMobileProps> = ({
    orders, totals, visibleColumns, selectedIds, isSelectionMode, onToggleSelect, onEdit, onView,
    handlePrint, handleCopy, handleCopyTemplate, copiedId, copiedTemplateId, toggleOrderVerified, 
    handleUpdateFulfillmentStatus, handleSendTelegram, updatingIds, groupBy = 'none', viewMode = 'card'
}) => {
    const { currentUser, hasPermission, advancedSettings, language, appData } = useContext(AppContext);
    const t = translations[language];
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

    const canEditOrder = (order: ParsedOrder) => {
        if (!currentUser) return false;
        const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
        if (isVerified) return currentUser.IsSystemAdmin || currentUser.Role === 'Admin';
        if (currentUser.IsSystemAdmin) return true;
        if (!hasPermission('edit_order')) return false;
        const userTeams = (currentUser.Team || '').split(',').map(t => t.trim());
        if (!userTeams.includes(order.Team)) return false;
        const orderTime = getValidDate(order.Timestamp).getTime();
        return (Date.now() - orderTime) < 43200000; // 12 hours
    };

    const isVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
    const showVerify = isVisible('check');

    const formatPhone = (val: string) => {
        let phone = (val || '').replace(/[^0-9]/g, '');
        if (phone.length > 0) phone = '0' + phone.replace(/^0+/, '');
        return phone;
    };

    const renderOrderCard = (order: ParsedOrder, idx: number) => {
        const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
        const isSelected = selectedIds.has(order['Order ID']);
        const isPaid = order['Payment Status'] === 'Paid';
        const orderTotal = Number(order['Grand Total']) || 0;
        const displayIndex = idx + 1;

        const products = Array.isArray(order.Products) ? order.Products : [];
        const mainProduct = products[0];
        const productCount = products.length;

        const fs = (order as any).FulfillmentStatus || (order as any)['Fulfillment Status'] || 'Pending';
        const isCancelled = fs === 'Cancelled';
        const isReturned = fs === 'Returned';

        // Enhancement: Find logos
        const displayPhone = formatPhone(order['Customer Phone']);
        const carrier = appData?.phoneCarriers?.find(c =>
            String(c.Prefixes || '').split(',').map(p => p.trim()).filter(Boolean).includes(displayPhone.substring(0, 3))
        );
        const carrierLogo = carrier?.CarrierLogoURL;

        const shippingMethod = appData?.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);
        const shippingLogo = shippingMethod?.LogoURL;

        const packagePhoto = order['Package Photo'];

        return (
            <div 
                key={order['Order ID']}
                onClick={() => (selectedIds.size > 0 || isSelectionMode) ? onToggleSelect?.(order['Order ID']) : onView?.(order)}
                className={`relative group bg-[var(--cm-card-bg)] border border-[var(--cm-border)] rounded-lg p-4 transition-all duration-300 active:scale-[0.99] overflow-hidden ${
                    isSelected ? 'ring-2 ring-[var(--cm-accent)] shadow-[0_0_20px_rgba(240,185,11,0.2)]' : 'shadow-lg shadow-black/20'
                } ${isCancelled || isReturned ? 'opacity-70' : ''}`}
            >
                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 bottom-0 w-1 ${isPaid ? 'bg-emerald-500' : 'bg-red-500'}`} />

                {/* Watermark for special statuses */}
                {(isCancelled || isReturned) && (
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] pointer-events-none z-10 opacity-10 font-black text-5xl tracking-[0.2em] whitespace-nowrap select-none ${isCancelled ? 'text-red-500' : 'text-purple-500'}`}>
                        {isCancelled ? 'CANCELLED' : 'RETURNED'}
                    </div>
                )}

                {/* Card Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        {isSelectionMode ? (
                            <div 
                                onClick={(e) => { e.stopPropagation(); onToggleSelect?.(order['Order ID']); }}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${isSelected ? 'bg-[var(--cm-accent)] border-[var(--cm-accent)]' : 'border-[var(--cm-border)] bg-black/20'}`}
                            >
                                {isSelected && <Check size={12} className="text-black" strokeWidth={4} />}
                            </div>
                        ) : isVisible('index') && (
                            <span className="text-[10px] font-mono font-black text-[var(--cm-text-muted)] opacity-40">#{displayIndex}</span>
                        )}
                        <div className="flex flex-col gap-1.5">
                            {isVisible('orderId') && (
                                <span className="text-[10px] font-mono font-bold text-[var(--cm-text-primary)]/80 tracking-tight">
                                    ID: {order['Order ID'].substring(0, 8)}...
                                </span>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                                {isVisible('status') && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-sm border ${isPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                        {isPaid ? 'PAID' : 'UNPAID'}
                                    </span>
                                )}
                                {isVisible('fulfillmentStatus') && <FulfillmentBadge status={fs} />}
                                {showVerify && isVerified && (
                                    <div className="flex items-center gap-1 text-emerald-500 text-[9px] font-black uppercase">
                                        <Check size={10} strokeWidth={4}/> VERIFIED
                                    </div>
                                )}
                                {isVisible('telegramStatus') && (
                                    <TelegramStatusIcon 
                                        order={order} 
                                        handleSendTelegram={handleSendTelegram} 
                                        isUpdating={updatingIds.has(order['Order ID'])}
                                        isBinance={isBinance}
                                        t={t}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    {isVisible('total') && (
                        <div className="text-right">
                            <div className="text-[20px] font-black text-[var(--cm-text-primary)] tabular-nums leading-none tracking-tighter flex items-center justify-end">
                                <span className="text-[12px] text-[var(--cm-accent)] mr-0.5 opacity-80">$</span>
                                {orderTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <div className="flex gap-4 mb-4 pb-4 border-b border-[var(--cm-border)]/30">
                    {isVisible('productInfo') && (
                        <div className="w-16 h-16 rounded-lg bg-black/20 border border-[var(--cm-border)]/50 shrink-0 relative overflow-hidden group-hover:border-[var(--cm-accent)]/50 transition-colors">
                            {mainProduct?.ProductImage ? (
                                <img 
                                    src={convertGoogleDriveUrl(mainProduct.ProductImage)} 
                                    className="w-full h-full object-cover" 
                                    alt={mainProduct.ProductName || "Product"} 
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[8px] text-[var(--cm-text-muted)] font-black">NO IMAGE</div>
                            )}
                            {productCount > 1 && (
                                <div className="absolute bottom-0 right-0 bg-[var(--cm-accent)] text-black text-[9px] font-black px-1.5 py-0.5 rounded-tl-md shadow-sm">
                                    +{productCount - 1}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        {isVisible('customerName') && (
                            <h3 className="text-[15px] font-black text-[var(--cm-text-primary)] truncate uppercase tracking-tight mb-0.5 group-hover:text-[var(--cm-accent)] transition-colors">
                                {order['Customer Name'] || 'Unknown Customer'}
                            </h3>
                        )}
                        <div className="flex items-center gap-2 text-[12px] font-bold text-[var(--cm-accent)] mb-1.5">
                            {carrierLogo && (
                                <img src={convertGoogleDriveUrl(carrierLogo)} className="w-3.5 h-3.5 object-contain" alt="" />
                            )}
                            <span>{order['Customer Phone']}</span>
                        </div>
                        {isVisible('location') && (
                            <div className="flex items-start gap-1.5 text-[10px] text-[var(--cm-text-muted)] font-medium">
                                <MapPin size={11} className="text-red-500 shrink-0 mt-0.5 opacity-80" />
                                <span className="line-clamp-1">{order.Location || 'No location provided'}</span>
                            </div>
                        )}
                    </div>
                    {packagePhoto && (
                        <div className="w-16 h-16 rounded-lg bg-black/20 border border-blue-500/30 shrink-0 relative overflow-hidden flex-none">
                            <img 
                                src={convertGoogleDriveUrl(packagePhoto)} 
                                className="w-full h-full object-cover" 
                                alt="Package" 
                                loading="lazy"
                            />
                            <div className="absolute bottom-0 right-0 bg-blue-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-tl-md shadow-sm flex items-center gap-0.5">
                                <Package size={8} /> PKG
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Metadata & Actions */}
                <div className="flex items-end justify-between">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 flex-1">
                        {isVisible('fulfillment') && (
                            <div className="min-w-0">
                                <div className="text-[8px] font-black text-[var(--cm-text-muted)] uppercase flex items-center gap-1 mb-0.5">
                                    <Warehouse size={8} /> Store
                                </div>
                                <div className="text-[10px] font-bold text-[var(--cm-text-primary)] truncate">{order['Fulfillment Store'] || '---'}</div>
                            </div>
                        )}
                        {isVisible('shippingService') && (
                            <div className="min-w-0">
                                <div className="text-[8px] font-black text-[var(--cm-text-muted)] uppercase flex items-center gap-1 mb-0.5">
                                    <Truck size={8} /> Shipping
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {shippingLogo && <img src={convertGoogleDriveUrl(shippingLogo)} className="w-3.5 h-3.5 object-contain" alt="" />}
                                    <span className="text-[10px] font-bold text-[var(--cm-text-primary)] truncate">{order['Internal Shipping Method'] || '---'}</span>
                                </div>
                            </div>
                        )}
                        {!isVisible('shippingService') && isVisible('driver') && (
                            <div className="min-w-0">
                                <div className="text-[8px] font-black text-[var(--cm-text-muted)] uppercase flex items-center gap-1 mb-0.5">
                                    <Truck size={8} /> Driver
                                </div>
                                <div className="text-[10px] font-bold text-[var(--cm-text-primary)] truncate">{order['Driver Name'] || '---'}</div>
                            </div>
                        )}
                        {isVisible('date') && (
                            <div>
                                <div className="text-[8px] font-black text-[var(--cm-text-muted)] uppercase flex items-center gap-1 mb-0.5">
                                    <Clock size={8} /> Time
                                </div>
                                <div className="text-[10px] font-bold text-[var(--cm-text-primary)]">
                                    {getValidDate(order.Timestamp).toLocaleDateString('km-KH', { day: '2-digit', month: 'short' })}
                                </div>
                            </div>
                        )}
                        {isVisible('pageInfo') && (
                            <div className="min-w-0">
                                <div className="text-[8px] font-black text-[var(--cm-text-muted)] uppercase flex items-center gap-1 mb-0.5">
                                    <Globe size={8} /> Source
                                </div>
                                <div className="text-[10px] font-bold text-[var(--cm-text-primary)] truncate italic">{order.Page || 'Direct'}</div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4 shrink-0" onClick={e => e.stopPropagation()}>
                        {isVisible('actions') && canEditOrder(order) && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit?.(order); }} 
                                className="w-10 h-10 flex items-center justify-center bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] text-[var(--cm-text-muted)] rounded-lg active:scale-90 transition-all hover:border-[var(--cm-accent)] hover:text-[var(--cm-accent)]"
                            >
                                <Edit2 size={16} />
                            </button>
                        )}
                        {isVisible('telegramStatus') && (() => {
                            const id1 = order['Telegram Message ID 1'];
                            const id2 = order['Telegram Message ID 2'];
                            const isChecking = id1 === 'CHECKING';
                            const isSent = (id1 && id2) && !isChecking;

                            if (!isSent) {
                                return (
                                    <TelegramSendButton 
                                        orderId={order['Order ID']}
                                        handleSendTelegram={handleSendTelegram}
                                        isUpdating={updatingIds.has(order['Order ID'])}
                                        isBinance={isBinance}
                                    />
                                );
                            }
                            return null;
                        })()}
                        {showVerify && !isSelectionMode && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); toggleOrderVerified(order['Order ID'], isVerified); }}
                                className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all active:scale-90 ${
                                    isVerified 
                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' 
                                    : 'bg-[var(--cm-card-bg2)] border-[var(--cm-border)] text-[var(--cm-text-muted)]'
                                }`}
                            >
                                {updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : <Check size={18} strokeWidth={3} />}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderOrderListRow = (order: ParsedOrder, idx: number) => {
        const isSelected = selectedIds.has(order['Order ID']);
        const isPaid = order['Payment Status'] === 'Paid';
        const orderTotal = Number(order['Grand Total']) || 0;
        const displayIndex = idx + 1;

        const id1 = order['Telegram Message ID 1'];
        const id2 = order['Telegram Message ID 2'];
        const isChecking = id1 === 'CHECKING';
        const isSent = (id1 && id2) && !isChecking;

        const displayPhone = formatPhone(order['Customer Phone']);
        const carrier = appData?.phoneCarriers?.find(c =>
            String(c.Prefixes || '').split(',').map(p => p.trim()).filter(Boolean).includes(displayPhone.substring(0, 3))
        );
        const carrierLogo = carrier?.CarrierLogoURL;

        const shippingMethod = appData?.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);
        const shippingLogo = shippingMethod?.LogoURL;

        const packagePhoto = order['Package Photo'];
        
        // Products logic for thumbnail
        const products = Array.isArray(order.Products) ? order.Products : [];
        const mainProduct = products[0];
        const productCount = products.length;

        return (
            <div 
                key={order['Order ID']} 
                onClick={() => (isSelectionMode || selectedIds.size > 0) ? onToggleSelect?.(order['Order ID']) : onView?.(order)}
                className={`relative flex items-center gap-3 px-4 py-3 border-b border-[var(--cm-border)] transition-colors active:bg-[var(--cm-card-bg2)] ${
                    isSelected ? 'bg-[var(--cm-accent-light)]' : 'bg-[var(--cm-card-bg)]'
                }`}
            >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${isPaid ? 'bg-emerald-500' : 'bg-red-500'}`} />
                
                <div className="w-6 shrink-0 flex justify-center">
                    {isSelectionMode ? (
                        <div 
                            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(order['Order ID']); }}
                            className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-[var(--cm-accent)] border-[var(--cm-accent)]' : 'border-[var(--cm-border)] bg-black/20'}`}
                        >
                            {isSelected && <Check size={12} className="text-black" strokeWidth={4} />}
                        </div>
                    ) : isVisible('index') && (
                        <span className="text-[10px] font-mono font-bold text-[var(--cm-text-muted)] opacity-30">{displayIndex}</span>
                    )}
                </div>

                {/* Product Thumbnail (Replacing Customer/Carrier Logo logic here as requested by user context) */}
                <div className="w-10 h-10 rounded-md bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] shrink-0 relative overflow-hidden hidden xs:block">
                    {mainProduct?.ProductImage ? (
                        <img 
                            src={convertGoogleDriveUrl(mainProduct.ProductImage)} 
                            className="w-full h-full object-cover" 
                            alt={mainProduct.ProductName || "Product"} 
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-[var(--cm-text-muted)] font-black text-center leading-tight">NO<br/>IMG</div>
                    )}
                    {productCount > 1 && (
                        <div className="absolute bottom-0 right-0 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] text-[8px] font-black px-1 rounded-tl-sm shadow-sm">
                            +{productCount - 1}
                        </div>
                    )}
                </div>

                {packagePhoto && (
                    <div className="w-10 h-10 rounded-md bg-black/20 border border-[var(--cm-border)] overflow-hidden shrink-0 hidden xs:block relative">
                        <img src={convertGoogleDriveUrl(packagePhoto)} className="w-full h-full object-cover" alt="PKG" />
                        <div className="absolute bottom-0 right-0 bg-blue-500 text-white text-[7px] font-black px-1 rounded-tl-sm">PKG</div>
                    </div>
                )}

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        {isVisible('customerName') && (
                            <h3 className="text-[13px] font-black text-[var(--cm-text-primary)] truncate uppercase tracking-tight">
                                {order['Customer Name']}
                            </h3>
                        )}
                        {isVisible('status') && (
                            <span className={`text-[8px] font-black px-1 py-0.5 rounded-sm ${isPaid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                {isPaid ? 'PAID' : 'UNPAID'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--cm-text-muted)]">
                        <div className="flex items-center gap-1 text-[var(--cm-accent)]">
                            {carrierLogo && <img src={convertGoogleDriveUrl(carrierLogo)} className="w-3 h-3 object-contain" alt="" />}
                            <span>{order['Customer Phone']}</span>
                        </div>
                        {isVisible('location') && (
                            <>
                                <span className="opacity-20">•</span>
                                <span className="truncate flex-1">{order.Location || 'N/A'}</span>
                            </>
                        )}
                    </div>

                    {isVisible('shippingService') && (
                        <div className="flex items-center gap-1 text-[9px] font-medium text-[var(--cm-text-muted)] mt-1">
                            {shippingLogo && <img src={convertGoogleDriveUrl(shippingLogo)} className="w-2.5 h-2.5 object-contain opacity-70" alt="" />}
                            <span className="truncate">{order['Internal Shipping Method']}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {isVisible('total') && (
                        <div className="text-right">
                            <div className="text-[14px] font-black text-[var(--cm-text-primary)] italic tabular-nums leading-none">
                                <span className="text-[10px] text-[var(--cm-accent)] mr-0.5">$</span>
                                {orderTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </div>
                        </div>
                    )}
                    
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {isVisible('actions') && canEditOrder(order) && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onEdit?.(order); }} 
                                className="w-8 h-8 flex items-center justify-center bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] text-[var(--cm-text-muted)] rounded-md active:scale-90 transition-all"
                            >
                                <Edit2 size={14} />
                            </button>
                        )}
                        {isVisible('telegramStatus') && (
                            isSent ? (
                                <div className="w-8 h-8 flex items-center justify-center bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20 shadow-sm" title={t.msg_sent}>
                                    <Check size={14} strokeWidth={4} />
                                </div>
                            ) : isChecking ? (
                                <div className="flex flex-col items-center gap-0.5 animate-pulse">
                                    <Spinner size="xs" />
                                    <span className="text-[7px] font-black text-blue-400 uppercase">Checking</span>
                                </div>
                            ) : (
                                <TelegramSendButton 
                                    orderId={order['Order ID']}
                                    handleSendTelegram={handleSendTelegram}
                                    isUpdating={updatingIds.has(order['Order ID'])}
                                    isBinance={isBinance}
                                />
                            )
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col space-y-6 animate-fade-in">
            {groupedData.length === 0 || (groupedData.length === 1 && groupedData[0].orders.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--cm-text-muted)] opacity-50">
                    <div className="w-16 h-16 mb-4 rounded-full bg-[var(--cm-card-bg2)] flex items-center justify-center border border-[var(--cm-border)]">
                        <Clock size={32} strokeWidth={1} />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest">{t.no_orders || 'No Orders Found'}</p>
                </div>
            ) : (
                groupedData.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-4">
                        {group.label && (
                            <div className="flex items-center gap-3 px-4">
                                {isBinance ? (
                                    <>
                                        <div className="w-1 h-4 bg-[#FCD535] rounded-full shadow-[0_0_8px_rgba(252,213,53,0.4)]"></div>
                                        <span className="text-[10px] font-bold text-[#848E9C] uppercase tracking-tighter">{group.label}</span>
                                        <div className="h-[1px] flex-1 bg-[#2B3139]"></div>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-[10px] font-black text-[var(--cm-accent)] uppercase tracking-[0.2em]">{group.label}</span>
                                        <div className="h-px flex-1 bg-gradient-to-r from-[var(--cm-border)] to-transparent"></div>
                                    </>
                                )}
                            </div>
                        )}
                        
                        <div className={viewMode === 'card' ? "grid grid-cols-1 gap-4 px-4" : "flex flex-col border-y border-[var(--cm-border)] shadow-xl"}>
                            {group.orders.map((order, idx) => 
                                viewMode === 'card' ? renderOrderCard(order, idx) : renderOrderListRow(order, idx)
                            )}
                        </div>
                    </div>
                ))
            )}
            
            {displayCount < orders.length && (
                <div className="flex justify-center pt-4 pb-2 px-4">
                    <button 
                        onClick={handleLoadMore} 
                        className="w-full py-4 bg-[var(--cm-card-bg2)] text-[var(--cm-text-muted)] rounded-lg text-[11px] font-black uppercase tracking-[0.3em] border border-[var(--cm-border)] active:scale-[0.98] active:bg-[var(--cm-card-bg)] transition-all shadow-lg hover:border-[var(--cm-accent)] hover:text-[var(--cm-accent)]"
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

export default memo(OrdersListMobile);

