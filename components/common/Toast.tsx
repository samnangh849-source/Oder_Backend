
import React, { useEffect } from 'react';
import { APP_LOGO_URL } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface ToastProps {
    message: string;
    type?: 'success' | 'info' | 'error';
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000); // Auto close after 5s
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgClass = 
        type === 'success' ? 'bg-emerald-600/90 border-emerald-500 shadow-[0_10px_40px_rgba(16,185,129,0.3)]' :
        type === 'error' ? 'bg-red-600/90 border-red-500 shadow-[0_10px_40px_rgba(239,68,68,0.3)]' :
        'bg-blue-600/90 border-blue-500 shadow-[0_10px_40px_rgba(59,130,246,0.3)]';

    const logoUrl = convertGoogleDriveUrl(APP_LOGO_URL);

    return (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 pl-3 pr-4 py-3 rounded-2xl border backdrop-blur-xl text-white animate-slide-in-right ${bgClass} min-w-[320px] max-w-md`}>
            <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-xl p-1.5 flex items-center justify-center border border-white/20">
                {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full bg-white/20 rounded-lg animate-pulse" />
                )}
            </div>
            <div className="flex-grow">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">System Notification</span>
                    {type === 'success' && <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></div>}
                </div>
                <div className="font-bold text-sm leading-tight">
                    {message}
                </div>
            </div>
            <button onClick={onClose} className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <style>{`
                @keyframes slide-in-right {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .animate-slide-in-right { animation: slide-in-right 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
            `}</style>
        </div>
    );
};

export default Toast;
