
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { TeamPage } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface SearchablePageDropdownProps {
    pages: TeamPage[];
    selectedPageName: string;
    onSelect: (page: TeamPage) => void;
    placeholder?: string;
}

const SearchablePageDropdown: React.FC<SearchablePageDropdownProps> = ({ pages, selectedPageName, onSelect, placeholder = "ជ្រើសរើស Page..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const selected = pages.find(p => p.PageName === selectedPageName);
        if (selected) setSearchTerm(selected.PageName);
    }, [selectedPageName, pages]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                const selected = pages.find(p => p.PageName === selectedPageName);
                setSearchTerm(selected ? selected.PageName : '');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedPageName, pages]);

    const filteredPages = useMemo(() => {
        if (!searchTerm.trim()) return pages;
        const q = searchTerm.toLowerCase();
        return pages.filter(p => (p.PageName || '').toLowerCase().includes(q));
    }, [pages, searchTerm]);

    const selectedPage = pages.find(p => p.PageName === selectedPageName);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div className="relative group">
                <input
                    type="text"
                    className="form-input !pl-14 !pr-10 !py-3.5 bg-[#0B0E11] border-2 border-[#2B3139] focus:border-[#FCD535] transition-all rounded-none font-bold text-[#EAECEF] placeholder-[#474D57] outline-none"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                <div className="absolute left-0 top-0 bottom-0 pl-3.5 flex items-center pointer-events-none">
                    <div className="w-8 h-8 rounded-none bg-[#1E2329] overflow-hidden border-2 border-[#2B3139] flex items-center justify-center">
                        {selectedPage ? (
                            <img 
                                src={convertGoogleDriveUrl(selectedPage.PageLogoURL)} 
                                className="w-full h-full object-cover" 
                                alt="" 
                            />
                        ) : (
                            <svg className="w-4 h-4 text-[#474D57]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM7.07 18.28c.43-.9 1.91-1.61 3.46-1.61s3.03.72 3.46 1.61C12.79 19.11 11.41 19.5 10 19.5s-2.79-.39-3.93-1.22zM15.6 17.03c-.78-1.13-2.56-1.86-4.6-1.86s-3.82.73-4.6 1.86c-.52-.51-.95-1.09-1.27-1.74.88-1.19 2.72-2.12 4.87-2.12s3.99.93 4.87 2.12c-.32.65-.75 1.23-1.27 1.74zM10 12.3c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
                        )}
                    </div>
                </div>
                <div className="absolute right-0 top-0 bottom-0 pr-3.5 flex items-center text-[#848E9C] group-focus-within:text-[#FCD535] transition-colors pointer-events-none">
                    <svg className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-1 bg-[#1E2329] border-2 border-[#FCD535] rounded-none shadow-[0_15px_45px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in-down">
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                        {filteredPages.length > 0 ? filteredPages.map((page) => (
                            <button
                                key={page.PageName}
                                type="button"
                                onClick={() => {
                                    onSelect(page);
                                    setSearchTerm(page.PageName);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 p-2 rounded-none transition-all border-b border-[#2B3139]/50 last:border-0 ${selectedPageName === page.PageName ? 'bg-[#FCD535] text-[#181A20]' : 'text-[#EAECEF] hover:bg-[#FCD535]/10'}`}
                            >
                                <img 
                                    src={convertGoogleDriveUrl(page.PageLogoURL)} 
                                    className={`w-11 h-11 rounded-none object-cover border-2 flex-shrink-0 transition-all ${selectedPageName === page.PageName ? 'border-[#181A20]' : 'border-[#2B3139]'}`} 
                                    alt="" 
                                />
                                <div className="text-left min-w-0">
                                    <p className="font-black text-[14px] truncate leading-tight uppercase tracking-tight">{page.PageName}</p>
                                    <p className={`text-[9px] uppercase tracking-widest font-black mt-1 ${selectedPageName === page.PageName ? 'text-[#181A20]/70' : 'text-[#848E9C]'}`}>{page.Team}</p>
                                </div>
                            </button>
                        )) : (
                            <div className="p-6 text-center text-[10px] text-[#848E9C] font-black uppercase tracking-widest italic">រកមិនឃើញ Page ទេ</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchablePageDropdown;
