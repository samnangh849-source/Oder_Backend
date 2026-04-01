
import React from 'react';
import { Margins, ThemeType } from './types';
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
      <label className="text-[10px] uppercase font-bold text-gray-500 mb-1.5 block group-hover:text-[#FCD535] transition-colors">{label}</label>
      <div className="relative">
        <input 
          type="number" 
          step={0.5}
          value={margins[prop]}
          onChange={(e) => onMarginChange(prop, parseFloat(e.target.value) || 0)}
          className="w-full bg-[#0B0E11] border border-[#2B3139] text-gray-200 text-sm rounded-sm px-3 py-2.5 focus:outline-none focus:border-[#FCD535]/50 transition-all font-mono"
        />
        <span className="absolute right-3 top-2.5 text-xs text-gray-600 pointer-events-none">mm</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-gray-300 font-sans font-bold text-xs tracking-widest uppercase mb-3">
            <Layout className="w-4 h-4 text-[#FCD535]" />
            <h3>VISUAL THEME</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
            {Object.values(ThemeType).map((theme) => (
                <button
                    key={theme}
                    onClick={() => onThemeChange(theme)}
                    className={`relative px-3 py-2.5 text-xs font-bold uppercase tracking-wider rounded-sm border transition-all duration-300 ${currentTheme === theme ? 'bg-[#FCD535]/10 border-[#FCD535]/50 text-[#FCD535]' : 'bg-[#0B0E11] border-[#2B3139] text-gray-500 hover:text-gray-300 hover:bg-[#181A20]'}`}
                >
                    {theme}
                </button>
            ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-gray-300 font-sans font-bold text-xs tracking-widest uppercase mb-3">
            <Printer className="w-4 h-4 text-[#FCD535]" />
            <h3>PRINT QUALITY</h3>
        </div>
        <div className="bg-[#0B0E11] rounded-sm p-4 border border-[#2B3139] space-y-4">
            
            {/* Watermark Intensity */}
            <div>
                <label className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-500 mb-2">
                    <span className="flex items-center gap-1.5"><Droplets size={10} /> Watermark Boldness</span>
                    <span className="text-[#FCD535]">{watermarkIntensity}%</span>
                </label>
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={watermarkIntensity} 
                    onChange={(e) => onWatermarkChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#181A20] rounded-sm appearance-none cursor-pointer accent-[#FCD535]"
                />
            </div>

            {/* Print Density (General) */}
            <div>
                <label className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-500 mb-2">
                    <span>Label Density</span>
                    <span className="text-gray-400">{printDensity}%</span>
                </label>
                <input 
                    type="range" 
                    min="50" 
                    max="150" 
                    step="5"
                    value={printDensity} 
                    onChange={(e) => onPrintDensityChange(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-[#181A20] rounded-sm appearance-none cursor-pointer accent-gray-500"
                />
            </div>

        </div>
      </div>

      <div>
        <label className="flex items-center justify-between p-3.5 border border-[#2B3139] rounded-sm bg-[#0B0E11] cursor-pointer hover:border-[#FCD535]/30 transition-all group">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-sm transition-colors ${isDesignMode ? 'bg-[#FCD535]/10 text-[#FCD535]' : 'bg-[#181A20] text-gray-500'}`}><Zap className="w-4 h-4" /></div>
                <div>
                    <span className="block text-xs uppercase tracking-widest font-bold text-gray-200">Live Edit</span>
                    <span className="block text-[10px] text-gray-500 uppercase tracking-widest">Manual Override</span>
                </div>
            </div>
            <div className="relative">
                <input type="checkbox" checked={isDesignMode} onChange={(e) => onDesignModeToggle(e.target.checked)} className="sr-only peer" />
                <div className="w-9 h-5 bg-[#181A20] border border-[#2B3139] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FCD535]/20 peer-checked:border-[#FCD535]/50 peer-checked:after:bg-[#FCD535]"></div>
            </div>
        </label>

        {isDesignMode && (
          <div className="mt-4 p-4 rounded-sm bg-[#0B0E11] border border-[#FCD535]/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-[#FCD535]/50"></div>
              
              {/* Header Actions */}
              <div className="flex items-center justify-between mb-5 border-b border-[#2B3139] pb-3">
                  <span className="text-[10px] font-bold text-[#FCD535] uppercase tracking-wider flex items-center gap-1.5">
                      <Move size={10} /> Active Selection
                  </span>
                  <div className="flex gap-1">
                      <button onClick={() => emitDesignAction('undo', {})} className="w-6 h-6 flex items-center justify-center rounded-sm bg-[#181A20] text-gray-400 hover:text-white hover:bg-[#2B3139] transition-colors border border-[#2B3139]" title="Undo"><Undo2 size={12} /></button>
                      <button onClick={() => emitDesignAction('redo', {})} className="w-6 h-6 flex items-center justify-center rounded-sm bg-[#181A20] text-gray-400 hover:text-white hover:bg-[#2B3139] transition-colors border border-[#2B3139]" title="Redo"><Redo2 size={12} /></button>
                      <button onClick={() => emitDesignAction('reset', {})} className="w-6 h-6 flex items-center justify-center rounded-sm bg-[#F6465D]/10 text-[#F6465D] hover:bg-[#F6465D]/20 border border-[#F6465D]/20 transition-colors" title="Reset"><RotateCcw size={10} /></button>
                  </div>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-4">
                  {/* D-PAD */}
                  <div className="w-[80px] h-[80px] bg-[#181A20] rounded-sm relative mx-auto border border-[#2B3139]">
                      <button onClick={() => emitDesignAction('move', {y: -1})} className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#FCD535] active:scale-90 hover:bg-[#2B3139] rounded-sm transition-all"><ChevronUp size={16}/></button>
                      <button onClick={() => emitDesignAction('move', {y: 1})} className="absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#FCD535] active:scale-90 hover:bg-[#2B3139] rounded-sm transition-all"><ChevronDown size={16}/></button>
                      <button onClick={() => emitDesignAction('move', {x: -1})} className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#FCD535] active:scale-90 hover:bg-[#2B3139] rounded-sm transition-all"><ChevronLeft size={16}/></button>
                      <button onClick={() => emitDesignAction('move', {x: 1})} className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#FCD535] active:scale-90 hover:bg-[#2B3139] rounded-sm transition-all"><ChevronRight size={16}/></button>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-2 h-2 rounded-[2px] bg-gray-600 border border-[#2B3139]"></div>
                      </div>
                  </div>

                  {/* STYLE CONTROLS */}
                  <div className="flex flex-col gap-2 justify-center">
                      {/* Size */}
                      <div className="flex items-center justify-between bg-[#181A20] p-1 rounded-sm border border-[#2B3139]">
                          <button onClick={() => emitDesignAction('size', -1)} className="w-8 h-7 flex items-center justify-center rounded-sm hover:bg-[#2B3139] text-gray-400 hover:text-white transition-colors active:bg-[#FCD535]/20"><Minus size={12}/></button>
                          <div className="flex items-center gap-1.5 px-2">
                              <Type size={10} className="text-gray-500" />
                              <span className="text-[9px] font-bold text-gray-300">SIZE</span>
                          </div>
                          <button onClick={() => emitDesignAction('size', 1)} className="w-8 h-7 flex items-center justify-center rounded-sm hover:bg-[#2B3139] text-gray-400 hover:text-white transition-colors active:bg-[#FCD535]/20"><Plus size={12}/></button>
                      </div>

                      {/* Style Toggles */}
                      <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => emitDesignAction('style', {prop: 'bold'})} className="flex items-center justify-center gap-1.5 h-8 bg-[#181A20] hover:bg-[#2B3139] border border-[#2B3139] rounded-sm text-gray-300 hover:text-white transition-colors active:bg-[#FCD535]/20 active:border-[#FCD535]/50">
                              <Bold size={12} />
                              <span className="text-[9px] font-bold">BOLD</span>
                          </button>
                      </div>
                  </div>
              </div>
              
              <div className="mt-4 text-[9px] text-gray-500 text-center font-mono border-t border-[#2B3139] pt-2">
                  <span className="text-[#FCD535]">★</span> Click element to select & edit
              </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-gray-300 font-sans font-bold uppercase tracking-widest text-xs"><Sliders className="w-4 h-4 text-[#FCD535]" /><h3>AXIS CONTROL</h3></div>
            <button onClick={() => { if(confirm('Restore defaults?')) { localStorage.clear(); window.location.reload(); } }} className="p-1.5 rounded-sm hover:bg-[#F6465D]/10 text-gray-500 hover:text-[#F6465D] border border-transparent hover:border-[#F6465D]/30 transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="bg-[#0B0E11] rounded-sm p-4 border border-[#2B3139]">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <InputField label="Top (Y+)" prop="top" /><InputField label="Right (X+)" prop="right" />
                <InputField label="Bottom (Y-)" prop="bottom" /><InputField label="Left (X-)" prop="left" />
            </div>
            <div className="pt-4 border-t border-[#2B3139]">
                <div className="grid grid-cols-2 gap-4"><InputField label="Split Left" prop="lineLeft" /><InputField label="Split Right" prop="lineRight" /></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;
