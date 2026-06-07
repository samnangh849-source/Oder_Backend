
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, Search, X, ChevronDown, CheckSquare, Square, RotateCcw } from 'lucide-react';

interface SelectFilterProps {
    label: string;
    value: string; // Stores comma-separated values for multi-select
    onChange: (value: string) => void;
    options: (string | { label: string; value: string })[];
    placeholder?: string;
    variant?: 'default' | 'payment' | 'modal';
    multiple?: boolean;
    searchable?: boolean;
    isInline?: boolean; // New prop for direct rendering
}

const SelectFilter: React.FC<SelectFilterProps> = ({ 
    label, 
    value, 
    onChange, 
    options, 
    placeholder = "All",
    variant = 'default',
    multiple = false,
    searchable = true,
    isInline = false // Default to false
}) => {
    const [isOpen, setIsOpen] = useState(isInline);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (isInline) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); // Reset search on close
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isInline]);

    // Focus input when opening
    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen, searchable]);

    // Parse current values
    const selectedValues = useMemo(() => value ? value.split(',').filter(v => v) : [], [value]);

    // Helper to get label/value
    const getOptionLabel = (opt: string | { label: string; value: string }) => {
        return typeof opt === 'string' ? opt : opt.label;
    };

    const getOptionValue = (opt: string | { label: string; value: string }) => {
        return typeof opt === 'string' ? opt : opt.value;
    };

    // Filter options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt => {
            const label = getOptionLabel(opt).toLowerCase();
            const val = getOptionValue(opt).toLowerCase();
            return label.includes(lowerTerm) || val.includes(lowerTerm);
        });
    }, [options, searchTerm]);

    const handleSelect = (optionValue: string) => {
        if (multiple) {
            let newValues;
            if (selectedValues.includes(optionValue)) {
                newValues = selectedValues.filter(v => v !== optionValue);
            } else {
                newValues = [...selectedValues, optionValue];
            }
            onChange(newValues.join(','));
            // Keep open for multiple selection
        } else {
            onChange(optionValue);
            if (!isInline) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }
    };

    const handleSelectAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        const allValues = options.map(opt => getOptionValue(opt));
        onChange(allValues.join(','));
    };

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        if (!multiple && !isInline) setIsOpen(false);
    };

    if (isInline) {
        return (
            <div className="w-full flex flex-col space-y-4">
                <div className="flex items-center justify-between px-1">
                    {searchable && (
                        <div className="relative flex-grow mr-4">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 transition-colors" />
                            <input
                                type="text"
                                className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm pl-11 pr-4 py-3 text-sm text-white focus:border-[#FCD535] outline-none transition-all"
                                placeholder="ស្វែងរក..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}
                    {multiple && (
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSelectAll}
                                className="px-3 py-2 bg-[#FCD535]/10 text-[#FCD535] text-[10px] font-black uppercase rounded-sm border border-[#FCD535]/20 hover:bg-[#FCD535]/20 transition-all flex items-center gap-1.5"
                            >
                                <CheckSquare size={14} /> All
                            </button>
                            <button 
                                onClick={handleClearAll}
                                className="px-3 py-2 bg-[#F6465D]/10 text-[#F6465D] text-[10px] font-black uppercase rounded-sm border border-[#F6465D]/20 hover:bg-[#F6465D]/20 transition-all flex items-center gap-1.5"
                            >
                                <RotateCcw size={14} /> Clear
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-1 px-1">
                    {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => {
                        const optValue = getOptionValue(opt);
                        const optLabel = getOptionLabel(opt);
                        const isSelected = selectedValues.includes(optValue);
                        return (
                            <div 
                                key={`${optValue}-${idx}`}
                                onClick={() => handleSelect(optValue)}
                                className={`px-4 py-3.5 flex items-center justify-between cursor-pointer rounded-sm transition-all ${isSelected ? 'bg-[#FCD535]/10 text-[#FCD535] border border-[#FCD535]/30' : 'bg-[#1e2329] text-gray-400 hover:bg-[#2B3139] border border-transparent'}`}
                            >
                                <span className={`text-[13px] font-bold tracking-tight ${isSelected ? 'text-[#FCD535]' : ''}`}>{optLabel}</span>
                                {isSelected ? (
                                    <div className="w-5.5 h-5.5 bg-[#FCD535] rounded-sm flex items-center justify-center shrink-0">
                                        <Check className="w-4 h-4 text-black" strokeWidth={4} />
                                    </div>
                                ) : multiple && (
                                    <div className="w-5.5 h-5.5 rounded-sm border border-[#474D57] shrink-0"></div>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="py-14 text-center flex flex-col items-center gap-3 opacity-30 border-2 border-dashed border-[#2B3139] rounded-sm">
                            <div className="w-12 h-12 bg-white/5 rounded-sm flex items-center justify-center">
                                <Search className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">No Matches Found</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── variant-aware style tokens ──────────────────────────────────────────
    const isModal = variant === 'modal';
    const r = isModal ? 'rounded-xl' : 'rounded-sm';
    const rItem = isModal ? 'rounded-lg' : 'rounded-sm';
    const bgTrigger = isModal ? 'bg-[#1e2329]' : 'bg-[#0B0E11]';
    const bgHover   = isModal ? 'hover:bg-[#252a33]' : 'hover:bg-[#181A20]';
    const bgMenu    = isModal ? 'bg-[#1e2329]'   : 'bg-[#181A20]';
    const bgSearch  = isModal ? 'bg-[#181a20]'   : 'bg-[#0B0E11]';
    const borderFocus = isModal ? 'focus:border-[#fcd535]/50' : 'focus:border-[#FCD535]';

    let displayText = placeholder;
    if (selectedValues.length > 0) {
        if (selectedValues.length === 1) {
            const found = options.find(o => getOptionValue(o) === selectedValues[0]);
            displayText = found ? getOptionLabel(found) : selectedValues[0];
        } else {
            displayText = `${selectedValues.length} Selected`;
        }
    }

    let baseClass = `relative w-full cursor-pointer ${bgTrigger} border border-[#2B3139] py-3 px-4 ${r} font-bold transition-all ${bgHover} flex justify-between items-center group/select`;
    let textClass = isModal ? 'text-[#848e9c]' : 'text-gray-400';

    if (variant === 'payment') {
        if (selectedValues.includes('Paid')) {
            baseClass += " !border-[#0ECB81]/50 !bg-[#0ECB81]/10";
            textClass = "text-[#0ECB81]";
        } else if (selectedValues.includes('Unpaid')) {
            baseClass += " !border-[#F6465D]/50 !bg-[#F6465D]/10";
            textClass = "text-[#F6465D]";
        }
    } else if (selectedValues.length > 0) {
        textClass = "text-[#FCD535]";
        baseClass += " !border-[#FCD535]/40 !bg-[#FCD535]/8";
    }

    if (isOpen) baseClass += isModal ? " !border-[#fcd535]/50" : " border-[#FCD535] bg-[#181A20]";

    return (
        <div className={`w-full transition-all ${isOpen ? 'relative z-[60]' : 'relative z-10'}`} ref={dropdownRef}>
            {(label || (!isModal && multiple)) && (
                <label className="text-[10px] font-black text-[#707A8A] mb-2 uppercase tracking-widest flex items-center justify-between">
                    <span>{label}</span>
                    {multiple && <span className="text-[8px] font-black text-[#FCD535] bg-[#FCD535]/10 px-2 py-0.5 rounded-sm border border-[#FCD535]/20">MULTI</span>}
                </label>
            )}

            <div className={baseClass} onClick={() => setIsOpen(!isOpen)}>
                <span className={`truncate mr-2 text-sm ${textClass}`}>{displayText}</span>
                <div className="flex items-center gap-1.5">
                    {selectedValues.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            className={`p-1.5 hover:bg-white/10 ${rItem} text-gray-500 hover:text-white transition-all active:scale-90`}
                        >
                            <X className="w-3 h-3" strokeWidth={3} />
                        </button>
                    )}
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#fcd535]' : 'text-[#5e6673] group-hover/select:text-gray-300'}`} strokeWidth={2.5} />
                </div>

                {isOpen && (
                    <div className={`absolute top-full left-0 w-full mt-1.5 ${bgMenu} border border-[#2B3139] ${r} shadow-2xl z-50 overflow-hidden animate-dropdown-in max-h-[350px] flex flex-col`}>
                        <div className="p-2 border-b border-[#2B3139] sticky top-0 z-10" style={{ background: 'inherit' }}>
                            <div className="flex items-center gap-2 mb-2">
                                {searchable && (
                                    <div className="relative flex-grow">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#5e6673]" />
                                        <input
                                            ref={searchInputRef}
                                            type="text"
                                            className={`w-full ${bgSearch} border border-[#2B3139] ${rItem} pl-9 pr-4 py-2 text-xs font-bold text-white ${borderFocus} outline-none transition-all placeholder:text-[#5e6673]`}
                                            placeholder="ស្វែងរក..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                )}
                            </div>
                            {multiple && (
                                <div className="flex gap-2 px-1 pb-1">
                                    <button 
                                        onClick={handleSelectAll}
                                        className="flex-1 py-1.5 bg-[#2B3139] hover:bg-[#FCD535]/10 hover:text-[#FCD535] text-[9px] font-black uppercase rounded-sm transition-all flex items-center justify-center gap-1.5 text-gray-400"
                                    >
                                        <CheckSquare size={12} /> Select All
                                    </button>
                                    <button 
                                        onClick={handleClearAll}
                                        className="flex-1 py-1.5 bg-[#2B3139] hover:bg-[#F6465D]/10 hover:text-[#F6465D] text-[9px] font-black uppercase rounded-sm transition-all flex items-center justify-center gap-1.5 text-gray-400"
                                    >
                                        <RotateCcw size={12} /> Clear
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="overflow-y-auto custom-scrollbar flex-grow py-1">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map((opt, idx) => {
                                    const optValue = getOptionValue(opt);
                                    const optLabel = getOptionLabel(opt);
                                    const isSelected = selectedValues.includes(optValue);

                                    return (
                                        <div
                                            key={`${optValue}-${idx}`}
                                            onClick={(e) => { e.stopPropagation(); handleSelect(optValue); }}
                                            className={`px-3 py-2.5 flex items-center justify-between cursor-pointer transition-all mx-1.5 my-0.5 ${rItem} ${isSelected ? 'bg-[#fcd535]/10 text-[#FCD535]' : 'text-[#848e9c] hover:bg-[#2B3139] hover:text-[#eaecef]'}`}
                                        >
                                            <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#FCD535]' : ''}`}>
                                                {optLabel}
                                            </span>
                                            {isSelected ? (
                                                <div className={`w-4 h-4 bg-[#FCD535] ${rItem} flex items-center justify-center flex-shrink-0 ml-2`}>
                                                    <Check className="w-2.5 h-2.5 text-black" strokeWidth={4} />
                                                </div>
                                            ) : multiple && (
                                                <div className={`w-4 h-4 ${rItem} border border-[#3d4451] flex-shrink-0 ml-2`}></div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-6 text-center flex flex-col items-center gap-2">
                                    <div className={`w-9 h-9 bg-[#2B3139] ${rItem} flex items-center justify-center text-[#5e6673]`}>
                                        <Search className="w-4 h-4" />
                                    </div>
                                    <div className="text-[10px] text-[#5e6673] font-bold uppercase tracking-widest">រកមិនឃើញ</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes dropdown-in {
                    from { transform: translateY(-6px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                .animate-dropdown-in { animation: dropdown-in 0.15s cubic-bezier(0,0,0.2,1) forwards; }
            `}</style>
        </div>
    );
};

export default SelectFilter;
