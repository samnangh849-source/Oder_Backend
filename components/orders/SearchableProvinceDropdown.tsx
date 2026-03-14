
import React, { useState, useRef, useEffect, useMemo } from 'react';

interface SearchableProvinceDropdownProps {
    provinces: string[];
    selectedProvince: string;
    onSelect: (province: string) => void;
}

const SearchableProvinceDropdown: React.FC<SearchableProvinceDropdownProps> = ({ provinces, selectedProvince, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSearchTerm(selectedProvince);
    }, [selectedProvince]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchTerm(selectedProvince);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedProvince]);

    const sortedProvinces = useMemo(() => {
        // Define exact names used in data
        const phnomPenh = "រាជធានីភ្នំពេញ";
        const kandal = "ខេត្តកណ្ដាល";
        
        // Simple filter based on search term
        const filtered = provinces.filter(p => 
            p.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Custom prioritize
        const others = filtered
            .filter(p => !p.includes("ភ្នំពេញ") && !p.includes("កណ្ដាល"))
            .sort((a, b) => a.localeCompare(b, 'km'));

        const final = [];
        
        // Find exact or partial matches for priority items
        const ppMatch = filtered.find(p => p.includes("ភ្នំពេញ"));
        const kdMatch = filtered.find(p => p.includes("កណ្ដាល"));

        if (ppMatch) final.push(ppMatch);
        if (kdMatch) final.push(kdMatch);
        
        return [...final, ...others];
    }, [provinces, searchTerm]);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div className="relative group">
                <input
                    type="text"
                    className="form-input !pl-10 !py-3 rounded-xl border-gray-700 bg-gray-900 focus:border-blue-500/50 transition-all font-bold text-gray-200"
                    placeholder="ស្វែងរក ខេត្ត/រាជធានី..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                <div className="absolute left-3 top-0 bottom-0 flex items-center justify-center text-gray-500 pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-gray-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-down max-h-60 overflow-y-auto custom-scrollbar">
                    {sortedProvinces.length > 0 ? sortedProvinces.map((p, idx) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => {
                                onSelect(p);
                                setSearchTerm(p);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors border-b border-white/5 last:border-0 ${selectedProvince === p ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/5'}`}
                        >
                            <div className="flex justify-between items-center">
                                <span>{p}</span>
                                {idx < 2 && searchTerm === '' && (
                                    <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded uppercase tracking-widest opacity-50">Priority</span>
                                )}
                            </div>
                        </button>
                    )) : (
                        <div className="p-4 text-center text-xs text-gray-500">រកមិនឃើញខេត្តនេះទេ</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableProvinceDropdown;
