
import React, { useEffect } from 'react';
import { useSoundEffects } from '../../hooks/useSoundEffects';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children?: React.ReactNode;
    maxWidth?: string;
    fullScreen?: boolean;
    zIndex?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, maxWidth = 'max-w-md', fullScreen = false, zIndex = 'z-[100]' }) => {
    const { playPop, playClick } = useSoundEffects();

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                playClick();
                onClose();
            }
        };
        if (isOpen) {
            playPop();
            window.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleOverlayClick = () => {
        playClick();
        onClose();
    };

    return (
        <div 
            className={`fixed inset-0 bg-[#0B0E11]/80 backdrop-blur-sm flex items-center justify-center ${zIndex} transition-opacity duration-300 modal-overlay ${fullScreen ? 'p-0' : 'p-4 sm:p-6'}`}
            onClick={handleOverlayClick}
        >
            <div
                className={`${fullScreen ? 'w-screen h-screen max-w-none max-h-none' : `page-card w-full ${maxWidth} rounded-sm shadow-2xl border border-[#2B3139] max-h-[95vh] flex flex-col my-auto`} bg-[#181A20] transform transition-all duration-300 scale-100 opacity-100 animate-modal-in overflow-hidden font-sans text-gray-300`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex-grow overflow-y-auto overscroll-contain no-scrollbar scroll-smooth">
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
