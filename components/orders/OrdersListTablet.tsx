import React, { useContext, useMemo } from 'react';
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
    viewMode?: 'card' | 'list';
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
    groupBy = 'none',
    viewMode = 'card'
}) => {
    const { appData, previewImage, currentUser, advancedSettings } = useContext(AppContext);
    const isBinance = advancedSettings?.uiTheme === 'binance';

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
        return method ? convertGoogleDriveUrl(method.LogoURL) : null;
    };

    const formatPhone = (val: string) => {
        let phone = (val || '').replace(/[^0-9]/g, '');
        if (phone.length > 0) phone = '0' + phone.replace(/^0+/, '');
        return phone;
    };

    const checkColumnVisible = (key: string) => !visibleColumns || visibleColumns.has(key);
    const showVerify = checkColumnVisible('isVerified') || checkColumnVisible('check');

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
                            {isBinance ? (
                                <>
                                    <div className="w-1 h-5 bg-[#FCD535] rounded-sm"></div>
                                    <span className="text-xs font-bold text-[#848E9C] uppercase tracking-tight">{groupBy}: <span className="text-[#EAECEF]">{group.label}</span></span>
                                    <div className="h-[1px] flex-1 bg-[#2B3139]"></div>
                                </>
                            ) : (
                                <>
                                    <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] italic">{groupBy}: <span className="text-white">{group.label}</span></span>
                                    <span className="text-xs text-gray-600 font-bold ml-auto">{group.orders.length} items</span>
                                </>
                            )}
                        </div>
                    )}
                    
                    <div className={viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-2 gap-5'}>
                        {group.orders.map((order) => {
                            const pageInfo = appData.pages?.find((p: any) => p.PageName === order.Page);
                            const logoUrl = pageInfo ? convertGoogleDriveUrl(pageInfo.PageLogoURL) : '';
                            const displayPhone = formatPhone(order['Customer Phone']);
                            const isVerified = order.IsVerified === true || String(order.IsVerified).toUpperCase() === 'TRUE' || order.IsVerified === 'A';
                            const isUpdating = updatingIds.has(order['Order ID']);
                            const isSelected = selectedIds.has(order['Order ID']);
                            const shippingLogo = getShippingLogo(order['Internal Shipping Method']);
                            const isThisCopied = copiedId === order['Order ID'];
                            const allowEdit = canEditOrder(order);
                            const isPaid = order['Payment Status'] === 'Paid';

                            if (viewMode === 'list') {
                                return (
                                    <div 
                                        key={order['Order ID']}
                                        onClick={() => onView && onView(order)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.99] cursor-pointer ${isSelected ? 'bg-blue-600/20 border-blue-500/50' : isVerified ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-[#1e293b]/40 border-white/5'}`}
                                    >
                                        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect && onToggleSelect(order['Order ID'])} className="h-5 w-5 rounded-lg border-white/10 bg-white/5 text-blue-500 focus:ring-0" />
                                        </div>
                                        <div className="w-10 h-10 rounded-lg bg-black/40 border border-white/5 p-0.5 flex-shrink-0">
                                            {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-md" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-600">N/A</div>}
                                        </div>
                                        <div className="flex-grow min-w-0 grid grid-cols-4 gap-4 items-center">
                                            <div className="col-span-1 min-w-0">
                                                <h4 className="text-[13px] font-black text-white truncate">{order['Customer Name']}</h4>
                                                <p className="text-[11px] font-bold text-blue-400 font-mono">{displayPhone}</p>
                                            </div>
                                            <div className="col-span-1">
                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${isPaid ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>{order['Payment Status']}</span>
                                            </div>
                                            <div className="col-span-1">
                                                <p className="text-[11px] font-bold text-gray-400 truncate flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                                                    {order.Location}
                                                </p>
                                            </div>
                                            <div className="col-span-1 text-right">
                                                <p className="text-sm font-black text-white tracking-tighter italic">${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                        {showVerify && (
                                            <div className="flex-shrink-0 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => toggleOrderVerified(order['Order ID'], isVerified)} className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${isVerified ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                                                    {isUpdating ? <Spinner size="xs" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div 
                                    key={order['Order ID']} 
                                    className={`
                                        relative rounded-[2.5rem] p-6 shadow-xl transition-all duration-300 overflow-hidden group flex flex-col justify-between
                                        ${isSelected 
                                            ? 'bg-blue-900/20 border-2 border-blue-500/50 shadow-blue-900/20' 
                                            : isVerified 
                                                ? 'bg-emerald-900/10 border border-emerald-500/20 shadow-emerald-900/10' 
                                                : 'bg-[#1e293b]/60 border border-white/5 shadow-black/30 backdrop-blur-md hover:bg-[#1e293b]/80'
                                        }
                                    `}
                                >
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="flex items-center gap-3">
                                            {onToggleSelect && (
                                                <input 
                                                    type="checkbox" 
                                                    className="h-6 w-6 rounded-lg border-gray-600 bg-gray-800 text-blue-500 cursor-pointer focus:ring-0"
                                                    checked={isSelected}
                                                    onChange={() => onToggleSelect(order['Order ID'])}
                                                />
                                            )}
                                            <button onClick={() => handleCopy(order['Order ID'])} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all active:scale-95 ${isThisCopied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-black/30 text-gray-400 border-white/5 hover:text-white'}`}>
                                                <span className="text-[11px] font-black uppercase tracking-widest font-mono">#{order['Order ID'].substring(0, 8)}</span>
                                            </button>
                                        </div>
                                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${isPaid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {order['Payment Status']}
                                        </span>
                                    </div>

                                    <div className="flex items-start gap-5 mb-6">
                                        <div className="relative w-14 h-14 rounded-2xl bg-black/40 border border-white/10 p-0.5 flex-shrink-0">
                                            {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-xl" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">N/A</div>}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-white font-black text-base truncate">{order['Customer Name']}</h3>
                                            <p className="text-blue-400 font-mono font-bold text-sm">{displayPhone}</p>
                                            <div className="text-[11px] text-gray-500 font-bold truncate flex items-center gap-1 mt-1">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                {order.Location}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <div className="flex justify-between items-end mb-5 pt-4 border-t border-white/5">
                                            <div>
                                                <p className="text-2xl font-black text-white tracking-tight italic">${(Number(order['Grand Total']) || 0).toFixed(2)}</p>
                                            </div>

                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {shippingLogo && <img src={shippingLogo} className="w-4 h-4 object-contain" alt="" />}
                                                    <span className="text-[11px] font-black text-orange-400 uppercase tracking-wide">{order['Internal Shipping Method']}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button onClick={() => onView && onView(order)} className="w-12 h-12 flex items-center justify-center bg-white/5 text-gray-400 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-90">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c3.478 0 6.991 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            </button>
                                            {onEdit && (
                                                allowEdit ? (
                                                    <button onClick={() => onEdit(order)} className="flex-1 py-3 bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-2xl border border-blue-500/20 font-black text-[11px] uppercase tracking-widest transition-all active:scale-95">Edit</button>
                                                ) : (
                                                    <button disabled className="flex-1 py-3 bg-gray-800 text-gray-600 rounded-2xl border border-white/5 font-black text-[11px] uppercase tracking-widest cursor-not-allowed">Locked</button>
                                                )
                                            )}
                                            <button onClick={() => handlePrint(order)} className="w-12 h-12 flex items-center justify-center bg-gray-800 text-gray-400 hover:text-white rounded-2xl border border-white/10 transition-all active:scale-90">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                            </button>
                                            {showVerify && (
                                                <div className="relative">
                                                    <input type="checkbox" checked={isVerified} onChange={() => toggleOrderVerified(order['Order ID'], isVerified)} className={`w-12 h-12 rounded-2xl appearance-none border transition-all cursor-pointer ${isVerified ? 'bg-emerald-500 border-emerald-400' : 'bg-gray-800 border-gray-600'}`} />
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">{isUpdating ? <Spinner size="sm" /> : isVerified ? <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg> : <span className="text-[10px] font-black text-gray-500 uppercase">OK</span>}</div>
                                                </div>
                                            )}
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