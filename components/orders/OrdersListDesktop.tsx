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
    const OVERSCAN = 10;

    const checkColumnVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
    const isAllSelected = orders.length > 0 && orders.every(o => selectedIds.has(o['Order ID']));

    const getColWidth = (key: string) => {
        const width = window.innerWidth;
        const widths: any = {
            index: 'w-8',
            actions: 'w-28',
            customerName: width < 1440 ? 'w-24' : 'w-28',
            productInfo: width < 1366 ? 'w-36' : 'w-48',
            location: width < 1440 ? 'w-24' : 'w-32',
            pageInfo: 'w-24',
            brandSales: 'w-32',
            fulfillment: 'w-28',
            total: 'w-20',
            shippingService: width < 1440 ? 'w-10' : 'w-16',
            driver: 'w-32',
            shippingCost: 'w-20',
            status: 'w-16',
            date: 'w-14',
            note: width < 1600 ? 'w-40' : 'w-56',
            print: 'w-32',
            check: 'w-14',
            orderId: 'w-16'
        };
        return widths[key] || 'w-24';
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
        flatList.forEach(item => { itemOffsets.push(currentY); currentY += item.type === 'header' ? HEADER_HEIGHT : ROW_HEIGHT; });
        const totalHeight = currentY;
        const containerHeight = containerRef.current?.clientHeight || 800;
        let startIndex = 0;
        for (let i = 0; i < itemOffsets.length; i++) { if (itemOffsets[i] > scrollTop - (OVERSCAN * ROW_HEIGHT)) { startIndex = i; break; } }
        startIndex = Math.max(0, startIndex - OVERSCAN);
        let endIndex = itemOffsets.length - 1;
        for (let i = startIndex; i < itemOffsets.length; i++) { if (itemOffsets[i] > scrollTop + containerHeight + (OVERSCAN * ROW_HEIGHT)) { endIndex = i; break; } }
        const virtualItems = [];
        for (let i = startIndex; i <= endIndex; i++) { virtualItems.push({ index: i, item: flatList[i], offset: itemOffsets[i] }); }
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
        <div className="bg-white/[0.01] rounded-[2rem] border border-white/5 flex flex-col h-full min-h-[400px] overflow-hidden">
            <div className="flex-shrink-0 z-20 bg-black/20 backdrop-blur-md border-b border-white/5">
                <table className="admin-table w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            {onToggleSelectAll && <th className="px-1 py-4 w-8 text-center"><input type="checkbox" className="h-4 w-4 rounded-md border-white/10 bg-black/40 text-blue-500 cursor-pointer" checked={isAllSelected} onChange={() => onToggleSelectAll(orders.map(o => o['Order ID']))} /></th>}
                            {checkColumnVisible('index') && <th className={`px-1 py-4 font-bold uppercase tracking-widest text-center text-gray-500 text-[10px] ${getColWidth('index')}`}>#</th>}
                            {checkColumnVisible('actions') && <th className={`px-4 py-4 font-bold uppercase tracking-widest text-center text-gray-500 text-[10px] ${getColWidth('actions')}`}>Act</th>}
                            {checkColumnVisible('customerName') && <th className={`px-6 py-4 font-bold uppercase tracking-widest text-left text-gray-500 text-[10px] ${getColWidth('customerName')}`}>Merchant</th>}
                            {checkColumnVisible('productInfo') && <th className={`px-6 py-4 font-bold uppercase tracking-widest text-left text-gray-500 text-[10px] ${getColWidth('productInfo')}`}>Assets</th>}
                            {checkColumnVisible('location') && <th className={`px-4 py-4 font-bold uppercase tracking-widest text-left text-gray-500 text-[10px] ${getColWidth('location')}`}>Area</th>}
                            {checkColumnVisible('pageInfo') && <th className={`px-4 py-4 font-bold uppercase tracking-widest text-left text-gray-500 text-[10px] ${getColWidth('pageInfo')}`}>Page</th>}
                            {checkColumnVisible('total') && <th className={`px-6 py-4 font-bold uppercase tracking-widest text-left text-gray-500 text-[10px] ${getColWidth('total')}`}>Valuation</th>}
                            {checkColumnVisible('status') && <th className={`px-6 py-4 font-bold uppercase tracking-widest text-center text-gray-500 text-[10px] ${getColWidth('status')}`}>Status</th>}
                            {checkColumnVisible('date') && <th className={`px-2 py-4 font-bold uppercase tracking-widest text-left text-gray-500 text-[10px] ${getColWidth('date')}`}>Time</th>}
                            {checkColumnVisible('print') && <th className={`px-4 py-4 font-bold uppercase tracking-widest text-center text-gray-500 text-[10px] ${getColWidth('print')}`}>Output</th>}
                            {checkColumnVisible('check') && <th className={`px-2 py-4 font-bold uppercase tracking-widest text-center text-emerald-500/60 text-[9px] ${getColWidth('check')}`}>Check</th>}
                            {checkColumnVisible('orderId') && <th className={`px-2 py-4 font-bold uppercase tracking-widest text-center text-gray-500 text-[10px] ${getColWidth('orderId')}`}>ID</th>}
                        </tr>
                    </thead>
                </table>
            </div>

            <div ref={containerRef} className="flex-grow overflow-y-auto overflow-x-auto custom-scrollbar overscroll-contain" onScroll={handleScroll}>
                <div style={{ height: `${totalHeight}px`, position: 'relative', minWidth: '1400px' }}>
                    {virtualItems.map(({ item, offset }) => {
                        if (item.type === 'header') {
                            return (
                                <div key={`header-${item.label}`} style={{ position: 'absolute', top: offset, height: HEADER_HEIGHT, width: '100%' }} className="bg-white/[0.03] backdrop-blur-md border-y border-white/5 flex items-center px-6 z-10">
                                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{groupBy}: <span className="text-blue-400 ml-1">{item.label}</span></span>
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
                                        {checkColumnVisible('total') && <col className={getColWidth('total')} />}
                                        {checkColumnVisible('status') && <col className={getColWidth('status')} />}
                                        {checkColumnVisible('date') && <col className={getColWidth('date')} />}
                                        {checkColumnVisible('print') && <col className={getColWidth('print')} />}
                                        {checkColumnVisible('check') && <col className={getColWidth('check')} />}
                                        {checkColumnVisible('orderId') && <col className={getColWidth('orderId')} />}
                                    </colgroup>
                                    <tbody className="divide-y divide-white/5">
                                        <tr className={`transition-all ${isVerified ? 'bg-emerald-500/5' : selectedIds.has(order['Order ID']) ? 'bg-blue-500/5' : 'hover:bg-white/[0.03]'}`} style={{ height: `${ROW_HEIGHT}px` }}>
                                            {onToggleSelect && (<td className="px-0.5 py-2 text-center"><input type="checkbox" className="h-4 w-4 rounded border-white/10 bg-black/40 text-blue-500" checked={selectedIds.has(order['Order ID'])} onChange={() => onToggleSelect(order['Order ID'])} /></td>)}
                                            {checkColumnVisible('index') && <td className="px-1 py-2 text-center font-medium text-gray-600 text-[10px]">{orders.findIndex(o => o['Order ID'] === order['Order ID']) + 1}</td>}
                                            {checkColumnVisible('actions') && (
                                                <td className="px-2 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => onView && onView(order)} className="text-gray-500 hover:text-white transition-colors" title="View"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c3.478 0 6.991 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2}/></svg></button>
                                                        {allowEdit && <button onClick={() => onEdit && onEdit(order)} className="text-gray-500 hover:text-blue-400 transition-colors" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>}
                                                    </div>
                                                </td>
                                            )}
                                            {checkColumnVisible('customerName') && (<td className="px-6 py-2"><div className="font-bold text-gray-200 truncate mb-0.5 text-sm">{order['Customer Name']}</div><div className="flex items-center gap-1.5">{carrierLogo && <img src={convertGoogleDriveUrl(carrierLogo)} className="w-3 h-3 object-contain opacity-60" alt="" />}<div className="text-gray-500 font-mono text-[10px]">{displayPhone}</div></div></td>)}
                                            {checkColumnVisible('productInfo') && <td className="px-6 py-2"><div className="flex gap-1.5 overflow-x-auto no-scrollbar">{order.Products.slice(0, 3).map((p, i) => (<div key={i} className="flex-shrink-0 bg-white/[0.03] p-1 rounded-lg border border-white/5 flex flex-col items-center min-w-[40px]"><span className="text-[10px] font-bold text-gray-300">x{p.quantity}</span></div>))}</div></td>}
                                            {checkColumnVisible('location') && (<td className="px-4 py-2"><div className="font-bold text-gray-300 text-xs truncate">{order.Location}</div><div className="text-[10px] text-gray-600 truncate">{order['Address Details']}</div></td>)}
                                            {checkColumnVisible('pageInfo') && <td className="px-2 py-2"><div className="flex items-center gap-2">{logoUrl && <img src={logoUrl} className="w-6 h-6 rounded-full border border-white/5 object-cover" alt="" />}<span className="font-bold text-gray-500 text-[10px] uppercase truncate">{order.Page}</span></div></td>}
                                            {checkColumnVisible('total') && <td className="px-6 py-2 font-bold text-blue-400 text-sm tracking-tight">${(Number(order['Grand Total']) || 0).toFixed(2)}</td>}
                                            {checkColumnVisible('status') && <td className="px-6 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{order['Payment Status']}</span></td>}
                                            {checkColumnVisible('date') && (<td className="px-2 py-2 flex flex-col leading-tight pt-4"><span className="font-bold text-gray-400 text-[10px]">{orderDate.toLocaleDateString('km-KH')}</span><span className="text-gray-600 text-[9px]">{orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></td>)}
                                            {checkColumnVisible('print') && (<td className="px-4 py-2 text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => handleCopyTemplate(order)} className={`p-1.5 rounded-lg transition-all ${copiedTemplateId === order['Order ID'] ? 'text-blue-400' : 'text-gray-500 hover:text-white'}`}><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button><button onClick={() => handlePrint(order)} className="text-gray-500 hover:text-emerald-400 transition-all"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" /></svg></button></div></td>)}
                                            {checkColumnVisible('check') && (<td className="px-2 py-2 text-center"><div className={`h-5 w-5 mx-auto rounded border-2 flex items-center justify-center transition-all ${isVerified ? 'bg-emerald-500 border-emerald-400' : 'border-gray-700 hover:border-emerald-500/50'} ${canVerifyOrder() ? 'cursor-pointer' : 'cursor-not-allowed'}`} onClick={() => canVerifyOrder() && !updatingIds.has(order['Order ID']) && toggleOrderVerified(order['Order ID'], order.IsVerified)}>{updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : isVerified && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}</div></td>)}
                                            {checkColumnVisible('orderId') && <td className="px-2 py-2 text-center"><button onClick={() => handleCopy(order['Order ID'])} className="text-[9px] font-mono text-gray-600 hover:text-blue-400 transition-colors">{order['Order ID'].substring(0, 6)}</button></td>}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default OrdersListDesktop;
