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
    const ROW_HEIGHT = 85;
    const HEADER_HEIGHT = 45;
    const OVERSCAN = 10;

    const checkColumnVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
    const isAllSelected = orders.length > 0 && orders.every(o => selectedIds.has(o['Order ID']));

    // Ultra-Compact Column Widths
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
        if (groupBy === 'none') {
            return orders.map(o => ({ type: 'order' as const, data: o }));
        }

        const sorted = [...orders].sort((a: any, b: any) => {
            const valA = String(a[groupBy] || '').toLowerCase();
            const valB = String(b[groupBy] || '').toLowerCase();
            return valA.localeCompare(valB);
        });

        const items: ({ type: 'order', data: ParsedOrder } | { type: 'header', label: string })[] = [];
        let currentGroup = '';

        sorted.forEach(order => {
            const groupVal = String((order as any)[groupBy] || 'Unassigned');
            if (groupVal !== currentGroup) {
                items.push({ type: 'header', label: groupVal });
                currentGroup = groupVal;
            }
            items.push({ type: 'order', data: order });
        });

        return items;
    }, [orders, groupBy]);

    const { virtualItems, totalHeight } = useMemo(() => {
        let currentY = 0;
        const itemOffsets: number[] = [];
        flatList.forEach(item => {
            itemOffsets.push(currentY);
            currentY += item.type === 'header' ? HEADER_HEIGHT : ROW_HEIGHT;
        });

        const totalHeight = currentY;
        const containerHeight = containerRef.current?.clientHeight || 800;
        
        let startIndex = 0;
        for (let i = 0; i < itemOffsets.length; i++) {
            if (itemOffsets[i] > scrollTop - (OVERSCAN * ROW_HEIGHT)) {
                startIndex = i;
                break;
            }
        }
        startIndex = Math.max(0, startIndex - OVERSCAN);

        let endIndex = itemOffsets.length - 1;
        for (let i = startIndex; i < itemOffsets.length; i++) {
            if (itemOffsets[i] > scrollTop + containerHeight + (OVERSCAN * ROW_HEIGHT)) {
                endIndex = i;
                break;
            }
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
        <div className="page-card !p-0 shadow-2xl border-white/5 bg-gray-900/60 backdrop-blur-3xl rounded-[2.5rem] flex flex-col h-full min-h-[400px] overflow-hidden">
            <div className="flex-shrink-0 z-20 bg-gray-900 rounded-t-[2.5rem] border-b border-white/10">
                <table className={`admin-table w-full border-collapse ${showBorders ? 'divide-x divide-white/10 border-x border-white/10' : ''}`} style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr className={`bg-gray-800/80 ${showBorders ? 'divide-x divide-white/10' : ''}`}>
                            {onToggleSelectAll && <th className="px-1 py-4 w-8 text-center"><input type="checkbox" className="h-5 w-5 rounded-md border-gray-600 bg-gray-900 text-blue-500 cursor-pointer" checked={isAllSelected} onChange={() => onToggleSelectAll(orders.map(o => o['Order ID']))} /></th>}
                            {checkColumnVisible('index') && <th className={`px-1 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('index')}`}>#</th>}
                            {checkColumnVisible('actions') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('actions')}`}>Command</th>}
                            {checkColumnVisible('customerName') && (
                                <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('customerName')}`}>
                                    <div className="flex flex-col leading-tight"><span>Merchant</span><span className="mt-0.5 opacity-70">Client</span></div>
                                </th>
                            )}
                            {checkColumnVisible('productInfo') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('productInfo')}`}>Assets</th>}
                            {checkColumnVisible('location') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('location')}`}>Geography</th>}
                            {checkColumnVisible('pageInfo') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('pageInfo')}`}>Source Page</th>}
                            {checkColumnVisible('brandSales') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('brandSales')}`}>Brand/Sales</th>}
                            {checkColumnVisible('fulfillment') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('fulfillment')}`}>Fulfillment</th>}
                            {checkColumnVisible('total') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('total')}`}>Valuation</th>}
                            {checkColumnVisible('shippingService') && <th className={`px-2 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('shippingService')}`}>Logistics</th>}
                            {checkColumnVisible('driver') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('driver')}`}>Driver</th>}
                            {checkColumnVisible('shippingCost') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('shippingCost')}`}>Exp. Cost</th>}
                            {checkColumnVisible('status') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('status')}`}>Status</th>}
                            {checkColumnVisible('date') && <th className={`px-2 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('date')}`}>Time</th>}
                            {checkColumnVisible('note') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('note')}`}>Note</th>}
                            {checkColumnVisible('print') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('print')}`}>Output</th>}
                            {checkColumnVisible('check') && <th className={`px-2 py-4 font-normal uppercase tracking-[0.15em] text-center text-emerald-500/80 text-[10px] ${getColWidth('check')}`}>VERIFIED</th>}
                            {checkColumnVisible('orderId') && <th className={`px-2 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('orderId')}`}>Node ID</th>}
                        </tr>
                    </thead>
                    <tbody className={`bg-[#0f172a] ${showBorders ? 'divide-x divide-white/10' : ''}`}>
                         <DesktopGrandTotalRow totals={totals} isVisible={checkColumnVisible} showSelection={!!onToggleSelect} showBorders={showBorders} />
                    </tbody>
                </table>
            </div>

            <div ref={containerRef} className="flex-grow overflow-y-auto overflow-x-auto custom-scrollbar overscroll-contain" onScroll={handleScroll}>
                <div style={{ height: `${totalHeight}px`, position: 'relative', minWidth: '1400px' }}>
                    {virtualItems.map(({ item, offset }) => {
                        if (item.type === 'header') {
                            return (
                                <div key={`header-${item.label}`} style={{ position: 'absolute', top: offset, height: HEADER_HEIGHT, width: '100%' }} className="bg-gray-800/90 backdrop-blur-md border-y border-white/5 flex items-center px-6 z-10 shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-5 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                                        <span className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic">{groupBy}: <span className="text-purple-400 ml-1">{item.label}</span></span>
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
                            <div key={order['Order ID']} style={{ position: 'absolute', top: offset, height: ROW_HEIGHT, width: '100%' }}>
                                <table className={`admin-table w-full border-collapse ${showBorders ? 'divide-x divide-white/5 border-x border-white/10' : ''}`} style={{ tableLayout: 'fixed' }}>
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
                                    <tbody className={`divide-y divide-white/5 ${showBorders ? 'divide-x divide-white/5' : ''}`}>
                                        <tr className={`${isVerified ? 'bg-emerald-900/30 border-l-4 border-l-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]' : selectedIds.has(order['Order ID']) ? 'bg-blue-500/10 shadow-[inset_3px_0_0_0_#3b82f6]' : 'hover:bg-white/[0.02]'} transition-all group relative`} style={{ height: `${ROW_HEIGHT}px` }}>
                                            {onToggleSelect && (<td className="px-0.5 py-2 text-center"><input type="checkbox" className="h-4 w-4 rounded-md border-gray-700 bg-gray-950 text-blue-500 cursor-pointer" checked={selectedIds.has(order['Order ID'])} onChange={() => onToggleSelect(order['Order ID'])} /></td>)}
                                            {checkColumnVisible('index') && <td className="px-1 py-2 text-center font-bold text-gray-600 text-[clamp(10px,0.7vw,12px)]">{orders.findIndex(o => o['Order ID'] === order['Order ID']) + 1}</td>}
                                            {checkColumnVisible('actions') && (
                                                <td className="px-2 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button onClick={() => onView && onView(order)} className="text-gray-400 hover:text-white bg-white/5 hover:bg-gray-700 px-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-white/5" title="View"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c3.478 0 6.991 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                                                        {allowEdit ? (<button onClick={() => onEdit && onEdit(order)} className="text-blue-400/80 hover:text-white bg-blue-400/5 hover:bg-blue-600 px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-blue-400/10">Edit</button>) : (<span className="text-gray-600 text-[7px] font-bold uppercase bg-black/20 px-1.5 py-1 rounded-md">Lock</span>)}
                                                    </div>
                                                </td>
                                            )}
                                            {checkColumnVisible('customerName') && (<td className="px-6 py-2"><div className="font-black text-gray-100 truncate mb-0.5 leading-tight tracking-tight text-[clamp(14px,1.1vw,16px)]">{order['Customer Name']}</div><div className="flex items-center gap-1.5">{carrierLogo && <img src={convertGoogleDriveUrl(carrierLogo)} className="w-3 h-3 object-contain opacity-80" alt="" />}<div className="text-blue-400/80 font-mono font-black tracking-tighter text-[clamp(10px,0.8vw,12px)]">{displayPhone}</div></div></td>)}
                                            {checkColumnVisible('productInfo') && <td className="px-6 py-2"><div className="flex flex-col gap-1">{order.Products.slice(0, 2).map((p, i) => (<div key={i} className="bg-black/40 p-1 rounded-lg border border-white/5 flex flex-col"><span className="font-bold text-gray-300 line-clamp-1 text-[clamp(9px,0.6vw,11px)]">{p.name}</span><span className="text-blue-400/80 font-black mt-0.5 text-[8px]">x{p.quantity}</span></div>))}</div></td>}
                                            {checkColumnVisible('location') && (<td className="px-4 py-2"><div className="font-black text-gray-200 leading-tight truncate text-[clamp(12px,0.8vw,14px)]">{order.Location}</div><div className="font-bold text-gray-600 mt-0.5 line-clamp-1 text-[clamp(9px,0.7vw,11px)]">{order['Address Details']}</div></td>)}
                                            {checkColumnVisible('pageInfo') && <td className="px-2 py-2"><div className="flex items-center gap-2">{logoUrl && <img src={logoUrl} className="w-6 h-6 rounded-full border border-white/10 object-cover shadow-lg" alt="" />}<div className="min-w-0"><span className="font-bold text-gray-500 block truncate leading-none mb-0.5 text-[clamp(8px,0.6vw,10px)] uppercase tracking-wider">{order.Page}</span><span className="font-black text-blue-400 block truncate leading-none text-[clamp(11px,0.9vw,13px)] uppercase tracking-tight">T: {order.Team}</span></div></div></td>}
                                            {checkColumnVisible('brandSales') && <td className="px-6 py-2"><span className="font-bold text-gray-300 line-clamp-2 text-[10px] leading-tight" title={pageInfo?.DefaultStore}>{pageInfo?.DefaultStore || '-'}</span></td>}
                                            {checkColumnVisible('fulfillment') && <td className="px-6 py-2"><span className="font-bold text-gray-300 bg-gray-800 px-1.5 py-1 rounded border border-white/5 text-[9px]">{order['Fulfillment Store']}</span></td>}
                                            {checkColumnVisible('total') && <td className="px-6 py-2 font-black text-blue-400 tracking-tighter text-[clamp(14px,1vw,16px)]">${(Number(order['Grand Total']) || 0).toFixed(2)}</td>}
                                            {checkColumnVisible('shippingService') && (<td className="px-2 py-2"><div className="flex flex-col items-start gap-0.5">{shippingLogo && <img src={convertGoogleDriveUrl(shippingLogo)} className="w-5 h-5 rounded-lg object-contain bg-gray-950 p-0.5 border border-white/5" alt="" />}<span className="text-orange-400/80 font-black uppercase tracking-tight text-[clamp(9px,0.7vw,11px)] leading-tight break-words line-clamp-2">{order['Internal Shipping Method'] || '-'}</span></div></td>)}
                                            {checkColumnVisible('driver') && (<td className="px-6 py-2"><div className="flex items-center gap-1.5">{(() => { const driverName = order['Driver Name'] || order['Internal Shipping Details']; const driverInfo = appData.drivers?.find(d => d.DriverName === driverName); return (<>{driverInfo?.ImageURL && <img src={convertGoogleDriveUrl(driverInfo.ImageURL)} className="w-4 h-4 rounded-full border border-white/10 object-cover bg-gray-800 cursor-pointer active:scale-95 transition-transform" alt="" onClick={() => previewImage(convertGoogleDriveUrl(driverInfo.ImageURL))} />}<span className="text-emerald-400/80 font-bold truncate tracking-tight text-[clamp(9px,0.7vw,11px)]">{driverName || '-'}</span></>); })()}</div></td>)}
                                            {checkColumnVisible('shippingCost') && <td className="px-2 py-2 text-gray-400 font-mono font-black tracking-tighter text-[clamp(11px,0.8vw,13px)]">${(Number(order['Internal Cost']) || 0).toFixed(3)}</td>}
                                            {checkColumnVisible('status') && <td className="px-6 py-2 text-center"><span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{order['Payment Status']}</span></td>}
                                            {checkColumnVisible('date') && (<td className="px-2 py-2"><div className="flex flex-col items-start leading-tight"><span className="font-bold text-gray-400 text-[clamp(11px,0.8vw,13px)]">{orderDate.toLocaleDateString('km-KH')}</span><span className="font-mono text-blue-500/80 font-black text-[9px]">{orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span></div></td>)}
                                            {checkColumnVisible('note') && <td className="px-6 py-2 overflow-hidden"><div className="text-gray-300 text-[10px] line-clamp-2 break-words overflow-hidden" title={order.Note}>{order.Note || '-'}</div></td>}
                                            {checkColumnVisible('print') && (<td className="px-4 py-2 text-center"><div className="flex items-center justify-center gap-1"><button onClick={() => handleCopyTemplate(order)} className={`p-1.5 rounded-lg transition-all border active:scale-90 ${copiedTemplateId === order['Order ID'] ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-gray-800 text-gray-400 border-white/10 hover:text-white'}`}><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg></button><button onClick={() => handlePrint(order)} className="text-emerald-400/60 hover:text-white bg-emerald-400/5 hover:bg-emerald-600 p-1.5 rounded-lg transition-all border border-emerald-400/10 active:scale-90"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" /></svg></button></div></td>)}
                                            {checkColumnVisible('check') && (<td className="px-2 py-2 text-center"><div className={`relative flex items-center justify-center ${canVerifyOrder() ? 'cursor-pointer group/check' : 'cursor-not-allowed'}`} onClick={() => canVerifyOrder() && !updatingIds.has(order['Order ID']) && toggleOrderVerified(order['Order ID'], order.IsVerified)}><div className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${isVerified ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)] scale-105' : 'bg-gray-900 border-gray-700'} ${canVerifyOrder() && !isVerified ? 'hover:border-emerald-500/50 hover:bg-emerald-500/10' : ''}`}>{updatingIds.has(order['Order ID']) ? <Spinner size="xs" /> : <svg className={`w-3.5 h-3.5 text-white transition-opacity ${isVerified ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>}</div></div></td>)}
                                            {checkColumnVisible('orderId') && <td className="px-2 py-2 text-center"><button onClick={() => handleCopy(order['Order ID'])} className={`p-1 rounded-lg transition-all border ${copiedId === order['Order ID'] ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-gray-800 border-white/5 text-gray-500 hover:text-blue-400 active:scale-90'}`}><span className="text-[7px] font-black uppercase tracking-widest">{copiedId === order['Order ID'] ? '✓' : 'ID'}</span></button></td>}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            </div>
            <style>{`@keyframes scale-in { 0% { transform: scale(0); } 80% { transform: scale(1.2); } 100% { transform: scale(1); } } .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }`}</style>
        </div>
    );
};

export default OrdersListDesktop;
