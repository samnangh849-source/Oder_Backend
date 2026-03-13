import React, { useContext, useRef, useState, useMemo } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import Spinner from '../common/Spinner';
import { DesktopGrandTotalRow } from './OrderGrandTotal';

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
    const { appData, previewImage, currentUser, hasPermission } = useContext(AppContext);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const ROW_HEIGHT = 72;
    const HEADER_HEIGHT = 45;
    const TOTAL_ROW_HEIGHT = 72; // DesktopGrandTotalRow is about this height
    const GROUP_HEADER_HEIGHT = 45;
    const OVERSCAN = 10;

    const checkColumnVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
    const isAllSelected = orders.length > 0 && orders.every(o => selectedIds.has(o['Order ID']));

    const getColWidth = (key: string) => {
        const width = window.innerWidth;
        const widths: any = {
            index: 'w-10',
            actions: 'w-32',
            customerName: width < 1440 ? 'w-36' : 'w-44',
            productInfo: width < 1366 ? 'w-44' : 'w-56',
            location: width < 1440 ? 'w-32' : 'w-40',
            pageInfo: 'w-28',
            brandSales: 'w-36',
            fulfillment: 'w-32',
            total: 'w-24',
            shippingService: width < 1440 ? 'w-14' : 'w-20',
            driver: 'w-36',
            shippingCost: 'w-24',
            status: 'w-24',
            date: 'w-20',
            note: width < 1600 ? 'w-48' : 'w-64',
            print: 'w-36',
            check: 'w-16',
            orderId: 'w-20'
        };
        return widths[key] || 'w-28';
    };

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

    const columnKeys = [
        'index', 'actions', 'customerName', 'productInfo', 'location', 
        'pageInfo', 'brandSales', 'fulfillment', 'total', 'shippingService', 
        'driver', 'shippingCost', 'status', 'date', 'note', 'print', 'check', 'orderId'
    ];

    const visibleColumnsList = columnKeys.filter(checkColumnVisible);

    return (
        <div className="bg-[#020617] rounded-[2.5rem] border border-white/5 flex flex-col h-full min-h-[400px] overflow-hidden shadow-2xl relative">
            <div ref={containerRef} className="flex-grow overflow-auto custom-scrollbar overscroll-contain" onScroll={handleScroll}>
                <div style={{ minWidth: '1600px', position: 'relative' }}>
                    {/* Sticky Table Header & Total Row */}
                    <div className="sticky top-0 z-40">
                        {/* Table Column Headers */}
                        <div className="bg-[#0f172a]/95 backdrop-blur-3xl border-b border-white/5 shadow-xl">
                            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                <colgroup>
                                    {onToggleSelectAll && <col className="w-8" />}
                                    {checkColumnVisible('index') && <col className={getColWidth('index')} />}
                                    {checkColumnVisible('actions') && <col className={getColWidth('actions')} />}
                                    {checkColumnVisible('customerName') && <col className={getColWidth('customerName')} />}
                                    {checkColumnVisible('productInfo') && <col className={getColWidth('productInfo')} />}
                                    {checkColumnVisible('location') && <col className={getColWidth('location')} />}
                                    {checkColumnVisible('pageInfo') && <col className={getColWidth('pageInfo')} />}
                                    {checkColumnVisible('brandSales') && <col className={getColWidth('brandSales')} />}
                                    {checkColumnVisible('fulfillment') && <col className={getColWidth('fulfillment')} />}
                                    {checkColumnVisible('total') && <col className={getColWidth('total')} />}
                                    {checkColumnVisible('shippingService') && <col className={getColWidth('shippingService')} />}
                                    {checkColumnVisible('driver') && <col className={getColWidth('driver')} />}
                                    {checkColumnVisible('shippingCost') && <col className={getColWidth('shippingCost')} />}
                                    {checkColumnVisible('status') && <col className={getColWidth('status')} />}
                                    {checkColumnVisible('date') && <col className={getColWidth('date')} />}
                                    {checkColumnVisible('note') && <col className={getColWidth('note')} />}
                                    {checkColumnVisible('print') && <col className={getColWidth('print')} />}
                                    {checkColumnVisible('check') && <col className={getColWidth('check')} />}
                                    {checkColumnVisible('orderId') && <col className={getColWidth('orderId')} />}
                                </colgroup>
                                <thead>
                                    <tr>
                                        {onToggleSelectAll && <th className="px-1 py-4 w-8 text-center"><input type="checkbox" className="h-4 w-4 rounded-md border-white/10 bg-black/40 text-blue-500 cursor-pointer" checked={isAllSelected} onChange={() => onToggleSelectAll(orders.map(o => o['Order ID']))} /></th>}
                                        {checkColumnVisible('index') && <th className={`px-1 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[9px] ${getColWidth('index')}`}>#</th>}
                                        {checkColumnVisible('actions') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[9px] ${getColWidth('actions')}`}>Control</th>}
                                        {checkColumnVisible('customerName') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('customerName')}`}>Merchant</th>}
                                        {checkColumnVisible('productInfo') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('productInfo')}`}>Inventory</th>}
                                        {checkColumnVisible('location') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('location')}`}>Area</th>}
                                        {checkColumnVisible('pageInfo') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('pageInfo')}`}>Page</th>}
                                        {checkColumnVisible('brandSales') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('brandSales')}`}>Store</th>}
                                        {checkColumnVisible('fulfillment') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('fulfillment')}`}>Warehouse</th>}
                                        {checkColumnVisible('total') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('total')}`}>Valuation</th>}
                                        {checkColumnVisible('shippingService') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[9px] ${getColWidth('shippingService')}`}>Carrier</th>}
                                        {checkColumnVisible('driver') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('driver')}`}>Agent</th>}
                                        {checkColumnVisible('shippingCost') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('shippingCost')}`}>Cost</th>}
                                        {checkColumnVisible('status') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[9px] ${getColWidth('status')}`}>Settlement</th>}
                                        {checkColumnVisible('date') && <th className={`px-2 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('date')}`}>Chronology</th>}
                                        {checkColumnVisible('note') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[9px] ${getColWidth('note')}`}>Annotation</th>}
                                        {checkColumnVisible('print') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[9px] ${getColWidth('print')}`}>Output</th>}
                                        {checkColumnVisible('check') && <th className={`px-2 py-4 font-black uppercase tracking-[0.2em] text-center text-emerald-500/60 text-[9px] ${getColWidth('check')}`}>Verify</th>}
                                        {checkColumnVisible('orderId') && <th className={`px-2 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[9px] ${getColWidth('orderId')}`}>ID</th>}
                                    </tr>
                                </thead>
                            </table>
                        </div>

                        {/* Grand Total Row */}
                        <div className="bg-[#0f172a]/80 backdrop-blur-2xl border-b border-blue-500/20 shadow-2xl">
                            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                <colgroup>
                                    {onToggleSelectAll && <col className="w-8" />}
                                    {checkColumnVisible('index') && <col className={getColWidth('index')} />}
                                    {checkColumnVisible('actions') && <col className={getColWidth('actions')} />}
                                    {checkColumnVisible('customerName') && <col className={getColWidth('customerName')} />}
                                    {checkColumnVisible('productInfo') && <col className={getColWidth('productInfo')} />}
                                    {checkColumnVisible('location') && <col className={getColWidth('location')} />}
                                    {checkColumnVisible('pageInfo') && <col className={getColWidth('pageInfo')} />}
                                    {checkColumnVisible('brandSales') && <col className={getColWidth('brandSales')} />}
                                    {checkColumnVisible('fulfillment') && <col className={getColWidth('fulfillment')} />}
                                    {checkColumnVisible('total') && <col className={getColWidth('total')} />}
                                    {checkColumnVisible('shippingService') && <col className={getColWidth('shippingService')} />}
                                    {checkColumnVisible('driver') && <col className={getColWidth('driver')} />}
                                    {checkColumnVisible('shippingCost') && <col className={getColWidth('shippingCost')} />}
                                    {checkColumnVisible('status') && <col className={getColWidth('status')} />}
                                    {checkColumnVisible('date') && <col className={getColWidth('date')} />}
                                    {checkColumnVisible('note') && <col className={getColWidth('note')} />}
                                    {checkColumnVisible('print') && <col className={getColWidth('print')} />}
                                    {checkColumnVisible('check') && <col className={getColWidth('check')} />}
                                    {checkColumnVisible('orderId') && <col className={getColWidth('orderId')} />}
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
                                            <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] italic">{groupBy}: <span className="text-blue-400 ml-1">{item.label}</span></span>
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
                            const shippingLogo = appData.shippingMethods?.find(m => m.MethodName === order['Internal Shipping Method'])?.LogosURL;
                            const orderDate = getSafeDateObj(order.Timestamp);
                            const allowEdit = canEditOrder(order);

                            return (
                                <div key={order['Order ID']} style={{ position: 'absolute', top: offset, height: ROW_HEIGHT, width: '100%' }} className="group">
                                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                        <colgroup>
                                            {onToggleSelectAll && <col className="w-8" />}
                                            {checkColumnVisible('index') && <col className={getColWidth('index')} />}
                                            {checkColumnVisible('actions') && <col className={getColWidth('actions')} />}
                                            {checkColumnVisible('customerName') && <col className={getColWidth('customerName')} />}
                                            {checkColumnVisible('productInfo') && <col className={getColWidth('productInfo')} />}
                                            {checkColumnVisible('location') && <col className={getColWidth('location')} />}
                                            {checkColumnVisible('pageInfo') && <col className={getColWidth('pageInfo')} />}
                                            {checkColumnVisible('brandSales') && <col className={getColWidth('brandSales')} />}
                                            {checkColumnVisible('fulfillment') && <col className={getColWidth('fulfillment')} />}
                                            {checkColumnVisible('total') && <col className={getColWidth('total')} />}
                                            {checkColumnVisible('shippingService') && <col className={getColWidth('shippingService')} />}
                                            {checkColumnVisible('driver') && <col className={getColWidth('driver')} />}
                                            {checkColumnVisible('shippingCost') && <col className={getColWidth('shippingCost')} />}
                                            {checkColumnVisible('status') && <col className={getColWidth('status')} />}
                                            {checkColumnVisible('date') && <col className={getColWidth('date')} />}
                                            {checkColumnVisible('note') && <col className={getColWidth('note')} />}
                                            {checkColumnVisible('print') && <col className={getColWidth('print')} />}
                                            {checkColumnVisible('check') && <col className={getColWidth('check')} />}
                                            {checkColumnVisible('orderId') && <col className={getColWidth('orderId')} />}
                                        </colgroup>
                                        <tbody className="divide-y divide-white/5">
                                            <tr className={`transition-all duration-300 ${isVerified ? 'bg-emerald-500/[0.03]' : selectedIds.has(order['Order ID']) ? 'bg-blue-500/[0.05]' : 'hover:bg-white/[0.04]'} ${showBorders ? 'divide-x divide-white/5' : ''}`} style={{ height: `${ROW_HEIGHT}px` }}>
                                                {onToggleSelect && (<td className="px-0.5 py-2 text-center"><input type="checkbox" className="h-4 w-4 rounded border-white/10 bg-black/40 text-blue-500 cursor-pointer focus:ring-0" checked={selectedIds.has(order['Order ID'])} onChange={() => onToggleSelect(order['Order ID'])} /></td>)}
                                                
                                                {checkColumnVisible('index') && <td className="px-1 py-2 text-center font-bold text-gray-700 text-[10px]">{orders.findIndex(o => o['Order ID'] === order['Order ID']) + 1}</td>}
                                                
                                                {checkColumnVisible('actions') && (
                                                    <td className="px-2 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => onView && onView(order)} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all border border-white/5" title="View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c3.478 0 6.991 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2}/></svg></button>
                                                            {allowEdit && <button onClick={() => onEdit && onEdit(order)} className="w-8 h-8 flex items-center justify-center bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-all border border-blue-500/20" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>}
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('customerName') && (
                                                    <td className="px-6 py-2">
                                                        <div className="font-black text-gray-200 truncate mb-0.5 text-sm">{order['Customer Name']}</div>
                                                        <div className="flex items-center gap-1.5">
                                                            {carrierLogo && <img src={convertGoogleDriveUrl(carrierLogo)} className="w-3.5 h-3.5 object-contain" alt="" />}
                                                            <div className="text-gray-500 font-mono font-black text-[10px] tracking-tight">{displayPhone}</div>
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('productInfo') && (
                                                    <td className="px-6 py-2">
                                                        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                                                            {order.Products.slice(0, 4).map((p, i) => (
                                                                <div key={i} className="flex-shrink-0 bg-white/[0.03] px-2 py-1 rounded-lg border border-white/5 flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-black text-blue-400">x{p.quantity}</span>
                                                                    <span className="text-[9px] font-bold text-gray-400 truncate max-w-[60px]">{p.name}</span>
                                                                </div>
                                                            ))}
                                                            {order.Products.length > 4 && <span className="text-[9px] font-black text-gray-600 self-center">+{order.Products.length-4}</span>}
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('location') && (
                                                    <td className="px-4 py-2">
                                                        <div className="font-black text-gray-300 text-[11px] truncate leading-tight uppercase">{order.Location}</div>
                                                        <div className="text-[9px] text-gray-600 font-bold truncate mt-0.5 italic">{order['Address Details']}</div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('pageInfo') && (
                                                    <td className="px-4 py-2">
                                                        <div className="flex items-center gap-2">
                                                            {logoUrl && <img src={logoUrl} className="w-7 h-7 rounded-xl border border-white/5 object-cover shadow-lg" alt="" />}
                                                            <span className="font-black text-gray-500 text-[10px] uppercase truncate tracking-tighter">{order.Page}</span>
                                                        </div>
                                                    </td>
                                                )}

                                                {checkColumnVisible('brandSales') && (
                                                    <td className="px-4 py-2">
                                                        <span className="px-2 py-1 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-indigo-400 font-black text-[9px] uppercase tracking-tighter truncate block">
                                                            {order['Fulfillment Store']}
                                                        </span>
                                                    </td>
                                                )}

                                                {checkColumnVisible('fulfillment') && (
                                                    <td className="px-4 py-2">
                                                        <span className="font-black text-gray-500 text-[10px] uppercase truncate">{order['Fulfillment Store']}</span>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('total') && (
                                                    <td className="px-6 py-2">
                                                        <div className="font-black text-blue-400 text-base tracking-tighter italic">
                                                            <span className="text-xs align-top mr-0.5">$</span>
                                                            {(Number(order['Grand Total']) || 0).toFixed(2)}
                                                        </div>
                                                    </td>
                                                )}

                                                {checkColumnVisible('shippingService') && (
                                                    <td className="px-4 py-2 text-center">
                                                        {shippingLogo ? <img src={convertGoogleDriveUrl(shippingLogo)} className="w-6 h-6 object-contain mx-auto opacity-80" alt="" /> : <span className="text-[9px] text-gray-600">N/A</span>}
                                                    </td>
                                                )}

                                                {checkColumnVisible('driver') && (
                                                    <td className="px-4 py-2">
                                                        <div className="font-black text-orange-400/80 text-[10px] uppercase truncate">{order['Driver Name'] || 'Unassigned'}</div>
                                                    </td>
                                                )}

                                                {checkColumnVisible('shippingCost') && (
                                                    <td className="px-4 py-2 font-mono font-black text-orange-500/60 text-xs">
                                                        ${(Number(order['Internal Cost']) || 0).toFixed(2)}
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('status') && (
                                                    <td className="px-6 py-2 text-center">
                                                        <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]'}`}>
                                                            {order['Payment Status']}
                                                        </span>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('date') && (
                                                    <td className="px-2 py-2 flex flex-col leading-tight pt-4">
                                                        <span className="font-black text-gray-400 text-[10px] tracking-tighter">{orderDate.toLocaleDateString('km-KH')}</span>
                                                        <span className="text-gray-600 font-bold text-[9px] uppercase tracking-widest">{orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                    </td>
                                                )}

                                                {checkColumnVisible('note') && (
                                                    <td className="px-4 py-2">
                                                        <div className="text-[10px] text-gray-500 font-medium truncate italic max-w-full group-hover:text-gray-300 transition-colors">
                                                            {order.Note || '---'}
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('print') && (
                                                    <td className="px-4 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleCopyTemplate(order)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all border ${copiedTemplateId === order['Order ID'] ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:text-white border-white/5'}`} title="Copy Template"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button>
                                                            <button onClick={() => handlePrint(order)} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-emerald-600 text-gray-500 hover:text-white rounded-lg transition-all border border-white/5" title="Print Label"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" /></svg></button>
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('check') && (
                                                    <td className="px-2 py-2 text-center">
                                                        <div className={`h-6 w-6 mx-auto rounded-lg border-2 flex items-center justify-center transition-all duration-500 ${isVerified ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)] rotate-[360deg]' : 'border-gray-800 hover:border-emerald-500/50'} ${canVerifyOrder() ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={() => canVerifyOrder() && !updatingIds.has(order['Order ID']) && toggleOrderVerified(order['Order ID'], order.IsVerified)}>
                                                            {updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : isVerified && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}
                                                        </div>
                                                    </td>
                                                )}
                                                
                                                {checkColumnVisible('orderId') && <td className="px-2 py-2 text-center"><button onClick={() => handleCopy(order['Order ID'])} className="text-[9px] font-black font-mono text-gray-700 hover:text-blue-400 transition-colors uppercase tracking-tight">{order['Order ID'].substring(0, 6)}</button></td>}
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
