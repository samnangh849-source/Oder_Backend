
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface SelectFilterProps {
    label: string;
    value: string; // Stores comma-separated values for multi-select
    onChange: (value: string) => void;
    options: (string | { label: string; value: string })[];
    placeholder?: string;
    variant?: 'default' | 'payment';
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
    const selectedValues = useMemo(() => value ? value.split(',') : [], [value]);

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

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        if (!multiple && !isInline) setIsOpen(false);
    };

    if (isInline) {
        return (
            <div className="w-full flex flex-col space-y-3">
                {searchable && (
                    <div className="relative group px-1">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 group-focus-within:text-[#FCD535] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5}/></svg>
                        <input
                            type="text"
                            className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm pl-11 pr-4 py-3 text-sm text-white focus:border-[#FCD535] outline-none transition-all"
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
                <div className="max-h-[320px] overflow-y-auto custom-scrollbar space-y-1 py-1">
                    {filteredOptions.length > 0 ? filteredOptions.map((opt, idx) => {
                        const optValue = getOptionValue(opt);
                        const optLabel = getOptionLabel(opt);
                        const isSelected = selectedValues.includes(optValue);
                        return (
                            <div 
                                key={`${optValue}-${idx}`}
                                onClick={() => handleSelect(optValue)}
                                className={`px-4 py-3.5 flex items-center justify-between cursor-pointer rounded-sm transition-all ${isSelected ? 'bg-[#FCD535]/10 text-[#FCD535] border border-[#FCD535]/50' : 'bg-transparent text-gray-400 hover:bg-[#2B3139] border border-transparent'}`}
                            >
                                <span className={`text-[13px] font-bold tracking-tight ${isSelected ? 'text-[#FCD535]' : ''}`}>{optLabel}</span>
                                {isSelected ? (
                                    <div className="w-5.5 h-5.5 bg-[#FCD535] rounded-sm flex items-center justify-center shrink-0">
                                        <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                ) : multiple && (
                                    <div className="w-5.5 h-5.5 rounded-sm border border-[#2B3139] shrink-0"></div>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="py-14 text-center flex flex-col items-center gap-3 opacity-30 border-2 border-dashed border-[#2B3139] rounded-sm">
                            <div className="w-12 h-12 bg-white/5 rounded-sm flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2}/></svg>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">No Matches Found</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Display Text Logic for dropdown mode
    let displayText = placeholder;
    if (selectedValues.length > 0) {
        if (selectedValues.length === 1) {
            const found = options.find(o => getOptionValue(o) === selectedValues[0]);
            displayText = found ? getOptionLabel(found) : selectedValues[0];
        } else {
            displayText = `${selectedValues.length} Selected`;
        }
    }

    // Style logic for dropdown mode
    let baseClass = "relative w-full cursor-pointer bg-[#0B0E11] border border-[#2B3139] py-3.5 px-4 rounded-sm font-bold transition-all hover:bg-[#181A20] flex justify-between items-center group/select";
    let textClass = "text-gray-400";

    if (variant === 'payment') {
        if (selectedValues.includes('Paid')) {
            baseClass += " border-[#0ECB81]/50 bg-[#0ECB81]/10";
            textClass = "text-[#0ECB81]";
        } else if (selectedValues.includes('Unpaid')) {
            baseClass += " border-[#F6465D]/50 bg-[#F6465D]/10";
            textClass = "text-[#F6465D]";
        }
    } else {
        if (selectedValues.length > 0) {
            textClass = "text-[#FCD535]";
            baseClass += " border-[#FCD535]/50 bg-[#FCD535]/10";
        }
    }

    if (isOpen) baseClass += " border-[#FCD535] bg-[#181A20]";

    return (
        <div className={`w-full transition-all ${isOpen ? 'relative z-[60]' : 'relative z-10'}`} ref={dropdownRef}>
            <label className="text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest flex items-center gap-2">
                {label} 
                {multiple && <span className="text-[8px] font-black text-[#FCD535] bg-[#FCD535]/10 px-2 py-0.5 rounded-sm border border-[#FCD535]/20">MULTI</span>}
            </label>
            
            <div 
                className={baseClass} 
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`truncate mr-2 text-sm ${textClass}`}>{displayText}</span>
                
                <div className="flex items-center gap-2">
                    {selectedValues.length > 0 && (
                        <button 
                            onClick={handleClear}
                            className="p-1.5 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition-all active:scale-90"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                    <svg className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-400' : 'group-hover/select:text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                </div>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-[#181A20] border border-[#2B3139] rounded-sm shadow-2xl z-50 overflow-hidden animate-dropdown-in md:max-h-[400px] flex flex-col">
                        {/* Search Bar */}
                        {searchable && (
                            <div className="p-2 border-b border-[#2B3139] sticky top-0 bg-[#181A20] z-10">
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm pl-10 pr-4 py-2 text-sm text-white focus:border-[#FCD535] focus:outline-none transition-all"
                                        placeholder="Type to filter..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        )}

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
                                            className={`
                                                px-3 py-2.5 flex items-center justify-between cursor-pointer transition-all mx-1 rounded-sm
                                                ${isSelected ? 'bg-[#2B3139] text-[#FCD535]' : 'text-gray-300 hover:bg-[#2B3139]'}
                                            `}
                                        >
                                            <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#FCD535]' : ''}`}>
                                                {optLabel}
                                            </span>
                                            {isSelected ? (
                                                <div className="w-4 h-4 bg-[#FCD535] rounded-sm flex items-center justify-center flex-shrink-0 ml-2">
                                                    <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            ) : multiple && (
                                                <div className="w-4 h-4 rounded-sm border border-[#2B3139] flex-shrink-0 ml-2"></div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center flex flex-col items-center gap-3">
                                    <div className="w-10 h-10 bg-[#2B3139] rounded-sm flex items-center justify-center text-gray-500">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">No Matches Found</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <style>{`
                @keyframes dropdown-in {
                    from { transform: translateY(-10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-dropdown-in { animation: dropdown-in 0.2s cubic-bezier(0, 0, 0.2, 1) forwards; }
            `}</style>
        </div>
    );
};

export default SelectFilter;
