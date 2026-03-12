
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface SelectFilterProps {
    label: string;
    value: string; // Stores comma-separated values for multi-select
    onChange: (value: string) => void;
    options: (string | { label: string; value: string })[];
    placeholder?: string;
    variant?: 'default' | 'payment';
    multiple?: boolean;
    searchable?: boolean; // New prop to enable/disable search
}

const SelectFilter: React.FC<SelectFilterProps> = ({ 
    label, 
    value, 
    onChange, 
    options, 
    placeholder = "All",
    variant = 'default',
    multiple = false,
    searchable = true // Default to true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(''); // Reset search on close
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when opening
    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen, searchable]);

    // Parse current values
    const selectedValues = value ? value.split(',') : [];

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
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange('');
        if (!multiple) setIsOpen(false);
    };

    // Display Text Logic
    let displayText = placeholder;
    if (selectedValues.length > 0) {
        if (selectedValues.length === 1) {
            const found = options.find(o => getOptionValue(o) === selectedValues[0]);
            // If checking specifically for Customer Name, try to show just the name part if it's too long, 
            // but usually showing the label is safer.
            displayText = found ? getOptionLabel(found) : selectedValues[0];
        } else {
            displayText = `${selectedValues.length} Selected`;
        }
    }

    // Style logic
    let baseClass = "relative w-full cursor-pointer bg-gray-900/50 border border-gray-800 py-3.5 px-4 rounded-2xl font-bold transition-all hover:bg-gray-900 hover:border-gray-700 flex justify-between items-center group/select";
    let textClass = "text-gray-400";

    if (variant === 'payment') {
        if (selectedValues.includes('Paid')) {
            baseClass += " border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.1)]";
            textClass = "text-emerald-400";
        } else if (selectedValues.includes('Unpaid')) {
            baseClass += " border-red-500/30 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]";
            textClass = "text-red-400";
        }
    } else {
        if (selectedValues.length > 0) {
            textClass = "text-white";
            baseClass += " border-blue-500/40 bg-blue-600/5 shadow-[0_0_20px_rgba(37,99,235,0.1)]";
        }
    }

    if (isOpen) baseClass += " ring-2 ring-blue-500/20 border-blue-500/50 bg-gray-900";

    return (
        <div className="w-full" ref={dropdownRef}>
            <label className="text-[10px] font-black text-gray-500 mb-2 block uppercase tracking-widest ml-2 flex items-center gap-2">
                {label} 
                {multiple && <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">MULTI</span>}
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
                    <div className="absolute top-full left-0 w-full mt-3 bg-[#1a2235] border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] z-50 overflow-hidden animate-dropdown-in md:max-h-[400px] flex flex-col backdrop-blur-xl">
                        {/* Search Bar */}
                        {searchable && (
                            <div className="p-3 border-b border-white/5 sticky top-0 bg-[#1a2235]/80 backdrop-blur-md z-10">
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:border-blue-500/50 focus:outline-none placeholder-gray-600 transition-all"
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
                                                px-4 py-3.5 flex items-center justify-between cursor-pointer transition-all mx-1.5 rounded-xl mb-0.5 last:mb-0
                                                ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-gray-300 hover:bg-white/5'}
                                            `}
                                        >
                                            <span className={`text-sm font-bold truncate ${isSelected ? 'text-white' : ''}`}>
                                                {optLabel}
                                            </span>
                                            {isSelected ? (
                                                <div className="w-5 h-5 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            ) : multiple && (
                                                <div className="w-5 h-5 rounded-lg border-2 border-gray-700 flex-shrink-0 ml-2 group-hover:border-gray-500 transition-colors"></div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center flex flex-col items-center gap-3">
                                    <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center text-gray-600">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    </div>
                                    <div className="text-xs text-gray-500 font-black uppercase tracking-widest">No Matches Found</div>
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
