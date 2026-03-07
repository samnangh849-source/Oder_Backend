
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder, Product, MasterProduct, ShippingMethod } from '../types';
import { WEB_APP_URL } from '../constants';
import { convertGoogleDriveUrl } from '../utils/fileUtils';

// Import New Utils & Services
import { formatForInput, recalculateTotals, generateAuditLog } from '../utils/orderLogic';
import { logUserActivity, logOrderEdit } from '../services/auditService';

// Import New Sub-Components
import EditCustomerPanel from '../components/orders/edit/EditCustomerPanel';
import EditProductPanel from '../components/orders/edit/EditProductPanel';
import EditOrderSummary from '../components/orders/edit/EditOrderSummary';
import BarcodeScannerModal from '../components/orders/BarcodeScannerModal';

interface EditOrderPageProps {
    order: ParsedOrder;
    onSaveSuccess: () => void;
    onCancel: () => void;
}

const EditOrderPage: React.FC<EditOrderPageProps> = ({ order, onSaveSuccess, onCancel }) => {
    const { appData, currentUser, previewImage, refreshData, advancedSettings } = useContext(AppContext);
    
    // Keep a reference to the original order for Audit comparison
    const originalOrderRef = useRef<ParsedOrder>(order);

    const [formData, setFormData] = useState<ParsedOrder>(order);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [bankLogo, setBankLogo] = useState<string>('');

    // Scanner State
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [scanMode, setScanMode] = useState<'single' | 'increment'>('increment');

    // Local state for dependent dropdowns
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedSangkat, setSelectedSangkat] = useState('');

    // Audit: Log when user opens the page
    useEffect(() => {
        if (currentUser) {
            // Security Check: Standard User Restrictions
            if (!currentUser.IsSystemAdmin) {
                // 1. Team Check
                const userTeams = (currentUser.Team || '').split(',').map(t => t.trim());
                if (!userTeams.includes(order.Team)) {
                    alert("អ្នកមិនមានសិទ្ធិកែប្រែការបញ្ជាទិញរបស់ក្រុមផ្សេងទេ (You cannot edit orders from other teams).");
                    onCancel();
                    return;
                }

                // 2. Dynamic Grace Period Check
                // Priority: 1. User Advanced Settings, 2. System Settings, 3. Default (12h)
                const systemGraceSetting = Array.isArray(appData.settings) 
                    ? appData.settings.find((s: any) => s.Key === 'OrderEditGracePeriod') 
                    : null;
                
                const systemGraceSeconds = parseInt(systemGraceSetting?.Value) || 43200;
                const userGraceSeconds = advancedSettings?.orderEditGracePeriod;
                
                // Use user setting if available, otherwise system setting. Always enforce 3s minimum.
                const finalGraceSeconds = Math.max(3, userGraceSeconds !== undefined ? userGraceSeconds : systemGraceSeconds);
                const graceMs = finalGraceSeconds * 1000;

                const orderTime = new Date(order.Timestamp).getTime();
                const timeDiff = Date.now() - orderTime;
                
                if (timeDiff > graceMs) {
                    const displayTime = finalGraceSeconds >= 3600 
                        ? `${(finalGraceSeconds / 3600).toFixed(1)} ម៉ោង` 
                        : (finalGraceSeconds >= 60 ? `${(finalGraceSeconds / 60).toFixed(1)} នាទី` : `${finalGraceSeconds} វិនាទី`);
                        
                    alert(`ការបញ្ជាទិញនេះលើសពី ${displayTime} ហើយ អ្នកមិនអាចកែប្រែបានទេ (Order edit window of ${displayTime} expired).`);
                    onCancel();
                    return;
                }
            }

            logUserActivity(
                currentUser.UserName, 
                'VIEW_EDIT_PAGE', 
                `Opened Order #${order['Order ID']} for editing`
            );
        }
    }, []);

    useEffect(() => {
        setFormData(order);
        originalOrderRef.current = order; // Update ref when prop changes
    }, [order]);

    useEffect(() => {
        if (formData['Payment Status'] === 'Paid' && formData['Payment Info']) {
             const bankInfo = appData.bankAccounts?.find((b: any) => b.BankName === formData['Payment Info']);
             if (bankInfo) setBankLogo(convertGoogleDriveUrl(bankInfo.LogoURL));
        }
    }, [formData['Payment Status'], formData['Payment Info'], appData.bankAccounts]);

    // --- Logic Handlers ---

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) return;
        
        // e.target.value is "YYYY-MM-DDTHH:mm" (Local Time from Input)
        // We simply append ":00" to make it compatible with our backend expectation
        // DO NOT use toISOString() as it converts to UTC (Z) which shifts the time.
        const localIsoString = `${e.target.value}:00`;
        
        setFormData(prev => ({ ...prev, Timestamp: localIsoString }));
    };

    const handleAddProduct = () => {
        setFormData(prev => {
            const newProduct: Product = { 
                id: Date.now() + Math.random(), // Ensure unique ID
                name: '', 
                quantity: 1, 
                originalPrice: 0, 
                finalPrice: 0, 
                total: 0, 
                discountPercent: 0, 
                colorInfo: '', 
                image: '', 
                cost: 0, 
                tags: '' 
            };
            const updatedProducts = [...prev.Products, newProduct];
            const currentShipping = parseFloat(String(prev['Shipping Fee (Customer)'])) || 0;
            const newTotals = recalculateTotals(updatedProducts, currentShipping);
            
            return { 
                ...prev, 
                Products: updatedProducts,
                ...newTotals
            };
        });
    };

    const handleRemoveProduct = (idx: number) => {
        if (formData.Products.length <= 1) { 
            alert("មិនអាចលុបផលិតផលចុងក្រោយបានទេ (Cannot remove last item)"); 
            return; 
        }
        setFormData(prev => {
            const newProducts = prev.Products.filter((_, i) => i !== idx);
            const currentShipping = Number(prev['Shipping Fee (Customer)']) || 0;
            const newTotals = recalculateTotals(newProducts, currentShipping);
            return { ...prev, Products: newProducts, ...newTotals };
        });
    };

    const handleCodeScanned = (scannedCode: string) => {
        const masterProduct = appData.products.find((p: MasterProduct) => p.Barcode && p.Barcode.trim() === scannedCode.trim());
        
        if (masterProduct) {
            setFormData(prev => {
                const newProducts = [...prev.Products];
                const existingIndex = newProducts.findIndex(p => p.name === masterProduct.ProductName);
                
                if (existingIndex > -1) {
                    // Update existing
                    if (scanMode === 'increment') {
                        const productToUpdate = { ...newProducts[existingIndex] };
                        productToUpdate.quantity = (Number(productToUpdate.quantity) || 0) + 1;
                        productToUpdate.total = (productToUpdate.quantity) * (Number(productToUpdate.finalPrice) || 0);
                        newProducts[existingIndex] = productToUpdate;
                    }
                } else {
                    // Add new
                    const newProduct: Product = {
                        id: Date.now(),
                        name: masterProduct.ProductName,
                        quantity: 1,
                        originalPrice: masterProduct.Price,
                        finalPrice: masterProduct.Price,
                        total: masterProduct.Price,
                        discountPercent: 0,
                        colorInfo: '',
                        image: masterProduct.ImageURL,
                        cost: masterProduct.Cost,
                        tags: masterProduct.Tags
                    };
                    newProducts.push(newProduct);
                }
                
                const currentShippingFee = parseFloat(String(prev['Shipping Fee (Customer)'])) || 0;
                const newTotals = recalculateTotals(newProducts, currentShippingFee);
                return { ...prev, Products: newProducts, ...newTotals };
            });
            
            if (scanMode === 'single') setIsScannerVisible(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            let processedValue: any = value;
            if (name === 'Customer Phone') {
                processedValue = value.replace(/[^0-9]/g, '');
                if (processedValue.length > 0 && !processedValue.startsWith('0')) processedValue = '0' + processedValue;
            } else if (name === 'Shipping Fee (Customer)' || name === 'Internal Cost') {
                if (value === '' || value.endsWith('.')) processedValue = value;
                else processedValue = Math.max(0, parseFloat(value) || 0);
            }

            const updatedState = { ...prev, [name]: processedValue };

            if (name === 'Shipping Fee (Customer)') {
                const numericFee = parseFloat(String(processedValue)) || 0;
                const newTotals = recalculateTotals(updatedState.Products, numericFee);
                return { ...updatedState, ...newTotals };
            }
            if (name === 'Payment Status' && processedValue === 'Unpaid') { 
                updatedState['Payment Info'] = ''; 
                setBankLogo(''); 
            }
            return updatedState;
        });
    };

    const handleProductChange = (index: number, field: keyof Product, value: any, extraTags?: string) => {
        setFormData(prev => {
            const newProducts = [...prev.Products];
            const productToUpdate = { ...newProducts[index] };
            
            if (field === 'name') {
                productToUpdate.name = value;
                const masterProduct = appData.products.find((p: MasterProduct) => p.ProductName === value);
                
                if (masterProduct) {
                    productToUpdate.originalPrice = masterProduct.Price;
                    productToUpdate.finalPrice = masterProduct.Price;
                    productToUpdate.cost = masterProduct.Cost;
                    productToUpdate.image = masterProduct.ImageURL;
                    productToUpdate.tags = extraTags !== undefined ? extraTags : masterProduct.Tags;
                } else {
                    productToUpdate.originalPrice = 0;
                    productToUpdate.finalPrice = 0;
                    productToUpdate.cost = 0;
                    productToUpdate.image = '';
                    productToUpdate.tags = '';
                }
            } else if (field === 'finalPrice' || field === 'quantity') {
                if (value === '' || String(value).endsWith('.')) {
                    // @ts-ignore
                    productToUpdate[field] = value;
                } else {
                    // @ts-ignore
                    productToUpdate[field] = Math.max(field === 'quantity' ? 1 : 0, parseFloat(value) || 0);
                }
            } else {
                // @ts-ignore
                productToUpdate[field] = value;
            }
            
            // Recalculate Row Total
            const q = parseFloat(String(productToUpdate.quantity)) || 0;
            const p = parseFloat(String(productToUpdate.finalPrice)) || 0;
            productToUpdate.total = q * p;
            
            newProducts[index] = productToUpdate;
            const currentShippingFee = parseFloat(String(prev['Shipping Fee (Customer)'])) || 0;
            const newTotals = recalculateTotals(newProducts, currentShippingFee);
            return { ...prev, Products: newProducts, ...newTotals };
        });
    };

    const handleDelete = async () => {
        if (!window.confirm(`តើអ្នកពិតជាចង់លុបប្រតិបត្តិការណ៍ ID: ${formData['Order ID']} មែនទេ?`)) return;
        if (!currentUser) return;
        
        const loggingUser = currentUser.UserName || 'Unknown User';

        try {
            const response = await fetch(`${WEB_APP_URL}/api/admin/delete-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    orderId: formData['Order ID'], 
                    team: formData.Team, 
                    userName: loggingUser,
                    telegramMessageId1: formData['Telegram Message ID 1'],
                    telegramMessageId2: formData['Telegram Message ID 2'],
                    telegramChatId: formData.TelegramValue
                })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Delete failed');
            
            // Audit: Log deletion
            await logUserActivity(loggingUser, 'DELETE_ORDER', `Deleted Order #${formData['Order ID']}`);

            await refreshData();
            onSaveSuccess();
        } catch (err: any) { setError(`លុបមិនបានសម្រេច: ${err.message}`); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        
        if (!formData.Products.every(p => p.name && parseFloat(String(p.quantity)) > 0)) {
            setError("សូមពិនិត្យព័ត៌មានផលិតផល (ឈ្មោះ និងចំនួន)។");
            setLoading(false);
            return;
        }

        const currentMethod = appData.shippingMethods?.find(m => m.MethodName === formData['Internal Shipping Method']);
        if (currentMethod?.RequireDriverSelection && !formData['Internal Shipping Details']) {
             setError("សូមជ្រើសរើសអ្នកដឹក (Driver) សម្រាប់សេវាកម្មនេះ។");
             setLoading(false);
             return;
        }

        const loggingUser = currentUser?.UserName || 'Unknown User';

        try {
            const finalShippingFee = parseFloat(String(formData['Shipping Fee (Customer)'])) || 0;
            const finalTotals = recalculateTotals(formData.Products, finalShippingFee);
            
            const cleanNewData: any = {
                ...formData,
                "Shipping Fee (Customer)": finalShippingFee,
                "Subtotal": finalTotals.Subtotal,
                "Grand Total": finalTotals['Grand Total'],
                "Internal Cost": parseFloat(String(formData['Internal Cost'])) || 0,
                "Discount ($)": finalTotals['Discount ($)'],
                "Total Product Cost ($)": finalTotals['Total Product Cost ($)'],
                "IsVerified": !!formData.IsVerified
            };
                        // Clean products array for internal calculations
            const productsWithSubtotals = formData.Products.map(p => ({
                ...p,
                quantity: parseFloat(String(p.quantity)) || 0,
                finalPrice: parseFloat(String(p.finalPrice)) || 0,
                total: (parseFloat(String(p.quantity)) || 0) * (parseFloat(String(p.finalPrice)) || 0)
            }));
            // --- OPTIMIZED UPDATE LOGIC START ---
            // 1. Only include keys that actually changed to reduce payload and DB overhead
            // 2. Ensure NO null values are sent (convert to "" or 0 for PostgreSQL compatibility)
            // 3. Map keys to snake_case for Backend (Go/PostgreSQL) consistency
            const changedData: any = {};
            const original = originalOrderRef.current;
            
            // Map Frontend Keys to Backend Column Names (snake_case)
            const fieldMap: Record<string, string> = {
                'Customer Name': 'customer_name',
                'Customer Phone': 'customer_phone',
                'Location': 'location',
                'Address Details': 'address_details',
                'Internal Shipping Method': 'internal_shipping_method',
                'Internal Shipping Details': 'internal_shipping_details',
                'Note': 'note',
                'Payment Status': 'payment_status',
                'Payment Info': 'payment_info',
                'Shipping Fee (Customer)': 'shipping_fee_customer',
                'Internal Cost': 'internal_cost',
                'Timestamp': 'timestamp',
                'IsVerified': 'is_verified',
                'Page': 'page',
                'Team': 'team',
                'Fulfillment Store': 'fulfillment_store'
            };

            Object.entries(fieldMap).forEach(([frontendKey, backendKey]) => {
                const currentVal = formData[frontendKey as keyof ParsedOrder];
                const originalVal = original[frontendKey as keyof ParsedOrder];

                // Robust comparison (trim strings, handle nulls)
                const isString = typeof currentVal === 'string';
                const hasChanged = isString 
                    ? String(currentVal || '').trim() !== String(originalVal || '').trim()
                    : currentVal !== originalVal;

                if (hasChanged) {
                    if (currentVal === null || currentVal === undefined) {
                        changedData[backendKey] = typeof originalVal === 'number' ? 0 : "";
                    } else {
                        changedData[backendKey] = currentVal;
                    }
                }
            });

            // Always check products separately as they are stringified in DB
            const newProductsJson = JSON.stringify(productsWithSubtotals);
            const oldProductsJson = JSON.stringify(original.Products);
            
            if (newProductsJson !== oldProductsJson) {
                changedData['products_json'] = newProductsJson;
                changedData["subtotal"] = finalTotals.Subtotal;
                changedData["grand_total"] = finalTotals['Grand Total'];
                changedData["discount_usd"] = finalTotals['Discount ($)'];
                changedData["total_product_cost_usd"] = finalTotals['Total Product Cost ($)'];
            }

            // If nothing changed, just close
            if (Object.keys(changedData).length === 0) {
                onSaveSuccess();
                return;
            }
            // --- OPTIMIZED UPDATE LOGIC END ---

            // --- AUDIT LOGIC START ---
            const changes = generateAuditLog(original, formData);
            if (changes && changes.length > 0) {
                await Promise.all(changes.map(change => 
                    logOrderEdit(
                        formData['Order ID'], 
                        loggingUser, 
                        change.field, 
                        change.oldValue, 
                        change.newValue
                    )
                ));
            }
            // --- AUDIT LOGIC END ---

            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    orderId: formData['Order ID'], 
                    team: formData.Team, 
                    userName: loggingUser,
                    newData: changedData // Send ONLY changed fields
                }) 
            });
            
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Update failed');
            
            // *** NEW: Explicit Activity Log for Updates to avoid 'System' user in generic activity logs ***
            await logUserActivity(
                loggingUser,
                'UPDATE_ORDER',
                `Updated Order #${formData['Order ID']}`
            );

            await refreshData();
            onSaveSuccess();
        } catch (err: any) { setError(`រក្សាទុកមិនបានសម្រេច: ${err.message}`); } finally { setLoading(false); }
    };

    return (
        // Main Container - Fixed Layout
        <div className="w-full h-full lg:h-[calc(100vh-40px)] flex flex-col animate-fade-in lg:overflow-hidden">
            {/* Scanner Modal */}
            {isScannerVisible && (
                <BarcodeScannerModal 
                    onClose={() => setIsScannerVisible(false)}
                    onCodeScanned={handleCodeScanned}
                    scanMode={scanMode}
                    setScanMode={setScanMode}
                    productsInOrder={formData.Products as any} 
                    masterProducts={appData.products}
                />
            )}

            {/* Top Bar */}
            <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4 px-1 lg:px-4 pt-2">
                <div>
                    <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                        Edit Order
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">#{formData['Order ID']}</span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">{formData.Team}</span>
                        {/* Date Picker */}
                        <div className="flex items-center gap-1 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                            <label htmlFor="order-date" className="text-[10px] font-black text-gray-600 uppercase cursor-pointer">Date</label>
                            <input 
                                id="order-date"
                                type="datetime-local"
                                value={formatForInput(formData.Timestamp)}
                                onChange={handleDateChange}
                                disabled={!currentUser?.IsSystemAdmin}
                                className={`bg-transparent border-none text-[10px] font-bold text-blue-400 p-0 focus:ring-0 h-4 ${!currentUser?.IsSystemAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                    </div>
                </div>
                <button onClick={onCancel} className="px-6 py-2.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-400 font-black rounded-xl uppercase text-[10px] tracking-widest transition-all">បោះបង់</button>
            </div>

            {error && (
                <div className="flex-shrink-0 mb-4 mx-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 animate-shake">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2"/></svg>
                    <span className="font-bold text-xs">{error}</span>
                </div>
            )}

            {/* Split Content Area */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden px-1 lg:px-4 pb-4">
                
                {/* Left: Customer & Logistics */}
                <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 h-full overflow-hidden">
                    <EditCustomerPanel 
                        formData={formData}
                        appData={appData}
                        onChange={handleInputChange}
                        onPageSelect={(val) => {
                            const selectedPage = appData.pages?.find(p => p.PageName === val);
                            setFormData(prev => ({ 
                                ...prev, 
                                Page: val, 
                                TelegramValue: selectedPage?.TelegramValue || prev.TelegramValue,
                                'Fulfillment Store': selectedPage?.DefaultStore || prev['Fulfillment Store']
                            }));
                        }}
                        onProvinceSelect={(val) => {
                            setFormData(prev => ({ ...prev, Location: val }));
                            setSelectedDistrict(''); setSelectedSangkat('');
                        }}
                        onDistrictChange={(val) => { setSelectedDistrict(val); setSelectedSangkat(''); }}
                        onSangkatChange={setSelectedSangkat}
                        onShippingMethodSelect={(method: ShippingMethod) => setFormData(prev => ({ 
                            ...prev, 
                            'Internal Shipping Method': method.MethodName,
                            'Internal Shipping Details': method.RequireDriverSelection ? '' : method.MethodName
                        }))}
                        onDriverSelect={(val) => setFormData(prev => ({ ...prev, 'Internal Shipping Details': val }))}
                        onBankChange={(e) => {
                            const val = e.target.value;
                            setFormData(prev => ({ ...prev, 'Payment Info': val }));
                            const b = appData.bankAccounts?.find((bank: any) => bank.BankName === val);
                            setBankLogo(b ? convertGoogleDriveUrl(b.LogoURL) : '');
                        }}
                        selectedDistrict={selectedDistrict}
                        selectedSangkat={selectedSangkat}
                        bankLogo={bankLogo}
                    />
                </div>

                {/* Right: Products & Summary */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden h-full">
                    <EditProductPanel 
                        products={formData.Products}
                        masterProducts={appData.products}
                        onProductChange={handleProductChange}
                        onAddProduct={handleAddProduct}
                        onRemoveProduct={handleRemoveProduct}
                        onPreviewImage={previewImage}
                        onScanBarcode={() => setIsScannerVisible(true)}
                    />
                    
                    <EditOrderSummary 
                        subtotal={Number(formData.Subtotal) || 0}
                        grandTotal={Number(formData['Grand Total']) || 0}
                        shippingFee={formData['Shipping Fee (Customer)']}
                        onShippingFeeChange={handleInputChange}
                        onSave={handleSubmit}
                        onDelete={handleDelete}
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    );
};

export default EditOrderPage;
