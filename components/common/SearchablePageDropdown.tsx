
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
                    className="form-input !pl-14 !pr-10 !py-3.5 bg-gray-900/50 border-gray-700 group-hover:border-blue-500/50 transition-all rounded-[1.25rem] font-bold text-gray-200"
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2">
                    <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden border border-white/5 flex items-center justify-center">
                        {selectedPage ? (
                            <img 
                                src={convertGoogleDriveUrl(selectedPage.PageLogoURL)} 
                                className="w-full h-full object-cover" 
                                alt="" 
                            />
                        ) : (
                            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM7.07 18.28c.43-.9 1.91-1.61 3.46-1.61s3.03.72 3.46 1.61C12.79 19.11 11.41 19.5 10 19.5s-2.79-.39-3.93-1.22zM15.6 17.03c-.78-1.13-2.56-1.86-4.6-1.86s-3.82.73-4.6 1.86c-.52-.51-.95-1.09-1.27-1.74.88-1.19 2.72-2.12 4.87-2.12s3.99.93 4.87 2.12c-.32.65-.75 1.23-1.27 1.74zM10 12.3c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>
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
                        {filteredPages.length > 0 ? filteredPages.map((page) => (
                            <button
                                key={page.PageName}
                                type="button"
                                onClick={() => {
                                    onSelect(page);
                                    setSearchTerm(page.PageName);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl transition-all ${selectedPageName === page.PageName ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-300 hover:bg-white/5'}`}
                            >
                                <img 
                                    src={convertGoogleDriveUrl(page.PageLogoURL)} 
                                    className="w-11 h-11 rounded-full object-cover border-2 border-white/10 shadow-sm flex-shrink-0" 
                                    alt="" 
                                />
                                <div className="text-left min-w-0">
                                    <p className="font-black text-[15px] truncate leading-tight">{page.PageName}</p>
                                    <p className={`text-[10px] uppercase tracking-widest font-black mt-1 ${selectedPageName === page.PageName ? 'text-blue-100' : 'text-gray-500'}`}>{page.Team}</p>
                                </div>
                            </button>
                        )) : (
                            <div className="p-6 text-center text-xs text-gray-500 font-black uppercase tracking-widest">រកមិនឃើញ Page ទេ</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchablePageDropdown;
