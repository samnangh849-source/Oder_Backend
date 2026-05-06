
import React, { useState, useRef, useEffect, useMemo, useCallback, useContext } from 'react';
import { MasterProduct } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import ProductSelectionConfirm from '../orders/ProductSelectionConfirm';
import { AppContext } from '../../context/AppContext';

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
    const { showNotification } = useContext(AppContext);
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [previewProduct, setPreviewProduct] = useState<MasterProduct | null>(null);
    const [holdItem, setHoldItem] = useState<MasterProduct | null>(null);
    const holdTimerRef = useRef<any>(null);
    const isLongPress = useRef(false);
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedProduct = useMemo(() => 
        products.find(p => p.ProductName === selectedProductName),
    [products, selectedProductName]);

    useEffect(() => {
        setSearchTerm(selectedProductName);
    }, [selectedProductName]);

    const handleHoldStart = (product: MasterProduct, delay = 500) => {
        isLongPress.current = false;
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        holdTimerRef.current = setTimeout(() => {
            setHoldItem(product);
            isLongPress.current = true;
        }, delay);
    };

    const handleHoldEnd = () => {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        setHoldItem(null);
        isLongPress.current = false;
    };

    const handleItemClickFromHandler = (product: MasterProduct) => {
        const wasHold = isLongPress.current;
        handleHoldEnd();
        if (!wasHold) {
            handleItemClick(product);
        }
    };

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
        if (item.isAddNew) {
            confirmSelect(item.ProductName);
        } else {
            confirmSelect(item.ProductName, item.Tags || '');
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
        <div className={`group/search-unit transition-all ${isOpen ? 'relative z-[70]' : 'relative z-10'}`} ref={dropdownRef}>
            {/* Unified Clean Input Frame */}
            <div className={`
                flex items-stretch bg-[#0B0E11] border rounded-lg transition-all duration-200 overflow-hidden
                ${isOpen || searchTerm !== selectedProductName ? 'border-[#FCD535] ring-1 ring-[#FCD535]/20' : 'border-[#2B3139] hover:border-[#474D57]'}
            `}>
                {/* Left Action: Review Toggle */}
                <div className="flex-shrink-0 flex items-center bg-[#1E2329] border-r border-[#2B3139] transition-colors">
                    <button 
                        type="button"
                        className={`w-10 h-10 flex items-center justify-center transition-all group/pen ${selectedProduct ? 'text-[#FCD535] hover:bg-[#FCD535]/10' : 'text-[#474D57] cursor-not-allowed opacity-50'}`}
                        onClick={() => selectedProduct && setPreviewProduct(selectedProduct)}
                        title="Operational Review"
                        disabled={!selectedProduct}
                    >
                        <svg className="w-4 h-4 transition-transform group-hover/pen:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                </div>

                {/* Main Input: Search Field */}
                <div className="flex-grow relative flex items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full bg-transparent pl-3 pr-10 py-2 font-medium text-sm text-[#EAECEF] placeholder-[#474D57] outline-none h-10"
                        placeholder="Search product or barcode..."
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setIsOpen(true); setActiveIndex(0); }}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                    />
                    
                    {/* Clear Button */}
                    <div className="absolute right-0 top-0 bottom-0 pr-2 flex items-center">
                        {searchTerm && (
                            <button 
                                type="button" 
                                onClick={handleClear} 
                                className="w-6 h-6 flex items-center justify-center text-[#474D57] hover:text-[#F6465D] hover:bg-[#F6465D]/10 rounded-full transition-colors font-bold text-lg"
                            >
                                &times;
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 bg-[#1E2329] border border-[#2B3139] rounded-xl shadow-2xl overflow-hidden animate-fade-in-down max-h-[350px] flex flex-col">
                    <div className="bg-[#0B0E11]/80 px-4 py-2.5 border-b border-[#2B3139] flex justify-between items-center flex-shrink-0 backdrop-blur-sm">
                        <span className="text-[10px] font-semibold text-[#848E9C] uppercase tracking-wider">Results ({filteredProducts.length})</span>
                        <span className="text-[10px] font-semibold text-[#FCD535] uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FCD535]"></span> Active
                        </span>
                    </div>
                    <ul className="p-0 space-y-0 overflow-y-auto custom-scrollbar">
                        {itemsForNavigation.length === 0 ? (
                            <li className="p-8 text-center flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-[#2B3139]/30 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-[#474D57]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <span className="text-xs text-[#848E9C] font-medium">No matches found</span>
                            </li>
                        ) : itemsForNavigation.map((item, index) => {
                            if ('isAddNew' in item && item.isAddNew) {
                                return (
                                    <li key="add-new" className={`px-4 py-3 cursor-pointer flex items-center gap-4 transition-all border-b border-[#2B3139]/50 ${activeIndex === index ? 'bg-[#FCD535]/10' : 'hover:bg-[#2B3139]/50'}`} onMouseDown={() => handleItemClick(item)}>
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeIndex === index ? 'bg-[#FCD535] text-[#181A20]' : 'bg-[#2B3139] text-[#848E9C]'}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                        </div>
                                        <div className="min-w-0 flex flex-col">
                                            <p className={`font-semibold text-sm leading-none mb-1 ${activeIndex === index ? 'text-[#FCD535]' : 'text-[#EAECEF]'}`}>Add new product</p>
                                            <p className="text-xs text-[#848E9C] truncate">"{item.ProductName}"</p>
                                        </div>
                                    </li>
                                );
                            }
                            const product = item as MasterProduct;
                            const img = product.ImageURL || '';
                            const hasNoImage = !img || img.includes('placehold.co') || img.includes('text=N/A');

                            return (
                                <li 
                                    key={product.ProductName} 
                                    className={`px-4 py-3 cursor-pointer flex items-center gap-4 transition-all border-b border-[#2B3139]/50 last:border-0 relative ${activeIndex === index ? 'bg-[#2B3139]/40' : 'hover:bg-[#2B3139]/20'}`} 
                                    onMouseEnter={() => handleHoldStart(product, 400)}
                                    onMouseLeave={handleHoldEnd}
                                    onMouseDown={(e) => e.button === 0 && handleHoldStart(product, 400)}
                                    onMouseUp={() => handleItemClickFromHandler(product)}
                                    onTouchStart={() => handleHoldStart(product, 400)}
                                    onTouchEnd={() => handleItemClickFromHandler(product)}
                                >
                                    {activeIndex === index && <div className="absolute inset-y-0 left-0 w-1 bg-[#FCD535]"></div>}
                                    
                                    {/* Product Visual */}
                                    <div className="relative flex-shrink-0">
                                        <div className={`w-12 h-12 rounded-lg overflow-hidden border transition-all ${activeIndex === index ? 'border-[#FCD535]' : 'border-[#2B3139]'}`}>
                                            <img src={convertGoogleDriveUrl(product.ImageURL)} className={`w-full h-full object-cover ${hasNoImage ? 'opacity-20 grayscale' : ''}`} alt="" />
                                        </div>
                                    </div>

                                    {/* Product Meta */}
                                    <div className="min-w-0 flex-grow py-0.5">
                                        <p className="font-semibold text-sm truncate text-[#EAECEF]" title={product.ProductName}>
                                            {highlightMatch(product.ProductName, searchTerm)}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-xs font-bold text-[#FCD535]">${product.Price.toFixed(2)}</span>
                                            <span className="text-[10px] text-[#848E9C] uppercase tracking-wider bg-[#0B0E11] px-1.5 py-0.5 rounded border border-[#2B3139]">
                                                {product.Barcode || 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Hook */}
                                    <div className="flex-shrink-0 pl-2 hidden sm:block">
                                        <button 
                                            type="button"
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${activeIndex === index ? 'bg-[#FCD535] text-[#181A20]' : 'text-[#848E9C] hover:bg-[#2B3139] hover:text-[#EAECEF]'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewProduct(product);
                                            }}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* Hold Overlay (Tooltip) */}
            {holdItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-fade-in pointer-events-none">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
                    <div className="bg-[#1E2329] border-2 border-[#FCD535] p-6 rounded-none shadow-2xl max-w-xs w-full text-center animate-scale-in">
                        <div className="w-24 h-24 mx-auto mb-4 rounded-none overflow-hidden border-2 border-[#FCD535]">
                            <img src={convertGoogleDriveUrl(holdItem.ImageURL)} className="w-full h-full object-cover" />
                        </div>
                        <h3 className="text-[#FCD535] font-black text-lg leading-tight uppercase tracking-tighter mb-2">{holdItem.ProductName}</h3>
                        <p className="text-[#EAECEF] font-black font-mono text-base tracking-widest">${holdItem.Price.toFixed(2)}</p>
                    </div>
                </div>
            )}

            <ProductSelectionConfirm 
                product={previewProduct}
                isOpen={!!previewProduct}
                onClose={() => setPreviewProduct(null)}
                onConfirm={confirmSelect}
                showTagEditor={showTagEditor}
            />

            <style>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
                @keyframes scale-in {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scale-in {
                    animation: scale-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                }
                @keyframes fade-in-down {
                    from { transform: translateY(-10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-fade-in-down {
                    animation: fade-in-down 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default SearchableProductDropdown;

