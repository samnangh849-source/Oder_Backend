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
        <footer className="relative z-30 px-6 sm:px-12 py-6 bg-[#0B0E11]/80 backdrop-blur-xl border-t border-white/5 flex flex-col sm:flex-row gap-6 flex-shrink-0 justify-between items-center shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            <div className="order-2 sm:order-1 flex gap-4 w-full sm:w-auto">
                <button 
                    onClick={onClose} 
                    disabled={uploading} 
                    className="flex-1 sm:flex-none px-10 py-4 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all duration-300 border border-white/5 active:scale-95 flex items-center justify-center gap-3 group"
                >
                    <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    EXIT TERMINAL
                </button>
            </div>

            <div className="order-1 sm:order-2 flex gap-4 w-full sm:w-auto">
                {step === 'VERIFYING' && (
                    <button 
                        onClick={() => setStep('LABELING')} 
                        disabled={!isOrderVerified} 
                        className={`flex-1 sm:flex-none px-12 py-4 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3 group active:scale-95 ${!isOrderVerified ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed opacity-50' : 'bg-[#FCD535] text-black hover:bg-[#FCD535]/90 shadow-[0_10px_30px_rgba(252,213,53,0.2)] hover:shadow-[0_15px_40px_rgba(252,213,53,0.3)]'}`}
                    >
                        PROCEED TO LABEL
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                )}

                {step === 'LABELING' && (
                    <button 
                        onClick={() => setStep('PHOTO')} 
                        disabled={!hasGeneratedLabel} 
                        className={`flex-1 sm:flex-none px-12 py-4 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3 group active:scale-95 ${!hasGeneratedLabel ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed opacity-50' : 'bg-[#FCD535] text-black hover:bg-[#FCD535]/90 shadow-[0_10px_30px_rgba(252,213,53,0.2)] hover:shadow-[0_15px_40px_rgba(252,213,53,0.3)]'}`}
                    >
                        INITIALIZE CAMERA
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                )}

                {step === 'PHOTO' && (
                    <button 
                        onClick={handleSubmit} 
                        disabled={!packagePhoto || uploading} 
                        className={`flex-1 sm:flex-none px-12 py-4 rounded-xl font-black uppercase text-[11px] tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3 group active:scale-95 ${!packagePhoto || uploading ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed opacity-50' : 'bg-[#0ECB81] text-white hover:bg-[#0ECB81]/90 shadow-[0_10px_30px_rgba(14,203,129,0.2)] hover:shadow-[0_15px_40px_rgba(14,203,129,0.3)]'}`}
                    >
                        {uploading && undoTimer === null ? (
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                <span>PROCESSING</span>
                            </div>
                        ) : (
                            <>
                                FINALIZE PACKING 
                                <svg className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </>
                        )}
                    </button>
                )}
            </div>
        </footer>
    );
};

export default ActionControls;
