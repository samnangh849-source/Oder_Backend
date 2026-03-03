
import React, { useContext } from 'react';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import Spinner from '../common/Spinner';
import { MobileGrandTotalCard } from './OrderGrandTotal';

interface OrdersListTabletProps {
    orders: ParsedOrder[];
    totals: { grandTotal: number; internalCost: number; count: number; paidCount: number; unpaidCount: number };
    visibleColumns?: Set<string>;
    selectedIds: Set<string>;
    onToggleSelect?: (id: string) => void;
    onEdit?: (order: ParsedOrder) => void;
    handlePrint: (order: ParsedOrder) => void;
    handleCopy: (id: string) => void;
    handleCopyTemplate: (order: ParsedOrder) => void;
    copiedId: string | null;
    copiedTemplateId: string | null;
    toggleOrderVerified: (id: string, currentStatus: boolean) => void;
    updatingIds: Set<string>;
}

const OrdersListTablet: React.FC<OrdersListTabletProps> = ({
    orders,
    totals,
    visibleColumns,
    selectedIds,
    onToggleSelect,
    onEdit,
    handlePrint,
    handleCopy,
    handleCopyTemplate,
    copiedId,
    copiedTemplateId,
    toggleOrderVerified,
    updatingIds
}) => {
    const { appData, previewImage, currentUser } = useContext(AppContext);

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

    const isVisible = (key: string) => !visibleColumns || visibleColumns.has(key);

    return (
        <div className="space-y-6 pb-20">
            {/* Grand Total Summary Reused from Mobile but tailored style handled by grid container */}
            <div className="w-full">
                <MobileGrandTotalCard totals={totals} />
            </div>

            {/* Tablet Grid Layout - 2 Columns */}
            <div className="grid grid-cols-2 gap-5">
                {orders.map((order) => {
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
                                relative rounded-[2rem] p-5 shadow-xl transition-all duration-300 overflow-hidden group flex flex-col justify-between
                                ${isSelected 
                                    ? 'bg-blue-900/20 border-2 border-blue-500/50 shadow-blue-900/20' 
                                    : isVerified 
                                        ? 'bg-emerald-900/10 border border-emerald-500/20 shadow-emerald-900/10' 
                                        : 'bg-[#1e293b]/60 border border-white/5 shadow-black/30 backdrop-blur-md hover:bg-[#1e293b]/80'
                                }
                            `}
                        >
                            {/* Header: ID, Status, Select */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    {onToggleSelect && (
                                        <input 
                                            type="checkbox" 
                                            className="h-5 w-5 rounded-lg border-gray-600 bg-gray-800 text-blue-500 cursor-pointer focus:ring-0"
                                            checked={isSelected}
                                            onChange={() => onToggleSelect(order['Order ID'])}
                                        />
                                    )}
                                    <div className="flex flex-col gap-1">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleCopy(order['Order ID'])}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${isThisCopied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-black/30 text-gray-400 border-white/5 hover:text-white'}`}
                                            >
                                                <span className="text-[10px] font-black uppercase tracking-widest font-mono">#{order['Order ID'].substring(0, 8)}</span>
                                                {isThisCopied && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </button>
                                            
                                            {/* Copy Template Button */}
                                            <button 
                                                onClick={() => handleCopyTemplate(order)}
                                                className={`flex items-center justify-center w-8 h-8 rounded-xl border transition-all active:scale-95 ${isThisTemplateCopied ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-black/30 border-white/5 text-gray-400 hover:text-white'}`}
                                            >
                                                {isThisTemplateCopied ? (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                )}
                                            </button>
                                        </div>
                                        {isScheduled && (
                                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg animate-pulse self-start" title={`Scheduled: ${order['Scheduled Time']}`}>
                                                <svg className="w-2.5 h-2.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Scheduled</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {order['Payment Status']}
                                </span>
                            </div>

                            {/* Customer Info */}
                            <div className="flex items-start gap-4 mb-4">
                                <div className="relative w-12 h-12 rounded-xl bg-black/40 border border-white/10 p-0.5 flex-shrink-0">
                                    {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-[10px]" alt="logo" /> : <div className="w-full h-full flex items-center justify-center text-[9px]">N/A</div>}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-white font-black text-sm truncate">{order['Customer Name']}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {carrierLogo && <img src={carrierLogo} className="h-3 w-auto object-contain opacity-70" alt="carrier" />}
                                        <p className="text-blue-400 font-mono font-bold text-xs">{displayPhone}</p>
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-bold truncate mt-1 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        {order.Location || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* Products Compact */}
                            <div className="bg-black/20 rounded-xl p-2.5 border border-white/5 mb-4 overflow-hidden">
                                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                    {order.Products && order.Products.length > 0 ? order.Products.map((p, i) => {
                                        const masterProd = appData.products?.find(mp => mp.ProductName === p.name);
                                        const displayImg = p.image || masterProd?.ImageURL || '';
                                        return (
                                            <div key={i} className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-800 border border-white/5 overflow-hidden relative cursor-pointer" onClick={() => previewImage(convertGoogleDriveUrl(displayImg))}>
                                                <img src={convertGoogleDriveUrl(displayImg)} className="w-full h-full object-cover" alt="" />
                                                <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-[8px] font-black px-1 rounded-tl-md">x{p.quantity}</div>
                                            </div>
                                        );
                                    }) : <span className="text-[10px] text-gray-600 italic">No products</span>}
                                </div>
                            </div>

                            {/* Note Section */}
                            {isVisible('note') && order.Note && (
                                <div className="mb-4 px-3 py-2 bg-black/20 rounded-xl border border-white/5">
                                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Note</p>
                                    <p className="text-[11px] text-gray-300 line-clamp-2 break-words">{order.Note}</p>
                                </div>
                            )}

                            {/* Footer: Total & Actions */}
                            <div className="mt-auto">
                                <div className="flex justify-between items-end mb-4 pt-3 border-t border-white/5">
                                    <div>
                                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Total</p>
                                        <p className="text-xl font-black text-white tracking-tight">${order['Grand Total'].toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Shipping</p>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {shippingLogo && <img src={shippingLogo} className="w-3.5 h-3.5 object-contain" alt="" />}
                                                <span className="text-xs font-bold text-orange-400">{order['Internal Shipping Method']?.substring(0, 10)}</span>
                                            </div>
                                            {isVisible('driver') && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {(() => {
                                                        const driverName = order['Driver Name'] || order['Internal Shipping Details'];
                                                        const driverInfo = appData.drivers?.find(d => d.DriverName === driverName);
                                                        return (
                                                            <>
                                                                <span className="text-[10px] font-bold text-emerald-400 opacity-80">{driverName || '-'}</span>
                                                                {driverInfo && driverInfo.ImageURL && (
                                                                    <img 
                                                                        src={convertGoogleDriveUrl(driverInfo.ImageURL)} 
                                                                        className="w-4 h-4 rounded-full border border-white/10 object-cover" 
                                                                        alt="driver"
                                                                    />
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {onEdit && (
                                        allowEdit ? (
                                            <button onClick={() => onEdit(order)} className="flex-1 py-2.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl border border-blue-500/20 font-black text-[10px] uppercase tracking-widest transition-all">Edit</button>
                                        ) : (
                                            <button disabled className="flex-1 py-2.5 bg-gray-800 text-gray-600 rounded-xl border border-white/5 font-black text-[10px] uppercase tracking-widest cursor-not-allowed">Locked</button>
                                        )
                                    )}
                                    <button onClick={() => handlePrint(order)} className="w-10 h-10 flex items-center justify-center bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-white/10 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg></button>
                                    
                                    <div className="relative">
                                        <input type="checkbox" checked={isVerified} onChange={() => toggleOrderVerified(order['Order ID'], isVerified)} className={`w-10 h-10 rounded-xl appearance-none border transition-all cursor-pointer ${isVerified ? 'bg-emerald-500 border-emerald-400' : 'bg-gray-800 border-gray-600'}`} />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">{isUpdating ? <Spinner size="sm" /> : isVerified ? <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : <span className="text-[8px] font-black text-gray-500 uppercase">OK</span>}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default OrdersListTablet;
