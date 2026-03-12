
import React, { useEffect } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
    maxWidth?: string;
    fullScreen?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, maxWidth = 'max-w-md', fullScreen = false }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className={`fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] transition-opacity duration-300 modal-overlay ${fullScreen ? 'p-0' : 'p-4 sm:p-6 lg:p-8'}`}
            onClick={onClose}
        >
            <div
                className={`${fullScreen ? 'w-screen h-screen' : `page-card w-full ${maxWidth} rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] border border-white/10`} bg-[#0f172a]/95 transform transition-all duration-300 scale-100 opacity-100 animate-modal-in max-h-[92vh] flex flex-col overflow-hidden my-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-grow overflow-y-auto overscroll-contain custom-scrollbar scroll-smooth">
                    {children}
                </div>
            </div>
            <style>{`
                @keyframes modal-in {
                    from { transform: scale(0.98) translateY(10px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
                .animate-modal-in { animation: modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
            `}</style>
        </div>
    );
};

export default Modal;
