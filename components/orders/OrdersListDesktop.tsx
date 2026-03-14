import React, { useContext, useRef, useMemo, useCallback, useState } from 'react';
import { List } from 'react-window';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import Spinner from '../common/Spinner';
import { DesktopGrandTotalRow } from './OrderGrandTotal';
import { translations } from '../../translations';

interface OrdersListDesktopProps {
    orders: ParsedOrder[];
    totals: { grandTotal: number; internalCost: number; count: number; paidCount: number; unpaidCount: number };
    visibleColumns?: Set<string>;
    selectedIds: Set<string>;
    onToggleSelect?: (id: string) => void;
    onToggleSelectAll?: (ids: string[]) => void;
    onEdit?: (order: ParsedOrder) => void;
    onView?: (order: ParsedOrder) => void;
    handlePrint: (order: ParsedOrder) => void;
    handleCopy: (id: string) => void;
    handleCopyTemplate: (order: ParsedOrder) => void;
    copiedId: string | null;
    copiedTemplateId: string | null;
    toggleOrderVerified: (id: string, currentStatus: any) => void;
    updatingIds: Set<string>;
    showBorders?: boolean;
    groupBy?: string;
}

// Row component compatible with react-window 2.x
const OrderRow = (props: any) => {
    const { index, style, ...data } = props;
    const { 
        items, visibleCols, getColWidth, onToggleSelect, selectedIds, 
        onView, onEdit, handleCopyTemplate, handlePrint, handleCopy,
        toggleOrderVerified, updatingIds, canVerifyOrder, canEditOrder,
        showBorders, copiedTemplateId, appData, t, groupByLabel
    } = data;
    
    const item = items[index];
    if (!item) return null;

    if (item.type === 'header') {
        return (
            <div style={style} className="bg-white/[0.03] backdrop-blur-md border-y border-white/5 flex items-center px-6 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                    <span className="text-xs font-black text-white uppercase tracking-[0.3em] italic">
                        {groupByLabel}: <span className="text-blue-400 ml-1">{item.label}</span>
                    </span>
                </div>
            </div>
        );
    }

    const order = item.data;
    const isVerified = String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
    const isSelected = selectedIds.has(order['Order ID']);
    const allowEdit = canEditOrder(order);
    
    const { 
        displayPhone, carrierLogo, pageLogoUrl, shippingLogo, orderDate,
        productThumbnails
    } = item.enriched;

    return (
        <div style={style} className="group">
            <style>{`
                .os-tooltip-trigger { position: relative; }
                .os-tooltip {
                    position: absolute;
                    bottom: calc(100% + 5px);
                    left: 20px;
                    padding: 8px 12px;
                    background: rgba(15, 23, 42, 0.98);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 10px;
                    color: white;
                    font-size: 11px;
                    font-weight: 700;
                    white-space: pre-wrap;
                    width: max-content;
                    max-width: 260px;
                    z-index: 1000;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(5px);
                    transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
                    pointer-events: none;
                }
                .os-tooltip-trigger:hover .os-tooltip {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                }
                .os-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    left: 15px;
                    border-left: 5px solid transparent;
                    border-right: 5px solid transparent;
                    border-top: 5px solid rgba(15, 23, 42, 0.98);
                }
                /* Flip tooltip for top rows to avoid header conflict */
                .os-tooltip-trigger.is-top .os-tooltip {
                    bottom: auto;
                    top: calc(100% + 5px);
                    transform: translateY(-5px);
                }
                .os-tooltip-trigger.is-top:hover .os-tooltip {
                    transform: translateY(0);
                }
                .os-tooltip-trigger.is-top .os-tooltip::after {
                    top: auto;
                    bottom: 100%;
                    border-top: none;
                    border-bottom: 5px solid rgba(15, 23, 42, 0.98);
                }
            `}</style>
            <div className={`flex h-full transition-all duration-300 border-b border-white/[0.08] ${isVerified ? 'bg-emerald-500/[0.04]' : isSelected ? 'bg-blue-500/[0.08]' : 'hover:bg-white/[0.05]'} ${showBorders ? 'border-x border-white/10' : ''}`}>
                {onToggleSelect && (
                    <div className="flex-shrink-0 flex items-center justify-center px-0.5" style={{ width: '40px' }}>
                        <input 
                            type="checkbox" 
                            className="h-5 w-5 rounded border-white/10 bg-black/40 text-blue-500 cursor-pointer focus:ring-0" 
                            checked={isSelected} 
                            onChange={() => onToggleSelect(order['Order ID'])} 
                        />
                    </div>
                )}

                {visibleCols.map((k: string) => {
                    const width = getColWidth(k);
                    const isTopRow = index < 5;
                    const tooltipTriggerClass = `os-tooltip-trigger ${isTopRow ? 'is-top' : ''}`;

                    const content = (() => {
                        switch (k) {
                            case 'index':
                                return <div className="font-bold text-gray-600 text-sm text-center w-full">{item.originalIndex + 1}</div>;
                            case 'actions':
                                return (
                                    <div className="flex items-center justify-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity w-full">
                                        <button onClick={() => onView && onView(order)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/5 shadow-lg" title="View"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c3.478 0 6.991 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2.5}/></svg></button>
                                        {allowEdit && <button onClick={() => onEdit && onEdit(order)} className="w-10 h-10 flex items-center justify-center bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all border border-blue-500/20 shadow-lg" title="Edit"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg></button>}
                                    </div>
                                );
                            case 'customerName':
                                return (
                                    <div className="px-6 py-2 w-full overflow-hidden">
                                        <div className="font-black text-gray-100 truncate mb-1 text-[15px]">{order['Customer Name']}</div>
                                        <div className="flex items-center gap-2">
                                            {carrierLogo && <img src={convertGoogleDriveUrl(carrierLogo)} className="w-4 h-4 object-contain" alt="" />}
                                            <div className="text-gray-500 font-mono font-black text-[12px] tracking-tight">{displayPhone}</div>
                                        </div>
                                    </div>
                                );
                            case 'productInfo':
                                return (
                                    <div className="px-6 py-2 w-full overflow-hidden flex items-center">
                                        <div className="flex items-center gap-3 w-full">
                                            <div className="flex -space-x-4 hover:space-x-1 transition-all duration-500 items-center shrink-0">
                                                {productThumbnails.slice(0, 3).map((p: any, i: number) => (
                                                    <div key={i} className="relative group/prod">
                                                        <div className="w-12 h-12 rounded-2xl bg-gray-800 border-2 border-[#020617] overflow-hidden shadow-2xl transition-all group-hover/prod:scale-110 group-hover/prod:z-10 group-hover/prod:border-blue-500/50">
                                                            {p.img ? <img src={p.img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-500 italic">No Pic</div>}
                                                        </div>
                                                        <div className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[10px] font-black w-5 h-5 rounded-lg flex items-center justify-center border-2 border-[#020617] shadow-lg transform rotate-3 group-hover/prod:rotate-0 transition-transform">
                                                            {p.quantity}
                                                        </div>
                                                    </div>
                                                ))}
                                                {order.Products.length > 3 && (
                                                    <div className="w-12 h-12 rounded-2xl bg-[#0f172a] border-2 border-[#020617] flex items-center justify-center text-[11px] font-black text-blue-400 z-0 shadow-2xl">
                                                        +{order.Products.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <span className="text-[12px] font-black text-white truncate uppercase tracking-tight leading-none italic">{order.Products[0]?.name}</span>
                                                    <div className="w-1 h-1 rounded-full bg-blue-500/40"></div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{order.Products.length} Items</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            case 'location':
                                return (
                                    <div className="px-4 py-2 w-full overflow-hidden">
                                        <div className="font-black text-gray-300 text-[13px] truncate leading-tight uppercase tracking-tight">{order.Location}</div>
                                        <div className="text-[11px] text-gray-600 font-bold truncate mt-1 italic">{order['Address Details']}</div>
                                    </div>
                                );
                            case 'pageInfo':
                                return (
                                    <div className={`px-4 py-2 w-full flex items-center gap-3 ${tooltipTriggerClass}`}>
                                        <div className="os-tooltip">{order.Page}</div>
                                        {pageLogoUrl && <img src={pageLogoUrl} className="w-10 h-10 rounded-xl border border-white/5 object-cover shadow-xl" alt="" />}
                                        <span className="font-black text-gray-500 text-[11px] uppercase truncate tracking-tighter">{order.Page}</span>
                                    </div>
                                );
                            case 'brandSales':
                            case 'fulfillment':
                                return (
                                    <div className="px-4 py-2 w-full flex items-center overflow-hidden">
                                        <span className="px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 font-black text-[11px] uppercase tracking-tighter truncate block text-center w-full">
                                            {order['Fulfillment Store']}
                                        </span>
                                    </div>
                                );
                            case 'total':
                                return (
                                    <div className="px-6 py-2 w-full flex items-center">
                                        <div className="font-black text-blue-400 text-[18px] tracking-tighter italic drop-shadow-[0_0_8px_rgba(37,99,235,0.2)]">
                                            <span className="text-[12px] align-top mr-0.5">$</span>
                                            {(Number(order['Grand Total']) || 0).toFixed(2)}
                                        </div>
                                    </div>
                                );
                            case 'shippingService':
                                return (
                                    <div className={`px-4 py-2 w-full flex items-center ${tooltipTriggerClass}`}>
                                        <div className="os-tooltip">{order['Internal Shipping Method']}</div>
                                        <div className="flex items-center gap-2 bg-black/30 p-2 rounded-xl border border-white/5 shadow-inner overflow-hidden w-full">
                                            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                                                {shippingLogo ? <img src={convertGoogleDriveUrl(shippingLogo)} className="w-6 h-6 object-contain opacity-90" alt="" /> : <span className="text-[10px] text-gray-600">N/A</span>}
                                            </div>
                                            <span className="text-[11px] font-black text-gray-400 uppercase truncate tracking-tighter">{order['Internal Shipping Method'] || 'N/A'}</span>
                                        </div>
                                    </div>
                                );
                            case 'driver':
                                return <div className="px-4 py-2 w-full font-black text-orange-400/80 text-[12px] uppercase truncate tracking-tight flex items-center">{order['Driver Name'] || 'Unassigned'}</div>;
                            case 'shippingCost':
                                return <div className="px-4 py-2 w-full font-mono font-black text-orange-500/60 text-[14px] flex items-center">${(Number(order['Internal Cost']) || 0).toFixed(2)}</div>;
                            case 'status':
                                return (
                                    <div className="px-6 py-2 w-full flex items-center justify-center">
                                        <span className={`px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'}`}>
                                            {order['Payment Status']}
                                        </span>
                                    </div>
                                );
                            case 'date':
                                return (
                                    <div className="px-2 py-2 w-full flex flex-col justify-center leading-tight">
                                        <span className="font-black text-gray-400 text-[12px] tracking-tighter">{orderDate.toLocaleDateString('km-KH')}</span>
                                        <span className="text-gray-600 font-bold text-[11px] uppercase tracking-widest">{orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                    </div>
                                );
                            case 'note':
                                return (
                                    <div className="px-4 py-2 w-full text-[12px] text-gray-500 font-medium truncate italic flex items-center group-hover:text-gray-300 transition-colors">
                                        {order.Note || '---'}
                                    </div>
                                );
                            case 'print':
                                return (
                                    <div className="px-4 py-2 w-full flex items-center justify-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleCopyTemplate(order)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border shadow-lg ${copiedTemplateId === order['Order ID'] ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 text-gray-500 hover:text-white border-white/5'}`} title="Copy Template"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                                        <button onClick={() => handlePrint(order)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-emerald-600 text-gray-500 hover:text-white rounded-xl transition-all border border-white/5 shadow-lg" title="Print Label"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" /></svg></button>
                                    </div>
                                );
                            case 'check':
                                return (
                                    <div className="px-2 py-2 w-full flex items-center justify-center">
                                        <div className={`h-8 w-8 rounded-xl border-2 flex items-center justify-center transition-all duration-500 shadow-lg ${isVerified ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] rotate-[360deg]' : 'border-gray-800 hover:border-emerald-500/50'} ${canVerifyOrder() ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={() => canVerifyOrder() && !updatingIds.has(order['Order ID']) && toggleOrderVerified(order['Order ID'], order.IsVerified)}>
                                            {updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : isVerified && <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                    </div>
                                );
                            case 'orderId':
                                return <div className="px-2 py-2 w-full text-center flex items-center justify-center"><button onClick={() => handleCopy(order['Order ID'])} className="text-[11px] font-black font-mono text-gray-700 hover:text-blue-400 transition-colors uppercase tracking-tight">{order['Order ID'].substring(0, 6)}</button></div>;
                            default:
                                return null;
                        }
                    })();

                    return (
                        <div key={k} style={{ width: `${width}px` }} className={`flex-shrink-0 flex items-center ${showBorders ? 'border-r border-white/10' : ''}`}>
                            {content}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const OrdersListDesktop: React.FC<OrdersListDesktopProps> = ({
    orders, totals, visibleColumns, selectedIds, onToggleSelect, onToggleSelectAll,
    onEdit, onView, handlePrint, handleCopy, handleCopyTemplate, copiedId, copiedTemplateId,
    toggleOrderVerified, updatingIds, showBorders = false, groupBy = 'none'
}) => {
    const { appData, currentUser, hasPermission, language } = useContext(AppContext);
    const t = translations[language];
    
    const ROW_HEIGHT = 88;
    const GROUP_HEADER_HEIGHT = 45;

    const checkColumnVisible = useCallback((key: string) => !visibleColumns || visibleColumns.has(key), [visibleColumns]);
    const isAllSelected = orders.length > 0 && orders.every(o => selectedIds.has(o['Order ID']));

    const getColWidth = useCallback((key: string): number => {
        const screenWidth = window.innerWidth;
        const isUltraWide = screenWidth > 1600;
        const isCompact = screenWidth < 1366;

        const baseWidths: Record<string, number> = {
            index: 45,
            actions: 130,
            customerName: isUltraWide ? 220 : (isCompact ? 170 : 190),
            productInfo: isUltraWide ? 300 : (isCompact ? 220 : 260),
            location: isUltraWide ? 200 : (isCompact ? 150 : 170),
            pageInfo: 130,
            brandSales: 140,
            fulfillment: 130,
            total: 95,
            shippingService: 150,
            driver: 140,
            shippingCost: 90,
            status: 105,
            date: 105,
            note: isUltraWide ? 280 : (isCompact ? 180 : 220),
            print: 125,
            check: 65,
            orderId: 85
        };
        return baseWidths[key] || 150;
    }, []);

    const columnKeys = useMemo(() => [
        'index', 'actions', 'customerName', 'productInfo', 'location', 
        'pageInfo', 'brandSales', 'fulfillment', 'total', 'shippingService', 
        'driver', 'shippingCost', 'status', 'date', 'note', 'print', 'check', 'orderId'
    ], []);

    const visibleCols = useMemo(() => columnKeys.filter(checkColumnVisible), [columnKeys, checkColumnVisible]);
    
    const totalTableWidth = useMemo(() => {
        let width = onToggleSelectAll ? 40 : 0;
        visibleCols.forEach(k => { width += getColWidth(k); });
        return width;
    }, [visibleCols, onToggleSelectAll, getColWidth]);

    const getSafeDateObj = useCallback((dateStr: string) => {
        if (!dateStr) return new Date();
        const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5]));
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    }, []);

    const formatPhone = useCallback((val: string) => {
        let phone = (val || '').replace(/[^0-9]/g, '');
        if (phone.length > 0) phone = '0' + phone.replace(/^0+/, '');
        return phone;
    }, []);

    const enrichedItems = useMemo(() => {
        let rawItems: any[] = [];
        if (groupBy === 'none') {
            rawItems = orders.map((o, idx) => ({ type: 'order' as const, data: o, originalIndex: idx }));
        } else {
            const sorted = [...orders].sort((a: any, b: any) => String(a[groupBy] || '').toLowerCase().localeCompare(String(b[groupBy] || '').toLowerCase()));
            let currentGroup = '';
            sorted.forEach((order, idx) => {
                const groupVal = String((order as any)[groupBy] || 'Unassigned');
                if (groupVal !== currentGroup) { 
                    rawItems.push({ type: 'header', label: groupVal }); 
                    currentGroup = groupVal; 
                }
                rawItems.push({ type: 'order', data: order, originalIndex: orders.indexOf(order) });
            });
        }

        return rawItems.map(item => {
            if (item.type === 'header') return item;
            
            const order = item.data;
            const pageInfo = appData.pages?.find((p: any) => p.PageName === order.Page);
            const displayPhone = formatPhone(order['Customer Phone']);
            const carrier = appData.phoneCarriers?.find(c => c.Prefixes.split(',').map(p => p.trim()).includes(displayPhone.substring(0, 3)));
            const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);
            
            const productThumbnails = order.Products.map((p: any) => {
                const productData = appData.products?.find(pd => pd.ProductName === p.name);
                return {
                    img: productData ? convertGoogleDriveUrl(productData.ImageURL) : '',
                    quantity: p.quantity
                };
            });

            return {
                ...item,
                enriched: {
                    displayPhone,
                    carrierLogo: carrier?.CarrierLogoURL || '',
                    pageLogoUrl: pageInfo ? convertGoogleDriveUrl(pageInfo.PageLogoURL) : '',
                    shippingLogo: shippingMethod?.LogosURL || '',
                    orderDate: getSafeDateObj(order.Timestamp),
                    productThumbnails
                }
            };
        });
    }, [orders, groupBy, appData, formatPhone, getSafeDateObj]);

    const getItemSize = useCallback((index: number) => {
        return enrichedItems[index].type === 'header' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT;
    }, [enrichedItems, GROUP_HEADER_HEIGHT, ROW_HEIGHT]);

    const canEditOrder = useCallback((order: ParsedOrder) => {
        if (!currentUser) return false;
        const isVerified = String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
        if (isVerified) return currentUser.IsSystemAdmin || currentUser.Role === 'Admin';
        if (currentUser.IsSystemAdmin) return true;
        if (!hasPermission('edit_order')) return false;
        const userTeams = (currentUser.Team || '').split(',').map(t => t.trim());
        if (!userTeams.includes(order.Team)) return false;
        const orderTime = getSafeDateObj(order.Timestamp).getTime();
        return (Date.now() - orderTime) < 43200000;
    }, [currentUser, hasPermission, getSafeDateObj]);

    const canVerifyOrder = useCallback(() => currentUser?.IsSystemAdmin || hasPermission('verify_order'), [currentUser, hasPermission]);

    const rowProps = useMemo(() => ({
        items: enrichedItems,
        visibleCols,
        getColWidth,
        onToggleSelect,
        selectedIds,
        onView,
        onEdit,
        handleCopyTemplate,
        handlePrint,
        handleCopy,
        toggleOrderVerified,
        updatingIds,
        canVerifyOrder,
        canEditOrder,
        showBorders,
        copiedTemplateId,
        appData,
        t,
        groupByLabel: groupBy
    }), [
        enrichedItems, visibleCols, getColWidth, onToggleSelect, selectedIds, 
        onView, onEdit, handleCopyTemplate, handlePrint, handleCopy,
        toggleOrderVerified, updatingIds, canVerifyOrder, canEditOrder,
        showBorders, copiedTemplateId, appData, t, groupBy
    ]);

    return (
        <div className="bg-[#020617] rounded-none border border-white/5 flex flex-col h-full min-h-[400px] overflow-hidden shadow-2xl relative">
            <div className="flex-grow overflow-auto custom-scrollbar overscroll-contain">
                <div style={{ minWidth: `${totalTableWidth}px`, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Sticky Table Header & Total Row */}
                    <div className="sticky top-0 z-40 shadow-[0_15px_30px_rgba(0,0,0,0.5)] flex-shrink-0">
                        {/* Table Column Headers */}
                        <div className="bg-[#0f172a]/95 backdrop-blur-3xl border-b border-white/10">
                            <div className="flex w-full">
                                {onToggleSelectAll && (
                                    <div className="flex-shrink-0 flex items-center justify-center py-5" style={{ width: '40px' }}>
                                        <input 
                                            type="checkbox" 
                                            className="h-5 w-5 rounded-md border-white/10 bg-black/40 text-blue-500 cursor-pointer" 
                                            checked={isAllSelected} 
                                            onChange={() => onToggleSelectAll(orders.map(o => o['Order ID']))} 
                                        />
                                    </div>
                                )}
                                {visibleCols.map(k => (
                                    <div 
                                        key={k} 
                                        style={{ width: `${getColWidth(k)}px` }} 
                                        className={`px-4 py-5 font-black uppercase tracking-widest text-gray-500 text-[11px] flex items-center ${k === 'index' || k === 'actions' || k === 'status' || k === 'print' || k === 'check' || k === 'orderId' ? 'justify-center text-center' : 'justify-start text-left'}`}
                                    >
                                        {(t as any)[`col_${k}`] || (t as any)[k] || k}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Grand Total Row */}
                        <div className="bg-[#0f172a]/80 backdrop-blur-2xl border-b border-blue-500/20">
                            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                <colgroup>
                                    {onToggleSelectAll && <col style={{ width: '40px' }} />}
                                    {visibleCols.map(k => <col key={k} style={{ width: `${getColWidth(k)}px` }} />)}
                                </colgroup>
                                <tbody>
                                    <DesktopGrandTotalRow 
                                        totals={totals} 
                                        isVisible={checkColumnVisible} 
                                        showSelection={!!onToggleSelectAll} 
                                        showBorders={showBorders} 
                                    />
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Virtualized List Content */}
                    <div className="flex-grow">
                        <List
                            rowCount={enrichedItems.length}
                            rowHeight={getItemSize}
                            rowComponent={OrderRow}
                            rowProps={rowProps}
                            className="custom-scrollbar"
                            style={{ height: '800px' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrdersListDesktop;
