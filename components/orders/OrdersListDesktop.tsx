
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
    handlePrint: (order: ParsedOrder) => void;
    handleCopy: (id: string) => void;
    handleCopyTemplate: (order: ParsedOrder) => void;
    copiedId: string | null;
    copiedTemplateId: string | null;
    toggleOrderVerified: (id: string, currentStatus: any) => void;
    updatingIds: Set<string>;
    showBorders?: boolean;
}

const OrdersListDesktop: React.FC<OrdersListDesktopProps> = ({
    orders, totals, visibleColumns, selectedIds, onToggleSelect, onToggleSelectAll,
    onEdit, handlePrint, handleCopy, handleCopyTemplate, copiedId, copiedTemplateId,
    toggleOrderVerified, updatingIds, showBorders = false
}) => {
    const { appData, previewImage, currentUser } = useContext(AppContext);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const ROW_HEIGHT = 76;
    const OVERSCAN = 5;

    const isVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
    const isAllSelected = orders.length > 0 && orders.every(o => selectedIds.has(o['Order ID']));

    // Dynamic Column Widths based on Screen Size
    const getColWidth = (key: string) => {
        const width = window.innerWidth;
        const widths: any = {
            index: 'w-8',
            actions: 'w-16',
            customerName: width < 1440 ? 'w-24' : 'w-28',
            productInfo: width < 1366 ? 'w-36' : 'w-48',
            location: width < 1440 ? 'w-20' : 'w-28',
            pageInfo: 'w-32',
            fulfillment: 'w-32',
            total: 'w-20',
            shippingService: width < 1440 ? 'w-20' : 'w-28',
            driver: 'w-32',
            shippingCost: 'w-20',
            status: 'w-16',
            date: 'w-14',
            note: width < 1600 ? 'w-40' : 'w-56',
            print: 'w-32',
            check: 'w-14',
            orderId: 'w-16'
        };
        return widths[key] || 'w-32';
    };

    const { virtualItems, totalHeight, paddingTop } = useMemo(() => {
        const totalHeight = orders.length * ROW_HEIGHT;
        const containerHeight = containerRef.current?.clientHeight || 800;
        let startIndex = Math.floor(scrollTop / ROW_HEIGHT);
        let endIndex = Math.min(orders.length - 1, Math.floor((scrollTop + containerHeight) / ROW_HEIGHT));
        startIndex = Math.max(0, startIndex - OVERSCAN);
        endIndex = Math.min(orders.length - 1, endIndex + OVERSCAN);
        const virtualItems = [];
        for (let i = startIndex; i <= endIndex; i++) virtualItems.push({ index: i, data: orders[i] });
        return { virtualItems, totalHeight, paddingTop: startIndex * ROW_HEIGHT };
    }, [orders, scrollTop]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop);

    const getCarrierLogo = (phoneNumber: string) => {
        if (!phoneNumber || !appData.phoneCarriers) return null;
        const cleanPhone = phoneNumber.replace(/\s/g, '');
        const prefix = cleanPhone.substring(0, 3);
        const carrier = appData.phoneCarriers.find(c => c.Prefixes.split(',').map(p => p.trim()).includes(prefix));
        return carrier ? convertGoogleDriveUrl(carrier.CarrierLogoURL) : null;
    };

    const getShippingLogo = (methodName: string) => {
        if (!methodName || !appData.shippingMethods) return null;
        const method = appData.shippingMethods.find(m => m.MethodName === methodName);
        return method ? convertGoogleDriveUrl(method.LogosURL) : null;
    };

    const formatPhone = (val: string) => {
        let phone = (val || '').replace(/[^0-9]/g, '');
        if (phone.length > 0) phone = '0' + phone.replace(/^0+/, '');
        return phone;
    };

    const getSafeDateObj = (dateStr: string) => {
        if (!dateStr) return new Date();
        
        // Handle "YYYY-MM-DD H:mm" format (Legacy/Manual)
        const manualMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (manualMatch) {
            return new Date(
                parseInt(manualMatch[1]),
                parseInt(manualMatch[2]) - 1,
                parseInt(manualMatch[3]),
                parseInt(manualMatch[4]),
                parseInt(manualMatch[5])
            );
        }

        // Handle ISO-like format with Z (e.g., "2026-01-04T06:31:21Z")
        // User confirmed this string is ALREADY Cambodia time, so 'Z' is misleading.
        // We strip 'Z' to force the browser to treat it as Local Time (Cambodia).
        if (dateStr.endsWith('Z')) {
            const cleanDate = dateStr.slice(0, -1); // Remove Z
            return new Date(cleanDate);
        }

        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    // Helper to check edit permission
    const canEditOrder = (order: ParsedOrder) => {
        if (!currentUser) return false;
        if (currentUser.IsSystemAdmin) return true;

        // Check Team Ownership
        const userTeams = (currentUser.Team || '').split(',').map(t => t.trim());
        if (!userTeams.includes(order.Team)) return false;

        // Check Time Window (12 Hours = 43200000 ms)
        // Use getSafeDateObj to ensure consistent parsing of custom date formats
        const orderTime = getSafeDateObj(order.Timestamp).getTime();
        const timeDiff = Date.now() - orderTime;
        return timeDiff < 43200000;
    };

    return (
        <div className="page-card !p-0 shadow-2xl border-white/5 bg-gray-900/60 backdrop-blur-3xl rounded-[2.5rem] flex flex-col h-[calc(100vh-220px)]">
            <div className="flex-shrink-0 z-20 bg-gray-900 rounded-t-[2.5rem] border-b border-white/10">
                <table className={`admin-table w-full border-collapse ${showBorders ? 'divide-x divide-white/10 border-x border-white/10' : ''}`} style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr className={`bg-gray-800/80 ${showBorders ? 'divide-x divide-white/10' : ''}`}>
                            {onToggleSelectAll && <th className="px-1 py-4 w-8 text-center"><input type="checkbox" className="h-5 w-5 rounded-md border-gray-600 bg-gray-900 text-blue-500 cursor-pointer" checked={isAllSelected} onChange={() => onToggleSelectAll(orders.map(o => o['Order ID']))} /></th>}
                            {isVisible('index') && <th className={`px-1 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('index')}`}>#</th>}
                            {isVisible('actions') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('actions')}`}>Command</th>}
                            {isVisible('customerName') && (
                                <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('customerName')}`}>
                                    <div className="flex flex-col leading-tight">
                                        <span>Merchant</span>
                                        <span className="mt-0.5 opacity-70">Client</span>
                                    </div>
                                </th>
                            )}
                            {isVisible('productInfo') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('productInfo')}`}>Assets</th>}
                            {isVisible('location') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('location')}`}>Geography</th>}
                            {isVisible('pageInfo') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('pageInfo')}`}>Source Page</th>}
                            {isVisible('fulfillment') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('fulfillment')}`}>Fulfillment</th>}
                            {isVisible('total') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('total')}`}>Valuation</th>}
                            {isVisible('shippingService') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('shippingService')}`}>Logistics</th>}
                            {isVisible('driver') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('driver')}`}>Driver</th>}
                            {isVisible('shippingCost') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('shippingCost')}`}>Exp. Cost</th>}
                            {isVisible('status') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('status')}`}>Status</th>}
                            {isVisible('date') && <th className={`px-2 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('date')}`}>Time</th>}
                            {isVisible('note') && <th className={`px-6 py-4 font-black uppercase tracking-[0.2em] text-left text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('note')}`}>Note</th>}
                            {isVisible('print') && <th className={`px-4 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('print')}`}>Output</th>}
                            {isVisible('check') && <th className={`px-2 py-4 font-normal uppercase tracking-[0.15em] text-center text-emerald-500/80 text-[10px] ${getColWidth('check')}`}>VERIFIED</th>}
                            {isVisible('orderId') && <th className={`px-2 py-4 font-black uppercase tracking-[0.2em] text-center text-gray-500 text-[clamp(11px,0.9vw,13px)] ${getColWidth('orderId')}`}>Node ID</th>}
                        </tr>
                    </thead>
                    <tbody className={`bg-[#0f172a] ${showBorders ? 'divide-x divide-white/10' : ''}`}>
                         <DesktopGrandTotalRow totals={totals} isVisible={isVisible} showSelection={!!onToggleSelect} showBorders={showBorders} />
                    </tbody>
                </table>
            </div>

            <div ref={containerRef} className="flex-grow overflow-y-auto overflow-x-auto custom-scrollbar" onScroll={handleScroll}>
                <div style={{ height: `${totalHeight}px`, position: 'relative', minWidth: '1400px' }}>
                    <table className={`admin-table w-full border-collapse ${showBorders ? 'divide-x divide-white/5 border-x border-white/10' : ''}`} style={{ tableLayout: 'fixed', transform: `translateY(${paddingTop}px)` }}>
                        <thead className="invisible h-0">
                            <tr className={showBorders ? 'divide-x divide-transparent' : ''}>
                                {onToggleSelectAll && <th className="w-8"></th>}
                                {isVisible('index') && <th className={getColWidth('index')}></th>}
                                {isVisible('actions') && <th className={getColWidth('actions')}></th>}
                                {isVisible('customerName') && <th className={getColWidth('customerName')}></th>}
                                {isVisible('productInfo') && <th className={getColWidth('productInfo')}></th>}
                                {isVisible('location') && <th className={getColWidth('location')}></th>}
                                {isVisible('pageInfo') && <th className={getColWidth('pageInfo')}></th>}
                                {isVisible('fulfillment') && <th className={getColWidth('fulfillment')}></th>}
                                {isVisible('total') && <th className={getColWidth('total')}></th>}
                                {isVisible('shippingService') && <th className={getColWidth('shippingService')}></th>}
                                {isVisible('driver') && <th className={getColWidth('driver')}></th>}
                                {isVisible('shippingCost') && <th className={getColWidth('shippingCost')}></th>}
                                {isVisible('status') && <th className={getColWidth('status')}></th>}
                                {isVisible('date') && <th className={getColWidth('date')}></th>}
                                {isVisible('note') && <th className={getColWidth('note')}></th>}
                                {isVisible('print') && <th className={getColWidth('print')}></th>}
                                {isVisible('check') && <th className={getColWidth('check')}></th>}
                                {isVisible('orderId') && <th className={getColWidth('orderId')}></th>}
                            </tr>
                        </thead>
                        <tbody className={`divide-y divide-white/5 ${showBorders ? 'divide-x divide-white/5' : ''}`}>
                            {virtualItems.map(({ index, data: order }) => {
                                const pageInfo = appData.pages?.find((p: any) => p.PageName === order.Page);
                                const logoUrl = pageInfo ? convertGoogleDriveUrl(pageInfo.PageLogoURL) : '';
                                const displayPhone = formatPhone(order['Customer Phone']);
                                const carrierLogo = getCarrierLogo(displayPhone);
                                const isThisCopied = copiedId === order['Order ID'];
                                const isThisTemplateCopied = copiedTemplateId === order['Order ID'];
                                const shippingLogo = getShippingLogo(order['Internal Shipping Method']);
                                const orderId = order['Order ID'];
                                
                                // Scheduled Status Check
                                const scheduledTimeStr = order['Scheduled Time'];
                                const isScheduled = scheduledTimeStr && getSafeDateObj(scheduledTimeStr).getTime() > Date.now();
                                
                                // *** STRICT CHECK FOR 'A' or TRUE ***
                                const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                                
                                const isUpdating = updatingIds.has(orderId);
                                const isSelected = selectedIds.has(orderId);
                                const orderDate = getSafeDateObj(order.Timestamp);
                                
                                // Permission Check
                                const allowEdit = canEditOrder(order);

                                return (
                                    <tr 
                                        key={orderId} 
                                        className={`
                                            ${isVerified 
                                                ? 'bg-emerald-900/30 border-l-4 border-l-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]' 
                                                : isSelected 
                                                    ? 'bg-blue-500/10 shadow-[inset_3px_0_0_0_#3b82f6]' 
                                                    : 'hover:bg-white/[0.02]'} 
                                            ${showBorders ? 'divide-x divide-white/5' : ''}
                                            transition-all group relative
                                        `} 
                                        style={{ height: `${ROW_HEIGHT}px` }}
                                    >
                                        {onToggleSelect && (<td className="px-0.5 py-3 text-center w-8"><input type="checkbox" className="h-5 w-5 rounded-md border-gray-700 bg-gray-950 text-blue-500 cursor-pointer" checked={isSelected} onChange={() => onToggleSelect(orderId)} /></td>)}
                                        {isVisible('index') && <td className={`px-1 py-3 text-center font-bold text-gray-600 text-[clamp(11px,0.8vw,13px)] ${getColWidth('index')}`}>{index + 1}</td>}
                                        
                                        {/* Actions Column */}
                                        {isVisible('actions') && (
                                            <td className={`px-4 py-5 text-center ${getColWidth('actions')}`}>
                                                {allowEdit ? (
                                                    <button onClick={() => onEdit && onEdit(order)} className="text-blue-400/80 hover:text-white bg-blue-400/5 hover:bg-blue-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-blue-400/10">Edit</button>
                                                ) : (
                                                    <span className="text-gray-600 text-[9px] font-bold uppercase cursor-not-allowed">Locked</span>
                                                )}
                                            </td>
                                        )}

                                        {isVisible('customerName') && (<td className={`px-6 py-5 ${getColWidth('customerName')}`}><div className="font-black text-gray-100 truncate mb-1 leading-tight tracking-tight text-[clamp(15px,1.2vw,17px)]">{order['Customer Name']}</div><div className="flex items-center gap-2">{carrierLogo && <img src={carrierLogo} className="w-3.5 h-3.5 object-contain opacity-80" alt="carrier" />}<div className="text-blue-400/80 font-mono font-black tracking-tighter text-[clamp(11px,0.8vw,13px)]">{displayPhone}</div></div></td>)}
                                        {isVisible('productInfo') && <td className={`px-6 py-3 ${getColWidth('productInfo')}`}><div className="flex flex-col gap-1">{order.Products.slice(0, 2).map((p, i) => (<div key={i} className="bg-black/40 p-1 rounded-lg border border-white/5 flex flex-col"><span className="font-bold text-gray-300 line-clamp-1 text-[clamp(10px,0.7vw,12px)]">{p.name}</span><span className="text-blue-400/80 font-black mt-0.5 text-[9px]">x{p.quantity}</span></div>))}</div></td>}
                                        {isVisible('location') && (<td className={`px-4 py-3 ${getColWidth('location')}`}><div className="font-black text-gray-200 leading-tight truncate text-[clamp(13px,0.9vw,15px)]">{order.Location}</div><div className="font-bold text-gray-600 mt-1 line-clamp-1 text-[clamp(10px,0.8vw,12px)]">{order['Address Details']}</div></td>)}
                                        {isVisible('pageInfo') && <td className={`px-2 py-3 ${getColWidth('pageInfo')}`}>
                                            <div className="flex items-center gap-2">
                                                {logoUrl && <img src={logoUrl} className="w-7 h-7 rounded-full border border-white/10 object-cover shadow-lg" alt="logo" />}
                                                <div className="min-w-0">
                                                    <span className="font-bold text-gray-500 block truncate leading-none mb-1 text-[clamp(9px,0.7vw,11px)] uppercase tracking-wider">{order.Page}</span>
                                                    <span className="font-black text-blue-400 block truncate leading-none text-[clamp(12px,1vw,14px)] uppercase tracking-tight">
                                                        T: {order.Team}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>}
                                        {isVisible('fulfillment') && <td className={`px-6 py-3 ${getColWidth('fulfillment')}`}><span className="font-bold text-gray-300 bg-gray-800 px-2 py-1 rounded border border-white/5 text-[10px]">{order['Fulfillment Store']}</span></td>}
                                        {isVisible('total') && <td className={`px-6 py-3 font-black text-blue-400 tracking-tighter text-[clamp(15px,1.1vw,17px)] ${getColWidth('total')}`}>${order['Grand Total'].toFixed(2)}</td>}
                                        {isVisible('shippingService') && (
                                            <td className={`px-6 py-3 ${getColWidth('shippingService')}`}>
                                                <div className="flex flex-col items-start gap-1.5">
                                                    {shippingLogo && (
                                                        <img 
                                                            src={shippingLogo} 
                                                            className="w-6 h-6 rounded-lg object-contain bg-gray-950 p-1 border border-white/5 shadow-sm" 
                                                            alt="shipping" 
                                                        />
                                                    )}
                                                    <span className="text-orange-400/80 font-black uppercase truncate tracking-tight text-[clamp(10px,0.8vw,12px)] leading-none">
                                                        {order['Internal Shipping Method'] || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                        )}
                                        {isVisible('driver') && (
                                            <td className={`px-6 py-3 ${getColWidth('driver')}`}>
                                                <div className="flex items-center gap-2">
                                                    {(() => {
                                                        const driverName = order['Driver Name'] || order['Internal Shipping Details'];
                                                        const driverInfo = appData.drivers?.find(d => d.DriverName === driverName);
                                                        return (
                                                            <>
                                                                {driverInfo && driverInfo.ImageURL && (
                                                                    <img 
                                                                        src={convertGoogleDriveUrl(driverInfo.ImageURL)} 
                                                                        className="w-5 h-5 rounded-full border border-white/10 object-cover bg-gray-800 cursor-pointer active:scale-95 transition-transform" 
                                                                        alt="driver"
                                                                        onClick={() => previewImage(convertGoogleDriveUrl(driverInfo.ImageURL))}
                                                                    />
                                                                )}
                                                                <span className="text-emerald-400/80 font-bold truncate tracking-tight text-[clamp(10px,0.8vw,12px)]">
                                                                    {driverName || '-'}
                                                                </span>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                        )}
                                        {isVisible('shippingCost') && <td className={`px-2 py-3 text-gray-400 font-mono font-black tracking-tighter text-[clamp(12px,0.9vw,14px)] ${getColWidth('shippingCost')}`}>${(Number(order['Internal Cost']) || 0).toFixed(3)}</td>}
                                        {isVisible('status') && <td className={`px-6 py-3 text-center ${getColWidth('status')}`}><span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{order['Payment Status']}</span></td>}
                                        {isVisible('date') && (
                                            <td className={`px-2 py-3 ${getColWidth('date')}`}>
                                                <div className="flex flex-col items-start leading-tight">
                                                    <span className="font-bold text-gray-400 text-[clamp(12px,0.9vw,14px)]">{orderDate.toLocaleDateString('km-KH')}</span>
                                                    <span className="font-mono text-blue-500/80 font-black text-[clamp(11px,0.8vw,12px)]">{orderDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                </div>
                                            </td>
                                        )}
                                        {isVisible('note') && <td className={`px-6 py-3 overflow-hidden ${getColWidth('note')}`}><div className="text-gray-300 text-[11px] line-clamp-2 break-words overflow-hidden" title={order.Note}>{order.Note || '-'}</div></td>}
                                        
                                        {isVisible('print') && (
                                            <td className={`px-4 py-3 text-center ${getColWidth('print')}`}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button onClick={() => handleCopyTemplate(order)} className={`p-2 rounded-lg transition-all border active:scale-90 ${isThisTemplateCopied ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-gray-800 text-gray-400 border-white/10 hover:text-white'}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                    </button>
                                                    <button onClick={() => handlePrint(order)} className="text-emerald-400/60 hover:text-white bg-emerald-400/5 hover:bg-emerald-600 p-2 rounded-lg transition-all border border-emerald-400/10 active:scale-90">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                        
                                        {isVisible('check') && (
                                            <td className={`px-2 py-3 text-center ${getColWidth('check')}`}>
                                                <div 
                                                    className="relative flex items-center justify-center cursor-pointer group/check" 
                                                    onClick={() => !isUpdating && toggleOrderVerified(orderId, order.IsVerified)}
                                                >
                                                    <div className={`
                                                        h-7 w-7 rounded-lg border-2 flex items-center justify-center transition-all duration-300
                                                        ${isVerified 
                                                            ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)] scale-105' 
                                                            : 'bg-gray-900 border-gray-700 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                                                        } 
                                                        ${isUpdating ? 'opacity-50' : ''}
                                                    `}>
                                                        {isUpdating ? <Spinner size="xs" /> : (
                                                            <svg className={`w-4 h-4 text-white transition-opacity ${isVerified ? 'opacity-100' : 'opacity-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        )}
                                        
                                        {isVisible('orderId') && <td className={`px-2 py-3 text-center ${getColWidth('orderId')}`}><button onClick={() => handleCopy(order['Order ID'])} className={`p-1.5 rounded-lg transition-all border ${isThisCopied ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-gray-800 border-white/5 text-gray-500 hover:text-blue-400 active:scale-90'}`}><span className="text-[9px] font-black uppercase tracking-widest">{isThisCopied ? '✓' : 'ID'}</span></button></td>}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            <style>{`@keyframes scale-in { 0% { transform: scale(0); } 80% { transform: scale(1.2); } 100% { transform: scale(1); } } .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }`}</style>
        </div>
    );
};

export default OrdersListDesktop;
