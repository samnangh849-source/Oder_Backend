
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ShippingMethod } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface SearchableShippingMethodDropdownProps {
    methods: ShippingMethod[];
    selectedMethodName: string;
    onSelect: (method: ShippingMethod) => void;
    placeholder?: string;
}

const SearchableShippingMethodDropdown: React.FC<SearchableShippingMethodDropdownProps> = ({ 
    methods = [], 
    selectedMethodName, 
    onSelect, 
    placeholder = "ជ្រើសរើសសេវាដឹកជញ្ជូន..." 
}) => {
    const safeMethods = useMemo(() => Array.isArray(methods) ? methods : [], [methods]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const selected = safeMethods.find(m => m.MethodName === selectedMethodName);
        if (selected) setSearchTerm(selected.MethodName);
    }, [selectedMethodName, safeMethods]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                const selected = safeMethods.find(m => m.MethodName === selectedMethodName);
                setSearchTerm(selected ? selected.MethodName : '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedMethodName, safeMethods]);

    const filteredMethods = useMemo(() => {
        if (!searchTerm.trim()) return safeMethods;
        const q = searchTerm.toLowerCase();
        return safeMethods.filter(m => (m.MethodName || '').toLowerCase().includes(q));
    }, [safeMethods, searchTerm]);

    const selectedMethod = safeMethods.find(m => m.MethodName === selectedMethodName);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div className="relative group">
                <input
                    type="text"
                    className="form-input !pl-14 !pr-10 !py-3.5 bg-gray-900/50 border-gray-700 group-hover:border-blue-500/50 transition-all rounded-[1.25rem] font-bold text-gray-200"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <div className="w-8 h-8 rounded-xl bg-gray-800 overflow-hidden border border-white/5 flex items-center justify-center p-1 shadow-inner">
                        {selectedMethod ? (
                            <img 
                                src={convertGoogleDriveUrl(selectedMethod.LogosURL)} 
                                className="w-full h-full object-contain" 
                                alt="" 
                            />
                        ) : (
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16l4-4 4 4" /></svg>
                        )}
                    </div>
                </div>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors">
                    <svg className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-[1.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in-down">
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5">
                        {filteredMethods.length > 0 ? filteredMethods.map((method) => (
                            <button
                                key={method.MethodName}
                                type="button"
                                onClick={() => {
                                    onSelect(method);
                                    setSearchTerm(method.MethodName);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-all ${selectedMethodName === method.MethodName ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-300 hover:bg-white/5'}`}
                            >
                                <div className="w-11 h-11 rounded-xl bg-gray-900 border-2 border-white/10 p-1.5 shadow-sm flex-shrink-0 flex items-center justify-center">
                                    <img 
                                        src={convertGoogleDriveUrl(method.LogosURL)} 
                                        className="w-full h-full object-contain" 
                                        alt="" 
                                    />
                                </div>
                                <div className="text-left min-w-0 flex-grow">
                                    <p className="font-black text-[15px] truncate leading-tight">{method.MethodName}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter ${selectedMethodName === method.MethodName ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {method.RequireDriverSelection ? 'Driver Selection Req' : 'Standard Service'}
                                        </span>
                                        {method.InternalCost !== undefined && method.InternalCost > 0 && (
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter ${selectedMethodName === method.MethodName ? 'bg-white/20 text-white' : 'bg-orange-500/10 text-orange-400'}`}>
                                                Rec: ${method.InternalCost}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        )) : (
                            <div className="p-6 text-center text-xs text-gray-500 font-black uppercase tracking-widest">រកមិនឃើញសេវាដឹកជញ្ជូនទេ</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableShippingMethodDropdown;
