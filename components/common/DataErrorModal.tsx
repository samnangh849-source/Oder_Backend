import React from 'react';
import Modal from './Modal';

interface DataErrorModalProps {
    error: { message: string; title: string; critical: boolean };
    onRetry: () => void;
    onLogout?: () => void;
}

const DataErrorModal: React.FC<DataErrorModalProps> = ({ error, onRetry, onLogout }) => {
    return (
        // Passing an empty onClose to Modal prevents it from closing when clicking overlay,
        // which is desired for critical errors.
        <Modal isOpen={true} onClose={() => {}} maxWidth="max-w-md">
            <div className="text-center p-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-900/30 mb-4 border border-red-500/30">
                    <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{error.title}</h3>
                <div className="bg-gray-900/50 p-3 rounded-lg text-left mb-6 border border-gray-700">
                    <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{error.message}</p>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                    {error.critical && onLogout && (
                         <button onClick={onLogout} className="btn btn-secondary w-full sm:w-auto">
                            ចាកចេញ (Logout)
                         </button>
                    )}
                    <button onClick={onRetry} className="btn btn-primary w-full sm:w-auto">
                        ព្យាយាមម្តងទៀត (Retry)
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default DataErrorModal;