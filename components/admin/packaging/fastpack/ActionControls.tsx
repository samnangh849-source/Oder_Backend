import React from 'react';
import Spinner from '@/components/common/Spinner';

type PackStep = 'VERIFYING' | 'LABELING' | 'CAPTURING';

interface ActionControlsProps {
    step: PackStep;
    isOrderVerified: boolean;
    hasGeneratedLabel: boolean;
    uploading: boolean;
    previewImage: string | null;
    undoTimer: number | null;
    onClose: () => void;
    setStep: (step: PackStep) => void;
    handleSubmit: () => void;
}

const ActionControls: React.FC<ActionControlsProps> = ({
    step, isOrderVerified, hasGeneratedLabel, uploading, previewImage, undoTimer, onClose, setStep, handleSubmit
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
                <button onClick={() => setStep('CAPTURING')} disabled={!hasGeneratedLabel} className={`px-10 py-3 rounded-sm font-bold uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-3 ${!hasGeneratedLabel ? 'bg-[#0B0E11] text-gray-600 border border-[#2B3139]' : 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-black'}`}>
                    Proceed to Capture
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
            )}

            {step === 'CAPTURING' && (
                <button onClick={handleSubmit} disabled={uploading || !previewImage} className={`px-10 py-3 rounded-sm font-bold uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-3 ${uploading || !previewImage ? 'bg-[#0B0E11] text-gray-600 border border-[#2B3139]' : 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-black'}`}>
                    {uploading && undoTimer === null ? <Spinner size="sm" /> : <>Finalize Upload <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></>}
                </button>
            )}
            </div>
        </footer>
    );
};

export default ActionControls;
