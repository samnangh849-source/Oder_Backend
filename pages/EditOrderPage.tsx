
import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder, Product, MasterProduct, ShippingMethod } from '../types';
import { WEB_APP_URL } from '../constants';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { CacheService, CACHE_KEYS } from '../services/cacheService';

// Import New Utils & Services
import { formatForInput, recalculateTotals, generateAuditLog } from '../utils/orderLogic';
import { logUserActivity, logOrderEdit } from '../services/auditService';
import { compressImage } from '../utils/imageCompressor';
import { fileToDataUrl } from '../utils/fileUtils';

// Import New Sub-Components
import EditCustomerPanel from '../components/orders/edit/EditCustomerPanel';
import EditLogisticsPanel from '../components/orders/edit/EditLogisticsPanel';
import EditProductPanel from '../components/orders/edit/EditProductPanel';
import EditOrderSummary from '../components/orders/edit/EditOrderSummary';
import BarcodeScannerModal from '../components/orders/BarcodeScannerModal';
import OrderActionModal from '../components/orders/OrderActionModal';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';

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
    const [orderDiscount, setOrderDiscount] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [bankLogo, setBankLogo] = useState<string>('');
    const [copySuccess, setCopySuccess] = useState(false);

    // Action Modal State
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionModalType, setActionModalType] = useState<'cancel' | 'return'>('cancel');
    const [pendingReason, setPendingReason] = useState('');

    // Return Photo State
    const [isReturnPhotoModalOpen, setIsReturnPhotoModalOpen] = useState(false);
    const [returnPhoto, setReturnPhoto] = useState<string | null>(null);
    const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
    const [returnActionType, setReturnActionType] = useState<'to_returned' | 'to_pending'>('to_returned');

    // Scanner State
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [scanMode, setScanMode] = useState<'single' | 'increment'>('increment');

    // Local state for dependent dropdowns
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedSangkat, setSelectedSangkat] = useState('');

    // Audit: Log when user opens the page
    useEffect(() => {
        if (currentUser) {
            // Initialize orderDiscount by calculating the difference between total discount and product discounts
            const productDiscounts = order.Products.reduce((sum, p) => sum + ((p.originalPrice - (p.finalPrice || 0)) * (p.quantity || 0)), 0);
            const initialOrderDiscount = Math.max(0, (Number(order['Discount ($)']) || 0) - productDiscounts);
            setOrderDiscount(initialOrderDiscount);

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
        
        // Also re-initialize orderDiscount when order prop changes
        const productDiscounts = order.Products.reduce((sum, p) => sum + ((p.originalPrice - (p.finalPrice || 0)) * (p.quantity || 0)), 0);
        const initialOrderDiscount = Math.max(0, (Number(order['Discount ($)']) || 0) - productDiscounts);
        setOrderDiscount(initialOrderDiscount);
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
            const newTotals = recalculateTotals(updatedProducts, currentShipping, orderDiscount);
            
            return { 
                ...prev, 
                Products: updatedProducts,
                ...newTotals
            };
        });
    };

    const handleAddMasterProduct = (master: MasterProduct) => {
        setFormData(prev => {
            const newProduct: Product = {
                id: Date.now() + Math.random(),
                name: master.ProductName,
                quantity: 1,
                originalPrice: master.Price,
                finalPrice: master.Price,
                total: master.Price,
                discountPercent: 0,
                colorInfo: '',
                image: master.ImageURL,
                cost: master.Cost,
                tags: master.Tags
            };
            const updatedProducts = [...prev.Products, newProduct];
            const currentShipping = parseFloat(String(prev['Shipping Fee (Customer)'])) || 0;
            const newTotals = recalculateTotals(updatedProducts, currentShipping, orderDiscount);
            
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
            const newTotals = recalculateTotals(newProducts, currentShipping, orderDiscount);
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
                const newTotals = recalculateTotals(newProducts, currentShippingFee, orderDiscount);
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
                const newTotals = recalculateTotals(updatedState.Products, numericFee, orderDiscount);
                return { ...updatedState, ...newTotals };
            }
            if (name === 'Payment Status' && processedValue === 'Unpaid') { 
                updatedState['Payment Info'] = ''; 
                setBankLogo(''); 
            }
            return updatedState;
        });
    };

    const handleOrderDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        let numericDiscount = 0;
        if (value !== '' && !value.endsWith('.')) {
            numericDiscount = Math.max(0, parseFloat(value) || 0);
        }
        
        setOrderDiscount(numericDiscount);
        setFormData(prev => {
            const currentShippingFee = parseFloat(String(prev['Shipping Fee (Customer)'])) || 0;
            const newTotals = recalculateTotals(prev.Products, currentShippingFee, numericDiscount);
            return { ...prev, ...newTotals };
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
            } else if (field === 'finalPrice' || field === 'quantity' || field === 'originalPrice') {
                if (value === '' || String(value).endsWith('.')) {
                    // @ts-ignore
                    productToUpdate[field] = value;
                } else {
                    const numericValue = Math.max(field === 'quantity' ? 1 : 0, parseFloat(value) || 0);
                    // @ts-ignore
                    productToUpdate[field] = numericValue;
                    
                    // SYNC Logic: If Base Price changes, we update finalPrice too 
                    // so that the Subtotal reflects the new price immediately.
                    if (field === 'originalPrice') {
                        productToUpdate.finalPrice = numericValue;
                    }
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
            const newTotals = recalculateTotals(newProducts, currentShippingFee, orderDiscount);
            return { ...prev, Products: newProducts, ...newTotals };
        });
    };

    const handleDelete = async () => {
        if (!window.confirm(`តើអ្នកពិតជាចង់លុបប្រតិបត្តិការណ៍ ID: ${formData['Order ID']} មែនទេ?`)) return;
        if (!currentUser) return;
        
        const loggingUser = currentUser.UserName || 'Unknown User';

        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${WEB_APP_URL}/api/admin/delete-order`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    orderId: formData['Order ID'], 
                    team: formData.Team, 
                    userName: loggingUser,
                    fulfillmentStore: formData['Fulfillment Store'],
                    telegramMessageId1: formData['Telegram Message ID 1'],
                    telegramMessageId2: formData['Telegram Message ID 2'],
                    telegramMessageId3: formData['Telegram Message ID 3'],
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

    const handleCancelOrderClick = () => {
        const isShipped = formData.FulfillmentStatus === 'Shipped' || formData.FulfillmentStatus === 'Delivered';
        setActionModalType(isShipped ? 'return' : 'cancel');
        setIsActionModalOpen(true);
    };

    const handleConfirmAction = async (reason: string) => {
        setIsActionModalOpen(false);
        const isReturn = actionModalType === 'return';
        
        setLoading(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const newData: any = isReturn ? {
                'Fulfillment Status': 'Returned',
                'Return Reason': reason,
            } : {
                'Fulfillment Status': 'Cancelled',
                'Cancel Reason': reason
            };

            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    orderId: formData['Order ID'], 
                    team: formData.Team, 
                    userName: currentUser?.FullName || 'System',
                    newData
                })
            });
            const result = await response.json();
            if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Action failed');
            
            const actionKey = isReturn ? 'RETURN_ORDER' : 'CANCEL_ORDER';
            const actionLabel = isReturn ? 'Returned (Requested)' : 'Cancelled';
            await logUserActivity(currentUser?.UserName || 'Unknown', actionKey, `${actionLabel} Order #${formData['Order ID']} with reason: ${reason}`);

            await refreshData();
            onSaveSuccess();
        } catch (err: any) {
            setError(`${actionModalType === 'return' ? 'Return' : 'Cancel'} មិនបានសម្រេច: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUnReturn = async () => {
        let suggestedStatus = 'Pending';
        if (formData['Delivered Time'] && String(formData['Delivered Time']).trim() !== '') {
            suggestedStatus = 'Delivered';
        } else if (formData['Dispatched Time'] && String(formData['Dispatched Time']).trim() !== '') {
            suggestedStatus = 'Shipped';
        } else if (formData['Packed Time'] && String(formData['Packed Time']).trim() !== '') {
            suggestedStatus = 'Ready to Ship';
        }

        if (!window.confirm(`តើអ្នកពិតជាចង់លុបចោលការ Return និងប្តូរទៅស្ថានភាព ${suggestedStatus} វិញមែនទេ?`)) return;
        
        setLoading(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            if (!token) throw new Error("Session expired");

            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    orderId: formData['Order ID'],
                    team: formData.Team,
                    newData: {
                        'Fulfillment Status': suggestedStatus,
                        'Return Reason': '',
                        'Return Photo': '',
                        'Return Received By': '',
                        'Return Received Time': ''
                    }
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Failed to update order");
            }

            await logUserActivity(currentUser?.UserName || 'Unknown', 'UNRETURN_ORDER', `Un-Returned Order #${formData['Order ID']} to ${suggestedStatus}`);
            
            await refreshData();
            onSaveSuccess();
        } catch (err: any) {
            setError(`Un-Return មិនបានសម្រេច: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReturnPhoto = async (photo: string) => {
        setIsSubmittingReturn(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            if (!token) throw new Error("Session expired");

            // 1. GET ONE-TIME UPLOAD TOKEN FROM BACKEND
            const tokenRes = await fetch(`${WEB_APP_URL}/api/admin/generate-upload-token?orderId=${formData['Order ID']}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.token) throw new Error("Failed to get upload token");

            // 2. PREPARE METADATA
            const additionalData: any = { 
                'Fulfillment Status': 'Returned',
                'Return Received By': currentUser?.FullName || 'Admin',
                'Return Received Time': new Date().toISOString().slice(0, 19).replace('T', ' '),
                'Return Reason': pendingReason
            };

            // 3. DIRECT UPLOAD TO APPS SCRIPT (Bypass Server Render)
            const APPS_SCRIPT_URL = appData.settings?.find((s: any) => s.Key === 'APPS_SCRIPT_URL')?.Value;
            const APPS_SCRIPT_SECRET = appData.settings?.find((s: any) => s.Key === 'APPS_SCRIPT_SECRET')?.Value;

            if (!APPS_SCRIPT_URL) throw new Error("Apps Script URL not configured");

            await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Important for Apps Script cross-origin
                body: JSON.stringify({
                    action: "uploadImage",
                    secret: APPS_SCRIPT_SECRET,
                    token: tokenData.token, // Secure One-Time Token
                    orderId: formData['Order ID'],
                    team: formData.Team,
                    userName: currentUser?.UserName || 'System',
                    fileData: photo, // Base64
                    fileName: `return_${formData['Order ID']}_${Date.now()}`,
                    mimeType: "image/webp",
                    targetColumn: "Return Photo",
                    newData: additionalData
                })
            });

            await logUserActivity(currentUser?.UserName || 'Unknown', 'RETURN_ORDER', `Returned Order #${formData['Order ID']} (Direct Upload)`);

            setIsReturnPhotoModalOpen(false);
            setReturnPhoto(null);
            
            // Give Apps Script time to finish writing to Drive & Sheet
            setTimeout(async () => {
                await refreshData();
                onSaveSuccess();
                setIsSubmittingReturn(false);
            }, 3000);

        } catch (err: any) {
            setError(`Confirm Return មិនបានសម្រេច: ${err.message}`);
            setIsSubmittingReturn(false);
        }
    };

    const handleConfirmReturnClick = () => {
        setReturnActionType('to_returned');
        setPendingReason(formData['Return Reason'] || '');
        setIsReturnPhotoModalOpen(true);
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
            // 1. Only include keys that actually changed
            // 2. Align keys with Backend's mapToDBColumn (e.g., "Location", "Customer Name")
            // 3. Ensure NO null values (convert to "" or 0)
            const changedData: any = {};
            const original = originalOrderRef.current;
            
            // List of keys Backend expects via mapToDBColumn
            const keysToCheck = [
                "Customer Name", "Customer Phone", "Location", "Address Details",
                "Internal Shipping Method", "Internal Shipping Details", "Note",
                "Payment Status", "Payment Info", "Shipping Fee (Customer)", "Internal Cost",
                "Timestamp", "IsVerified", "Page", "Team", "Fulfillment Store",
                "Subtotal", "Grand Total", "Discount ($)", "Total Product Cost ($)"
            ];

            keysToCheck.forEach(key => {
                const currentVal = formData[key as keyof ParsedOrder];
                const originalVal = original[key as keyof ParsedOrder];

                // Comparison logic
                const isString = typeof currentVal === 'string';
                const hasChanged = isString 
                    ? String(currentVal || '').trim() !== String(originalVal || '').trim()
                    : currentVal !== originalVal;

                if (hasChanged) {
                    // Force no-null (PostgreSQL Compatibility)
                    if (currentVal === null || currentVal === undefined) {
                        changedData[key] = typeof originalVal === 'number' ? 0 : "";
                    } else {
                        changedData[key] = currentVal;
                    }
                }
            });

            // Handle Products separately
            const newProductsJson = JSON.stringify(productsWithSubtotals);
            const oldProductsJson = JSON.stringify(original.Products);
            
            if (newProductsJson !== oldProductsJson) {
                changedData["Products (JSON)"] = newProductsJson;
                changedData["Subtotal"] = finalTotals.Subtotal;
                changedData["Grand Total"] = finalTotals['Grand Total'];
                changedData["Discount ($)"] = finalTotals['Discount ($)'];
                changedData["Total Product Cost ($)"] = finalTotals['Total Product Cost ($)'];
            }

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

            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${WEB_APP_URL}/api/admin/update-order`, { 
                method: 'POST', 
                headers, 
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
        <div className="w-full h-full flex flex-col animate-fade-in bg-[#0B0E11] overflow-hidden">
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
            <div className="flex-shrink-0 bg-[#1E2329] border-b border-[#2B3139] px-3 sm:px-6 py-3 lg:py-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6 z-[60] shadow-xl relative">
                <div className="flex flex-col items-start gap-3 lg:gap-5 w-full lg:w-auto">
                    {/* Header Row: Back Button & Title */}
                    <div className="flex items-center gap-3 w-full">
                        <button 
                            onClick={onCancel} 
                            className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#0B0E11] border border-[#2B3139] flex items-center justify-center hover:bg-[#2B3139] hover:text-[#FCD535] transition-all text-[#848E9C] shadow-inner"
                            title="Go back"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        
                        <div className="flex items-center gap-3 min-w-0">
                            <h1 className="text-lg lg:text-xl font-black text-[#EAECEF] uppercase tracking-tighter truncate">Edit Order</h1>
                            <span className="px-2 py-0.5 rounded-lg bg-[#FCD535]/10 border border-[#FCD535]/20 text-[#FCD535] text-[9px] font-black uppercase tracking-widest flex-shrink-0">
                                {formData.Team}
                            </span>
                        </div>
                    </div>
                    
                    {/* Standard Mobile Meta Layout: Grid for UID/Dist, Full-width for Time */}
                    <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 w-full">
                        {/* Row 1: UID & Distribution (Balanced Grid on Mobile) */}
                        <div className="grid grid-cols-2 gap-2 w-full lg:flex lg:w-auto">
                            {/* Order ID Badge - Click to Copy */}
                            <div 
                                onClick={() => {
                                    navigator.clipboard.writeText(formData['Order ID']);
                                    setCopySuccess(true);
                                    setTimeout(() => setCopySuccess(false), 2000);
                                }}
                                className="relative flex items-center gap-2.5 px-3 py-1.5 bg-[#0B0E11] border-2 border-[#2B3139] rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] cursor-pointer hover:border-[#FCD535] group/uid transition-all h-12 lg:h-13 w-full lg:w-auto"
                                title="Click to copy full ID"
                            >
                                <div className="flex-shrink-0 w-7 h-7 rounded-none bg-[#474D57]/10 flex items-center justify-center border border-[#474D57]/20 group-hover/uid:bg-[#FCD535]/10 group-hover/uid:border-[#FCD535]/30 transition-all">
                                    <svg className="w-3.5 h-3.5 text-[#474D57] group-hover/uid:text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </div>
                                <div className="flex flex-col leading-none min-w-0">
                                    <span className="text-[8px] font-black text-[#474D57] group-hover/uid:text-[#FCD535] uppercase tracking-[0.1em] transition-colors">Order UID</span>
                                    <span className="text-[10px] font-mono font-black text-[#848E9C] group-hover/uid:text-[#EAECEF] transition-colors mt-0.5 truncate">#{formData['Order ID'].substring(0, 8)}</span>
                                </div>
                                
                                {copySuccess && (
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#0ECB81] text-[#181A20] text-[10px] font-black py-1 px-2.5 rounded-none shadow-[4px_4px_0px_0px_rgba(14,203,129,0.2)] animate-bounce whitespace-nowrap z-50 flex items-center gap-1.5 border-2 border-[#181A20]">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
                                        COPIED
                                    </div>
                                )}
                            </div>

                            {/* Fulfillment Warehouse Chip */}
                            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#0B0E11] border-2 border-[#2B3139] rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] h-12 lg:h-13 w-full lg:w-auto">
                                <div className="flex-shrink-0 w-7 h-7 rounded-none bg-[#FCD535]/10 flex items-center justify-center border border-[#FCD535]/20">
                                    <svg className="w-3.5 h-3.5 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                </div>
                                <div className="flex flex-col leading-none min-w-0">
                                    <span className="text-[8px] font-black text-[#474D57] uppercase tracking-[0.1em]">Distribution</span>
                                    <span className="text-[10px] font-black text-[#EAECEF] uppercase tracking-tight mt-0.5 truncate">{formData['Fulfillment Store'] || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Order Timestamp (Full-width on Mobile) */}
                        <div className={`flex items-center gap-3 px-3.5 py-1.5 bg-[#0B0E11] border-2 border-[#2B3139] rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] group ${!currentUser?.IsSystemAdmin ? 'opacity-70' : 'hover:border-[#FCD535]/40'} transition-all h-12 lg:h-13 w-full lg:w-auto`}>
                            <div className={`flex-shrink-0 w-7 h-7 rounded-none flex items-center justify-center border transition-colors ${!currentUser?.IsSystemAdmin ? 'bg-[#2B3139]/20 border-[#2B3139]' : 'bg-[#848E9C]/10 border-[#848E9C]/20 group-hover:bg-[#FCD535]/10 group-hover:border-[#FCD535]/20'}`}>
                                <svg className={`w-3.5 h-3.5 transition-colors ${!currentUser?.IsSystemAdmin ? 'text-[#474D57]' : 'text-[#848E9C] group-hover:text-[#FCD535]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div className="flex flex-col leading-none flex-grow">
                                <label htmlFor="order-date" className="text-[8px] font-black text-[#474D57] uppercase tracking-[0.1em] cursor-pointer">Log Timestamp</label>
                                <input 
                                    id="order-date"
                                    type="datetime-local"
                                    value={formatForInput(formData.Timestamp)}
                                    onChange={handleDateChange}
                                    disabled={!currentUser?.IsSystemAdmin}
                                    className={`bg-transparent border-none text-[10px] font-black text-[#EAECEF] p-0 focus:ring-0 h-5 w-full mt-0.5 ${!currentUser?.IsSystemAdmin ? 'cursor-not-allowed' : 'hover:text-[#FCD535] cursor-pointer'} tabular-nums text-left`}
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="hidden lg:flex gap-2.5 lg:w-auto mt-2 lg:mt-0">
                    <button onClick={onCancel} className="flex-1 lg:flex-none px-4 lg:px-6 py-2.5 bg-[#2B3139] hover:bg-[#363C44] text-[#EAECEF] text-xs font-bold rounded-xl transition-all border border-transparent hover:border-[#848E9C] flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" strokeLinecap="round" /></svg>
                        <span className="lg:inline">Discard</span>
                    </button>
                    <button onClick={handleSubmit} disabled={loading} className="flex-[2] lg:flex-none px-6 lg:px-10 py-2.5 bg-[#FCD535] hover:bg-[#F0B90B] text-[#181A20] text-xs font-bold rounded-xl shadow-lg shadow-[#FCD535]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wider">
                        {loading ? 'Saving...' : (
                            <>
                                <span className="hidden sm:inline">Update Order</span>
                                <span className="sm:hidden">Save Changes</span>
                            </>
                        )}
                        {!loading && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex-shrink-0 mb-2 mx-3 lg:mx-4 mt-2 p-3 bg-[#F6465D]/10 border border-[#F6465D]/20 rounded-lg text-[#F6465D] flex items-center gap-3 animate-shake">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth="2"/></svg>
                    <span className="font-bold text-[11px] lg:text-xs">{error}</span>
                </div>
            )}

            {/* Main Content Area - 3-Tier Layout */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-3 lg:p-4 flex flex-col gap-3 lg:gap-4 min-h-full max-w-[1600px] mx-auto w-full">
                    
                    {/* Tier 1: Customer & Logistics (Side-by-side) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-7 xl:col-span-8">
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
                                selectedDistrict={selectedDistrict}
                                selectedSangkat={selectedSangkat}
                            />
                        </div>
                        <div className="lg:col-span-5 xl:col-span-4">
                            <EditLogisticsPanel 
                                formData={formData}
                                appData={appData}
                                onChange={handleInputChange}
                                onShippingMethodSelect={(method: ShippingMethod) => setFormData(prev => ({ 
                                    ...prev, 
                                    'Internal Shipping Method': method.MethodName,
                                    'Internal Shipping Details': method.RequireDriverSelection ? '' : ''
                                }))}
                                onDriverSelect={(val) => setFormData(prev => ({ ...prev, 'Internal Shipping Details': val }))}
                                onBankChange={(e) => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, 'Payment Info': val }));
                                    const b = appData.bankAccounts?.find((bank: any) => bank.BankName === val);
                                    setBankLogo(b ? convertGoogleDriveUrl(b.LogoURL) : '');
                                }}
                                bankLogo={bankLogo}
                            />
                        </div>
                    </div>

                    {/* Tier 2: Items List (Full Width) */}
                    <div className="w-full relative z-10">
                        <EditProductPanel 
                            products={formData.Products}
                            masterProducts={appData.products}
                            onProductChange={handleProductChange}
                            onAddProduct={handleAddProduct}
                            onAddMasterProduct={handleAddMasterProduct}
                            onRemoveProduct={handleRemoveProduct}
                            onPreviewImage={previewImage}
                            onScanBarcode={() => setIsScannerVisible(true)}
                            fulfillmentStatus={formData.FulfillmentStatus}
                            fulfillmentStore={formData['Fulfillment Store']}
                            packedBy={formData['Packed By']}
                            packedTime={formData['Packed Time']}
                            dispatchedBy={formData['Dispatched By']}
                            dispatchedTime={formData['Dispatched Time']}
                        />
                    </div>

                    {/* Tier 3: Summary (Bottom) */}
                    <div className="sticky bottom-0 z-30 bg-[#0B0E11] pt-2 -mx-3 lg:-mx-4 px-3 lg:px-4">
                        <EditOrderSummary 
                            subtotal={Number(formData.Subtotal) || 0}
                            grandTotal={Number(formData['Grand Total']) || 0}
                            shippingFee={formData['Shipping Fee (Customer)']}
                            onShippingFeeChange={handleInputChange}
                            orderDiscount={orderDiscount}
                            onOrderDiscountChange={handleOrderDiscountChange}
                            onSave={handleSubmit}
                            onDelete={handleDelete}
                            onCancelOrder={handleCancelOrderClick}
                            onUnReturn={handleUnReturn}
                            onConfirmReturn={handleConfirmReturnClick}
                            hasReturnPhoto={(!!formData['Return Photo'] && formData['Return Photo'] !== '') || (!!formData['Return Received By'] && formData['Return Received By'] !== '')}
                            fulfillmentStatus={formData.FulfillmentStatus}
                            loading={loading}
                        />

                        <OrderActionModal
                            isOpen={isActionModalOpen}
                            onClose={() => setIsActionModalOpen(false)}
                            onConfirm={handleConfirmAction}
                            title={actionModalType === 'cancel' ? 'សំណើសុំបោះបង់ (Request Cancel)' : 'សំណើសុំបង្វិលឥវ៉ាន់ (Request Return)'}
                            actionText={actionModalType === 'cancel' ? 'បញ្ជូនសំណើបោះបង់' : 'បញ្ជូនសំណើបង្វិល'}
                            reasons={actionModalType === 'cancel' 
                                ? ['អតិថិជនសុំបោះបង់', 'ទាក់ទងអតិថិជនមិនបាន', 'ឥវ៉ាន់អស់ពីស្តុក', 'បញ្ចូលព័ត៌មានខុស/ច្រឡំ', 'អតិថិជនប្តូរចិត្ត'] 
                                : ['អតិថិជនមិនទទួលឥវ៉ាន់', 'ឥវ៉ាន់មានបញ្ហា/ខូចខាត', 'ឥវ៉ាន់មិនត្រឹមត្រូវ/ផ្ញើខុស', 'ទាក់ទងមិនបានពេលដឹក', 'ដឹកយូរពេក អតិថិជនមិនចាំ']
                            }
                        />

                        {isReturnPhotoModalOpen && (
                            <Modal isOpen={true} onClose={() => { if (!isSubmittingReturn) { setIsReturnPhotoModalOpen(false); setReturnPhoto(null); } }} maxWidth="max-w-xl">
                                <div className="bg-[#1E2329] border border-[#2B3139] overflow-hidden rounded-2xl shadow-2xl animate-fade-in">
                                    {/* Header with Order Info */}
                                    <div className="p-5 border-b border-[#2B3139] bg-[#0B0E11] flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-black text-[#EAECEF] uppercase tracking-wider truncate">
                                                    {returnActionType === 'to_pending' ? 'បញ្ជាក់ការទទួលឥវ៉ាន់ចូលស្តុក' : 'បញ្ជាក់ការទទួល Return'}
                                                </h3>
                                                <p className="text-[10px] font-mono text-[#FCD535] mt-0.5">#{formData['Order ID']}</p>
                                            </div>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <p className="text-[9px] font-black text-[#848E9C] uppercase tracking-widest">អតិថិជន (Customer)</p>
                                            <p className="text-xs font-bold text-[#EAECEF] truncate max-w-[150px]">{formData['Customer Name']}</p>
                                        </div>
                                    </div>

                                    <div className="p-6 space-y-6">
                                        {/* Capture Area */}
                                        <div className="relative group">
                                            <div className="aspect-[4/3] sm:aspect-video bg-black rounded-xl overflow-hidden border-2 border-[#2B3139] relative shadow-inner flex items-center justify-center">
                                                {returnPhoto ? (
                                                    <div className="relative w-full h-full animate-in zoom-in-95 duration-300">
                                                        <img src={returnPhoto} className="w-full h-full object-cover" alt="Return Proof" />
                                                        <div className="absolute inset-0 bg-black/20 pointer-events-none"></div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center space-y-4 text-center px-4">
                                                        <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative group-hover:scale-110 transition-transform duration-500">
                                                            <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#FCD535]/30 animate-[spin_10s_linear_infinite]"></div>
                                                            <svg className="w-10 h-10 text-gray-500 group-hover:text-[#FCD535] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-[#EAECEF] uppercase tracking-widest">ថតរូបបញ្ជាក់ (Take Photo)</p>
                                                            <p className="text-[10px] text-[#848E9C] mt-1 font-bold">ចុចទីនេះដើម្បីថតរូបកញ្ចប់ឥវ៉ាន់</p>
                                                        </div>
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            capture="environment" 
                                                            onChange={async (e) => { 
                                                                const file = e.target.files?.[0]; 
                                                                if (file) { 
                                                                    const compressed = await compressImage(file, 'balanced'); 
                                                                    const dataUrl = await fileToDataUrl(compressed); 
                                                                    setReturnPhoto(dataUrl); 
                                                                } 
                                                            }} 
                                                            className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                                                        />
                                                    </div>
                                                )}

                                                {/* Viewfinder Corners (Decorative) */}
                                                {!returnPhoto && (
                                                    <>
                                                        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#FCD535]/40 rounded-tl-sm pointer-events-none"></div>
                                                        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#FCD535]/40 rounded-tr-sm pointer-events-none"></div>
                                                        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#FCD535]/40 rounded-bl-sm pointer-events-none"></div>
                                                        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#FCD535]/40 rounded-br-sm pointer-events-none"></div>
                                                    </>
                                                )}
                                            </div>
                                            
                                            {returnPhoto && (
                                                <button 
                                                    onClick={() => setReturnPhoto(null)} 
                                                    className="absolute -top-3 -right-3 w-10 h-10 bg-[#F6465D] text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-[#1E2329] active:scale-90 transition-all z-20"
                                                    title="Retake Photo"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            )}
                                        </div>

                                        {/* Info Banner */}
                                        <div className="bg-[#0B0E11] p-4 rounded-xl border border-[#2B3139] flex items-start gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 text-lg">💡</div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Instruction</p>
                                                <p className="text-xs text-[#848E9C] font-bold mt-0.5 leading-relaxed">
                                                    {returnActionType === 'to_pending' 
                                                        ? 'សូមថតរូបទំនិញដែលបានត្រឡប់ចូលស្តុកវិញ (ស្រេចចិត្ត) ដើម្បីទុកជាភស្តុតាងនៃស្ថានភាពទំនិញ។'
                                                        : 'សូមថតរូបឱ្យឃើញ លេខកូដ (Order ID) ឬ ឈ្មោះអតិថិជន (ស្រេចចិត្ត)។'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button 
                                                onClick={() => { setIsReturnPhotoModalOpen(false); setReturnPhoto(null); }} 
                                                disabled={isSubmittingReturn}
                                                className="flex-1 py-4 bg-[#2B3139] hover:bg-[#3B424A] text-[#848E9C] hover:text-[#EAECEF] font-black text-xs uppercase tracking-[0.2em] rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                            >
                                                បោះបង់ (Cancel)
                                            </button>
                                            <button 
                                                onClick={() => handleConfirmReturnPhoto(returnPhoto || '')} 
                                                disabled={isSubmittingReturn} 
                                                className={`flex-[2] py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                                                    returnPhoto || true
                                                    ? 'bg-[#0ECB81] text-[#0B0E11] shadow-[#0ECB81]/10' 
                                                    : 'bg-[#2B3139] text-[#474D57]'
                                                }`}
                                            >
                                                {isSubmittingReturn ? (
                                                    <>
                                                        <Spinner size="sm" />
                                                        <span>កំពុងបញ្ជាក់...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                                                        {returnActionType === 'to_pending' ? 'បញ្ជាក់ការចូលស្តុក' : 'បញ្ជាក់ការទទួល (Confirm)'}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </Modal>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditOrderPage;
