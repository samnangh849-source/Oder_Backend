
import React, { useContext } from 'react';
import Spinner from '../../common/Spinner';
import { AppContext } from '../../../context/AppContext';

interface EditOrderSummaryProps {
    subtotal: number;
    grandTotal: number;
    shippingFee: number | string;
    onShippingFeeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: (e: React.FormEvent) => void;
    onDelete: () => void;
    loading: boolean;
}

const EditOrderSummary: React.FC<EditOrderSummaryProps> = ({
    subtotal, grandTotal, shippingFee, onShippingFeeChange, onSave, onDelete, loading
}) => {
    const { hasPermission } = useContext(AppContext);

    return (
        <div className="flex-shrink-0 bg-[#1E2329] border border-[#2B3139] rounded-sm p-4 flex flex-col lg:flex-row gap-4 items-center justify-between shadow-lg">
            {/* Stats Group */}
            <div className="flex flex-wrap gap-6 items-center justify-center lg:justify-start w-full lg:w-auto">
                <div className="text-center lg:text-left">
                    <p className="text-[10px] font-medium text-[#848E9C] uppercase mb-1">Subtotal</p>
                    <p className="text-lg font-bold text-[#EAECEF] tabular-nums">${(Number(subtotal) || 0).toFixed(2)}</p>
                </div>
                
                <div className="w-[1px] h-8 bg-[#2B3139] hidden lg:block"></div>
                
                <div className="text-center lg:text-left">
                    <p className="text-[10px] font-medium text-[#848E9C] uppercase mb-1">Shipping Fee</p>
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] text-[#848E9C] font-bold">$</span>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            name="Shipping Fee (Customer)" 
                            value={shippingFee} 
                            onChange={onShippingFeeChange} 
                            className="w-16 bg-transparent border-b border-[#2B3139] text-center font-bold text-lg text-[#EAECEF] outline-none focus:border-[#FCD535] transition-all py-0.5" 
                        />
                    </div>
                </div>
                
                <div className="w-[1px] h-8 bg-[#2B3139] hidden lg:block"></div>
                
                <div className="text-center lg:text-left">
                    <p className="text-[10px] font-bold text-[#0ECB81] uppercase mb-1">Grand Total</p>
                    <p className="text-3xl font-bold text-[#EAECEF] tabular-nums tracking-tight">
                        ${(Number(grandTotal) || 0).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-row gap-2 w-full lg:w-auto items-center">
                {/* Delete Button - Hidden if no permission */}
                {hasPermission('delete_order') && (
                    <button 
                        type="button" 
                        onClick={onDelete} 
                        disabled={loading}
                        className="flex-1 lg:flex-none px-4 py-2 bg-[#2B3139] hover:bg-[#F6465D]/10 text-[#848E9C] hover:text-[#F6465D] rounded-sm font-bold uppercase text-[11px] transition-all border border-[#2B3139] hover:border-[#F6465D]/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2"/></svg> 
                        Delete
                    </button>
                )}

                {/* Save Button */}
                <button 
                    onClick={onSave} 
                    disabled={loading}
                    className="flex-[2] lg:flex-none px-8 py-2 bg-[#FCD535] hover:bg-[#F0B90B] text-[#181A20] rounded-sm font-bold uppercase text-[11px] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Spinner size="xs" /> : <>
                        Save Changes
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </>}
                </button>
            </div>
        </div>
    );
};

export default EditOrderSummary;
