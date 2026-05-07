
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
    placeholder = "បញ្ចូលព័ត៌មានបន្ថែម..."
}) => {
    const [selectedReason, setSelectedReason] = useState<string>('');
    const [customReason, setCustomReason] = useState<string>('');

    const handleConfirm = () => {
        const finalReason = selectedReason === 'ផ្សេងៗ' || !selectedReason 
            ? customReason 
            : selectedReason + (customReason ? `: ${customReason}` : '');
        
        if (!finalReason.trim()) {
            alert("សូមបញ្ចូលមូលហេតុ");
            return;
        }
        onConfirm(finalReason);
        setSelectedReason('');
        setCustomReason('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="flex flex-col h-full bg-[#181A20] font-sans">
                <div className="px-6 py-4 border-b border-[#2B3139] flex justify-between items-center bg-[#0B0E11]/50">
                    <h3 className="text-sm font-bold text-gray-200 uppercase tracking-widest">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ជ្រើសរើសមូលហេតុ</label>
                        <div className="grid grid-cols-1 gap-2">
                            {reasons.map((reason) => (
                                <button
                                    key={reason}
                                    onClick={() => setSelectedReason(reason)}
                                    className={`px-4 py-3 text-left text-xs rounded-sm border transition-all ${
                                        selectedReason === reason 
                                        ? 'bg-[#FCD535]/10 border-[#FCD535] text-[#FCD535]' 
                                        : 'bg-[#0B0E11] border-[#2B3139] text-gray-400 hover:border-gray-500'
                                    }`}
                                >
                                    {reason}
                                </button>
                            ))}
                            <button
                                onClick={() => setSelectedReason('ផ្សេងៗ')}
                                className={`px-4 py-3 text-left text-xs rounded-sm border transition-all ${
                                    selectedReason === 'ផ្សេងៗ' 
                                    ? 'bg-[#FCD535]/10 border-[#FCD535] text-[#FCD535]' 
                                    : 'bg-[#0B0E11] border-[#2B3139] text-gray-400 hover:border-gray-500'
                                }`}
                            >
                                ផ្សេងៗ...
                            </button>
                        </div>
                    </div>

                    {(selectedReason === 'ផ្សេងៗ' || selectedReason) && (
                        <div className="space-y-2 animate-fade-in">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                {selectedReason === 'ផ្សេងៗ' ? 'រៀបរាប់មូលហេតុ' : 'កំណត់ចំណាំបន្ថែម'}
                            </label>
                            <textarea
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                placeholder={placeholder}
                                className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm p-3 text-white text-xs focus:border-[#FCD535] outline-none transition-colors min-h-[80px] resize-none"
                            />
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-[#2B3139] bg-[#0B0E11]/50 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-3 text-[10px] font-bold text-gray-400 bg-transparent border border-[#2B3139] hover:bg-gray-800 rounded-sm uppercase tracking-widest transition-colors"
                    >
                        បោះបង់
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="flex-1 py-3 text-[10px] font-bold text-black bg-[#FCD535] hover:bg-[#FCD535]/90 rounded-sm uppercase tracking-widest transition-colors"
                    >
                        {actionText}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default OrderActionModal;
