import React, { useContext, useRef, useState, useMemo } from 'react';
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

const OrdersListDesktop: React.FC<OrdersListDesktopProps> = ({
    orders, totals, visibleColumns, selectedIds, onToggleSelect, onToggleSelectAll,
    onEdit, onView, handlePrint, handleCopy, handleCopyTemplate, copiedId, copiedTemplateId,
    toggleOrderVerified, updatingIds, showBorders = false, groupBy = 'none'
}) => {
    const { appData, currentUser, hasPermission, language } = useContext(AppContext);
    const t = translations[language];
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    
    const ROW_HEIGHT = 88;
    const GROUP_HEADER_HEIGHT = 45;
    const OVERSCAN = 10;

    const checkColumnVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
    const isAllSelected = orders.length > 0 && orders.every(o => selectedIds.has(o['Order ID']));

    // --- SMART COLUMN WIDTH DEFINITIONS ---
    const getColWidth = (key: string): number => {
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
    };

    const columnKeys = [
        'index', 'actions', 'customerName', 'productInfo', 'location', 
        'pageInfo', 'brandSales', 'fulfillment', 'total', 'shippingService', 
        'driver', 'shippingCost', 'status', 'date', 'note', 'print', 'check', 'orderId'
    ];

    const visibleCols = useMemo(() => columnKeys.filter(checkColumnVisible), [visibleColumns]);
    
    // Calculate total table width dynamically based on visible columns
    const totalTableWidth = useMemo(() => {
        let width = onToggleSelectAll ? 40 : 0;
        visibleCols.forEach(k => { width += getColWidth(k); });
        return width;
    }, [visibleCols, onToggleSelectAll]);

    const flatList = useMemo(() => {
        if (groupBy === 'none') return orders.map(o => ({ type: 'order' as const, data: o }));
        const sorted = [...orders].sort((a: any, b: any) => String(a[groupBy] || '').toLowerCase().localeCompare(String(b[groupBy] || '').toLowerCase()));
        const items: ({ type: 'order', data: ParsedOrder } | { type: 'header', label: string })[] = [];
        let currentGroup = '';
        sorted.forEach(order => {
            const groupVal = String((order as any)[groupBy] || 'Unassigned');
            if (groupVal !== currentGroup) { items.push({ type: 'header', label: groupVal }); currentGroup = groupVal; }
            items.push({ type: 'order', data: order });
        });
        return items;
    }, [orders, groupBy]);

    const { virtualItems, totalHeight } = useMemo(() => {
        let currentY = 0;
        const itemOffsets: number[] = [];
        flatList.forEach(item => { 
            itemOffsets.push(currentY); 
            currentY += item.type === 'header' ? GROUP_HEADER_HEIGHT : ROW_HEIGHT; 
        });
        const totalHeight = currentY;
        const containerHeight = containerRef.current?.clientHeight || 800;
        let startIndex = 0;
        for (let i = 0; i < itemOffsets.length; i++) { 
            if (itemOffsets[i] > scrollTop - (OVERSCAN * ROW_HEIGHT)) { startIndex = i; break; } 
        }
        startIndex = Math.max(0, startIndex - OVERSCAN);
        let endIndex = itemOffsets.length - 1;
        for (let i = startIndex; i < itemOffsets.length; i++) { 
            if (itemOffsets[i] > scrollTop + containerHeight + (OVERSCAN * ROW_HEIGHT)) { endIndex = i; break; } 
        }
        const virtualItems = [];
        for (let i = startIndex; i <= endIndex; i++) { 
            virtualItems.push({ index: i, item: flatList[i], offset: itemOffsets[i] }); 
        }
        return { virtualItems, totalHeight };
    }, [flatList, scrollTop]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop);

    const formatPhone = (val: string) => {
        let phone = (val || '').replace(/[^0-9]/g, '');
        if (phone.length > 0) phone = '0' + phone.replace(/^0+/, '');
        return phone;
    };

    const getSafeDateObj = (dateStr: string) => {
        if (!dateStr) return new Date();
        const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (match) return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5]));
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

    const canVerifyOrder = () => currentUser?.IsSystemAdmin || hasPermission('verify_order');

    return (
        <div className="bg-[#020617] rounded-[2.5rem] border border-white/5 flex flex-col h-full min-h-[400px] overflow-hidden shadow-2xl relative">
            <div ref={containerRef} className="flex-grow overflow-auto custom-scrollbar overscroll-contain" onScroll={handleScroll}>
                <div style={{ minWidth: `${totalTableWidth}px`, position: 'relative' }}>
                    {/* Sticky Table Header & Total Row */}
                    <div className="sticky top-0 z-40 shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
                        {/* Table Column Headers */}
                        <div className="bg-[#0f172a]/95 backdrop-blur-3xl border-b border-white/10">
                            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                <colgroup>
                                    {onToggleSelectAll && <col style={{ width: '40px' }} />}
                                    {visibleCols.map(k => <col key={k} style={{ width: `${getColWidth(k)}px` }} />)}
                                </colgroup>
                                <thead>
                                    <tr>
                                        {onToggleSelectAll && <th className="px-1 py-5 text-center"><input type="checkbox" className="h-5 w-5 rounded-md border-white/10 bg-black/40 text-blue-500 cursor-pointer" checked={isAllSelected} onChange={() => onToggleSelectAll(orders.map(o => o['Order ID']))} /></th>}
                                        {visibleCols.map(k => (
                                            <th key={k} className={`px-4 py-5 font-black uppercase tracking-widest text-gray-500 text-[11px] ${k === 'index' || k === 'actions' || k === 'status' || k === 'print' || k === 'check' || k === 'orderId' ? 'text-center' : 'text-left'}`}>
                                                {(t as any)[`col_${k}`] || (t as any)[k] || k}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                            </table>
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

                    {/* Virtualized Table Content */}
                    <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                        {virtualItems.map(({ item, offset }) => {
                            if (item.type === 'header') {
                                return (
                                    <div key={`header-${item.label}`} style={{ position: 'absolute', top: offset, height: GROUP_HEADER_HEIGHT, width: '100%' }} className="bg-white/[0.03] backdrop-blur-md border-y border-white/5 flex items-center px-6 z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                                            <span className="text-xs font-black text-white uppercase tracking-[0.3em] italic">{groupBy}: <span className="text-blue-400 ml-1">{item.label}</span></span>
                                        </div>
                                    </div>
                                );
                            }

                            const order = item.data;
                            const pageInfo = appData.pages?.find((p: any) => p.PageName === order.Page);
                            const logoUrl = pageInfo ? convertGoogleDriveUrl(pageInfo.PageLogoURL) : '';
                            const displayPhone = formatPhone(order['Customer Phone']);
                            const carrierLogo = appData.phoneCarriers?.find(c => c.Prefixes.split(',').map(p => p.trim()).includes(displayPhone.substring(0, 3)))?.CarrierLogoURL;
                            const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                            const shippingMethod = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method']);
                            const shippingLogo = shippingMethod?.LogosURL;
                            const orderDate = getSafeDateObj(order.Timestamp);
                            const allowEdit = canEditOrder(order);

                            return (
                                <div key={order['Order ID']} style={{ position: 'absolute', top: offset, height: ROW_HEIGHT, width: '100%' }} className="group">
                                    <table className="w-full h-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                        <colgroup>
                                            {onToggleSelectAll && <col style={{ width: '40px' }} />}
                                            {visibleCols.map(k => <col key={k} style={{ width: `${getColWidth(k)}px` }} />)}
                                        </colgroup>
                                        <tbody className="divide-y divide-white/10">
                                            <tr className={`transition-all duration-300 border-b border-white/[0.08] ${isVerified ? 'bg-emerald-500/[0.04]' : selectedIds.has(order['Order ID']) ? 'bg-blue-500/[0.08]' : 'hover:bg-white/[0.05]'} ${showBorders ? 'divide-x divide-white/10 border-x border-white/10' : ''}`}>
                                                {onToggleSelect && (<td className="px-0.5 py-2 text-center"><input type="checkbox" className="h-5 w-5 rounded border-white/10 bg-black/40 text-blue-500 cursor-pointer focus:ring-0" checked={selectedIds.has(order['Order ID'])} onChange={() => onToggleSelect(order['Order ID'])} /></td>)}
                                                
                                                {checkColumnVisible('index') && <td className="px-1 py-2 text-center font-bold text-gray-600 text-sm">{orders.findIndex(o => o['Order ID'] === order['Order ID']) + 1}</td>}
                                                
                                                {checkColumnVisible('actions') && (
                                                    <td className="px-2 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => onView && onView(order)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/5 shadow-lg" title="View"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c3.478 0 6.991 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2.5}/></svg></button>
                                                            {allowEdit && <button onClick={() => onEdit && onEdit(order)} className="w-10 h-10 flex items-center justify-center bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl transition-all border border-blue-500/20 shadow-lg" title="Edit"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg></button>}
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('customerName') && (
                                                    <td className="px-6 py-2">
                                                        <div className="font-black text-gray-100 truncate mb-1 text-[15px]">{order['Customer Name']}</div>
                                                        <div className="flex items-center gap-2">
                                                            {carrierLogo && <img src={convertGoogleDriveUrl(carrierLogo)} className="w-4 h-4 object-contain" alt="" />}
                                                            <div className="text-gray-500 font-mono font-black text-[12px] tracking-tight">{displayPhone}</div>
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('productInfo') && (
                                                    <td className="px-6 py-2">
                                                        <div className="flex -space-x-3 hover:space-x-1 transition-all duration-500 py-1 items-center">
                                                            {order.Products.slice(0, 3).map((p, i) => {
                                                                const productData = appData.products?.find(pd => pd.ProductName === p.name);
                                                                const img = productData ? convertGoogleDriveUrl(productData.ImageURL) : '';
                                                                return (
                                                                    <div key={i} className="relative group/prod">
                                                                        <div className="w-11 h-11 rounded-xl bg-gray-800 border-2 border-[#020617] overflow-hidden shadow-lg transition-transform group-hover/prod:scale-110 group-hover/prod:z-10">
                                                                            {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-500">N/A</div>}
                                                                        </div>
                                                                        <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#020617] shadow-lg">
                                                                            {p.quantity}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {order.Products.length > 3 && (
                                                                <div className="w-11 h-11 rounded-xl bg-gray-900 border-2 border-[#020617] flex items-center justify-center text-[10px] font-black text-gray-400 z-0 shadow-lg">
                                                                    +{order.Products.length - 3}
                                                                </div>
                                                            )}
                                                            <div className="ml-4 flex flex-col justify-center max-w-[140px]">
                                                                <span className="text-[11px] font-black text-gray-300 truncate leading-tight">{order.Products[0]?.name}</span>
                                                                {order.Products.length > 1 && <span className="text-[9px] font-bold text-gray-500 mt-0.5">and {order.Products.length - 1} more items</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('location') && (
                                                    <td className="px-4 py-2">
                                                        <div className="font-black text-gray-300 text-[13px] truncate leading-tight uppercase tracking-tight">{order.Location}</div>
                                                        <div className="text-[11px] text-gray-600 font-bold truncate mt-1 italic">{order['Address Details']}</div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('pageInfo') && (
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-3">
                                                            {logoUrl && <img src={logoUrl} className="w-10 h-10 rounded-xl border border-white/5 object-cover shadow-xl" alt="" />}
                                                            <span className="font-black text-gray-500 text-[11px] uppercase truncate tracking-tighter">{order.Page}</span>
                                                        </div>
                                                    </td>
                                                )}

                                                {checkColumnVisible('brandSales') && (
                                                    <td className="px-4 py-2">
                                                        <span className="px-3 py-2 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 font-black text-[11px] uppercase tracking-tighter truncate block text-center">
                                                            {order['Fulfillment Store']}
                                                        </span>
                                                    </td>
                                                )}

                                                {checkColumnVisible('fulfillment') && (
                                                    <td className="px-4 py-2">
                                                        <span className="font-black text-gray-500 text-[11px] uppercase truncate">{order['Fulfillment Store']}</span>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('total') && (
                                                    <td className="px-6 py-2">
                                                        <div className="font-black text-blue-400 text-[18px] tracking-tighter italic drop-shadow-[0_0_8px_rgba(37,99,235,0.2)]">
                                                            <span className="text-[12px] align-top mr-0.5">$</span>
                                                            {(Number(order['Grand Total']) || 0).toFixed(2)}
                                                        </div>
                                                    </td>
                                                )}

                                                {checkColumnVisible('shippingService') && (
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2 bg-black/30 p-2 rounded-xl border border-white/5 shadow-inner overflow-hidden">
                                                            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                                                                {shippingLogo ? <img src={convertGoogleDriveUrl(shippingLogo)} className="w-6 h-6 object-contain opacity-90" alt="" /> : <span className="text-[10px] text-gray-600">N/A</span>}
                                                            </div>
                                                            <span className="text-[11px] font-black text-gray-400 uppercase truncate tracking-tighter">{order['Internal Shipping Method'] || 'N/A'}</span>
                                                        </div>
                                                    </td>
                                                )}

                                                {checkColumnVisible('driver') && (
                                                    <td className="px-4 py-2">
                                                        <div className="font-black text-orange-400/80 text-[12px] uppercase truncate tracking-tight">{order['Driver Name'] || 'Unassigned'}</div>
                                                    </td>
                                                )}

                                                {checkColumnVisible('shippingCost') && (
                                                    <td className="px-4 py-2 font-mono font-black text-orange-500/60 text-[14px]">
                                                        ${(Number(order['Internal Cost']) || 0).toFixed(2)}
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('status') && (
                                                    <td className="px-6 py-2 text-center">
                                                        <span className={`px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'}`}>
                                                            {order['Payment Status']}
                                                        </span>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('date') && (
                                                    <td className="px-2 py-2 flex flex-col leading-tight pt-6">
                                                        <span className="font-black text-gray-400 text-[12px] tracking-tighter">{orderDate.toLocaleDateString('km-KH')}</span>
                                                        <span className="text-gray-600 font-bold text-[11px] uppercase tracking-widest">{orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                    </td>
                                                )}

                                                {checkColumnVisible('note') && (
                                                    <td className="px-4 py-2">
                                                        <div className="text-[12px] text-gray-500 font-medium truncate italic max-w-full group-hover:text-gray-300 transition-colors">
                                                            {order.Note || '---'}
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('print') && (
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleCopyTemplate(order)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border shadow-lg ${copiedTemplateId === order['Order ID'] ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 text-gray-500 hover:text-white border-white/5'}`} title="Copy Template"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                                                            <button onClick={() => handlePrint(order)} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-emerald-600 text-gray-500 hover:text-white rounded-xl transition-all border border-white/5 shadow-lg" title="Print Label"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" /></svg></button>
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('check') && (
                                                    <td className="px-2 py-2 text-center">
                                                        <div className={`h-8 w-8 mx-auto rounded-xl border-2 flex items-center justify-center transition-all duration-500 shadow-lg ${isVerified ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] rotate-[360deg]' : 'border-gray-800 hover:border-emerald-500/50'} ${canVerifyOrder() ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={() => canVerifyOrder() && !updatingIds.has(order['Order ID']) && toggleOrderVerified(order['Order ID'], order.IsVerified)}>
                                                            {updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : isVerified && <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('orderId') && <td className="px-2 py-2 text-center"><button onClick={() => handleCopy(order['Order ID'])} className="text-[11px] font-black font-mono text-gray-700 hover:text-blue-400 transition-colors uppercase tracking-tight">{order['Order ID'].substring(0, 6)}</button></td>}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrdersListDesktop;
