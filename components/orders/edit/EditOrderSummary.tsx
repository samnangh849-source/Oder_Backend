
import React from 'react';
import Spinner from '../../common/Spinner';

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
    return (
        <div className="flex-shrink-0 bg-[#0f1523]/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-5 lg:p-6 flex flex-col lg:flex-row gap-6 items-center justify-between shadow-[0_-10px_40px_rgba(0,0,0,0.3)] relative z-30">
            {/* Stats Group */}
            <div className="flex flex-wrap gap-8 items-center justify-center lg:justify-start w-full lg:w-auto">
                <div className="text-center lg:text-left">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Subtotal</p>
                    <p className="text-xl font-bold text-gray-300">${(Number(subtotal) || 0).toFixed(2)}</p>
                </div>
                
                <div className="w-px h-10 bg-white/10 hidden lg:block"></div>
                
                <div className="text-center lg:text-left relative group">
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 group-focus-within:text-blue-400 transition-colors">Shipping Fee</p>
                    <div className="relative inline-flex items-center">
                        <input 
                            type="text" 
                            inputMode="decimal"
                            name="Shipping Fee (Customer)" 
                            value={shippingFee} 
                            onChange={onShippingFeeChange} 
                            className="w-20 bg-transparent border-b-2 border-gray-600 text-center font-black text-xl text-white outline-none focus:border-blue-500 transition-all py-0.5" 
                        />
                        <span className="text-gray-500 font-black ml-1 text-sm">$</span>
                    </div>
                </div>
                
                <div className="w-px h-10 bg-white/10 hidden lg:block"></div>
                
                <div className="text-center lg:text-left">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Grand Total</p>
                    <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-emerald-200 tracking-tighter drop-shadow-md">
                        ${(Number(grandTotal) || 0).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-center">
                {/* Delete Button */}
                <button 
                    type="button" 
                    onClick={onDelete} 
                    disabled={loading}
                    className="w-full lg:w-auto px-8 py-5 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 border border-red-500/20 active:scale-95 group order-last lg:order-first"
                >
                    <svg className="w-4 h-4 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth="2.5"/></svg> 
                    Delete
                </button>

                {/* Save Button */}
                <button 
                    onClick={onSave} 
                    disabled={loading}
                    className="w-full lg:w-auto px-12 py-5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-[0_10px_30px_rgba(37,99,235,0.4)] transform active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed group border border-white/10"
                >
                    {loading ? <Spinner size="sm" /> : <>
                        <span className="relative z-10">Save Changes</span>
                        <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                    </>}
                </button>
            </div>
        </div>
    );
};

export default EditOrderSummary;
