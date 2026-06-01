
import React from 'react';

interface TelegramSchedulerProps {
    schedule: boolean;
    time: string;
    onChange: (data: { schedule: boolean; time: string }) => void;
}

const TelegramScheduler: React.FC<TelegramSchedulerProps> = ({ schedule, time, onChange }) => {
    const toggleSchedule = () => {
        onChange({ schedule: !schedule, time: !schedule ? time : '' });
    };

    return (
        <div className={`relative overflow-hidden p-6 rounded-[2rem] border transition-all duration-500 ${schedule ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.15)]' : 'bg-gray-900/40 border-gray-700'}`}>
            <style>{`
                /* ប្ដូរពណ៌ និងពង្រីកទំហំ Default Calendar Icon របស់ Browser */
                .cyan-calendar-picker::-webkit-calendar-picker-indicator {
                    cursor: pointer;
                    /* ប្ដូរពណ៌ទៅជា Cyan */
                    filter: invert(56%) sepia(86%) saturate(2256%) hue-rotate(150deg) brightness(98%) contrast(101%);
                    padding: 8px;
                    width: 24px;
                    height: 24px;
                    transform: scale(1.3); /* ពង្រីកឱ្យធំជាងមុន */
                    border-radius: 12px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .cyan-calendar-picker::-webkit-calendar-picker-indicator:hover {
                    background: rgba(6, 182, 212, 0.15);
                    transform: scale(1.45);
                    filter: invert(60%) sepia(90%) saturate(2500%) hue-rotate(160deg) brightness(110%) contrast(110%);
                }
                .cyan-calendar-picker::-webkit-calendar-picker-indicator:active {
                    transform: scale(1.2);
                }
            `}</style>
            
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${schedule ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-gray-800 text-gray-500'}`}>
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h4 className={`text-sm font-black uppercase tracking-widest transition-colors ${schedule ? 'text-cyan-400' : 'text-gray-400'}`}>កំណត់ពេល Telegram</h4>
                        <p className="text-[10px] text-gray-500 font-bold uppercase opacity-60">Auto-Send Schedule</p>
                    </div>
                </div>
                
                <button 
                    type="button"
                    onClick={toggleSchedule}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${schedule ? 'bg-cyan-500' : 'bg-gray-700'}`}
                >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out ${schedule ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {schedule && (
                <div className="animate-reveal pt-6 mt-4 border-t border-cyan-500/10 space-y-4">
                    {/* Quick Select Buttons */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: '+1 ម៉ោង', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 1); return d.toISOString().slice(0, 16); } },
                            { label: '+2 ម៉ោង', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 2); return d.toISOString().slice(0, 16); } },
                            { label: '+4 ម៉ោង', getValue: () => { const d = new Date(); d.setHours(d.getHours() + 4); return d.toISOString().slice(0, 16); } },
                            { label: 'ស្អែក 8AM', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.toISOString().slice(0, 16); } },
                            { label: 'ស្អែក 1PM', getValue: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(13, 0, 0, 0); return d.toISOString().slice(0, 16); } },
                        ].map((opt, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => onChange({ schedule, time: opt.getValue() })}
                                className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-cyan-500 hover:text-white transition-all active:scale-95"
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative group">
                        <input 
                            type="datetime-local" 
                            value={time || ''} 
                            onChange={e => onChange({ schedule, time: e.target.value })} 
                            onClick={(e) => {
                                try {
                                    if ('showPicker' in HTMLInputElement.prototype) {
                                        e.currentTarget.showPicker();
                                    }
                                } catch(err) {}
                            }}
                            className="cyan-calendar-picker form-input !py-4 !pl-5 !pr-14 bg-black/40 border-cyan-500/20 text-white font-mono font-bold rounded-2xl focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all text-sm w-full cursor-pointer" 
                            min={new Date().toISOString().slice(0, 16)} 
                        />
                    </div>
                    <p className="text-[9px] text-cyan-400/60 font-black uppercase tracking-widest text-center mt-3">សារនឹងត្រូវផ្ញើ និងបង្ហាញក្នុងតារាងតាមម៉ោងកំណត់</p>
                </div>
            )}
            
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 bg-cyan-500 transition-opacity duration-700 rounded-full blur-[40px] pointer-events-none ${schedule ? 'opacity-10' : 'opacity-0'}`}></div>
        </div>
    );
};

export default TelegramScheduler;
