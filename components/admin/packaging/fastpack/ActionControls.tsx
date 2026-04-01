import React from 'react';
import Spinner from '@/components/common/Spinner';

type PackStep = 'VERIFYING' | 'LABELING' | 'PHOTO';

interface ActionControlsProps {
    step: PackStep;
    isOrderVerified: boolean;
    hasGeneratedLabel: boolean;
    packagePhoto: string | null;
    uploading: boolean;
    undoTimer: number | null;
    onClose: () => void;
    setStep: (step: PackStep) => void;
    handleSubmit: () => void;
}

const ActionControls: React.FC<ActionControlsProps> = ({
    step, isOrderVerified, hasGeneratedLabel, packagePhoto, uploading, undoTimer, onClose, setStep, handleSubmit
}) => {
    return (
        <footer className="relative z-30 px-6 py-4 bg-[#181A20] border-t border-[#2B3139] flex flex-col sm:flex-row gap-4 flex-shrink-0 justify-between">
            <div className="order-2 sm:order-1 flex gap-4">
                <button onClick={onClose} disabled={uploading} className="px-8 py-3 bg-[#0B0E11] text-gray-400 hover:text-[#F6465D] hover:bg-[#F6465D]/10 rounded-sm font-bold uppercase text-[10px] tracking-widest transition-colors border border-[#2B3139]">
                    Exit Terminal
                </button>
            </div>

            <div className="order-1 sm:order-2 flex gap-4">
                {step === 'VERIFYING' && (
                    <button onClick={() => setStep('LABELING')} disabled={!isOrderVerified} className={`px-10 py-3 rounded-sm font-bold uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-3 ${!isOrderVerified ? 'bg-[#0B0E11] text-gray-600 border border-[#2B3139]' : 'bg-[#FCD535] text-black hover:bg-[#FCD535]/90'}`}>
                        Proceed to Label
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                )}

                {step === 'LABELING' && (
                    <button onClick={() => setStep('PHOTO')} disabled={!hasGeneratedLabel} className={`px-10 py-3 rounded-sm font-bold uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-3 ${!hasGeneratedLabel ? 'bg-[#0B0E11] text-gray-600 border border-[#2B3139]' : 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-black'}`}>
                        Take Photo
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                )}

                {step === 'PHOTO' && (
                    <button onClick={handleSubmit} disabled={!packagePhoto || uploading} className={`px-10 py-3 rounded-sm font-bold uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-3 ${!packagePhoto || uploading ? 'bg-[#0B0E11] text-gray-600 border border-[#2B3139]' : 'bg-[#0ECB81] hover:bg-[#0ECB81]/90 text-white shadow-[0_0_15px_rgba(14,203,129,0.3)]'}`}>
                        {uploading && undoTimer === null ? <Spinner size="sm" /> : <>Finalize Packing <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></>}
                    </button>
                )}
            </div>
        </footer>
    );
};

export default ActionControls;
