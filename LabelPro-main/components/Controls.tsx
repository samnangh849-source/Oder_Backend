
import React from 'react';
import { Margins, ThemeType } from '../types';
import { Sliders, Layout, Zap, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, MousePointer2, Move, Undo2, Redo2, Bold, Type, Printer, Droplets } from 'lucide-react';

interface ControlsProps {
  margins: Margins;
  onMarginChange: (key: keyof Margins, value: number) => void;
  currentTheme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  isDesignMode: boolean;
  onDesignModeToggle: (val: boolean) => void;
  printDensity: number;
  onPrintDensityChange: (val: number) => void;
  watermarkIntensity: number;
  onWatermarkChange: (val: number) => void;
}

const Controls: React.FC<ControlsProps> = ({
  margins,
  onMarginChange,
  currentTheme,
  onThemeChange,
  isDesignMode,
  onDesignModeToggle,
  printDensity,
  onPrintDensityChange,
  watermarkIntensity,
  onWatermarkChange
}) => {
  const emitDesignAction = (type: string, payload: any) => {
    window.dispatchEvent(new CustomEvent('design-action', { detail: { type, payload } }));
  };

  const InputField = ({ label, prop }: { label: string, prop: keyof Margins }) => (
    <div className="group">
      <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block group-hover:text-brand-cyan transition-colors">{label}</label>
      <div className="relative">
        <input 
          type="number" 
          step={0.5}
          value={margins[prop]}
          onChange={(e) => onMarginChange(prop, parseFloat(e.target.value) || 0)}
          className="w-full bg-black/40 border border-white/10 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-brand-cyan/50 transition-all font-mono"
        />
        <span className="absolute right-3 top-2.5 text-xs text-slate-600 pointer-events-none">mm</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-slate-300 font-display font-bold text-sm tracking-wide mb-3">
            <Layout className="w-4 h-4 text-brand-purple" />
            <h3>VISUAL THEME</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
            {Object.values(ThemeType).map((theme) => (
                <button
                    key={theme}
                    onClick={() => onThemeChange(theme)}
                    className={`relative px-3 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all duration-300 ${currentTheme === theme ? 'bg-brand-purple/10 border-brand-purple/50 text-brand-purple' : 'bg-white/5 border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                    {theme}
                </button>
            ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-slate-300 font-display font-bold text-sm tracking-wide mb-3">
            <Printer className="w-4 h-4 text-brand-pink" />
            <h3>PRINT QUALITY</h3>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/5 backdrop-blur-sm shadow-inner space-y-4">
            
            {/* Watermark Intensity */}
            <div>
                <label className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 mb-2">
                    <span className="flex items-center gap-1.5"><Droplets size={10} /> Watermark Boldness</span>
                    <span className="text-brand-pink">{watermarkIntensity}%</span>
                </label>
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={watermarkIntensity} 
                    onChange={(e) => onWatermarkChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-pink"
                />
            </div>

            {/* Print Density (General) */}
            <div>
                <label className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 mb-2">
                    <span>Label Density</span>
                    <span className="text-slate-400">{printDensity}%</span>
                </label>
                <input 
                    type="range" 
                    min="50" 
                    max="150" 
                    step="5"
                    value={printDensity} 
                    onChange={(e) => onPrintDensityChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-500"
                />
            </div>

        </div>
      </div>

      <div>
        <label className="flex items-center justify-between p-3.5 border border-white/10 rounded-xl bg-gradient-to-r from-white/5 to-transparent cursor-pointer hover:border-brand-cyan/30 transition-all group">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${isDesignMode ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-white/5 text-slate-500'}`}><Zap className="w-4 h-4" /></div>
                <div>
                    <span className="block text-sm font-bold text-slate-200 font-display tracking-wide">Live Edit</span>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-widest">Manual Override</span>
                </div>
            </div>
            <div className="relative">
                <input type="checkbox" checked={isDesignMode} onChange={(e) => onDesignModeToggle(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-cyan/30 peer-checked:after:bg-brand-cyan"></div>
            </div>
        </label>

        {isDesignMode && (
          <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-brand-cyan/20 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-cyan/20"></div>
              
              {/* Header Actions */}
              <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-3">
                  <span className="text-[10px] font-bold text-brand-cyan uppercase tracking-wider flex items-center gap-1.5">
                      <Move size={10} /> Active Selection
                  </span>
                  <div className="flex gap-1">
                      <button onClick={() => emitDesignAction('undo', {})} className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-white/5" title="Undo"><Undo2 size={12} /></button>
                      <button onClick={() => emitDesignAction('redo', {})} className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border border-white/5" title="Redo"><Redo2 size={12} /></button>
                      <button onClick={() => emitDesignAction('reset', {})} className="w-6 h-6 flex items-center justify-center rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors" title="Reset"><RotateCcw size={10} /></button>
                  </div>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-4">
                  {/* D-PAD */}
                  <div className="w-[80px] h-[80px] bg-slate-800/50 rounded-full relative border border-white/5 mx-auto shadow-inner">
                      <button onClick={() => emitDesignAction('move', {y: -1})} className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-cyan active:scale-90 hover:bg-white/5 rounded-full transition-all"><ChevronUp size={16}/></button>
                      <button onClick={() => emitDesignAction('move', {y: 1})} className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-cyan active:scale-90 hover:bg-white/5 rounded-full transition-all"><ChevronDown size={16}/></button>
                      <button onClick={() => emitDesignAction('move', {x: -1})} className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-cyan active:scale-90 hover:bg-white/5 rounded-full transition-all"><ChevronLeft size={16}/></button>
                      <button onClick={() => emitDesignAction('move', {x: 1})} className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-brand-cyan active:scale-90 hover:bg-white/5 rounded-full transition-all"><ChevronRight size={16}/></button>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-3 h-3 rounded-full bg-slate-700 shadow-sm border border-white/10"></div>
                      </div>
                  </div>

                  {/* STYLE CONTROLS */}
                  <div className="flex flex-col gap-2 justify-center">
                      {/* Size */}
                      <div className="flex items-center justify-between bg-slate-800/50 p-1 rounded-lg border border-white/5">
                          <button onClick={() => emitDesignAction('size', -1)} className="w-8 h-7 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors active:bg-brand-cyan/20"><Minus size={12}/></button>
                          <div className="flex items-center gap-1.5 px-2">
                              <Type size={10} className="text-slate-500" />
                              <span className="text-[9px] font-bold text-slate-300">SIZE</span>
                          </div>
                          <button onClick={() => emitDesignAction('size', 1)} className="w-8 h-7 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors active:bg-brand-cyan/20"><Plus size={12}/></button>
                      </div>

                      {/* Style Toggles */}
                      <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => emitDesignAction('style', {prop: 'bold'})} className="flex items-center justify-center gap-1.5 h-8 bg-slate-800/50 hover:bg-slate-700 border border-white/5 rounded-lg text-slate-300 hover:text-white transition-colors active:bg-brand-cyan/20 active:border-brand-cyan/50">
                              <Bold size={12} />
                              <span className="text-[9px] font-bold">BOLD</span>
                          </button>
                          {/* Future: Color or Align */}
                          <div className="h-8 bg-slate-800/20 border border-white/5 rounded-lg opacity-30"></div>
                      </div>
                  </div>
              </div>
              
              <div className="mt-4 text-[9px] text-slate-500 text-center font-mono border-t border-white/5 pt-2">
                  <span className="text-brand-cyan/70">★</span> Click element to select & edit
              </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-300 font-display font-bold text-sm tracking-wide"><Sliders className="w-4 h-4 text-brand-cyan" /><h3>AXIS CONTROL</h3></div>
            <button onClick={() => { if(confirm('Restore defaults?')) { localStorage.clear(); window.location.reload(); } }} className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/5 backdrop-blur-sm shadow-inner">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <InputField label="Top (Y+)" prop="top" /><InputField label="Right (X+)" prop="right" />
                <InputField label="Bottom (Y-)" prop="bottom" /><InputField label="Left (X-)" prop="left" />
            </div>
            <div className="pt-4 border-t border-white/10">
                <div className="grid grid-cols-2 gap-4"><InputField label="Split Left" prop="lineLeft" /><InputField label="Split Right" prop="lineRight" /></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;
