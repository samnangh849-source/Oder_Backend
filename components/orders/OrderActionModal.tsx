
import React, { useState } from 'react';
import Modal from '../common/Modal';

interface OrderActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title: string;
    actionText: string;
    reasons: string[];
    placeholder?: string;
}

const OrderActionModal: React.FC<OrderActionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    actionText,
    reasons,
    placeholder = "បញ្ចូលព័ត៌មានបន្ថែម ឬបញ្ជាក់មូលហេតុ..."
}) => {
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [customReason, setCustomReason] = useState<string>('');

    // Validation: Must have a reason selected. If 'ផ្សេងៗ' is selected, customReason must not be empty.
    const isReady = selectedReason && (selectedReason !== 'ផ្សេងៗ' || customReason.trim().length > 0);

    const handleConfirm = () => {
        if (!isReady) return;

        const finalReason = selectedReason === 'ផ្សេងៗ'
            ? customReason.trim()
            : selectedReason + (customReason.trim() ? ` (${customReason.trim()})` : '');
        
        onConfirm(finalReason);
        setSelectedReason('');
        setCustomReason('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="flex flex-col h-full bg-[#1E2329] font-sans overflow-hidden rounded-2xl border border-[#2B3139] shadow-2xl">
                {/* Header */}
                <div className="px-6 py-5 border-b border-[#2B3139] flex justify-between items-center bg-[#1E2329]">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <h3 className="text-sm font-black text-[#EAECEF] uppercase tracking-wider">{title}</h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-[#848E9C] hover:bg-[#2B3139] hover:text-[#EAECEF] transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar max-h-[60vh]">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">សូមជ្រើសរើសមូលហេតុចម្បង <span className="text-red-500">*</span></label>
                            {!selectedReason && <span className="text-[9px] font-bold text-red-500/60 animate-pulse">Required</span>}
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                            {reasons.map((reason) => (
                                <button
                                    key={reason}
                                    onClick={() => setSelectedReason(reason)}
                                    className={`group px-4 py-3.5 text-left text-[11px] font-bold rounded-xl border-2 transition-all flex items-center justify-between ${
                                        selectedReason === reason 
                                        ? 'bg-[#FCD535]/10 border-[#FCD535] text-[#FCD535] shadow-[0_0_15px_rgba(252,213,53,0.1)]' 
                                        : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#474D57] hover:text-[#EAECEF]'
                                    }`}
                                >
                                    <span>{reason}</span>
                                    {selectedReason === reason && (
                                        <div className="w-4 h-4 rounded-full bg-[#FCD535] flex items-center justify-center">
                                            <svg className="w-2.5 h-2.5 text-[#181A20]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                            <button
                                onClick={() => setSelectedReason('ផ្សេងៗ')}
                                className={`group px-4 py-3.5 text-left text-[11px] font-bold rounded-xl border-2 transition-all flex items-center justify-between ${
                                    selectedReason === 'ផ្សេងៗ' 
                                    ? 'bg-[#FCD535]/10 border-[#FCD535] text-[#FCD535] shadow-[0_0_15px_rgba(252,213,53,0.1)]' 
                                    : 'bg-[#0B0E11] border-[#2B3139] text-[#848E9C] hover:border-[#474D57] hover:text-[#EAECEF]'
                                }`}
                            >
                                <span>ផ្សេងៗ...</span>
                                {selectedReason === 'ផ្សេងៗ' && (
                                    <div className="w-4 h-4 rounded-full bg-[#FCD535] flex items-center justify-center">
                                        <svg className="w-2.5 h-2.5 text-[#181A20]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>

                    {(selectedReason === 'ផ្សេងៗ' || selectedReason) && (
                        <div className="space-y-3 animate-slide-up">
                            <label className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em] px-1">
                                {selectedReason === 'ផ្សេងៗ' ? (
                                    <>រៀបរាប់មូលហេតុលម្អិត <span className="text-red-500">*</span></>
                                ) : (
                                    'កំណត់ចំណាំបន្ថែម (ស្រេចចិត្ត)'
                                )}
                            </label>
                            <textarea
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder={placeholder}
                                className={`w-full bg-[#0B0E11] border-2 rounded-xl p-4 text-[#EAECEF] text-xs font-medium focus:border-[#FCD535] outline-none transition-all min-h-[100px] resize-none placeholder-[#474D57] shadow-inner ${
                                    selectedReason === 'ផ្សេងៗ' && !customReason.trim() ? 'border-red-500/30' : 'border-[#2B3139]'
                                }`}
                            />
                            {selectedReason === 'ផ្សេងៗ' && !customReason.trim() && (
                                <p className="text-[9px] font-bold text-red-500 px-1 uppercase tracking-wider">សូមបញ្ជាក់មូលហេតុលម្អិតរបស់អ្នក</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-5 border-t border-[#2B3139] bg-[#1E2329] flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3.5 text-[11px] font-black text-[#848E9C] bg-transparent border-2 border-[#2B3139] hover:bg-[#2B3139] hover:text-[#EAECEF] rounded-xl uppercase tracking-widest transition-all active:scale-[0.98]"
                    >
                        បោះបង់
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={!isReady}
                        className={`flex-[1.5] py-3.5 text-[11px] font-black rounded-xl uppercase tracking-widest transition-all border-2 active:scale-[0.98] ${
                            isReady 
                            ? 'text-[#181A20] bg-[#FCD535] border-[#FCD535] shadow-[0_4px_15px_rgba(252,213,53,0.2)] hover:bg-[#F0B90B]' 
                            : 'text-[#474D57] bg-[#2B3139] border-[#2B3139] cursor-not-allowed opacity-50'
                        }`}
                    >
                        {actionText}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default OrderActionModal;
