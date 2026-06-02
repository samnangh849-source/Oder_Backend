
import React, { useContext } from 'react';
import Spinner from '../../common/Spinner';
import { AppContext } from '../../../context/AppContext';

interface EditOrderSummaryProps {
    subtotal: number;
    grandTotal: number;
    shippingFee: number | string;
    onShippingFeeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    orderDiscount: number | string;
    onOrderDiscountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: (e: React.FormEvent) => void;
    onDelete: () => void;
    onCancelOrder: () => void;
    onUnReturn?: () => void;
    fulfillmentStatus: string;
    loading: boolean;
}

const EditOrderSummary: React.FC<EditOrderSummaryProps> = ({
    subtotal, grandTotal, shippingFee, onShippingFeeChange, 
    orderDiscount, onOrderDiscountChange,
    onSave, onDelete, onCancelOrder, onUnReturn, fulfillmentStatus, loading
}) => {
    const { hasPermission } = useContext(AppContext);

    const isShipped = fulfillmentStatus === 'Shipped' || fulfillmentStatus === 'Delivered';
    const isCancelled = fulfillmentStatus === 'Cancelled' || fulfillmentStatus === 'Returned';

    return (
        <div className="flex-shrink-0 bg-[#1E2329] border-t-4 border-[#FCD535] border-l border-r border-b border-[#2B3139] rounded-none p-3 lg:p-4 flex flex-col lg:flex-row gap-4 lg:gap-6 items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.3)]">
            {/* Stats Group */}
            <div className="flex flex-wrap gap-4 sm:gap-8 items-center justify-center lg:justify-start w-full lg:w-auto">
                <div className="text-center lg:text-left">
                    <p className="text-[9px] font-black text-[#848E9C] uppercase tracking-widest mb-1">Subtotal</p>
                    <p className="text-lg lg:text-xl font-black text-[#EAECEF] tabular-nums tracking-tighter">${(Number(subtotal) || 0).toFixed(2)}</p>
                </div>
                
                <div className="w-[1px] h-8 bg-[#2B3139] hidden sm:block"></div>
                
                <div className="text-center lg:text-left">
                    <p className="text-[9px] font-black text-[#848E9C] uppercase tracking-widest mb-1">Ship Fee</p>
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] text-[#FCD535] font-black">$</span>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            name="Shipping Fee (Customer)" 
                            value={shippingFee} 
                            onChange={onShippingFeeChange} 
                            className="w-16 bg-transparent border-b border-[#2B3139] text-center font-black text-lg text-[#EAECEF] outline-none focus:border-[#FCD535] transition-all py-0.5 tabular-nums" 
                        />
                    </div>
                </div>

                <div className="w-[1px] h-8 bg-[#2B3139] hidden sm:block"></div>

                <div className="text-center lg:text-left">
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Discount</p>
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] text-red-500 font-black">-$</span>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            value={orderDiscount} 
                            onChange={onOrderDiscountChange} 
                            className="w-16 bg-transparent border-b border-[#2B3139] text-center font-black text-lg text-red-500 outline-none focus:border-red-500 transition-all py-0.5 tabular-nums" 
                        />
                    </div>
                </div>
                
                <div className="w-[1px] h-8 bg-[#2B3139] hidden lg:block"></div>
                
                <div className="text-center lg:text-left bg-[#FCD535]/5 px-4 py-1.5 border border-[#FCD535]/10">
                    <p className="text-[10px] font-black text-[#FCD535] uppercase tracking-[0.2em] mb-0.5">Grand Total</p>
                    <p className="text-3xl lg:text-4xl font-black text-[#FCD535] tabular-nums tracking-tighter drop-shadow-[0_0_15px_rgba(252,213,53,0.3)]">
                        ${(Number(grandTotal) || 0).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row gap-2.5 w-full lg:w-auto items-stretch">
                {/* Cancel/Return Button */}
                {!isCancelled ? (
                    <button 
                        type="button" 
                        onClick={onCancelOrder} 
                        disabled={loading}
                        className={`flex-1 lg:flex-none px-4 lg:px-6 py-2.5 rounded-none font-black uppercase text-[10px] tracking-widest transition-all border-2 active:translate-y-[2px] flex flex-col items-center justify-center leading-none gap-1.5 ${
                            isShipped 
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/40 hover:bg-purple-500/20 hover:border-purple-500' 
                            : 'bg-red-500/10 text-red-500 border-red-500/40 hover:bg-red-500/20 hover:border-red-500'
                        }`}
                        title={isShipped ? "Request to return this order" : "Request to cancel this order"}
                    >
                        <div className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="3" strokeLinecap="round" /></svg> 
                            <span className="text-[10px]">{isShipped ? 'REQUEST RETURN' : 'REQUEST CANCEL'}</span>
                        </div>
                    </button>
                ) : fulfillmentStatus === 'Returned' && onUnReturn && (
                    <button 
                        type="button" 
                        onClick={onUnReturn} 
                        disabled={loading}
                        className="flex-1 lg:flex-none px-4 lg:px-6 py-2.5 bg-orange-500/10 text-orange-500 border-orange-500/40 hover:bg-orange-500/20 hover:border-orange-500 rounded-none font-black uppercase text-[10px] tracking-widest transition-all border-2 active:translate-y-[2px] flex items-center justify-center gap-2"
                        title="Restore order from Returned status"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth="3" strokeLinecap="round" /></svg> 
                        UN RETURN
                    </button>
                )}

                {/* Delete Button - Hidden if no permission */}
                {hasPermission('delete_order') && (
                    <button 
                        type="button" 
                        onClick={onDelete} 
                        disabled={loading}
                        className="flex-1 lg:flex-none px-4 lg:px-6 py-2.5 bg-[#2B3139] hover:bg-[#F6465D] text-[#848E9C] hover:text-white rounded-none font-black uppercase text-[10px] tracking-widest transition-all border-2 border-transparent hover:border-[#F6465D] active:translate-y-[2px] flex items-center justify-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2.5"/></svg> 
                        Delete
                    </button>
                )}

                {/* Save Button */}
                <button 
                    onClick={onSave} 
                    disabled={loading}
                    className="flex-[2] lg:flex-none px-6 lg:px-10 py-2.5 bg-[#FCD535] hover:bg-[#F0B90B] text-[#181A20] rounded-none font-black uppercase text-[10px] lg:text-[11px] tracking-[0.15em] shadow-[4px_4px_0px_0px_rgba(252,213,53,0.2)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-[#FCD535]"
                >
                    {loading ? <Spinner size="xs" /> : <>
                        Save Order
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </>}
                </button>
            </div>
        </div>
    );
};

export default EditOrderSummary;
