
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
        <div className="flex-1 bg-gray-800/30 border border-white/5 rounded-[2rem] p-4 lg:p-6 overflow-y-auto custom-scrollbar flex flex-col relative shadow-inner">
            <div className="flex justify-between items-center mb-6 sticky top-0 z-20 bg-[#121a2b]/95 backdrop-blur-md p-3 -mx-2 -mt-2 rounded-2xl border border-white/5 shadow-lg">
                <h3 className="text-xs font-black text-white uppercase tracking-widest pl-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    Items List ({products.length})
                </h3>
                <div className="flex gap-2">
                    <button type="button" onClick={onScanBarcode} className="px-4 py-2.5 bg-blue-600/10 border border-blue-500/30 text-blue-400 rounded-xl shadow-lg hover:bg-blue-600 hover:text-white transition-all active:scale-95 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                        Scan
                    </button>
                    <button type="button" onClick={onAddProduct} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/30 text-[10px] font-black uppercase hover:bg-blue-500 transition-all active:scale-95 flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M12 4v16m8-8H4" /></svg> Add
                    </button>
                </div>
            </div>

            <div className="space-y-4 pb-4">
                {products.map((p, index) => (
                    <div key={p.id || index} className="group relative bg-[#0f1523] rounded-[1.5rem] p-4 border border-white/5 hover:border-blue-500/30 transition-all flex flex-col sm:flex-row gap-5 items-start shadow-md hover:shadow-xl">
                        <button type="button" onClick={() => onRemoveProduct(index)} className="absolute top-3 right-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-full w-8 h-8 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">&times;</button>
                        
                        {/* Image */}
                        <div className="w-20 h-20 bg-gray-900 rounded-2xl border border-white/10 overflow-hidden flex-shrink-0 cursor-pointer shadow-lg group-hover:scale-105 transition-transform" onClick={() => p.image && onPreviewImage(convertGoogleDriveUrl(p.image))}>
                            <img src={convertGoogleDriveUrl(p.image)} className="w-full h-full object-cover" alt="" />
                        </div>

                        {/* Info Inputs */}
                        <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
                            {/* Product Select & Details */}
                            <div className="lg:col-span-6 space-y-3">
                                <SearchableProductDropdown 
                                    products={masterProducts} 
                                    selectedProductName={p.name} 
                                    onSelect={(name, tags) => onProductChange(index, 'name', name, tags)} 
                                    allowAddNew={false}
                                />
                                <div className="flex gap-2">
                                    <input type="text" value={p.colorInfo} onChange={(e) => onProductChange(index, 'colorInfo', e.target.value)} className="bg-gray-800/50 border-none rounded-lg py-1.5 px-3 text-[10px] font-bold text-white w-full focus:ring-1 focus:ring-blue-500 placeholder-gray-600" placeholder="Color/Size..." />
                                    <input type="text" value={p.tags || ''} onChange={(e) => onProductChange(index, 'tags', e.target.value)} className="bg-gray-800/50 border-none rounded-lg py-1.5 px-3 text-[10px] font-bold text-blue-300 w-full focus:ring-1 focus:ring-blue-500 placeholder-gray-600" placeholder="Tags..." />
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="lg:col-span-3 flex justify-center">
                                <div className="w-32">
                                    <SetQuantity value={Number(p.quantity) || 1} onChange={(val) => onProductChange(index, 'quantity', val)} label="" />
                                </div>
                            </div>

                            {/* Price & Total */}
                            <div className="lg:col-span-3 flex flex-row lg:flex-col justify-between items-center lg:items-end gap-2 h-full">
                                <div className="relative group/price">
                                    <label className="absolute -top-3 right-0 text-[8px] font-black text-gray-500 uppercase opacity-0 group-hover/price:opacity-100 transition-opacity">Unit Price</label>
                                    <input type="text" inputMode="decimal" value={p.finalPrice} onChange={(e) => onProductChange(index, 'finalPrice', e.target.value)} className="w-24 bg-transparent border-b border-gray-700 py-1 font-black text-right text-emerald-400 focus:border-emerald-500 outline-none text-sm transition-all" />
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-wider">Total</p>
                                    <p className="text-lg font-black text-white tracking-tight">${(Number(p.total) || 0).toFixed(2)}</p>
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
