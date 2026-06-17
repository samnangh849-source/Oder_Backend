import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface OrderGracePeriodProps {
    timer: number;
    maxTimer: number;
    onUndo: () => void;
    isUndoing?: boolean;
    title?: string;
    subtitle?: string;
    accentColor?: 'emerald' | 'blue' | 'purple' | 'orange' | 'yellow';
}

const OrderGracePeriod: React.FC<OrderGracePeriodProps> = ({ 
    timer, 
    maxTimer, 
    onUndo, 
    isUndoing = false,
    title = "រួចរាល់ហើយ!",
    subtitle = "ការកម្ម៉ង់របស់អ្នកនឹងត្រូវបានបញ្ជូនទៅកាន់ប្រព័ន្ធក្នុងពេលបន្តិចទៀតនេះ...",
    accentColor = 'emerald'
}) => {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        const p = (timer / maxTimer) * 100;
        setProgress(p);
    }, [timer, maxTimer]);

    const colors = {
        emerald: {
            stroke: 'stroke-[#0ECB81]',
            glow: 'bg-[#0ECB81]/10',
            button: 'bg-[#0ECB81] hover:bg-[#0ECB81]/90 text-black',
            shadow: 'shadow-[#0ECB81]/20',
            text: 'text-[#0ECB81]'
        },
        blue: {
            stroke: 'stroke-[#4285F4]',
            glow: 'bg-[#4285F4]/10',
            button: 'bg-[#4285F4] hover:bg-[#4285F4]/90 text-white',
            shadow: 'shadow-[#4285F4]/20',
            text: 'text-[#4285F4]'
        },
        purple: {
            stroke: 'stroke-[#9C27B0]',
            glow: 'bg-[#9C27B0]/10',
            button: 'bg-[#9C27B0] hover:bg-[#9C27B0]/90 text-white',
            shadow: 'shadow-[#9C27B0]/20',
            text: 'text-[#9C27B0]'
        },
        orange: {
            stroke: 'stroke-[#F3BA2F]',
            glow: 'bg-[#F3BA2F]/10',
            button: 'bg-[#F3BA2F] hover:bg-[#F3BA2F]/90 text-black',
            shadow: 'shadow-[#F3BA2F]/20',
            text: 'text-[#F3BA2F]'
        },
        yellow: {
            stroke: 'stroke-[#FCD535]',
            glow: 'bg-[#FCD535]/10',
            button: 'bg-[#FCD535] hover:bg-[#FCD535]/90 text-black',
            shadow: 'shadow-[#FCD535]/20',
            text: 'text-[#FCD535]'
        }
    };

    const activeColor = colors[accentColor as keyof typeof colors] || colors.emerald;

    // Use Portal to render at document body root
    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0B0E11]/80 backdrop-blur-md transition-all duration-500 ${isUndoing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className={`relative bg-[#181A20] border border-[#2B3139] rounded-sm p-8 sm:p-10 w-full max-w-md shadow-[0_60px_100px_rgba(0,0,0,0.9)] text-center overflow-hidden transition-all duration-500 ${isUndoing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}>
                
                {/* CYBER SCANLINE EFFECT */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#FCD535]/50 to-transparent animate-scanline pointer-events-none opacity-50"></div>
                
                {/* Background Decorative Glow */}
                <div className={`absolute -top-40 -left-40 w-80 h-80 ${activeColor.glow} blur-[120px] rounded-full pointer-events-none opacity-40`}></div>
                <div className="absolute -bottom-40 -right-40 bg-blue-500/5 blur-[120px] w-80 h-80 rounded-full pointer-events-none opacity-40"></div>

                {/* Header Badge */}
                <div className="mb-8 flex justify-center">
                    <span className={`px-2.5 py-0.5 ${activeColor.glow} ${activeColor.text} border border-[#2B3139] text-[9px] font-black uppercase tracking-[0.3em] rounded-sm`}>
                        Automated Process
                    </span>
                </div>

                {/* Circular Progress & Icon */}
                <div className="relative w-44 h-44 mx-auto mb-10 flex items-center justify-center">
                    {/* Outer decorative ring */}
                    <div className="absolute inset-0 border border-[#2B3139] rounded-full opacity-20"></div>
                    
                    <svg className="w-[105%] h-[105%] -rotate-90 transform" viewBox="0 0 100 100">
                        {/* Background Circle */}
                        <circle
                            cx="50" cy="50" r="46"
                            className="stroke-[#2B3139]/30 fill-none"
                            strokeWidth="3"
                        />
                        {/* Progress Circle (Sharp Edge Style) */}
                        <circle
                            cx="50" cy="50" r="46" 
                            className={`${activeColor.stroke} fill-none transition-all duration-1000 ease-linear`} 
                            strokeWidth="3" 
                            strokeDasharray={289}
                            strokeDashoffset={289 * (1 - timer / maxTimer)}
                        />
                    </svg>
                    
                    {/* Inner Content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="flex flex-col items-center">
                            <span className="text-6xl font-black text-white font-mono leading-none tracking-tighter">{timer}</span>
                            <div className="mt-2 h-[2px] w-8 bg-[#FCD535] opacity-50"></div>
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] mt-3 pr-[-0.5em]">SEC</span>
                        </div>
                    </div>
                </div>

                {/* Title & Subtitle */}
                <div className="space-y-4 mb-10 relative z-10">
                    <h3 className="text-2xl font-black text-white uppercase tracking-widest leading-none">
                        {title}
                    </h3>
                    <div className="flex justify-center gap-1.5">
                        <div className="w-1 h-1 bg-[#2B3139]"></div>
                        <div className="w-8 h-1 bg-[#2B3139]"></div>
                        <div className="w-1 h-1 bg-[#2B3139]"></div>
                    </div>
                    <p className="text-[#848E9C] text-[11px] font-bold leading-relaxed px-6 uppercase tracking-wider">
                        {subtitle}
                    </p>
                </div>

                {/* Action Button (Industrial Sharp Style) */}
                <button 
                    onClick={onUndo}
                    className="w-full group relative overflow-hidden bg-[#F6465D]/10 hover:bg-[#F6465D]/20 border border-[#F6465D]/30 transition-all duration-300 py-4 rounded-sm flex items-center justify-center gap-4 active:scale-[0.98]"
                >
                    {/* Hover light effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F6465D]/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                    
                    <svg className="w-5 h-5 text-[#F6465D] group-hover:rotate-[-90deg] transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-[#F6465D] font-black uppercase text-[11px] tracking-[0.3em]">
                        Abort Submission
                    </span>
                    
                    {/* Corners */}
                    <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-[#F6465D]/60"></div>
                    <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-[#F6465D]/60"></div>
                </button>
                
                {/* Footer Meta */}
                <div className="mt-8 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-[#0ECB81] animate-pulse"></span>
                        <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.5em]">SYSTEM STABLE // SYNCING...</span>
                    </div>
                    <div className="w-full max-w-[120px] h-[1px] bg-[#2B3139]"></div>
                </div>
            </div>
            
            {/* Global Animation Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes scanline {
                    0% { transform: translateY(0); opacity: 0; }
                    5% { opacity: 0.5; }
                    95% { opacity: 0.5; }
                    100% { transform: translateY(400px); opacity: 0; }
                }
                .animate-scanline {
                    animation: scanline 4s linear infinite;
                }
            `}} />
        </div>,
        document.body
    );
};

export default OrderGracePeriod;
