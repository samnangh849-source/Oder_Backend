
import React, { useState, useContext, useMemo, useCallback } from 'react';
import { AppContext } from '../../../context/AppContext';
import { MasterProduct } from '../../../types';
import Spinner from '../../common/Spinner';
import { WEB_APP_URL } from '../../../constants';
import { convertGoogleDriveUrl } from '../../../utils/fileUtils';
import { getValueCaseInsensitive } from '../../../constants/settingsConfig';
import { translations } from '../../../translations';

interface ProductManagementMatrixProps {
    products: MasterProduct[];
    onRefresh: () => void;
}

const ProductManagementMatrix: React.FC<ProductManagementMatrixProps> = ({ products, onRefresh }) => {
    const { refreshData, showNotification, language } = useContext(AppContext);
    const t = translations[language];
    const [searchQuery, setSearchQuery] = useState('');
    const [updating, setUpdating] = useState<string | null>(null);
    const [editData, setEditData] = useState<Record<string, Partial<MasterProduct>>>({});
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newProduct, setNewProduct] = useState<Partial<MasterProduct>>({
        ProductName: '',
        Barcode: '',
        Price: 0,
        Cost: 0,
        Tags: ''
    });

    const handleAddNewProduct = async () => {
        if (!newProduct.ProductName) {
            showNotification?.('សូមបញ្ចូលឈ្មោះផលិតផល', 'error');
            return;
        }

        setIsAddingNew(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${WEB_APP_URL}/api/admin/add-row`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sheetName: 'Products',
                    newData: newProduct
                })
            });

            const result = await res.json();
            if (res.ok && result.status === 'success') {
                showNotification?.('បន្ថែមផលិតផលថ្មីជោគជ័យ', 'success');
                setNewProduct({
                    ProductName: '',
                    Barcode: '',
                    Price: 0,
                    Cost: 0,
                    Tags: ''
                });
                await refreshData();
                onRefresh();
            } else {
                throw new Error(result.message || 'Add failed');
            }
        } catch (err: any) {
            showNotification?.(err.message || 'Error adding product', 'error');
        } finally {
            setIsAddingNew(false);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return products;
        const q = searchQuery.toLowerCase();
        return products.filter(p => 
            p.ProductName.toLowerCase().includes(q) || 
            (p.Barcode || '').toLowerCase().includes(q) ||
            (p.Tags || '').toLowerCase().includes(q)
        );
    }, [products, searchQuery]);

    const handleFieldChange = (productName: string, field: keyof MasterProduct, value: any) => {
        setEditData(prev => ({
            ...prev,
            [productName]: {
                ...(prev[productName] || {}),
                [field]: value
            }
        }));
    };

    const handleSaveRow = async (product: MasterProduct, specificChanges?: Partial<MasterProduct>) => {
        const changes = specificChanges || editData[product.ProductName];
        if (!changes || Object.keys(changes).length === 0) return;

        setUpdating(product.ProductName);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sheetName: 'Products',
                    primaryKey: { ProductName: product.ProductName },
                    newData: changes
                })
            });

            const result = await res.json();
            if (res.ok && result.status === 'success') {
                showNotification?.(`${t.save_success}: ${product.ProductName}`, 'success');
                if (!specificChanges) {
                    setEditData(prev => {
                        const next = { ...prev };
                        delete next[product.ProductName];
                        return next;
                    });
                }
                await refreshData();
                onRefresh();
            } else {
                throw new Error(result.message || t.no_data);
            }
        } catch (err: any) {
            showNotification?.(err.message || 'Error', 'error');
        } finally {
            setUpdating(null);
        }
    };

    const handleImageUpload = async (product: MasterProduct, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUpdating(product.ProductName);
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                const token = localStorage.getItem('token');
                
                const res = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        fileData: base64Data,
                        fileName: `Product_${product.ProductName}_${Date.now()}.webp`,
                        mimeType: 'image/webp',
                        sheetName: 'Products',
                        primaryKey: { ProductName: product.ProductName },
                        targetColumn: 'ImageURL'
                    })
                });

                const result = await res.json();
                if (res.ok && result.status === 'success') {
                    showNotification?.(t.upload_success, 'success');
                    await refreshData();
                    onRefresh();
                } else {
                    throw new Error(result.message || 'Upload failed');
                }
            };
            reader.readAsDataURL(file);
        } catch (err: any) {
            showNotification?.(err.message || 'Error', 'error');
        } finally {
            setUpdating(null);
        }
    };

    const handleDeleteProduct = async (product: MasterProduct) => {
        if (!window.confirm(`${t.confirm_delete} "${product.ProductName}"?`)) return;

        setUpdating(product.ProductName);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${WEB_APP_URL}/api/admin/delete-row`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sheetName: 'Products',
                    primaryKey: { ProductName: product.ProductName }
                })
            });

            const result = await res.json();
            if (res.ok && result.status === 'success') {
                showNotification?.(t.delete_success, 'success');
                await refreshData();
                onRefresh();
            } else {
                throw new Error(result.message || 'Delete failed');
            }
        } catch (err: any) {
            showNotification?.(err.message || 'Error', 'error');
        } finally {
            setUpdating(null);
        }
    };

    const handleSaveAll = async () => {
        const changedProducts = Object.keys(editData);
        if (changedProducts.length === 0) return;

        setIsSavingAll(true);
        let successCount = 0;
        let failCount = 0;

        for (const name of changedProducts) {
            const product = products.find(p => p.ProductName === name);
            if (!product) continue;

            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        sheetName: 'Products',
                        primaryKey: { ProductName: name },
                        newData: editData[name]
                    })
                });
                if (res.ok) successCount++;
                else failCount++;
            } catch {
                failCount++;
            }
        }

        if (successCount > 0) {
            showNotification?.(`${t.save_success}: ${successCount}`, 'success');
            setEditData({});
            await refreshData();
            onRefresh();
        }
        if (failCount > 0) {
            showNotification?.(`Failed: ${failCount}`, 'error');
        }
        setIsSavingAll(false);
    };

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-[#1e2329] border border-[#2b3139] rounded-sm">
                <div className="relative w-full md:max-w-md group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder={`${t.search} (Name, Barcode, Tags)`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm py-2 pl-10 pr-4 text-sm text-[#eaecef] focus:border-[#fcd535] outline-none transition-all placeholder:text-[#5e6673]"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {Object.keys(editData).length > 0 && (
                        <button
                            onClick={handleSaveAll}
                            disabled={isSavingAll}
                            className="flex items-center gap-2 px-6 py-2 bg-[#fcd535] text-black text-xs font-black uppercase rounded-sm hover:bg-[#f0c832] transition-all disabled:opacity-50"
                        >
                            {isSavingAll ? <Spinner size="xs" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>}
                            {t.save_all} ({Object.keys(editData).length})
                        </button>
                    )}
                    <button
                        onClick={onRefresh}
                        className="p-2 bg-[#2b3139] text-[#848e9c] rounded-sm hover:text-white transition-all border border-[#3d4451]"
                        title={t.refresh_data}
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </button>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="flex-grow overflow-auto border border-[#2b3139] bg-[#0b0e11] rounded-sm relative">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 z-20 bg-[#181a20] shadow-sm">
                        <tr>
                            <th className="px-4 py-3 text-[10px] font-black text-[#848e9c] uppercase tracking-widest w-12 text-center border-b border-[#2b3139]">#</th>
                            <th className="px-4 py-3 text-[10px] font-black text-[#848e9c] uppercase tracking-widest border-b border-[#2b3139] w-16">{t.product_image}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-[#848e9c] uppercase tracking-widest border-b border-[#2b3139]">{t.product_name}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-[#848e9c] uppercase tracking-widest border-b border-[#2b3139] w-48">{t.field_Barcode}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-[#848e9c] uppercase tracking-widest border-b border-[#2b3139] w-32">{t.field_Price}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-[#848e9c] uppercase tracking-widest border-b border-[#2b3139] w-32">{t.field_Cost}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-[#848e9c] uppercase tracking-widest border-b border-[#2b3139] w-40">{t.tags}</th>
                            <th className="px-4 py-3 text-[10px] font-black text-[#848e9c] uppercase tracking-widest border-b border-[#2b3139] w-24 text-center">{t.actions}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2b3139]">
                        {/* Inline Add Row */}
                        <tr className="bg-[#fcd535]/5 border-b-2 border-[#fcd535]/20">
                            <td className="px-4 py-3 text-center text-[#fcd535] font-black">+</td>
                            <td className="px-4 py-3">
                                <div className="w-10 h-10 bg-[#181a20] rounded-sm border border-dashed border-[#fcd535]/40 flex items-center justify-center text-[#fcd535]/40 cursor-pointer hover:bg-[#fcd535]/10 transition-all" onClick={() => document.getElementById('new-product-img')?.click()}>
                                    {newProduct.ImageURL ? (
                                        <img src={convertGoogleDriveUrl(newProduct.ImageURL)} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    )}
                                    <input 
                                        type="file" 
                                        id="new-product-img" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            showNotification?.(t.loading, 'info');
                                        }}
                                    />
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <input
                                    type="text"
                                    placeholder={t.product_name}
                                    value={newProduct.ProductName}
                                    onChange={(e) => setNewProduct(prev => ({ ...prev, ProductName: e.target.value }))}
                                    className="w-full bg-[#0b0e11] border border-[#fcd535]/30 rounded-sm px-2 py-1 text-sm font-bold text-white focus:border-[#fcd535] outline-none transition-all placeholder:text-[#5e6673]"
                                />
                            </td>
                            <td className="px-4 py-3">
                                <input
                                    type="text"
                                    placeholder={t.field_Barcode}
                                    value={newProduct.Barcode}
                                    onChange={(e) => setNewProduct(prev => ({ ...prev, Barcode: e.target.value }))}
                                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm px-2 py-1 text-sm font-mono text-[#fcd535] focus:border-[#fcd535] outline-none transition-all placeholder:text-[#5e6673]"
                                />
                            </td>
                            <td className="px-4 py-3">
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5e6673] text-xs">$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={newProduct.Price || ''}
                                        onChange={(e) => setNewProduct(prev => ({ ...prev, Price: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm pl-5 pr-2 py-1 text-sm font-bold text-[#0ecb81] focus:border-[#0ecb81] outline-none transition-all"
                                    />
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5e6673] text-xs">$</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={newProduct.Cost || ''}
                                        onChange={(e) => setNewProduct(prev => ({ ...prev, Cost: parseFloat(e.target.value) || 0 }))}
                                        className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm pl-5 pr-2 py-1 text-sm font-bold text-[#f6465d] focus:border-[#f6465d] outline-none transition-all"
                                    />
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <input
                                    type="text"
                                    placeholder={t.tags}
                                    value={newProduct.Tags}
                                    onChange={(e) => setNewProduct(prev => ({ ...prev, Tags: e.target.value }))}
                                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm px-2 py-1 text-xs text-[#848e9c] focus:border-[#fcd535] outline-none transition-all placeholder:text-[#5e6673]"
                                />
                            </td>
                            <td className="px-4 py-3 text-center">
                                <button
                                    onClick={handleAddNewProduct}
                                    disabled={isAddingNew || !newProduct.ProductName}
                                    className="px-4 py-1.5 bg-[#fcd535] text-black text-[10px] font-black uppercase rounded-sm hover:bg-[#f0c832] transition-all disabled:opacity-50"
                                >
                                    {isAddingNew ? <Spinner size="xs" /> : t.add_new}
                                </button>
                            </td>
                        </tr>

                        {filteredProducts.map((product, idx) => {
                            const isUpdating = updating === product.ProductName;
                            const changes = editData[product.ProductName] || {};
                            const hasChanges = Object.keys(changes).length > 0;

                            return (
                                <tr key={product.ProductName} className={`hover:bg-[#181a20] transition-colors group ${hasChanges ? 'bg-[#fcd535]/5' : ''}`}>
                                    <td className="px-4 py-3 text-xs font-bold text-[#5e6673] text-center">{idx + 1}</td>
                                    <td className="px-4 py-3">
                                        <div className="relative group/img w-10 h-10 bg-[#181a20] rounded-sm border border-[#2b3139] overflow-hidden">
                                            {product.ImageURL ? (
                                                <img 
                                                    src={convertGoogleDriveUrl(product.ImageURL)} 
                                                    alt="" 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[#2b3139]">
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                                </div>
                                            )}
                                            
                                            {/* Upload Overlay */}
                                            <div 
                                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                                                onClick={() => document.getElementById(`upload-${product.ProductName}`)?.click()}
                                            >
                                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                                            </div>
                                            <input 
                                                type="file" 
                                                id={`upload-${product.ProductName}`} 
                                                className="hidden" 
                                                accept="image/*"
                                                onChange={(e) => handleImageUpload(product, e)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-[#eaecef]">{product.ProductName}</span>
                                            {product.Tags && <span className="text-[10px] text-[#848e9c]">{product.Tags}</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            value={changes.Barcode !== undefined ? changes.Barcode : product.Barcode}
                                            onChange={(e) => handleFieldChange(product.ProductName, 'Barcode', e.target.value)}
                                            className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm px-2 py-1 text-sm font-mono text-[#fcd535] focus:border-[#fcd535] outline-none transition-all"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5e6673] text-xs">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={changes.Price !== undefined ? changes.Price : product.Price}
                                                onChange={(e) => handleFieldChange(product.ProductName, 'Price', parseFloat(e.target.value))}
                                                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm pl-5 pr-2 py-1 text-sm font-bold text-[#0ecb81] focus:border-[#0ecb81] outline-none transition-all"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#5e6673] text-xs">$</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={changes.Cost !== undefined ? changes.Cost : product.Cost}
                                                onChange={(e) => handleFieldChange(product.ProductName, 'Cost', parseFloat(e.target.value))}
                                                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm pl-5 pr-2 py-1 text-sm font-bold text-[#f6465d] focus:border-[#f6465d] outline-none transition-all"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <input
                                            type="text"
                                            value={changes.Tags !== undefined ? changes.Tags : product.Tags || ''}
                                            onChange={(e) => handleFieldChange(product.ProductName, 'Tags', e.target.value)}
                                            placeholder="tag1, tag2..."
                                            className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm px-2 py-1 text-xs text-[#848e9c] focus:border-[#fcd535] outline-none transition-all"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {hasChanges ? (
                                                <button
                                                    onClick={() => handleSaveRow(product)}
                                                    disabled={isUpdating}
                                                    className="p-2 bg-[#0ecb8120] text-[#0ecb81] rounded-sm hover:bg-[#0ecb81] hover:text-white transition-all"
                                                    title="Save changes"
                                                >
                                                    {isUpdating ? <Spinner size="xs" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleDeleteProduct(product)}
                                                    disabled={isUpdating}
                                                    className="p-2 text-[#5e6673] hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete product"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredProducts.length === 0 && (
                    <div className="py-20 text-center text-[#5e6673] font-bold">
                        រកមិនឃើញផលិតផលដែលអ្នកស្វែងរកទេ
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductManagementMatrix;
