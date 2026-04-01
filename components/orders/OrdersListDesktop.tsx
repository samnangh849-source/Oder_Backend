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
        showBorders, copiedTemplateId, appData, t, groupByLabel, isBinance
    } = data;
    
    const item = items[index];
    if (!item) return null;

    if (item.type === 'header') {
        return (
            <div style={style} className={`${isBinance ? 'bg-[#1E2329] border-y border-[#2B3139]' : 'bg-white/[0.03] backdrop-blur-md border-y border-white/5'} flex items-center px-6 z-10`}>
                <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-5 ${isBinance ? 'bg-[#FCD535]' : 'bg-blue-500 rounded-full'}`} style={isBinance ? { borderRadius: '1px' } : undefined}></div>
                    <span className={`text-xs font-bold ${isBinance ? 'text-[#EAECEF]' : 'text-white italic'} uppercase tracking-wider`}>
                        {groupByLabel}: <span className={`${isBinance ? 'text-[#FCD535]' : 'text-blue-400'} ml-1`}>{item.label}</span>
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
        <div style={style} className="group box-border">
            <style>{`
                .os-tooltip-trigger { position: relative; }
                .os-tooltip {
                    position: absolute;
                    bottom: calc(100% + 5px);
                    left: 20px;
                    padding: 8px 12px;
                    background: #1E2329;
                    border: 1px solid #2B3139;
                    border-radius: 4px;
                    color: white;
                    font-size: 11px;
                    font-weight: 600;
                    white-space: pre-wrap;
                    width: max-content;
                    max-width: 260px;
                    z-index: 1000;
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(5px);
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    pointer-events: none;
                }
                .os-tooltip-trigger:hover .os-tooltip {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                }
            `}</style>
            <div className={`flex h-full transition-all box-border ${isBinance ? 'border-b border-[#2B3139]' : 'border-b border-white/10'} ${isVerified ? 'bg-[#0ECB81]/[0.02]' : isSelected ? 'bg-[#FCD535]/[0.05]' : 'hover:bg-[#2B3139]/30'}`}>
                {onToggleSelect && (
                    <div className={`flex-shrink-0 flex items-center justify-center px-0.5 box-border ${showBorders ? (isBinance ? 'border-r border-[#2B3139]' : 'border-r border-white/10') : ''}`} style={{ width: '40px' }}>
                        <input 
                            type="checkbox" 
                            className={`h-4 w-4 rounded border-[#474D57] bg-transparent text-[#FCD535] cursor-pointer focus:ring-0 focus:ring-offset-0 ${isBinance ? 'border-[#474D57]' : 'border-white/20 bg-black/40 text-blue-500'}`} 
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
                                return <div className="font-bold text-[#848E9C] text-xs text-center w-full">{item.originalIndex + 1}</div>;
                            case 'actions':
                                return (
                                    <div className="flex items-center justify-center gap-2 w-full">
                                        <button onClick={() => onView && onView(order)} className="w-8 h-8 flex items-center justify-center bg-[#2B3139] hover:bg-[#363C44] text-[#848E9C] hover:text-white rounded transition-all" title="View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c3.478 0 6.991 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2}/></svg></button>
                                        {allowEdit && <button onClick={() => onEdit && onEdit(order)} className="w-8 h-8 flex items-center justify-center bg-[#2B3139] hover:bg-[#363C44] text-[#FCD535] rounded transition-all" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>}
                                    </div>
                                );
                            case 'customerName':
                                return (
                                    <div className="w-full overflow-hidden">
                                        <div className="font-bold text-[#EAECEF] truncate mb-0.5 text-[14px]">{order['Customer Name']}</div>
                                        <div className="flex items-center gap-2">
                                            {carrierLogo && <img src={convertGoogleDriveUrl(carrierLogo)} className="w-3.5 h-3.5 object-contain" alt="" />}
                                            <div className="text-[#848E9C] font-bold text-[11px] tracking-tight">{displayPhone}</div>
                                        </div>
                                    </div>
                                );
                            case 'productInfo':
                                return (
                                    <div className="w-full overflow-hidden flex items-center">
                                        <div className="flex items-center gap-3 w-full">
                                            <div className="flex -space-x-2 items-center shrink-0">
                                                {productThumbnails.slice(0, 3).map((p: any, i: number) => (
                                                    <div key={i} className="relative">
                                                        <div className="w-10 h-10 rounded bg-[#2B3139] border border-[#363C44] overflow-hidden">
                                                            {p.img ? <img src={p.img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-[#848E9C]">No Pic</div>}
                                                        </div>
                                                        <div className="absolute -top-1 -right-1 bg-[#FCD535] text-[#181A20] text-[9px] font-bold px-1 rounded-sm border border-[#181A20]">
                                                            {p.quantity}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[12px] font-bold text-[#EAECEF] truncate uppercase tracking-tight leading-none">{order.Products[0]?.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-medium text-[#848E9C] uppercase tracking-wider leading-none">{order.Products.length} Items</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            case 'location':
                                return (
                                    <div className="w-full overflow-hidden">
                                        <div className="font-bold text-[#EAECEF] text-[12px] truncate leading-tight uppercase tracking-tight">{order.Location}</div>
                                        <div className="text-[10px] text-[#848E9C] font-medium truncate mt-0.5">{order['Address Details']}</div>
                                    </div>
                                );
                            case 'pageInfo':
                                return (
                                    <div className={`w-full flex items-center gap-2.5 ${tooltipTriggerClass}`}>
                                        <div className="os-tooltip">{order.Page}</div>
                                        {pageLogoUrl && <img src={pageLogoUrl} className="w-8 h-8 rounded border border-[#2B3139] object-cover" alt="" />}
                                        <span className="font-bold text-[#848E9C] text-[11px] uppercase truncate tracking-tight">{order.Page}</span>
                                    </div>
                                );
                            case 'brandSales':
                            case 'fulfillment':
                                return (
                                    <div className="w-full flex items-center overflow-hidden">
                                        <span className="px-2 py-1 rounded bg-[#2B3139] text-[#EAECEF] font-bold text-[10px] uppercase tracking-tight truncate block text-center w-full">
                                            {order['Fulfillment Store']}
                                        </span>
                                    </div>
                                );
                            case 'total':
                                return (
                                    <div className="w-full flex items-center">
                                        <div className="font-bold text-[#EAECEF] text-[16px] tracking-tight">
                                            <span className="text-[11px] mr-0.5">$</span>
                                            {(Number(order['Grand Total']) || 0).toFixed(2)}
                                        </div>
                                    </div>
                                );
                            case 'shippingService':
                                return (
                                    <div className={`w-full flex items-center ${tooltipTriggerClass}`}>
                                        <div className="os-tooltip">{order['Internal Shipping Method']}</div>
                                        <div className="flex items-center gap-2 bg-[#2B3139]/50 p-1.5 rounded border border-[#2B3139] overflow-hidden w-full">
                                            <div className="w-6 h-6 bg-[#2B3139] rounded flex items-center justify-center flex-shrink-0">
                                                {shippingLogo ? <img src={convertGoogleDriveUrl(shippingLogo)} className="w-4 h-4 object-contain" alt="" /> : <span className="text-[8px] text-[#848E9C]">N/A</span>}
                                            </div>
                                            <span className="text-[10px] font-bold text-[#848E9C] uppercase truncate tracking-tight">{order['Internal Shipping Method'] || 'N/A'}</span>
                                        </div>
                                    </div>
                                );
                            case 'driver':
                                return <div className="w-full font-bold text-[#848E9C] text-[11px] uppercase truncate tracking-tight flex items-center">{order['Driver Name'] || order['Internal Shipping Details'] || 'Unassigned'}</div>;
                            case 'shippingCost':
                                return <div className="w-full font-bold text-[#848E9C] text-[12px] flex items-center">${(Number(order['Internal Cost']) || 0).toFixed(2)}</div>;
                            case 'fulfillmentStatus': {
                                const fs = (order as any).FulfillmentStatus || (order as any)['Fulfillment Status'] || 'Pending';
                                const fsColors: Record<string, string> = {
                                    'Pending': 'bg-yellow-500/10 text-yellow-400',
                                    'Scheduled': 'bg-cyan-500/10 text-cyan-400',
                                    'Ready to Ship': 'bg-blue-500/10 text-blue-400',
                                    'Shipped': 'bg-purple-500/10 text-purple-400',
                                    'Delivered': 'bg-[#0ECB81]/10 text-[#0ECB81]',
                                    'Cancelled': 'bg-[#F6465D]/10 text-[#F6465D]',
                                };
                                return (
                                    <div className="w-full flex items-center justify-center">
                                        <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${fsColors[fs] || 'bg-[#2B3139] text-[#848E9C]'}`}>
                                            {fs}
                                        </span>
                                    </div>
                                );
                            }
                            case 'status':
                                return (
                                    <div className="w-full flex items-center justify-center">
                                        <span className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${order['Payment Status'] === 'Paid' ? 'bg-[#0ECB81]/10 text-[#0ECB81]' : 'bg-[#F6465D]/10 text-[#F6465D]'}`}>
                                            {order['Payment Status']}
                                        </span>
                                    </div>
                                );
                            case 'date':
                                return (
                                    <div className="w-full flex flex-col justify-center leading-tight">
                                        <span className="font-bold text-[#EAECEF] text-[11px] tracking-tight">{orderDate.toLocaleDateString('km-KH')}</span>
                                        <span className="text-[#848E9C] font-medium text-[10px] uppercase tracking-wider">{orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                );
                            case 'note':
                                return (
                                    <div className="w-full text-[11px] text-[#848E9C] font-medium truncate flex items-center italic">
                                        {order.Note || '---'}
                                    </div>
                                );
                            case 'print':
                                return (
                                    <div className="w-full flex items-center justify-center gap-2">
                                        <button onClick={() => handleCopyTemplate(order)} className={`w-8 h-8 flex items-center justify-center rounded transition-all border ${copiedTemplateId === order['Order ID'] ? 'bg-[#FCD535] border-[#FCD535] text-[#181A20]' : 'bg-[#2B3139] text-[#848E9C] hover:text-white border-[#363C44]'}`} title="Copy Template"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                                        <button onClick={() => handlePrint(order)} className="w-8 h-8 flex items-center justify-center bg-[#2B3139] hover:bg-[#0ECB81] text-[#848E9C] hover:text-white rounded transition-all border border-[#363C44]" title="Print Label"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" /></svg></button>
                                    </div>
                                );
                            case 'check':
                                return (
                                    <div className="w-full flex items-center justify-center">
                                        <div className={`h-6 w-6 rounded border flex items-center justify-center transition-all ${isVerified ? 'bg-[#0ECB81] border-[#0ECB81]' : 'border-[#474D57] hover:border-[#FCD535]'} ${canVerifyOrder() ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={() => canVerifyOrder() && !updatingIds.has(order['Order ID']) && toggleOrderVerified(order['Order ID'], order.IsVerified)}>
                                            {updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : isVerified && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                    </div>
                                );
                            case 'orderId':
                                return <div className="text-center flex items-center justify-center w-full"><button onClick={() => handleCopy(order['Order ID'])} className="text-[10px] font-bold font-mono text-[#848E9C] hover:text-[#FCD535] transition-colors uppercase tracking-tight">{order['Order ID'].substring(0, 6)}</button></div>;
                            default:
                                return null;
                        }
                    })();

                    return (
                        <div key={k} style={{ width: `${width}px` }} className={`flex-shrink-0 flex items-center px-4 box-border ${showBorders ? (isBinance ? 'border-r border-[#2B3139]' : 'border-r border-white/10') : ''}`}>
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
    const { appData, currentUser, hasPermission, language, advancedSettings } = useContext(AppContext);
    const t = translations[language];
    const isBinance = advancedSettings?.uiTheme === 'binance';

    const ROW_HEIGHT = isBinance ? 72 : 88;
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
            fulfillmentStatus: 120,
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
        'driver', 'shippingCost', 'fulfillmentStatus', 'status', 'date', 'note', 'print', 'check', 'orderId'
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
                    shippingLogo: shippingMethod?.LogoURL || '',
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
        groupByLabel: groupBy,
        isBinance
    }), [
        enrichedItems, visibleCols, getColWidth, onToggleSelect, selectedIds,
        onView, onEdit, handleCopyTemplate, handlePrint, handleCopy,
        toggleOrderVerified, updatingIds, canVerifyOrder, canEditOrder,
        showBorders, copiedTemplateId, appData, t, groupBy, isBinance
    ]);

    return (
        <div className={`${isBinance ? 'bg-[#0B0E11] border-[#2B3139]' : 'bg-[#020617] border-white/5 shadow-2xl'} rounded-none border flex flex-col h-full min-h-[400px] overflow-hidden relative`}>
            <div className="flex-grow overflow-auto custom-scrollbar overscroll-contain">
                <div style={{ minWidth: `${totalTableWidth}px`, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Sticky Table Header & Total Row */}
                    <div className={`sticky top-0 z-40 ${isBinance ? 'shadow-[0_4px_12px_rgba(0,0,0,0.5)]' : 'shadow-[0_15px_30px_rgba(0,0,0,0.6)]'} flex-shrink-0`}>
                        {/* Grand Total Row (Now on top) */}
                        <div className="w-full">
                            <DesktopGrandTotalRow 
                                totals={totals} 
                                isVisible={checkColumnVisible} 
                                showSelection={!!onToggleSelectAll} 
                                getColWidth={getColWidth}
                            />
                        </div>

                        {/* Table Column Headers (Now below Grand Total) */}
                        <div className={`${isBinance ? 'bg-[#1E2329] border-b border-[#2B3139]' : 'bg-[#0f172a]/98 backdrop-blur-3xl border-b border-white/10'}`}>
                            <div className="flex w-full box-border">
                                {onToggleSelectAll && (
                                    <div className={`flex-shrink-0 flex items-center justify-center py-4 px-0.5 box-border ${showBorders ? (isBinance ? 'border-r border-[#2B3139]' : 'border-r border-white/10') : ''}`} style={{ width: '40px' }}>
                                        <input 
                                            type="checkbox" 
                                            className={`h-4 w-4 rounded border-[#474D57] bg-transparent text-[#FCD535] cursor-pointer focus:ring-0 focus:ring-offset-0 ${isBinance ? 'border-[#474D57]' : 'border-white/20 bg-black/40 text-blue-500'}`} 
                                            checked={isAllSelected} 
                                            onChange={() => onToggleSelectAll(orders.map(o => o['Order ID']))} 
                                        />
                                    </div>
                                )}
                                {visibleCols.map(k => (
                                    <div 
                                        key={k} 
                                        style={{ width: `${getColWidth(k)}px` }} 
                                        className={`px-4 py-4 box-border ${isBinance ? 'font-black tracking-normal text-[#848E9C]' : 'font-black tracking-[0.1em] text-gray-400'} uppercase text-[10px] flex items-center ${k === 'index' || k === 'actions' || k === 'status' || k === 'fulfillmentStatus' || k === 'print' || k === 'check' || k === 'orderId' ? 'justify-center text-center' : 'justify-start text-left'} ${showBorders ? (isBinance ? 'border-r border-[#2B3139]' : 'border-r border-white/10') : ''}`}
                                    >
                                        {(t as any)[`col_${k}`] || (t as any)[k] || k}
                                    </div>
                                ))}
                            </div>
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
