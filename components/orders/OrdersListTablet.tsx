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
    onView?: (order: ParsedOrder) => void;
    handlePrint: (order: ParsedOrder) => void;
    handleCopy: (id: string) => void;
    handleCopyTemplate: (order: ParsedOrder) => void;
    copiedId: string | null;
    copiedTemplateId: string | null;
    toggleOrderVerified: (id: string, currentStatus: boolean) => void;
    updatingIds: Set<string>;
    groupBy?: string;
}

const OrdersListTablet: React.FC<OrdersListTabletProps> = ({
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
    updatingIds,
    groupBy = 'none'
}) => {
    const { appData, previewImage, currentUser } = useContext(AppContext);

    // Helper for robust date parsing
    const getSafeDateObj = (dateStr: string) => {
        if (!dateStr) return new Date();
        
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

        if (dateStr.endsWith('Z')) {
            const cleanDate = dateStr.slice(0, -1);
            return new Date(cleanDate);
        }

        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    // Helper to check edit permission
    const canEditOrder = (order: ParsedOrder) => {
        if (!currentUser) return false;
        if (currentUser.IsSystemAdmin) return true;

        const userTeams = (currentUser.Team || '').split(',').map(t => t.trim());
        if (!userTeams.includes(order.Team)) return false;

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

    const checkColumnVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
    const isBrandSalesVisible = checkColumnVisible('brandSales');

    const groupedData = useMemo(() => {
        if (groupBy === 'none') return [{ label: '', orders }];
        const groups: Record<string, ParsedOrder[]> = {};
        orders.forEach(o => {
            const key = String((o as any)[groupBy] || 'Unassigned');
            if (!groups[key]) groups[key] = [];
            groups[key].push(o);
        });
        return Object.entries(groups).map(([label, items]) => ({ label, orders: items }));
    }, [orders, groupBy]);

    return (
        <div className="space-y-6 pb-20">
            <div className="w-full">
                <MobileGrandTotalCard totals={totals} />
            </div>

            {groupedData.map((group, gIdx) => (
                <div key={gIdx} className="space-y-5">
                    {group.label && (
                        <div className="flex items-center gap-3 px-2 py-1">
                            <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                            <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] italic">{groupBy}: <span className="text-white">{group.label}</span></span>
                            <span className="text-xs text-gray-600 font-bold ml-auto">{group.orders.length} items</span>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-5">
                        {group.orders.map((order) => {
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
                                                    <button onClick={() => handleCopy(order['Order ID'])} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${isThisCopied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-black/30 text-gray-400 border-white/5 hover:text-white'}`}>
                                                        <span className="text-[10px] font-black uppercase tracking-widest font-mono">#{order['Order ID'].substring(0, 8)}</span>
                                                    </button>
                                                    <button onClick={() => handleCopyTemplate(order)} className={`flex items-center justify-center w-8 h-8 rounded-xl border transition-all active:scale-95 ${isThisTemplateCopied ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' : 'bg-black/30 border-white/5 text-gray-400 hover:text-white'}`}>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                                    </button>
                                                </div>
                                                {isScheduled && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg animate-pulse self-start">
                                                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Scheduled</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${order['Payment Status'] === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {order['Payment Status']}
                                        </span>
                                    </div>

                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="relative w-12 h-12 rounded-xl bg-black/40 border border-white/10 p-0.5 flex-shrink-0">
                                            {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-[10px]" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[9px]">N/A</div>}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-white font-black text-sm truncate">{order['Customer Name']}</h3>
                                            <p className="text-blue-400 font-mono font-bold text-xs">{displayPhone}</p>
                                            <div className="text-[10px] text-gray-500 font-bold truncate flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                {order.Location || 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <div className="flex justify-between items-end mb-4 pt-3 border-t border-white/5">
                                            <div>
                                                <p className="text-xl font-black text-white tracking-tight">${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                                            </div>

                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {shippingLogo && <img src={shippingLogo} className="w-3.5 h-3.5 object-contain" alt="" />}
                                                    <span className="text-xs font-bold text-orange-400">{order['Internal Shipping Method']?.substring(0, 10)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button onClick={() => onView && onView(order)} className="w-10 h-10 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-xl border border-white/10 transition-all">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c3.478 0 6.991 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            </button>
                                            {onEdit && (
                                                allowEdit ? (
                                                    <button onClick={() => onEdit(order)} className="flex-1 py-2.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-xl border border-blue-500/20 font-black text-[10px] uppercase tracking-widest transition-all">Edit</button>
                                                ) : (
                                                    <button disabled className="flex-1 py-2.5 bg-gray-800 text-gray-600 rounded-xl border border-white/5 font-black text-[10px] uppercase tracking-widest cursor-not-allowed">Locked</button>
                                                )
                                            )}
                                            <button onClick={() => handlePrint(order)} className="w-10 h-10 flex items-center justify-center bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-white/10 transition-all">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            </button>
                                            <div className="relative">
                                                <input type="checkbox" checked={isVerified} onChange={() => toggleOrderVerified(order['Order ID'], isVerified)} className={`w-10 h-10 rounded-xl appearance-none border transition-all cursor-pointer ${isVerified ? 'bg-emerald-500 border-emerald-400' : 'bg-gray-800 border-gray-600'}`} />
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">{isUpdating ? <Spinner size="sm" /> : isVerified ? <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg> : <span className="text-[8px] font-black text-gray-500 uppercase">OK</span>}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default OrdersListTablet;