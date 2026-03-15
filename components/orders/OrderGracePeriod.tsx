
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface OrderGracePeriodProps {
    timer: number;
    maxTimer: number;
    onUndo: () => void;
    isUndoing?: boolean;
    title?: string;
    subtitle?: string;
    accentColor?: 'emerald' | 'blue' | 'purple' | 'orange';
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
            stroke: 'stroke-emerald-500',
            glow: 'bg-emerald-500/20',
            button: 'bg-emerald-600 hover:bg-emerald-700',
            shadow: 'shadow-emerald-900/30'
        },
        blue: {
            stroke: 'stroke-blue-500',
            glow: 'bg-blue-500/20',
            button: 'bg-blue-600 hover:bg-blue-700',
            shadow: 'shadow-blue-900/30'
        },
        purple: {
            stroke: 'stroke-purple-500',
            glow: 'bg-purple-500/20',
            button: 'bg-purple-600 hover:bg-purple-700',
            shadow: 'shadow-purple-900/30'
        },
        orange: {
            stroke: 'stroke-orange-500',
            glow: 'bg-orange-500/20',
            button: 'bg-orange-600 hover:bg-orange-700',
            shadow: 'shadow-orange-900/30'
        }
    };

    const activeColor = colors[accentColor];

    // Use Portal to render at document body root
    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-xl transition-all duration-500 ${isUndoing ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div className={`relative bg-[#0f172a]/95 border border-white/10 rounded-[3.5rem] p-10 sm:p-12 w-full max-w-sm shadow-[0_40px_120px_rgba(0,0,0,0.8)] text-center overflow-hidden ring-1 ring-white/20 transition-all duration-500 ${isUndoing ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>
                {/* Background Decorative Glow */}
                <div className={`absolute -top-32 -left-32 w-64 h-64 ${activeColor.glow} blur-[100px] rounded-full pointer-events-none`}></div>
                <div className="absolute -bottom-32 -right-32 bg-blue-500/10 blur-[100px] w-64 h-64 rounded-full pointer-events-none"></div>

                {/* Circular Progress & Icon */}
                <div className="relative w-40 h-40 mx-auto mb-10 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 transform drop-shadow-[0_0_20px_rgba(0,0,0,0.3)]" viewBox="0 0 100 100">
                        {/* Background Circle */}
                        <circle
                            cx="50" cy="50" r="45"
                            className="stroke-gray-800/50 fill-none"
                            strokeWidth="8"
                        />
                        {/* Progress Circle */}
                        <circle
                            cx="50" cy="50" r="45" 
                            className={`${activeColor.stroke} fill-none transition-all duration-1000 ease-linear`} 
                            strokeWidth="8" 
                            strokeDasharray={282.7}
                            strokeDashoffset={282.7 * (1 - timer / maxTimer)}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-5xl font-black text-white font-mono leading-none drop-shadow-lg">{timer}</span>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2">Seconds</span>
                    </div>
                </div>

                <div className="space-y-3 mb-12 relative z-10">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">{title}</h3>
                    <p className="text-gray-400 text-[13px] font-bold leading-relaxed px-2">
                        {subtitle}
                    </p>
                </div>

                <button 
                    onClick={onUndo}
                    className="w-full py-5 bg-red-500 hover:bg-red-600 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-[0.25em] shadow-[0_15px_35px_rgba(239,68,68,0.4)] transition-all active:scale-95 flex items-center justify-center gap-4 group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <svg className="w-6 h-6 relative z-10 group-hover:-rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span className="relative z-10">បញ្ឈប់ការបញ្ជូន (Undo)</span>
                </button>
                
                <div className="mt-8 flex items-center justify-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-[0.4em]">Finalizing Sync...</p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OrderGracePeriod;
