import React, { useEffect, useState } from 'react';

export interface FloatingAlertProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    /**
     * Optional image source for the app icon. 
     * If not provided, a default bell icon or type-specific icon will be used.
     */
    imageSrc?: string;
    actionLabel?: string;
    onAction?: () => void;
    /**
     * Duration in milliseconds to auto-dismiss.
     * Set to 0 to disable auto-dismiss.
     * Default: 5000ms
     */
    duration?: number;
}

const FloatingAlert: React.FC<FloatingAlertProps> = ({
    isOpen,
    onClose,
    title,
    message,
    imageSrc,
    actionLabel,
    onAction,
    duration = 5000
}) => {
    const [isClosing, setIsClosing] = useState(false);
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsClosing(false);
        } else {
            // Start exit animation
            setIsClosing(true);
            const timer = setTimeout(() => {
                setShouldRender(false);
            }, 400); // Match animation duration
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && duration > 0) {
            const timer = setTimeout(() => {
                handleClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [isOpen, duration]);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setShouldRender(false);
        }, 400);
    };

    if (!shouldRender) return null;

    return (
        <>
            <div 
                className={`relative z-[110] w-full
                    ${isClosing ? 'animate-alert-fade-out' : 'animate-alert-fade-in'}
                    flex flex-col gap-3 p-4 rounded-[1.5rem]
                    backdrop-blur-xl bg-gray-900/90 border border-white/10
                    shadow-[0_20px_50px_rgba(0,0,0,0.3)]
                    text-white transition-all duration-300 ease-in-out cursor-pointer hover:bg-gray-900/95`}
                onClick={handleClose}
                role="alert"
            >
                <div className="flex items-start gap-4">
                    {/* App Icon / Image */}
                    <div className="flex-shrink-0">
                        {imageSrc ? (
                            <img src={imageSrc} alt="App Icon" className="w-12 h-12 rounded-xl object-cover shadow-lg bg-black/20 border border-white/5" />
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center shadow-lg border border-blue-500/30">
                                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                        <h4 className="text-base font-black text-white leading-tight uppercase tracking-tight italic">{title}</h4>
                        <p className="mt-1 text-sm text-gray-400 leading-snug font-bold">{message}</p>
                    </div>

                    {/* Close Button (Small) */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClose();
                        }}
                        className="flex-shrink-0 text-white/30 hover:text-white transition-colors p-1"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Optional Action Button */}
                {actionLabel && onAction && (
                    <div className="flex justify-end pt-2 border-t border-white/5 mt-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction();
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 shadow-lg"
                        >
                            {actionLabel}
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes alert-fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes alert-fade-out {
                    from {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: translateY(-10px) scale(0.95);
                    }
                }
                .animate-alert-fade-in {
                    animation: alert-fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .animate-alert-fade-out {
                    animation: alert-fade-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </>
    );
};

export default FloatingAlert;
