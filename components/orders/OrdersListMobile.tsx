import React, { useContext, useState, useMemo } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import Spinner from '../common/Spinner';
import { MobileGrandTotalCard } from './OrderGrandTotal';
import Modal from '../common/Modal';

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
}

const OrdersListMobile: React.FC<OrdersListMobileProps> = ({
    orders,
    totals,
    visibleColumns,
    selectedIds,
    onToggleSelect,
    onEdit,
    onView,
    handlePrint,
    handleCopy,
    handleCopyTemplate,
    copiedId,
    copiedTemplateId,
    toggleOrderVerified,
    updatingIds
}) => {
    const { appData, previewImage, currentUser } = useContext(AppContext);
    
    // View Mode State - Default to 'table'
    const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
        const saved = localStorage.getItem('mobile_view_preference');
        return (saved === 'card' || saved === 'table') ? saved : 'table';
    });

    // State for viewing detailed products modal
    const [viewingProductsOrder, setViewingProductsOrder] = useState<ParsedOrder | null>(null);

    const handleViewChange = (mode: 'card' | 'table') => {
        setViewMode(mode);
        localStorage.setItem('mobile_view_preference', mode);
    };

    // Pagination State for Infinite Scroll
    const [displayCount, setDisplayCount] = useState(20);
    
    const visibleOrders = useMemo(() => {
        return orders.slice(0, displayCount);
    }, [orders, displayCount]);

    // Handle "Load More" logic
    const handleLoadMore = () => {
        setDisplayCount(prev => prev + 20);
    };

    // Visibility defaults
    const checkColumnVisible = (key: string) => !visibleColumns || visibleColumns.has(key);

    const isProductInfoVisible = checkColumnVisible('productInfo');
    const isActionsVisible = checkColumnVisible('actions');
    const isPrintVisible = checkColumnVisible('print');
    const isCheckVisible = checkColumnVisible('check');
    const isFulfillmentVisible = checkColumnVisible('fulfillment');
    const isBrandSalesVisible = checkColumnVisible('brandSales');

    // Helper for robust date parsing
    const getSafeDateObj = (dateStr: string) => {
        if (!dateStr) return new Date();
        
        // Handle "YYYY-MM-DD H:mm" format (Legacy/Manual)
        const manualMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{2})/);
        if (manualMatch) {
            return new Date(
                parseInt(manualMatch[1]),
                parseInt(manualMatch[2]) - 1, // Month is 0-indexed
                parseInt(manualMatch[3]),
                parseInt(manualMatch[4]),
                parseInt(manualMatch[5])
            );
        }

        // Handle ISO-like format with Z (e.g., "2026-01-04T06:31:21Z")
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
        const orderTime = getSafeDateObj(order.Timestamp).getTime();
        const timeDiff = Date.now() - orderTime;
        return timeDiff < 43200000;
    };

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

    // Safe Date Parsing for iOS & custom DB Format (YYYY-MM-DD H:mm)
    const getSafeDateString = (dateStr: string) => {
        const date = getSafeDateObj(dateStr);
        return date.toLocaleDateString('km-KH');
    };

    return (
        <div className="space-y-5 pb-40">
            {/* Grand Total Summary */}
            <MobileGrandTotalCard totals={totals} />

            {/* View Switcher Controls */}
            <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{orders.length} Entries</span>
                <div className="flex bg-gray-800 p-1 rounded-xl border border-white/10">
                    <button 
                        onClick={() => handleViewChange('card')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 bg-gray-900/50'}`}
                        title="Card View"
                    >
                        {/* Modern Grid Icon */}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
                        </svg>
                    </button>
                    <button 
                        onClick={() => handleViewChange('table')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 bg-gray-900/50'}`}
                        title="Table View"
                    >
                        {/* Modern List Icon */}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
                        </svg>
                    </button>
                </div>
            </div>

            {viewMode === 'table' ? (
                // --- TABLE VIEW ---
                <div className="bg-[#0f172a] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-fade-in relative">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#0f172a] border-b border-white/10 text-[10px] text-gray-400 font-black uppercase tracking-wider">
                                    <th className="p-3 sticky left-0 z-20 bg-[#0f172a] border-r border-white/10 min-w-[130px] shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]">
                                        Customer
                                    </th>
                                    {isFulfillmentVisible && (
                                        <th className="p-3 min-w-[100px] text-gray-400">Store</th>
                                    )}
                                    {isBrandSalesVisible && (
                                        <th className="p-3 min-w-[100px] text-gray-400">Brand/Sales</th>
                                    )}
                                    {checkColumnVisible('driver') && (
                                        <th className="p-3 min-w-[100px] text-gray-400">Driver</th>
                                    )}
                                    <th className="p-3 text-right min-w-[80px]">Total</th>
                                    {checkColumnVisible('note') && <th className="p-3 text-left min-w-[120px]">Note</th>}
                                    <th className="p-3 text-center min-w-[90px]">Status</th>
                                    <th className="p-3 text-center min-w-[50px]">Act</th>
                                    <th className="p-3 min-w-[100px]">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs">
                                {visibleOrders.map((order) => {
                                    const isSelected = selectedIds.has(order['Order ID']);
                                    const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                                    const isThisTemplateCopied = copiedTemplateId === order['Order ID'];
                                    const allowEdit = canEditOrder(order);
                                    
                                    return (
                                        <tr key={order['Order ID']} className={`${isSelected ? 'bg-blue-900/20' : isVerified ? 'bg-emerald-900/5' : 'hover:bg-white/5'} transition-colors`}>
                                            <td className="p-3 sticky left-0 z-20 bg-gray-900 border-r border-white/10 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white truncate max-w-[110px]">{order['Customer Name']}</span>
                                                    <span className="text-[9px] text-gray-500 font-mono">{order['Customer Phone']}</span>
                                                </div>
                                            </td>
                                            {isFulfillmentVisible && (
                                                <td className="p-3 text-gray-300 font-bold text-[10px]">
                                                    {order['Fulfillment Store']}
                                                </td>
                                            )}
                                            {isBrandSalesVisible && (
                                                <td className="p-3 text-gray-300 font-bold text-[10px]">
                                                    {(() => {
                                                        const pInfo = appData.pages?.find((p: any) => p.PageName === order.Page);
                                                        return pInfo?.DefaultStore || '-';
                                                    })()}
                                                </td>
                                            )}
                                            {checkColumnVisible('driver') && (
                                                <td className="p-3 text-emerald-400 font-bold text-[10px]">
                                                    {order['Driver Name'] || order['Internal Shipping Details'] || '-'}
                                                </td>
                                            )}
                                            <td className="p-3 text-right font-black text-blue-400">
                                                ${order['Grand Total'].toFixed(2)}
                                            </td>
                                            {checkColumnVisible('note') && (
                                                <td className="p-3">
                                                    <div className="text-gray-400 line-clamp-1 truncate max-w-[100px] break-words" title={order.Note}>
                                                        {order.Note || '-'}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="p-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                        {order['Payment Status']}
                                                    </span>
                                                    {order['Scheduled Time'] && getSafeDateObj(order['Scheduled Time']).getTime() > Date.now() && (
                                                        <div className="flex items-center gap-1 text-[7px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-1 rounded animate-pulse">
                                                            <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                            Sch
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <button 
                                                        onClick={() => handleCopyTemplate(order)}
                                                        className={`text-gray-400 hover:text-white transition-all active:scale-90 ${isThisTemplateCopied ? 'text-indigo-400' : ''}`}
                                                    >
                                                        {isThisTemplateCopied ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}
                                                    </button>
                                                    
                                                    {isPrintVisible && (
                                                        <button 
                                                            onClick={() => handlePrint(order)}
                                                            className="text-emerald-400 hover:text-white transition-all active:scale-90"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" />
                                                            </svg>
                                                        </button>
                                                    )}

                                                    {onEdit && allowEdit ? (
                                                        <button onClick={() => onEdit(order)} className="text-gray-400 hover:text-white">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-600" title="Locked">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 text-[9px] text-gray-500 font-bold">
                                                {getSafeDateString(order.Timestamp)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                // --- CARD VIEW ---
                visibleOrders.map((order) => {
                    const pageInfo = appData.pages?.find((p: any) => p.PageName === order.Page);
                    const logoUrl = pageInfo ? convertGoogleDriveUrl(pageInfo.PageLogoURL) : '';
                    const displayPhone = formatPhone(order['Customer Phone']);
                    const carrierLogo = getCarrierLogo(displayPhone);
                    const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                    const isUpdating = updatingIds.has(order['Order ID']);
                    const isSelected = selectedIds.has(order['Order ID']);
                    const shippingLogo = getShippingLogo(order['Internal Shipping Method']);
                    const isThisCopied = copiedId === order['Order ID'];
                    const isThisTemplateCopied = copiedTemplateId === order['Order ID'];
                    const allowEdit = canEditOrder(order);
                    const isScheduled = order['Scheduled Time'] && getSafeDateObj(order['Scheduled Time']).getTime() > Date.now();

                    return (
                        <div 
                            key={order['Order ID']} 
                            className={`
                                relative rounded-3xl p-5 shadow-lg transition-all duration-300 overflow-hidden group
                                ${isSelected 
                                    ? 'bg-blue-900/30 border-2 border-blue-500/50 shadow-blue-900/20' 
                                    : isVerified 
                                        ? 'bg-emerald-950/40 border border-emerald-500/20 shadow-none' 
                                        : 'bg-slate-900 border border-white/5 shadow-md'
                                }
                            `}
                        >
                            {/* Background Selection Glow */}
                            {isSelected && (
                                <div className="absolute inset-0 bg-blue-500/5 pointer-events-none"></div>
                            )}

                            {/* Top Row: ID, Date, Selection */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    {onToggleSelect && (
                                        <div className="relative z-10">
                                            <input 
                                                type="checkbox" 
                                                className="h-6 w-6 rounded-xl border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/20 cursor-pointer transition-all"
                                                checked={isSelected}
                                                onChange={() => onToggleSelect(order['Order ID'])}
                                            />
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-1">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleCopy(order['Order ID'])}
                                                className={`
                                                    flex items-center gap-2 px-3 py-1 rounded-xl border transition-all active:scale-95
                                                    ${isThisCopied 
                                                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                                                        : 'bg-black/30 border-white/5 text-gray-400 hover:text-white'
                                                    }
                                                `}
                                            >
                                                <span className="text-[10px] font-black uppercase tracking-widest font-mono">
                                                    #{order['Order ID'].substring(0, 8)}
                                                </span>
                                                {isThisCopied && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </button>
                                            
                                            {/* Copy Template Button */}
                                            <button
                                                onClick={() => handleCopyTemplate(order)}
                                                className={`
                                                    flex items-center justify-center w-8 h-8 rounded-xl border transition-all active:scale-95
                                                    ${isThisTemplateCopied 
                                                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' 
                                                        : 'bg-black/30 border-white/5 text-gray-400 hover:text-white'
                                                    }
                                                `}
                                            >
                                                {isThisTemplateCopied ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                )}
                                            </button>
                                        </div>
                                        {isScheduled && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg animate-pulse self-start" title={`Scheduled: ${order['Scheduled Time']}`}>
                                                <svg className="w-2.5 h-2.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Scheduled</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end">
                                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                        {order['Payment Status']}
                                    </span>
                                    <span className="text-[9px] text-gray-600 font-bold mt-1">
                                        {getSafeDateString(order.Timestamp)}
                                    </span>
                                </div>
                            </div>

                            {/* Customer & Page Section */}
                            <div className="flex items-start gap-4 mb-5">
                                <div className="relative w-14 h-14 rounded-2xl bg-black/40 border border-white/10 p-1 flex-shrink-0">
                                    {logoUrl ? (
                                        <img src={logoUrl} className="w-full h-full object-cover rounded-xl" alt="page logo" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-600 text-[10px] font-black">N/A</div>
                                    )}
                                    <div className="absolute -bottom-1 -right-1 bg-gray-900 rounded-lg p-0.5 border border-gray-700">
                                        {carrierLogo && <img src={carrierLogo} className="w-4 h-4 object-contain" alt="carrier" />}
                                    </div>
                                </div>
                                
                                <div className="flex-grow min-w-0">
                                    <h3 className="text-white font-black text-sm truncate leading-tight mb-1">{order['Customer Name']}</h3>
                                    <p className="text-blue-400 font-mono font-bold text-xs tracking-wide mb-1">{displayPhone}</p>
                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold truncate mb-1">
                                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <span className="truncate">{order.Location || 'N/A'}</span>
                                    </div>
                                    {isBrandSalesVisible && pageInfo?.DefaultStore && (
                                        <div className="text-[9px] text-gray-400 font-bold truncate flex items-center gap-1">
                                            <span className="bg-gray-800 px-1.5 py-0.5 rounded text-[8px] uppercase">Brand</span>
                                            {pageInfo.DefaultStore}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Product List (Collapsible / Modal Trigger) */}
                            {isProductInfoVisible && order.Products && order.Products.length > 0 && (
                                <div className="bg-black/20 rounded-2xl p-3 border border-white/5 mb-5 shadow-inner">
                                    <div className="flex overflow-x-auto gap-3 pb-2 snap-x no-scrollbar">
                                        {order.Products.slice(0, 4).map((p, i) => {
                                            const masterProd = appData.products?.find(mp => mp.ProductName === p.name);
                                            const displayImg = p.image || masterProd?.ImageURL || '';
                                            return (
                                                <div key={i} className="flex-shrink-0 w-[200px] snap-center bg-gray-800/50 rounded-xl p-2 border border-white/5 flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-black/50 flex-shrink-0 overflow-hidden border border-white/5" onClick={() => previewImage(convertGoogleDriveUrl(displayImg))}>
                                                        <img src={convertGoogleDriveUrl(displayImg)} className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-bold text-gray-200 truncate">{p.name}</p>
                                                        <div className="flex justify-between items-center mt-0.5">
                                                            <span className="text-[9px] text-gray-500 font-bold">Qty: <span className="text-white">{p.quantity}</span></span>
                                                            {p.colorInfo && <span className="text-[8px] bg-purple-500/10 text-purple-400 px-1.5 rounded uppercase font-bold">{p.colorInfo}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {/* Show More Trigger for Many Products */}
                                        {order.Products.length > 4 && (
                                            <button 
                                                onClick={() => setViewingProductsOrder(order)}
                                                className="flex-shrink-0 w-[100px] snap-center bg-gray-800/80 rounded-xl p-2 border border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-gray-700 transition-colors active:scale-95"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                                                    <span className="font-black text-sm">+{order.Products.length - 4}</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">View All</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {checkColumnVisible('note') && order.Note && (
                                <div className="bg-black/20 rounded-2xl p-3 border border-white/5 mb-5 shadow-inner">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Note</p>
                                    <p className="text-[11px] text-gray-300 line-clamp-2 break-words">{order.Note}</p>
                                </div>
                            )}

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Total Amount</p>
                                    <p className="text-lg font-black text-white tracking-tight">${order['Grand Total'].toFixed(2)}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Shipping</p>
                                            <div className="flex items-center gap-1.5">
                                                {shippingLogo && <img src={shippingLogo} className="w-3.5 h-3.5 object-contain" alt="" />}
                                                <span className="text-xs font-bold text-orange-400">{order['Internal Shipping Method']?.substring(0, 10)}</span>
                                            </div>
                                            {checkColumnVisible('driver') && (
                                                <div className="flex items-center gap-1.5 mt-1 border-t border-white/5 pt-1">
                                                    <span className="text-[9px] font-bold text-emerald-400 opacity-80">{order['Driver Name'] || order['Internal Shipping Details'] || '-'}</span>
                                                </div>
                                            )}
                                        </div>
                                        {order['Internal Cost'] > 0 && (
                                            <span className="text-[9px] font-mono text-gray-600 font-bold bg-black/20 px-1.5 py-0.5 rounded">
                                                -${(Number(order['Internal Cost']) || 0).toFixed(3)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Action Bar */}
                            <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                                {isActionsVisible && (
                                    allowEdit ? (
                                        <button 
                                            onClick={() => onEdit && onEdit(order)} 
                                            className="flex-1 py-3 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                                        >
                                            Edit
                                        </button>
                                    ) : (
                                        <button 
                                            disabled
                                            className="flex-1 py-3 bg-gray-800 text-gray-600 rounded-xl border border-white/5 font-black text-[10px] uppercase tracking-widest cursor-not-allowed"
                                        >
                                            Locked
                                        </button>
                                    )
                                )}
                                
                                {isPrintVisible && (
                                    <button 
                                        onClick={() => handlePrint(order)} 
                                        className="w-12 h-12 flex items-center justify-center bg-gray-800 text-gray-400 rounded-xl border border-white/10 hover:text-white active:scale-90 transition-all"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" />
                                        </svg>
                                    </button>
                                )}

                                {isCheckVisible && (
                                    <div className="ml-auto relative">
                                        <input 
                                            type="checkbox" 
                                            checked={isVerified} 
                                            onChange={() => toggleOrderVerified(order['Order ID'], isVerified)} 
                                            className={`w-12 h-12 rounded-xl appearance-none border transition-all cursor-pointer ${isVerified ? 'bg-emerald-500 border-emerald-400' : 'bg-gray-800 border-gray-600'}`}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">{isUpdating ? <Spinner size="sm" /> : isVerified ? <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : <span className="text-[9px] font-black text-gray-500 uppercase">Check</span>}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
            
            {/* Load More Trigger */}
            {displayCount < orders.length && (
                <div className="flex justify-center pt-4">
                    <button 
                        onClick={handleLoadMore}
                        className="px-8 py-3 bg-gray-800 text-white rounded-full text-xs font-black uppercase tracking-widest border border-white/10 shadow-lg active:scale-95 transition-all"
                    >
                        Load More ({orders.length - displayCount} remaining)
                    </button>
                </div>
            )}

            {/* Product Details Modal for Large Lists */}
            {viewingProductsOrder && (
                <Modal isOpen={true} onClose={() => setViewingProductsOrder(null)} maxWidth="max-w-lg">
                    <div className="p-6 bg-[#0f172a] rounded-[2rem] border border-white/10 shadow-2xl">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Products List</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Order #{viewingProductsOrder['Order ID'].substring(0, 8)}</p>
                            </div>
                            <button onClick={() => setViewingProductsOrder(null)} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-all active:scale-90">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            {viewingProductsOrder.Products.map((p, i) => {
                                 const masterProd = appData.products?.find(mp => mp.ProductName === p.name);
                                 const displayImg = p.image || masterProd?.ImageURL || '';
                                 return (
                                    <div key={i} className="flex items-start gap-4 p-3 bg-gray-800/50 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="w-16 h-16 rounded-xl bg-black/40 overflow-hidden border border-white/10 flex-shrink-0 shadow-inner">
                                            <img src={convertGoogleDriveUrl(displayImg)} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="flex-grow min-w-0 pt-1">
                                            <h4 className="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">{p.name}</h4>
                                            <div className="flex flex-wrap gap-2 text-[10px]">
                                                <span className="bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded font-black border border-blue-500/20">x{p.quantity}</span>
                                                <span className="text-gray-400 font-bold self-center">Price: ${p.finalPrice?.toFixed(2)}</span>
                                                {p.colorInfo && <span className="bg-purple-600/20 text-purple-400 px-2 py-0.5 rounded font-bold border border-purple-500/20">{p.colorInfo}</span>}
                                            </div>
                                            <p className="text-xs font-black text-white mt-1.5 text-right tracking-tight">${(p.total || 0).toFixed(2)}</p>
                                        </div>
                                    </div>
                                 );
                            })}
                        </div>
                        <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest">Total Items</span>
                            <span className="text-white font-black text-lg">{viewingProductsOrder.Products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)}</span>
                        </div>
                    </div>
                </Modal>
            )}
            
            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

export default OrdersListMobile;