
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { MasterProduct } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import ProductSelectionConfirm from '../orders/ProductSelectionConfirm';

const highlightMatch = (text: string, query: string) => {
    if (!query || !text) return <span>{text}</span>;
    const terms = query.split(' ').filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (terms.length === 0) return <span>{text}</span>;
    const regex = new RegExp(`(${terms.join('|')})`, 'gi');
    return (
        <>
            {text.split(regex).map((part, i) =>
                regex.test(part) && part.trim() !== '' ? <strong key={i} className="text-yellow-300 bg-yellow-900/50 rounded-sm px-0.5">{part}</strong> : part
            )}
        </>
    );
};

const getRelevanceScore = (product: MasterProduct, query: string): number => {
    const pName = (product.ProductName || '').toLowerCase();
    const pBarcode = (product.Barcode || '').toLowerCase();
    const searchableText = `${pName} ${pBarcode}`;
    const q = query.toLowerCase().trim();
    if (!q) return 1;
    const queryTerms = q.split(' ').filter(Boolean);
    const allTermsMatch = queryTerms.every(term => searchableText.includes(term));
    if (!allTermsMatch) return 0;
    let score = 10;
    queryTerms.forEach(term => {
        if (pName.includes(term)) score += 20;
        if (pBarcode.includes(term)) score += 10;
    });
    if (pName.startsWith(q)) score += 500;
    return score;
};

interface SearchableProductDropdownProps {
    products: MasterProduct[];
    selectedProductName: string;
    onSelect: (productName: string, tags?: string) => void;
    showTagEditor?: boolean;
    allowAddNew?: boolean;
}

const SearchableProductDropdown: React.FC<SearchableProductDropdownProps> = ({ 
    products, 
    selectedProductName, 
    onSelect, 
    showTagEditor = true,
    allowAddNew = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [previewProduct, setPreviewProduct] = useState<MasterProduct | null>(null);
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setSearchTerm(selectedProductName);
    }, [selectedProductName]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm(selectedProductName);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedProductName]);
    
    const filteredProducts = useMemo(() => {
        const query = searchTerm || '';
        if (!query.trim()) return [];
        return products
            .map(product => ({ product, score: getRelevanceScore(product, query) }))
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score || a.product.ProductName.localeCompare(b.product.ProductName))
            .map(p => p.product);
    }, [products, searchTerm]);
    
    const canAddNewProduct = useMemo(() => {
        if (!allowAddNew) return false;
        const trimmedSearch = searchTerm.trim();
        if (!trimmedSearch) return false;
        return !products.some(p => (p.ProductName || '').trim().toLowerCase() === trimmedSearch.toLowerCase());
    }, [searchTerm, products, allowAddNew]);

    const itemsForNavigation = useMemo(() => {
        const items = [...filteredProducts];
        if (canAddNewProduct) {
            items.unshift({ isAddNew: true, ProductName: searchTerm.trim() } as any);
        }
        return items;
    }, [filteredProducts, canAddNewProduct, searchTerm]);

    const confirmSelect = useCallback((productName: string, tags?: string) => {
        onSelect(productName, tags);
        setSearchTerm(productName);
        setIsOpen(false);
        setPreviewProduct(null);
        setActiveIndex(0);
        inputRef.current?.blur();
    }, [onSelect]);
    
    const handleItemClick = (item: any) => {
        if (item.isAddNew) confirmSelect(item.ProductName);
        else {
            setPreviewProduct(item);
            setIsOpen(false);
        }
    };

    const handleClear = useCallback(() => {
        onSelect('', '');
        setSearchTerm('');
        setIsOpen(true);
        setActiveIndex(0);
        inputRef.current?.focus();
    }, [onSelect]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const itemsCount = itemsForNavigation.length;
        if (itemsCount === 0) return;
        switch (e.key) {
            case 'ArrowDown': e.preventDefault(); if (!isOpen) setIsOpen(true); setActiveIndex(prev => (prev + 1) % itemsCount); break;
            case 'ArrowUp': e.preventDefault(); if (!isOpen) setIsOpen(true); setActiveIndex(prev => (prev - 1 + itemsCount) % itemsCount); break;
            case 'Enter': e.preventDefault(); if (!isOpen) return; if (activeIndex > -1 && itemsForNavigation[activeIndex]) handleItemClick(itemsForNavigation[activeIndex]); break;
            case 'Escape': setIsOpen(false); setSearchTerm(selectedProductName); inputRef.current?.blur(); break;
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div className="relative group">
                <input
                    ref={inputRef}
                    type="text"
                    className="form-input !pr-16 !py-3.5 bg-gray-900/50 border-gray-700 group-hover:border-blue-500/50 transition-all rounded-[1.25rem] font-bold text-gray-200"
                    placeholder="ស្វែងរកផលិតផល..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setIsOpen(true); setActiveIndex(0); }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    {searchTerm && <button type="button" onClick={handleClear} className="text-gray-500 hover:text-white text-2xl">&times;</button>}
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>
            
            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-fade-in-down max-h-80 overflow-y-auto custom-scrollbar">
                    <ul className="p-2 space-y-1">
                        {itemsForNavigation.length === 0 ? (
                            <li className="p-4 text-center text-xs text-gray-500 font-black uppercase tracking-widest">រកមិនឃើញផលិតផលទេ</li>
                        ) : itemsForNavigation.map((item, index) => {
                            if ('isAddNew' in item && item.isAddNew) {
                                return (
                                    <li key="add-new" className={`p-3.5 rounded-2xl cursor-pointer flex items-center gap-4 transition-all ${activeIndex === index ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-300'}`} onMouseDown={() => handleItemClick(item)}>
                                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" /></svg>
                                        </div>
                                        <div className="min-w-0"><p className="font-black text-sm leading-tight">បន្ថែមថ្មី៖ <span className="text-yellow-400">"{item.ProductName}"</span></p></div>
                                    </li>
                                );
                            }
                            const product = item as MasterProduct;
                            return (
                                <li key={product.ProductName} className={`p-2.5 rounded-2xl cursor-pointer flex items-center gap-3 transition-all ${activeIndex === index ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/5 text-gray-300'}`} onMouseDown={() => handleItemClick(product)}>
                                    <img src={convertGoogleDriveUrl(product.ImageURL)} className="w-12 h-12 rounded-xl object-cover border border-white/10" alt="" />
                                    <div className="min-w-0 flex-grow">
                                        <p className="font-black text-[15px] truncate leading-tight">{highlightMatch(product.ProductName, searchTerm)}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/10">${product.Price.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <ProductSelectionConfirm 
                product={previewProduct}
                isOpen={!!previewProduct}
                onClose={() => setPreviewProduct(null)}
                onConfirm={confirmSelect}
                showTagEditor={showTagEditor}
            />
        </div>
    );
};

export default SearchableProductDropdown;
