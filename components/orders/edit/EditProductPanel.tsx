
import React from 'react';
import { Product, MasterProduct } from '../../../types';
import SearchableProductDropdown from '../../common/SearchableProductDropdown';
import SetQuantity from '../SetQuantity';
import { convertGoogleDriveUrl } from '../../../utils/fileUtils';

interface EditProductPanelProps {
    products: Product[];
    masterProducts: MasterProduct[];
    onProductChange: (index: number, field: keyof Product, value: any, extraTags?: string) => void;
    onAddProduct: () => void;
    onRemoveProduct: (index: number) => void;
    onPreviewImage: (url: string) => void;
    onScanBarcode: () => void;
}

const EditProductPanel: React.FC<EditProductPanelProps> = ({
    products, masterProducts, onProductChange, onAddProduct, onRemoveProduct, onPreviewImage, onScanBarcode
}) => {
    return (
        <div className="flex-initial lg:flex-1 bg-[#1E2329] border border-[#2B3139] rounded-sm p-4 lg:overflow-y-auto custom-scrollbar flex flex-col relative min-h-[300px]">
            <div className="flex justify-between items-center mb-4 sticky top-0 z-20 bg-[#1E2329] pb-3 border-b border-[#2B3139]">
                <h3 className="text-[11px] font-medium text-[#848E9C] uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1 h-3 bg-[#FCD535] rounded-sm"></div>
                    Items List ({products.length})
                </h3>
                <div className="flex gap-2">
                    <button type="button" onClick={onScanBarcode} className="px-3 py-1.5 bg-[#2B3139] border border-[#363C44] text-[#EAECEF] rounded-sm hover:bg-[#363C44] transition-all flex items-center gap-2 text-[11px] font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                        Scan
                    </button>
                    <button type="button" onClick={onAddProduct} className="px-4 py-1.5 bg-[#FCD535] text-[#181A20] rounded-sm text-[11px] font-bold hover:bg-[#F0B90B] transition-all flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4" /></svg> Add
                    </button>
                </div>
            </div>

            <div className="space-y-3 pb-4">
                {products.map((p, index) => (
                    <div key={p.id || index} className="group relative bg-[#1E2329] rounded-sm p-3 border border-[#2B3139] hover:border-[#FCD535]/30 transition-all flex flex-col sm:flex-row gap-4 items-start">
                        <button type="button" onClick={() => onRemoveProduct(index)} className="absolute top-2 right-2 text-[#848E9C] hover:text-[#F6465D] w-6 h-6 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">&times;</button>
                        
                        {/* Image */}
                        <div className="w-16 h-16 bg-[#0B0E11] rounded-sm border border-[#2B3139] overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => p.image && onPreviewImage(convertGoogleDriveUrl(p.image))}>
                            {p.image ? <img src={convertGoogleDriveUrl(p.image)} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-[8px] text-[#474D57]">No Pic</div>}
                        </div>

                        {/* Info Inputs */}
                        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                            {/* Product Select & Details */}
                            <div className="md:col-span-6 space-y-2">
                                <SearchableProductDropdown 
                                    products={masterProducts} 
                                    selectedProductName={p.name} 
                                    onSelect={(name, tags) => onProductChange(index, 'name', name, tags)} 
                                    allowAddNew={false}
                                />
                                <div className="flex gap-2">
                                    <input type="text" value={p.colorInfo} onChange={(e) => onProductChange(index, 'colorInfo', e.target.value)} className="bg-[#0B0E11] border border-[#2B3139] rounded-sm py-1 px-2 text-[10px] font-medium text-[#EAECEF] w-full focus:border-[#FCD535] outline-none placeholder-[#474D57]" placeholder="Variant (e.g. Red, XL)" />
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="md:col-span-3">
                                <SetQuantity value={Number(p.quantity) || 1} onChange={(val) => onProductChange(index, 'quantity', val)} label="" />
                            </div>

                            {/* Price & Total */}
                            <div className="md:col-span-3 flex flex-row md:flex-col justify-between items-center md:items-end gap-1">
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-medium text-[#848E9C] uppercase">Price</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-[#0ECB81] font-bold">$</span>
                                        <input type="text" inputMode="decimal" value={p.finalPrice} onChange={(e) => onProductChange(index, 'finalPrice', e.target.value)} className="w-16 bg-transparent border-b border-[#2B3139] py-0.5 font-bold text-right text-[#EAECEF] focus:border-[#FCD535] outline-none text-[13px] transition-all" />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-[#848E9C] uppercase font-medium">Total</p>
                                    <p className="text-[14px] font-bold text-[#EAECEF] tabular-nums">${(Number(p.total) || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EditProductPanel;
