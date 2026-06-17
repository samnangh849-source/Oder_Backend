import React, { useContext } from 'react';
import Spinner from '@/components/common/Spinner';
import { AppContext } from '@/context/AppContext';
import { translations } from '@/translations';

type PackStep = 'VERIFYING' | 'LABELING' | 'PHOTO';

interface ActionControlsProps {
    step: PackStep;
    isOrderVerified: boolean;
    hasGeneratedLabel: boolean;
    packagePhoto: string | null;
    uploading: boolean;
    undoTimer: number | null;
    mapLink?: string | null;
    onClose: () => void;
    setStep: (step: PackStep) => void;
    handleSubmit: () => void;
}

const ActionControls: React.FC<ActionControlsProps> = ({
    step, isOrderVerified, hasGeneratedLabel, packagePhoto, uploading, undoTimer, mapLink, onClose, setStep, handleSubmit
}) => {
    const { language } = useContext(AppContext);
    const t = translations[language as 'km' | 'en'];

    const handleBack = () => {
        if (step === 'LABELING') setStep('VERIFYING');
        else if (step === 'PHOTO') setStep('LABELING');
        else onClose();
    };

    return (
        <footer className="relative z-30 px-6 py-4 flex flex-col sm:flex-row gap-4 flex-shrink-0 justify-between items-center bg-[#181A20] border-t border-[#2B3139] shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
            {/* Back & Map Controls */}
            <div className="order-2 sm:order-1 flex w-full sm:w-auto gap-3">
                <button 
                    onClick={handleBack} 
                    disabled={uploading} 
                    className="w-full sm:w-auto px-6 py-3 bg-[#2B3139] hover:bg-[#474D57] text-[#EAECEF] rounded font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-3 active:scale-95 group"
                >
                    <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform text-[#848E9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" /></svg>
                    {step === 'VERIFYING' ? 'Abort Terminal' : step === 'LABELING' ? 'Back' : 'Back'}
                </button>

                {mapLink && (
                    <a 
                        href={mapLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-6 py-3 bg-[#1e3a8a]/40 hover:bg-[#1e3a8a]/60 text-blue-400 border border-blue-500/30 rounded font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-3 active:scale-95 group"
                    >
                        <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        <span>{t.view_google_map || 'View Google Map'}</span>
                    </a>
                )}
            </div>


            {/* Primary Action Control */}
            <div className="order-1 sm:order-2 flex w-full sm:w-auto min-w-[280px]">
                {step === 'VERIFYING' && (
                    <button 
                        onClick={() => setStep('LABELING')} 
                        disabled={!isOrderVerified} 
                        className={`w-full px-8 py-3.5 rounded font-bold text-base uppercase tracking-tight transition-all flex items-center justify-center gap-4 active:scale-[0.98] group ${!isOrderVerified ? 'bg-[#2B3139] text-[#5E6673] cursor-not-allowed' : 'bg-[#FCD535] text-[#181A20] hover:bg-[#FCD535]/90 shadow-lg shadow-[#FCD535]/10'}`}
                    >
                        <span>{t.proceed_to_label || 'Confirm & Label'}</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                    </button>
                )}

                {step === 'LABELING' && (
                    <button 
                        onClick={() => setStep('PHOTO')} 
                        disabled={!hasGeneratedLabel} 
                        className={`w-full px-8 py-3.5 rounded font-bold text-base uppercase tracking-tight transition-all flex items-center justify-center gap-4 active:scale-[0.98] group ${!hasGeneratedLabel ? 'bg-[#2B3139] text-[#5E6673] cursor-not-allowed' : 'bg-[#FCD535] text-[#181A20] hover:bg-[#FCD535]/90 shadow-lg shadow-[#FCD535]/10'}`}
                    >
                        <span>{t.initialize_camera || 'Initialize Vision'}</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                    </button>
                )}

                {step === 'PHOTO' && (
                    <button 
                        onClick={handleSubmit} 
                        disabled={!packagePhoto || uploading} 
                        className={`w-full px-10 py-3.5 rounded font-bold text-lg uppercase tracking-tight transition-all flex items-center justify-center gap-4 active:scale-[0.98] group ${!packagePhoto || uploading ? 'bg-[#2B3139] text-[#5E6673] cursor-not-allowed' : 'bg-[#02C076] text-white shadow-lg shadow-[#02C076]/10'}`}
                    >
                        {uploading && undoTimer === null ? (
                            <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>{t.finalize_packing || 'Commit Order'}</span>
                                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </>
                        )}
                    </button>
                )}
            </div>
        </footer>
    );
};

export default ActionControls;
