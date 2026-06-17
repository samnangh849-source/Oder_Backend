
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
                    className="form-input !pl-10 !py-3 rounded-none border-2 border-[#2B3139] bg-[#0B0E11] focus:border-[#FCD535] transition-all font-bold text-[#EAECEF] placeholder-[#474D57] outline-none"
                    placeholder="ស្វែងរក ខេត្ត/រាជធានី..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                <div className="absolute left-3 top-0 bottom-0 flex items-center justify-center text-[#848E9C] group-focus-within:text-[#FCD535] pointer-events-none transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-[#1E2329] border-2 border-[#FCD535] rounded-none shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in-down max-h-60 overflow-y-auto custom-scrollbar">
                    {sortedProvinces.length > 0 ? sortedProvinces.map((p, idx) => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => {
                                onSelect(p);
                                setSearchTerm(p);
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm font-black transition-all border-b border-[#2B3139] last:border-0 ${selectedProvince === p ? 'bg-[#FCD535] text-[#181A20]' : 'text-[#EAECEF] hover:bg-[#FCD535]/10'}`}
                        >
                            <div className="flex justify-between items-center uppercase tracking-tighter">
                                <span>{p}</span>
                                {idx < 2 && searchTerm === '' && (
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-none font-black uppercase tracking-widest ${selectedProvince === p ? 'bg-[#181A20]/20 text-[#181A20]' : 'bg-[#FCD535]/20 text-[#FCD535]'}`}>Priority</span>
                                )}
                            </div>
                        </button>
                    )) : (
                        <div className="p-6 text-center text-[10px] text-[#848E9C] font-black uppercase tracking-widest">រកមិនឃើញខេត្តនេះទេ</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SearchableProvinceDropdown;
