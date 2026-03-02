
import React, { useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { Product as ProductType, MasterProduct, Driver, Store, TeamPage, ShippingMethod } from '../types';
import Spinner from '../components/common/Spinner';
import { WEB_APP_URL } from '../constants';
import Modal from '../components/common/Modal';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import SearchableProductDropdown from '../components/common/SearchableProductDropdown';
import PageDropdown from '../components/common/PageDropdown';
import SearchablePageDropdown from '../components/common/SearchablePageDropdown';
import ShippingMethodDropdown from '../components/common/ShippingMethodDropdown';
import MapModal from '../components/orders/MapModal';
import BarcodeScannerModal from '../components/orders/BarcodeScannerModal';
import SearchableProvinceDropdown from '../components/orders/SearchableProvinceDropdown';
import TelegramScheduler from '../components/orders/TelegramScheduler';
import SetQuantity from '../components/orders/SetQuantity';
import DriverSelector from '../components/orders/DriverSelector';
import BankSelector from '../components/orders/BankSelector'; // Import the new component
import { logUserActivity } from '../services/auditService';

interface CreateOrderPageProps {
    team: string;
    onSaveSuccess: () => void;
    onCancel: () => void;
}

type ProductUIState = ProductType & {
    discountType: 'percent' | 'amount' | 'custom';
    discountAmountInput: string; 
    discountPercentInput: string; 
    finalPriceInput: string;
    applyDiscountToTotal: boolean;
}

const initialProductState: ProductUIState = {
    id: Date.now(),
    name: '',
    quantity: 1,
    originalPrice: 0,
    finalPrice: 0,
    total: 0,
    discountPercent: 0,
    colorInfo: '',
    image: '',
    cost: 0,
    discountType: 'percent',
    discountAmountInput: '',
    discountPercentInput: '',
    finalPriceInput: '',
    applyDiscountToTotal: false,
};

const STEPS = [
    { number: 1, title: 'អតិថិជន' },
    { number: 2, title: 'ផលិតផល' },
    { number: 3, title: 'ដឹកជញ្ជូន' },
    { number: 4, title: 'ផ្ទៀងផ្ទាត់' },
];

const CreateOrderPage: React.FC<CreateOrderPageProps> = ({ team, onSaveSuccess, onCancel }) => {
    const { appData, currentUser, apiKey, previewImage } = useContext(AppContext);
    const [currentStep, setCurrentStep] = useState(1);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    
    // SFX
    const sfxDriverSelect = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'));
    // Changed to Cash Register Sound
    const sfxSuccess = useRef(new Audio('https://samnangh849-source.github.io/ButtonTest/Send.mp3'));

    useEffect(() => {
        sfxDriverSelect.current.volume = 0.4;
        sfxSuccess.current.volume = 0.6;
    }, []);

    const initialOrderState = useMemo(() => ({
        page: '',
        telegramValue: '',
        fulfillmentStore: '',
        pageSelectMode: 'cards', // 'cards' or 'search'
        customer: { name: '', phone: '', province: '', district: '', sangkat: '', additionalLocation: '', shippingFee: '' },
        products: [{...initialProductState, id: Date.now()}],
        shipping: { method: '', details: '', cost: '' },
        payment: { status: 'Unpaid', info: '' },
        telegram: { schedule: false, time: '' },
        subtotal: 0,
        grandTotal: 0,
        note: '',
    }), []);

    const [order, setOrder] = useState<any>(initialOrderState);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [submissionStatus, setSubmissionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [selectedShippingMethod, setSelectedShippingMethod] = useState<any>(null);
    const [carrierLogo, setCarrierLogo] = useState<string>('');
    const [shippingLogo, setShippingLogo] = useState<string>('');
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [shippingFeeOption, setShippingFeeOption] = useState<'charge' | 'free'>('charge');
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [mapSearchUrl, setMapSearchUrl] = useState('');
    const [scanMode, setScanMode] = useState<'single' | 'increment'>('increment');
    
    const DRAFT_KEY = useMemo(() => `createOrderDraft_${currentUser?.UserName}_${team}`, [currentUser, team]);
    
    useEffect(() => {
        if (window.innerWidth < 768) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentStep]);

    useEffect(() => {
        try {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (savedDraft) {
                const parsedDraft = JSON.parse(savedDraft);
                setOrder((prev: any) => ({ ...prev, ...parsedDraft }));
                if (parsedDraft.customer && typeof parsedDraft.customer.shippingFee === 'number') {
                    setShippingFeeOption(parsedDraft.customer.shippingFee === 0 ? 'free' : 'charge');
                }
                if (parsedDraft.customer.phone) {
                   const phoneNumber = parsedDraft.customer.phone;
                   const foundCarrier = appData.phoneCarriers?.find((carrier: any) => 
                        (carrier.Prefixes || '').split(',').some((prefix: string) => phoneNumber.startsWith(prefix.trim()))
                    );
                    setCarrierLogo(foundCarrier ? convertGoogleDriveUrl(foundCarrier.CarrierLogoURL) : '');
                }
                if (parsedDraft.shipping.method) {
                    const methodInfo = appData.shippingMethods?.find((s: any) => s.MethodName === parsedDraft.shipping.method);
                    setSelectedShippingMethod(methodInfo || null);
                    setShippingLogo(methodInfo ? convertGoogleDriveUrl(methodInfo.LogosURL) : '');
                }
            }
        } catch (e) {
            localStorage.removeItem(DRAFT_KEY);
        }
    }, [DRAFT_KEY, appData.phoneCarriers, appData.shippingMethods]);

    useEffect(() => {
        const handler = setTimeout(() => {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(order));
        }, 500);
        return () => clearTimeout(handler);
    }, [order, DRAFT_KEY]);

    const handleCancelClick = () => setIsCancelModalOpen(true);
    const handleConfirmCancel = () => { localStorage.removeItem(DRAFT_KEY); setIsCancelModalOpen(false); onCancel(); };
    
    const teamPages = useMemo(() => {
        if (!appData.pages) return [];
        return appData.pages.filter((p: TeamPage) => p.Team === team);
    }, [appData.pages, team]);

    useEffect(() => {
        if (teamPages.length === 1 && !order.page) {
            const pageData = teamPages[0];
            setOrder((prev: any) => ({ ...prev, page: pageData.PageName, telegramValue: pageData.TelegramValue, fulfillmentStore: pageData.DefaultStore || order.fulfillmentStore }));
        }
    }, [teamPages, order.page]);

    const provinces = useMemo(() => {
        if (!appData.locations) return [];
        return [...new Set(appData.locations.map((loc: any) => loc.Province))];
    }, [appData.locations]);

    const districts = useMemo(() => {
        if (!appData.locations || !order.customer.province) return [];
        return [...new Set(appData.locations.filter((loc: any) => loc.Province === order.customer.province).map((loc: any) => loc.District))].sort((a, b) => String(a).localeCompare(String(b), 'km'));
    }, [appData.locations, order.customer.province]);

    const sangkats = useMemo(() => {
        if (!appData.locations || !order.customer.province || !order.customer.district) return [];
        return [...new Set(appData.locations.filter((loc: any) => loc.Province === order.customer.province && loc.District === order.customer.district).map((loc: any) => loc.Sangkat).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'km'));
    }, [appData.locations, order.customer.province, order.customer.district]);

    useEffect(() => {
        const newSubtotal = order.products.reduce((acc: number, p: ProductType) => acc + (p.total || 0), 0);
        const newGrandTotal = newSubtotal + (Number(order.customer.shippingFee) || 0);
        if (newSubtotal !== order.subtotal || newGrandTotal !== order.grandTotal) {
            setOrder((prev: any) => ({ ...prev, subtotal: newSubtotal, grandTotal: newGrandTotal }));
        }
    }, [order.products, order.customer.shippingFee]);

    const calculateProductFields = (product: ProductUIState, allMasterProducts: MasterProduct[]): ProductUIState => {
        const updated = { ...product };
        const masterProduct = allMasterProducts.find(p => p.ProductName === updated.name);
        updated.quantity = Math.max(1, Number(updated.quantity) || 1);
        updated.originalPrice = Math.max(0, masterProduct ? (Number(masterProduct.Price) || 0) : 0);
        updated.cost = Math.max(0, masterProduct ? (Number(masterProduct.Cost) || 0) : 0);
        const originalTotal = updated.quantity * updated.originalPrice;
        let finalTotal = originalTotal;
        let totalDiscountAmount = 0;
        switch (updated.discountType) {
            case 'percent':
                const dp = Math.max(0, Number(updated.discountPercentInput) || 0);
                totalDiscountAmount = originalTotal * (dp / 100);
                finalTotal = originalTotal - totalDiscountAmount;
                break;
            case 'amount':
                const da = Math.max(0, Number(updated.discountAmountInput) || 0);
                totalDiscountAmount = (updated.quantity > 1 && updated.applyDiscountToTotal) ? da : da * updated.quantity;
                finalTotal = originalTotal - totalDiscountAmount;
                break;
            case 'custom':
                const cfp = Math.max(0, Number(updated.finalPriceInput) || 0);
                finalTotal = updated.quantity * cfp;
                totalDiscountAmount = originalTotal - finalTotal;
                updated.finalPrice = cfp;
                break;
        }
        updated.total = Math.max(0, finalTotal);
        updated.finalPrice = updated.quantity > 0 ? updated.total / updated.quantity : 0;
        updated.discountPercent = originalTotal > 0 ? (totalDiscountAmount / originalTotal) * 100 : 0;
        if (updated.discountType !== 'custom') updated.finalPriceInput = updated.finalPrice.toFixed(2);
        return updated;
    };

    const handleCodeScanned = useCallback((scannedCode: string) => {
        const foundProduct = appData.products.find((p: MasterProduct) => p.Barcode && p.Barcode.trim() === scannedCode.trim());
        if (!foundProduct) return;
        setOrder((prevOrder: any) => {
            const existingProductIndex = prevOrder.products.findIndex((p: ProductType) => p.name === foundProduct.ProductName);
            let updatedProducts;
            if (existingProductIndex > -1) {
                const productToUpdate = { ...prevOrder.products[existingProductIndex] };
                if (scanMode === 'increment') productToUpdate.quantity += 1;
                const recalculated = calculateProductFields(productToUpdate, appData.products);
                updatedProducts = [...prevOrder.products];
                updatedProducts[existingProductIndex] = recalculated;
            } else {
                const emptyProductIndex = prevOrder.products.findIndex((p: ProductType) => !p.name);
                const newProduct: ProductUIState = { ...initialProductState, id: Date.now(), name: foundProduct.ProductName, quantity: 1, originalPrice: foundProduct.Price, cost: foundProduct.Cost, image: foundProduct.ImageURL, tags: foundProduct.Tags };
                const recalculated = calculateProductFields(newProduct, appData.products);
                if (emptyProductIndex > -1) { updatedProducts = [...prevOrder.products]; updatedProducts[emptyProductIndex] = recalculated; }
                else { updatedProducts = [...prevOrder.products, recalculated]; }
            }
            return { ...prevOrder, products: updatedProducts };
        });
        if (scanMode === 'single') setIsScannerVisible(false);
    }, [appData.products, scanMode]);

    const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            let phoneNumber = value.replace(/[^0-9]/g, '');
            if (phoneNumber.length > 1 && phoneNumber.startsWith('00')) phoneNumber = '0' + phoneNumber.substring(2);
            else if (phoneNumber.length > 0 && !phoneNumber.startsWith('0')) phoneNumber = '0' + phoneNumber;
            let foundCarrier = null;
            if (phoneNumber.length >= 2 && appData.phoneCarriers) { foundCarrier = appData.phoneCarriers.find((carrier: any) => (carrier.Prefixes || '').split(',').some((prefix: string) => phoneNumber.startsWith(prefix.trim()))); }
            setCarrierLogo(foundCarrier ? convertGoogleDriveUrl(foundCarrier.CarrierLogoURL) : '');
            setOrder((prev: any) => ({ ...prev, customer: { ...prev.customer, phone: phoneNumber } }));
            return;
        }
        if (name === 'shippingFee') {
            const numValue = value === '' ? '' : Math.max(0, parseFloat(value)); 
            setOrder((prev: any) => ({ ...prev, customer: { ...prev.customer, shippingFee: numValue } }));
            return;
        }
        setOrder((prev: any) => {
            let newCustomerState = { ...prev.customer, [name]: value };
            if (name === 'province') { newCustomerState.district = ''; newCustomerState.sangkat = ''; }
            else if (name === 'district') { newCustomerState.sangkat = ''; }
            return { ...prev, customer: newCustomerState };
        });
    };
    
    const handleProductUpdate = (index: number, field: keyof ProductUIState, value: any, extraTags?: string) => {
         setOrder((prev: any) => {
            const updatedProducts = [...prev.products];
            let productToUpdate = { ...updatedProducts[index] };
            if (['discountPercentInput', 'discountAmountInput', 'finalPriceInput'].includes(field)) {
                let stringValue = String(value).replace(/[^0-9.]/g, '').replace(/(\..*?)\./g, '$1');
                if (stringValue.startsWith('0') && stringValue.length > 1 && !stringValue.startsWith('0.')) stringValue = String(parseFloat(stringValue));
                // @ts-ignore
                productToUpdate[field] = stringValue;
            } else if (field === 'quantity') {
                productToUpdate[field] = value === '' ? 0 : Math.max(0, parseInt(value) || 0);
            } else {
                // @ts-ignore
                productToUpdate[field] = value;
            }
            if (field === 'name') {
                const masterProduct = appData.products.find((p: MasterProduct) => p.ProductName === value);
                productToUpdate.name = value;
                if (masterProduct) {
                    productToUpdate.originalPrice = masterProduct.Price;
                    productToUpdate.image = masterProduct.ImageURL;
                    productToUpdate.cost = masterProduct.Cost;
                    productToUpdate.discountType = 'percent';
                    productToUpdate.finalPrice = masterProduct.Price;
                    productToUpdate.finalPriceInput = String(masterProduct.Price);
                    // Update tags from dropdown selection
                    productToUpdate.tags = extraTags !== undefined ? extraTags : masterProduct.Tags;
                } else {
                    productToUpdate.originalPrice = 0; productToUpdate.image = ''; productToUpdate.cost = 0;
                    productToUpdate.discountType = 'custom'; productToUpdate.finalPrice = 0; productToUpdate.tags = '';
                }
            }
            if (field === 'discountType') { productToUpdate.discountPercentInput = ''; productToUpdate.discountAmountInput = ''; productToUpdate.finalPrice = productToUpdate.originalPrice; productToUpdate.finalPriceInput = String(productToUpdate.originalPrice); }
            updatedProducts[index] = calculateProductFields(productToUpdate, appData.products);
            return { ...prev, products: updatedProducts };
        });
    };
    
    const handleShippingMethodSelect = (method: ShippingMethod) => {
        setSelectedShippingMethod(method);
        setShippingLogo(convertGoogleDriveUrl(method.LogosURL));
        setOrder((prev: any) => ({ 
            ...prev, 
            shipping: { 
                ...prev.shipping, 
                method: method.MethodName, 
                details: method.RequireDriverSelection ? '' : method.MethodName 
            } 
        }));
    };
    
    const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let sv = value;
        if (name === 'cost') {
            if (sv.startsWith('0') && sv.length > 1 && !sv.startsWith('0.')) sv = String(parseFloat(sv));
            const numericValue = parseFloat(sv) || 0;
            sv = String(Math.max(0, numericValue)); 
        }
        setOrder((prev: any) => ({ ...prev, shipping: { ...prev.shipping, [name]: sv } }));
    };

    const handleDriverChange = (driverName: string) => {
        setOrder((prev: any) => ({ ...prev, shipping: { ...prev.shipping, details: driverName } }));
    };

    const handleBankChange = (bankName: string) => {
        setOrder((prev: any) => ({ ...prev, payment: { ...prev.payment, info: bankName } }));
    };

    const handleShippingOptionChange = (option: 'charge' | 'free') => { setShippingFeeOption(option); setOrder((prev: any) => ({ ...prev, customer: { ...prev.customer, shippingFee: option === 'free' ? 0 : '' } })); };
    
    const handleSearchOnMaps = () => {
        if (!apiKey) { alert("API Key Required for Maps."); return; }
        const { province, district, sangkat, additionalLocation } = order.customer;
        const query = [additionalLocation, sangkat, district, province, 'Cambodia'].filter(Boolean).join(', ');
        setMapSearchUrl(`https://www.google.com/maps/embed/v1/search?key=${apiKey}&q=${encodeURIComponent(query)}`);
        setIsMapModalOpen(true);
    };

    const validateStep = (step: number): boolean => {
        setError(''); 
        switch (step) {
            case 1:
                if (!order.customer.name || !order.customer.phone || !order.customer.province || !order.page || !order.fulfillmentStore) { setError('សូមបំពេញឈ្មោះ, លេខទូរស័ព្ទ, ខេត្ត/ក្រុង, Page និងឃ្លាំងបញ្ចេញទំនិញ។'); return false; }
                if (shippingFeeOption === 'charge' && (order.customer.shippingFee === '' || order.customer.shippingFee < 0)) { setError('សូមបញ្ចូលតម្លៃដឹកជញ្ជូនឱ្យបានត្រឹមត្រូវ។'); return false; }
                return true;
            case 2:
                if (order.products.length === 0 || order.products.some((p: any) => !p.name || p.quantity <= 0)) { setError('សូមពិនិត្យទិន្នន័យផលិតផល។'); return false; }
                return true;
            case 3:
                if (!order.shipping.method || (selectedShippingMethod?.RequireDriverSelection && !order.shipping.details) || order.shipping.cost === '' || parseFloat(order.shipping.cost) < 0) { setError('សូមពិនិត្យព័ត៌មានដឹកជញ្ជូន។'); return false; }
                return true;
            case 4:
                 if (order.payment.status === 'Paid' && !order.payment.info) { setError('សូមជ្រើសរើសគណនីធនាគារ។'); return false; }
                 if (order.telegram.schedule && !order.telegram.time) { setError('សូមជ្រើសរើសពេលវេលាផ្ញើសារ។'); return false; }
                return true;
            default: return true;
        }
    };
    
    const nextStep = () => { if (validateStep(currentStep)) setCurrentStep(currentStep + 1); };
    const prevStep = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [isUndoing, setIsUndoing] = useState(false);
    const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const submitIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const submitOrder = async () => {
        for (const step of STEPS) { if (!validateStep(step.number)) { setCurrentStep(step.number); return; } }
        setLoading(true);

        // OPTIMISTIC UI: Start 7-second countdown
        setUndoTimer(7);
        
        let secondsLeft = 7;
        if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);
        submitIntervalRef.current = setInterval(() => {
            secondsLeft -= 1;
            setUndoTimer(secondsLeft);
            if (secondsLeft <= 0) {
                if (submitIntervalRef.current) {
                    clearInterval(submitIntervalRef.current);
                    submitIntervalRef.current = null;
                }
            }
        }, 1000);

        // Wait for the Grace Period before actual submission
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        submitTimeoutRef.current = setTimeout(async () => {
            if (submitIntervalRef.current) {
                clearInterval(submitIntervalRef.current);
                submitIntervalRef.current = null;
            }
            setUndoTimer(null);
            
            // Proceed with ACTUAL API CALL
            await executeFinalSubmit();
        }, 7000);
    };

    const handleUndo = () => {
        if (submitTimeoutRef.current) {
            clearTimeout(submitTimeoutRef.current);
            submitTimeoutRef.current = null;
        }
        if (submitIntervalRef.current) {
            clearInterval(submitIntervalRef.current);
            submitIntervalRef.current = null;
        }
        setIsUndoing(true);
        setTimeout(() => {
            setUndoTimer(null);
            setLoading(false);
            setIsUndoing(false);
        }, 500); // Small animation delay
    };

    const executeFinalSubmit = async () => {
        let phoneToSend = '0' + order.customer.phone.replace(/[^0-9]/g, '').replace(/^0+/, '');
        
        // Construct Address Details manually to ensure it appears in the Sheet/Telegram even if scheduled
        const addressParts = [
            order.customer.additionalLocation,
            order.customer.sangkat,
            order.customer.district
        ].filter(Boolean);
        const fullAddress = addressParts.join(', ');

        // Format scheduled time to be cleaner (replace T with space)
        let scheduledTimeStr = order.telegram.schedule ? order.telegram.time : '';
        if (scheduledTimeStr) scheduledTimeStr = scheduledTimeStr.replace('T', ' ');

        const payload = { 
            currentUser, 
            selectedTeam: team, 
            page: order.page, 
            telegramValue: order.telegramValue, 
            
            // Nested object (standard)
            customer: { 
                ...order.customer, 
                phone: phoneToSend, 
                shippingFee: Number(order.customer.shippingFee) || 0 
            }, 
            
            // *** CRITICAL FIX: Flattened keys for Backend/Sheet/Scheduled Tasks ***
            "Customer Name": order.customer.name,
            "Customer Phone": phoneToSend,
            "Location": order.customer.province,
            "Address Details": fullAddress,
            "Internal Shipping Method": order.shipping.method,
            "Internal Shipping Details": order.shipping.details,
            "Internal Cost": Number(order.shipping.cost) || 0,
            "Payment Status": order.payment.status,
            "Payment Info": order.payment.info,
            "Fulfillment Store": order.fulfillmentStore,
            
            products: order.products.map((p: any) => ({ 
                name: p.name, 
                quantity: Number(p.quantity) || 1, 
                originalPrice: Number(p.originalPrice) || 0, 
                finalPrice: Number(p.finalPrice) || 0, 
                total: Number(p.total) || 0, 
                colorInfo: p.colorInfo, 
                cost: Number(p.cost) || 0,
                tags: p.tags,
                image: p.image
            })), 
            shipping: { 
                ...order.shipping, 
                cost: Number(order.shipping.cost) || 0 
            }, 
            payment: order.payment, 
            subtotal: Number(order.subtotal) || 0, 
            grandTotal: Number(order.grandTotal) || 0, 
            note: order.note,
            fulfillmentStore: order.fulfillmentStore,
            scheduledTime: scheduledTimeStr
        };
        
        try {
            const res = await fetch(`${WEB_APP_URL}/api/submit-order`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });
            const result = await res.json();
            if (!res.ok || result.status !== 'success') throw new Error(result.message || 'Error');
            
            // Play success sound
            sfxSuccess.current.currentTime = 0;
            sfxSuccess.current.play().catch(() => {});

            // *** NEW: Send Global Notification via Chat System ***
            try {
                const productNames = order.products.map((p: any) => p.name).join(', ');
                const notificationMessage = `📢 NEW ORDER: ${team} | ${order.page} | 👤 ${currentUser?.FullName} | 💰 $${payload.grandTotal} | 📍 ${order.customer.province} | 📦 ${productNames}`;
                
                await fetch(`${WEB_APP_URL}/api/chat/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userName: currentUser?.UserName,
                        type: 'text',
                        content: notificationMessage
                    })
                });
            } catch (notifyErr) {
                console.warn("Failed to send system notification", notifyErr);
            }
            // -----------------------------------------------------

            // *** NEW: Explicitly log user activity to avoid "System" user in Audit Logs ***
            await logUserActivity(
                currentUser?.UserName || 'Unknown',
                'CREATE_ORDER',
                `Created Order ID: ${result.orderId} for ${order.customer.name}`
            );

            localStorage.removeItem(DRAFT_KEY);
            setSubmissionStatus({ type: 'success', message: `ជោគជ័យ! Order ID: ${result.orderId}` });
            setTimeout(onSaveSuccess, 3000);
        } catch(err: any) {
            setSubmissionStatus({ type: 'error', message: `បរាជ័យ: ${err.message}` });
            setTimeout(() => setSubmissionStatus(null), 3000);
        } finally { setLoading(false); }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <fieldset className="border border-gray-600 p-3 sm:p-4 rounded-lg animate-fade-in space-y-6">
                        <legend className="px-2 text-base sm:text-lg font-semibold text-blue-300">ព័ត៌មានអតិថិជន & Page</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <label className="input-label font-black text-xs uppercase tracking-widest text-gray-500 mb-0 block">Facebook Page*</label>
                                    
                                    {/* UI Style Toggle */}
                                    <div className="flex bg-gray-900/80 p-1 rounded-xl border border-gray-700">
                                        <button 
                                            type="button"
                                            onClick={() => setOrder({ ...order, pageSelectMode: 'cards' })}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${order.pageSelectMode === 'cards' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            Card View
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setOrder({ ...order, pageSelectMode: 'search' })}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${order.pageSelectMode === 'search' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            Search View
                                        </button>
                                    </div>
                                </div>

                                <div className="animate-fade-in-down">
                                    {order.pageSelectMode === 'cards' ? (
                                        <PageDropdown 
                                            pages={teamPages} 
                                            selectedPageName={order.page} 
                                            onSelect={(pageData) => setOrder({ 
                                                ...order, 
                                                page: pageData.PageName, 
                                                telegramValue: pageData.TelegramValue, 
                                                fulfillmentStore: pageData.DefaultStore || order.fulfillmentStore 
                                            })} 
                                        />
                                    ) : (
                                        <SearchablePageDropdown 
                                            pages={teamPages}
                                            selectedPageName={order.page}
                                            onSelect={(pageData) => setOrder({ 
                                                ...order, 
                                                page: pageData.PageName, 
                                                telegramValue: pageData.TelegramValue, 
                                                fulfillmentStore: pageData.DefaultStore || order.fulfillmentStore 
                                            })}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="md:col-span-2 space-y-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                                    <label className="input-label !mb-0 font-black text-xs uppercase tracking-widest text-orange-400">ឃ្លាំងបញ្ចេញទំនិញ (Store)*</label>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {appData.stores?.map((s: Store) => {
                                        const isSelected = order.fulfillmentStore === s.StoreName;
                                        return (
                                            <button 
                                                key={s.StoreName} 
                                                type="button" 
                                                onClick={() => setOrder({...order, fulfillmentStore: s.StoreName})}
                                                className={`relative overflow-hidden group p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center text-center gap-2 ${
                                                    isSelected 
                                                    ? 'bg-orange-500/10 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.2)]' 
                                                    : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                                                }`}
                                            >
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-500 group-hover:text-gray-300'}`}>
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                                </div>
                                                <span className={`text-[11px] font-black uppercase tracking-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>{s.StoreName}</span>
                                                {isSelected && (
                                                    <div className="absolute top-1 right-1">
                                                        <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <input type="text" name="name" value={order.customer.name} placeholder="ឈ្មោះអតិថិជន*" className="form-input !py-3 rounded-xl border-gray-700 bg-gray-900" onChange={handleCustomerChange} required />
                            <div className="relative"><input type="tel" name="phone" value={order.customer.phone} placeholder="លេខទូរស័ព្ទ*" className="form-input !py-3 rounded-xl border-gray-700 bg-gray-900 pr-12" onChange={handleCustomerChange} required />{carrierLogo && <img src={carrierLogo} alt="Carrier" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-auto object-contain" />}</div>
                             
                             <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <SearchableProvinceDropdown 
                                    provinces={provinces}
                                    selectedProvince={order.customer.province}
                                    onSelect={(val) => handleCustomerChange({ target: { name: 'province', value: val } } as any)}
                                />
                                <select name="district" value={order.customer.district} className="form-select" onChange={handleCustomerChange} disabled={!order.customer.province}><option value="">-- ស្រុក/ខណ្ឌ --</option>{districts.map((d: string) => <option key={d} value={d}>{d}</option>)}</select>
                                <select name="sangkat" value={order.customer.sangkat} className="form-select" onChange={handleCustomerChange} disabled={!order.customer.district}><option value="">-- ឃុំ/សង្កាត់ --</option>{sangkats.map((s: string) => <option key={s} value={s}>{s}</option>)}</select>
                            </div>
                             <div className="md:col-span-2"><label className="input-label font-black text-[10px] uppercase text-gray-500 tracking-widest mb-2 block">ទីតាំងលម្អិត (ផ្ទះលេខ, ផ្លូវ)</label><div className="flex gap-2"><input type="text" name="additionalLocation" value={order.customer.additionalLocation} placeholder="បញ្ចូលទីតាំងលម្អិត..." className="form-input !py-3 rounded-xl bg-gray-900 border-gray-700" onChange={handleCustomerChange} /><button type="button" onClick={handleSearchOnMaps} className="p-3 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all active:scale-90"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg></button></div></div>
                            <div className="md:col-span-2">
                                <label className="input-label font-black text-[10px] uppercase text-gray-500 tracking-widest mb-2 block">ថ្លៃសេវាដឹកជញ្ជូន</label>
                                <div className="flex gap-3 mb-3">
                                    <button type="button" onClick={() => handleShippingOptionChange('charge')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase transition-all border ${shippingFeeOption === 'charge' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'}`}>គិតថ្លៃសេវា</button>
                                    <button type="button" onClick={() => handleShippingOptionChange('free')} className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase transition-all border ${shippingFeeOption === 'free' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'}`}>មិនគិតថ្លៃសេវា</button>
                                </div>
                                {shippingFeeOption === 'charge' && (
                                    <div className="space-y-3 animate-fade-in">
                                        <input type="number" min="0" name="shippingFee" value={order.customer.shippingFee} placeholder="តម្លៃដឹកជញ្ជូន (ឧ. 1.5)*" className="form-input !py-3 rounded-xl border-gray-700 bg-gray-900" onChange={handleCustomerChange} required />
                                        <div className="flex gap-2">
                                            {[1, 1.5, 2].map(fee => {
                                                const isActive = parseFloat(order.customer.shippingFee) === fee;
                                                return (
                                                    <button 
                                                        key={fee} 
                                                        type="button" 
                                                        onClick={() => handleCustomerChange({ target: { name: 'shippingFee', value: String(fee) } } as any)}
                                                        className={`flex-1 py-2 border font-black rounded-xl text-xs transition-all active:scale-95 ${isActive ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'}`}
                                                    >
                                                        ${fee}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </fieldset>
                );
            case 2:
                return (
                    <fieldset className="border border-gray-600 p-3 sm:p-4 rounded-lg animate-fade-in space-y-4 sm:space-y-6">
                        <legend className="px-2 text-base sm:text-lg font-semibold text-blue-300">ផលិតផល & ការបញ្ចុះតម្លៃ</legend>
                        <div className="space-y-4 sm:space-y-6">
                             {order.products.map((p: ProductUIState, index: number) => {
                                 const originalTotal = (Number(p.quantity) || 0) * (Number(p.originalPrice) || 0);
                                 const discountValue = originalTotal - (Number(p.total) || 0);
                                 return (
                                    <div key={p.id} className="p-3 sm:p-5 bg-gray-800/40 rounded-2xl sm:rounded-3xl border border-gray-700 relative shadow-xl overflow-hidden group">
                                        <button type="button" onClick={() => { if (order.products.length > 1) setOrder({ ...order, products: order.products.filter((_:any, i:number)=>i!==index) }); }} className="absolute top-2 right-2 sm:top-4 sm:right-4 text-red-400 bg-red-400/10 rounded-full h-6 w-6 sm:h-8 sm:w-8 flex items-center justify-center border border-red-400/20 hover:bg-red-600 hover:text-white transition-all z-10 active:scale-90" disabled={order.products.length <= 1}>&times;</button>
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-6 mb-4 sm:mb-6">
                                            <div className="md:col-span-2 flex justify-center">
                                                <div className="w-20 h-20 sm:w-28 sm:h-28 bg-gray-900 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-gray-700 shadow-inner group-hover:border-blue-500/50 transition-colors"><img src={convertGoogleDriveUrl(p.image)} className="w-full h-full object-cover" alt="" /></div>
                                            </div>
                                            <div className="md:col-span-10 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                                <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ឈ្មោះផលិតផល*</label><SearchableProductDropdown products={appData.products || []} selectedProductName={p.name} onSelect={(val, tags) => handleProductUpdate(index, 'name', val, tags)} /></div>
                                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                                    <SetQuantity 
                                                        value={p.quantity} 
                                                        onChange={(val) => handleProductUpdate(index, 'quantity', val)} 
                                                    />
                                                    <div className="space-y-1.5"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ពណ៌/សម្គាល់</label><input type="text" list={`colors-datalist-${p.id}`} value={p.colorInfo} onChange={(e) => handleProductUpdate(index, 'colorInfo', e.target.value)} className="form-input text-sm !py-2.5 rounded-xl bg-gray-900 border-gray-700" placeholder="ឧ. ខៀវ, XL" /><datalist id={`colors-datalist-${p.id}`}>{(appData.colors || []).map((c:any,i:number)=><option key={i} value={c.ColorName}/>)}</datalist></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-black/20 rounded-xl sm:rounded-[2rem] p-3 sm:p-6 border border-white/5 space-y-4 sm:space-y-6">
                                            <div className="flex items-center gap-2 sm:gap-3"><div className="h-px flex-grow bg-gray-700/50"></div><span className="text-[9px] sm:text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] sm:tracking-[0.3em] whitespace-nowrap">Pricing & Discount</span><div className="h-px flex-grow bg-gray-700/50"></div></div>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
                                                <div className="space-y-3 sm:space-y-4">
                                                    <div className="flex bg-gray-900/50 p-1 rounded-xl sm:rounded-2xl border border-gray-700 shadow-inner">{(['percent', 'amount', 'custom'] as const).map(t => (<button key={t} type="button" onClick={() => handleProductUpdate(index, 'discountType', t)} className={`flex-1 flex flex-col items-center justify-center py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all duration-300 active:scale-95 ${p.discountType === t ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}><span className="text-[9px] sm:text-[11px] font-black uppercase tracking-widest">{t === 'percent' ? 'បញ្ចុះ %' : t === 'amount' ? 'បញ្ចុះ $' : 'កែតម្លៃលក់'}</span></button>))}</div>
                                                    <div className="relative animate-fade-in">{p.discountType === 'percent' && (<div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 ml-1">បញ្ចូលភាគរយបញ្ចុះតម្លៃ (%)</label><div className="relative"><input type="number" min="0" max="100" placeholder="0" value={p.discountPercentInput} onChange={e=>handleProductUpdate(index, 'discountPercentInput', e.target.value)} className="form-input !text-base sm:!text-lg !font-black !py-2 sm:!py-3 pr-10 text-right text-blue-400 bg-gray-900 border-gray-700" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-black">%</span></div></div>)}{p.discountType === 'amount' && (<div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 ml-1">បញ្ចូលទឹកប្រាក់បញ្ចុះតម្លៃ ($)</label><div className="relative"><input type="number" min="0" placeholder="0.00" value={p.discountAmountInput} onChange={e=>handleProductUpdate(index, 'discountAmountInput', e.target.value)} className="form-input !text-base sm:!text-lg !font-black !py-2 sm:!py-3 pr-10 text-right text-red-400 bg-gray-900 border-gray-700" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-black">$</span></div>{p.quantity > 1 && (<label className="flex items-center gap-2 cursor-pointer p-2 bg-black/20 rounded-lg mt-1 sm:mt-2 border border-white/5 active:scale-95 transition-transform"><input type="checkbox" checked={p.applyDiscountToTotal} onChange={e => handleProductUpdate(index, 'applyDiscountToTotal', e.target.checked)} className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500" /><span className="text-[9px] sm:text-[10px] text-gray-400 uppercase font-black">បញ្ចុះលើតម្លៃសរុប</span></label>)}</div>)}{p.discountType === 'custom' && (<div className="space-y-2"><label className="text-[10px] font-bold text-gray-400 ml-1">កំណត់តម្លៃលក់ថ្មីក្នុង ១ ឯកតា ($)</label><div className="relative"><input type="text" inputMode="decimal" placeholder="0.00" value={p.finalPriceInput} onChange={e=>handleProductUpdate(index, 'finalPriceInput', e.target.value)} className="form-input !text-base sm:!text-lg !font-black !py-2 sm:!py-3 pr-10 text-right text-emerald-400 bg-gray-900 border-gray-700" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-black">$</span></div></div>)}</div>
                                                </div>
                                                <div className="bg-gray-900/60 rounded-xl sm:rounded-[1.5rem] p-3 sm:p-5 border border-white/5 flex flex-col justify-between"><div className="space-y-2 sm:space-y-3"><div className="flex justify-between items-center text-[10px] sm:text-xs"><span className="text-gray-500 font-bold uppercase">Original Subtotal</span><span className="text-blue-400 font-black">${originalTotal.toFixed(2)}</span></div><div className="flex justify-between items-center text-[10px] sm:text-xs"><span className="text-gray-500 font-bold uppercase">Discount Applied</span><span className="text-red-400 font-black">-{discountValue > 0 ? `$${discountValue.toFixed(2)}` : '$0.00'}</span></div><div className="h-px bg-gray-700/50 my-1"></div><div className="flex justify-between items-center"><span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Total</span><span className="text-xl sm:text-2xl font-black text-white tracking-tighter">${(p.total || 0).toFixed(2)}</span></div></div><div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-white/5 flex justify-center"><span className="text-[8px] sm:text-[9px] bg-emerald-500/10 text-emerald-400 px-2 sm:px-3 py-1 rounded-full border border-emerald-500/20 font-black uppercase tracking-widest">Avg. ${(p.finalPrice || 0).toFixed(2)} / unit</span></div></div>
                                            </div>
                                        </div>
                                    </div>
                                 );
                             })}
                        </div>

                        {/* NEW: Subtotal Display for Step 2 */}
                        <div className="bg-gray-900/80 p-4 rounded-2xl border border-blue-500/20 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Quantity</span>
                                    <span className="text-lg font-black text-white">{order.products.reduce((acc: number, p: any) => acc + (Number(p.quantity) || 0), 0)} items</span>
                                </div>
                            </div>
                            <div className="h-px w-full sm:w-px sm:h-10 bg-gray-700"></div>
                            <div className="flex flex-col items-center sm:items-end">
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Estimated Subtotal</span>
                                <span className="text-3xl font-black text-white tracking-tighter drop-shadow-md">
                                    ${(order.subtotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
                            <button type="button" onClick={()=>setIsScannerVisible(true)} className="w-full py-4 px-6 bg-blue-600/10 border border-blue-500/30 rounded-2xl text-blue-400 font-black uppercase text-[11px] tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/10 active:scale-95"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" strokeWidth="3"/></svg>Scan Barcode</button>
                        </div>
                    </fieldset>
                );
            case 3:
                return (
                    <fieldset className="border border-gray-600 p-3 sm:p-4 rounded-lg animate-fade-in space-y-4 sm:space-y-6"><legend className="px-2 text-base sm:text-lg font-semibold text-blue-300">ដឹកជញ្ជូន</legend><div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-1.5"><label className="input-label font-black text-[10px] uppercase text-gray-500 tracking-widest mb-2 block">វិធីសាស្រ្តដឹកជញ្ជូន*</label><ShippingMethodDropdown methods={appData.shippingMethods || []} selectedMethodName={order.shipping.method} onSelect={handleShippingMethodSelect} /></div>
                            <div className="space-y-1.5">
                                <label className="input-label font-black text-[10px] uppercase text-gray-500 tracking-widest mb-2 block">ថ្លៃសេវាឲ្យអ្នកដឹក (Cost)*</label>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <input type="number" min="0" step="0.01" name="cost" placeholder="0.00" value={order.shipping.cost} className="form-input !py-3 rounded-xl bg-gray-900 border-gray-700 text-blue-400 font-black pr-12" onChange={handleShippingChange} required />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                    </div>
                                    <div className="flex gap-2">
                                        {[1.25, 1.5, 2].map(cost => {
                                            const isActive = parseFloat(order.shipping.cost) === cost;
                                            return (
                                                <button 
                                                    key={cost} 
                                                    type="button" 
                                                    onClick={() => handleShippingChange({ target: { name: 'cost', value: String(cost) } } as any)}
                                                    className={`flex-1 py-2 border font-black rounded-xl text-xs transition-all active:scale-95 ${isActive ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'}`}
                                                >
                                                    ${cost}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            {selectedShippingMethod?.RequireDriverSelection && (
                                <div className="md:col-span-2 space-y-3 sm:space-y-4">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="h-4 w-1 bg-blue-500 rounded-full"></div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">ជ្រើសរើសអ្នកដឹក (DriverSelection)*</label>
                                    </div>
                                    <DriverSelector 
                                        drivers={appData.drivers || []} 
                                        selectedDriverName={order.shipping.details} 
                                        onSelect={handleDriverChange} 
                                    />
                                    {!order.shipping.details && (<p className="text-center text-[9px] text-gray-500 italic mt-1">សូមជ្រើសរើសអ្នកដឹកម្នាក់</p>)}
                                </div>
                            )}
                         </div></fieldset>
                );
            case 4:
                const selectedDriver = appData.drivers?.find((d: Driver) => d.DriverName === order.shipping.details);
                return (
                    <div className="animate-fade-in space-y-4 sm:space-y-8">
                        <div><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> ព័ត៌មានអតិថិជន</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 bg-gray-900/60 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/5 shadow-inner"><div className="space-y-1"><p className="text-[9px] text-gray-500 font-bold uppercase">Customer Info</p><p className="text-white font-black text-base sm:text-lg">{order.customer.name}</p><div className="flex items-center gap-2"><p className="text-blue-400 font-bold font-mono text-sm">{order.customer.phone}</p>{carrierLogo && <img src={carrierLogo} className="h-4 sm:h-5 w-auto object-contain" alt="Carrier" />}</div></div><div className="space-y-2 md:text-right">
                                    <p className="text-[9px] text-gray-500 font-bold uppercase">Location / Store</p>
                                    <p className="text-gray-200 font-bold text-xs sm:text-sm leading-tight">{`${order.customer.additionalLocation}, ${order.customer.sangkat}, ${order.customer.district}, ${order.customer.province}`.replace(/^,|,$/g, '').trim()}</p>
                                    <div className="pt-1.5 border-t border-white/5 mt-1.5 inline-block md:ml-auto">
                                        <p className="text-gray-500 text-[8px] font-black uppercase tracking-[0.2em] mb-0.5">Fulfillment Store</p>
                                        <div className="bg-purple-600/10 border border-purple-500/20 px-3 py-1 rounded-lg">
                                            <p className="text-purple-400 font-black text-xs sm:text-sm uppercase tracking-wider">{order.fulfillmentStore}</p>
                                        </div>
                                    </div>
                                </div></div></div>
                        <div><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> ព័ត៌មានដឹកជញ្ជូន</h3><div className="bg-gray-900/40 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-white/5 shadow-inner grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"><div className="space-y-1"><p className="text-[9px] text-gray-500 font-bold uppercase">Shipping Method</p><div className="flex items-center gap-2">{shippingLogo && <img src={shippingLogo} className="h-4 sm:h-5 w-auto object-contain" alt="Logo" />}<p className="text-white font-black text-xs sm:text-sm">{order.shipping.method}</p></div></div><div className="space-y-1"><p className="text-[9px] text-gray-500 font-bold uppercase">Driver / Details</p><div className="flex items-center gap-2">{selectedDriver && (<img src={convertGoogleDriveUrl(selectedDriver.ImageURL)} className="h-6 w-6 sm:h-8 sm:w-8 rounded-full object-cover border border-gray-700 cursor-pointer active:scale-95 transition-transform" alt="Driver" onClick={() => previewImage(convertGoogleDriveUrl(selectedDriver.ImageURL))} />)}<p className="text-white font-bold text-xs sm:text-sm">{order.shipping.details || 'N/A'}</p></div></div><div className="space-y-1 sm:text-right"><p className="text-[9px] text-gray-500 font-bold uppercase">Internal Cost ($)</p><p className="text-orange-400 font-black text-base sm:text-lg font-mono">${(Number(order.shipping.cost) || 0).toFixed(2)}</p></div></div></div>
                        <div><h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> បញ្ជីទំនិញកុម្ម៉ង់</h3><div className="space-y-2 sm:space-y-3">{order.products.map((p: any) => (<div key={p.id} className="flex items-center gap-3 sm:gap-4 bg-gray-900/40 p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-all"><div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-800 rounded-lg sm:rounded-xl overflow-hidden border border-gray-700 flex-shrink-0 relative"><img src={convertGoogleDriveUrl(p.image)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} /></div><div className="flex-grow min-w-0"><div className="flex justify-between items-start mb-0.5 sm:mb-1"><h4 className="text-white font-black text-xs sm:text-sm truncate leading-tight">{p.name}</h4><div className="flex gap-1.5"><span className="bg-blue-600/10 text-blue-400 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-blue-500/20">x{p.quantity}</span></div></div><div className="flex items-center gap-2 sm:gap-3">{p.colorInfo && (<span className="text-[9px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-md font-bold">{p.colorInfo}</span>)}<p className="text-[9px] text-gray-500 font-bold uppercase tracking-tight"><span>${(p.finalPrice || 0).toFixed(2)}</span> / unit</p></div></div><div className="text-right"><p className="text-white font-black text-sm sm:text-base tracking-tight">${(p.total || 0).toFixed(2)}</p><p className="text-[8px] text-gray-600 font-bold uppercase">Subtotal</p></div></div>))}</div></div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"><div className="bg-gray-900/40 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 text-center"><p className="text-[8px] sm:text-[9px] text-gray-500 font-black uppercase mb-1">សរុបទំនិញ</p><p className="text-white font-black text-base sm:text-lg">${(order.subtotal || 0).toFixed(2)}</p></div><div className="bg-gray-900/40 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 text-center"><p className="text-[8px] sm:text-[9px] text-gray-500 font-black uppercase mb-1">សេវាដឹក</p><p className="text-white font-black text-base sm:text-lg">${(Number(order.customer.shippingFee) || 0).toFixed(2)}</p></div><div className="col-span-2 bg-blue-600/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-500/20 text-center shadow-lg shadow-blue-900/10"><p className="text-[9px] sm:text-[10px] text-blue-400 font-black uppercase mb-1 tracking-widest">សរុបរួម (Grand Total)</p><p className="text-white font-black text-2xl sm:text-3xl tracking-tighter">${(order.grandTotal || 0).toFixed(2)}</p></div></div>
                        
                        {/* Improved Payment Section */}
                        <fieldset className="border border-gray-700 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gray-900/20">
                            <legend className="px-3 text-[10px] sm:text-xs font-black text-blue-400 uppercase tracking-[0.2em]">ស្ថានភាពទូទាត់</legend>
                            <div className="space-y-6">
                                {/* Segmented Control for Payment Status */}
                                <div className="flex bg-gray-900/80 p-1 rounded-2xl border border-gray-700 max-w-md mx-auto sm:mx-0">
                                    <button 
                                        type="button"
                                        onClick={() => setOrder({...order, payment: {...order.payment, status: 'Unpaid', info: ''}})}
                                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase transition-all flex flex-col items-center gap-1 ${order.payment.status === 'Unpaid' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <span>Unpaid</span>
                                        <span className="text-[8px] opacity-70 tracking-wider">COD</span>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setOrder({...order, payment: {...order.payment, status: 'Paid'}})}
                                        className={`flex-1 py-3 px-4 rounded-xl text-xs font-black uppercase transition-all flex flex-col items-center gap-1 ${order.payment.status === 'Paid' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <span>Paid</span>
                                        <span className="text-[8px] opacity-70 tracking-wider">Transfer</span>
                                    </button>
                                </div>

                                {order.payment.status === 'Paid' && (
                                    <div className="animate-fade-in-down space-y-3">
                                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ជ្រើសរើសគណនីធនាគារ</p>
                                        <BankSelector 
                                            bankAccounts={appData.bankAccounts || []}
                                            selectedBankName={order.payment.info}
                                            onSelect={(bankName) => handleBankChange(bankName)}
                                            fulfillmentStore={order.fulfillmentStore}
                                        />
                                    </div>
                                )}
                            </div>
                        </fieldset>
                        
                        {/* Telegram Scheduling Component */}
                        <TelegramScheduler 
                            schedule={order.telegram.schedule}
                            time={order.telegram.time}
                            onChange={(data) => setOrder({ ...order, telegram: data })}
                        />

                        <div className="space-y-2 sm:space-y-3 pt-4"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">ចំណាំ & Link Google Map</label><textarea placeholder="ចំណាំបន្ថែម..." value={order.note} rows={4} onChange={(e) => setOrder({...order, note: e.target.value})} className="form-textarea bg-gray-900/60 !rounded-[1.5rem] sm:!rounded-[2rem] border-white/5 focus:border-blue-500/50 text-sm"></textarea></div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto mt-2 sm:mt-10 lg:mt-14 px-1 sm:px-0">
             <style>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .btn-shimmer {
                    background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%);
                    background-size: 200% 100%;
                    animation: shimmer 3s infinite linear;
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 15px rgba(37,99,235,0.3); }
                    50% { box-shadow: 0 0 30px rgba(37,99,235,0.6); }
                }
                .btn-pulse { animation: pulse-glow 2s infinite ease-in-out; }
                @keyframes spin-border {
                    from { --angle: 0deg; }
                    to { --angle: 360deg; }
                }
                @property --angle {
                    syntax: '<angle>';
                    initial-value: 0deg;
                    inherits: false;
                }
                .card-flux {
                    position: relative;
                    background: #0f172a;
                    z-index: 1;
                }
                .card-flux-active::after, .card-flux-active::before {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    z-index: -1;
                    background: conic-gradient(from var(--angle), transparent 70%, #3b82f6, #8b5cf6, #ec4899, #3b82f6);
                    border-radius: inherit;
                    animation: spin-border 3s linear infinite;
                }
                .card-flux-active::before {
                    filter: blur(10px);
                    opacity: 0.7;
                }
                @keyframes float-y {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-float-y { animation: float-y 3s ease-in-out infinite; }
                @keyframes pulse-soft {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .animate-pulse-soft { animation: pulse-soft 2s ease-in-out infinite; }
             `}</style>
             {submissionStatus && (<div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4"><div className="page-card text-center flex flex-col items-center animate-fade-in-scale">{submissionStatus.type === 'success' ? (<div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4 border border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.2)]"><svg className="h-8 w-8 sm:h-10 sm:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></div>) : (<div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-500/30"><svg className="h-8 w-8 sm:h-10 sm:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></div>)}<p className="text-base sm:text-lg font-black text-white">{submissionStatus.message}</p></div></div>)}
            <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} url={mapSearchUrl} />
            {isScannerVisible && <BarcodeScannerModal onClose={() => setIsScannerVisible(false)} onCodeScanned={handleCodeScanned} scanMode={scanMode} setScanMode={setScanMode} productsInOrder={order.products} masterProducts={appData.products || []} />}
            <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} maxWidth="max-w-sm"><div className="p-6 text-center space-y-6"><div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20 shadow-xl shadow-red-900/10 animate-bounce-slow"><svg className="h-7 w-7 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div><h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter">បោះបង់ការបញ្ចូល?</h3><div className="flex gap-3"><button onClick={() => setIsCancelModalOpen(false)} className="px-6 py-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-2xl flex-1 font-black text-xs sm:text-sm transition-all hover:bg-gray-700 active:scale-95">ទេ (ត្រឡប់)</button><button onClick={handleConfirmCancel} className="px-6 py-3 bg-red-600 border border-red-500 text-white rounded-2xl flex-1 font-black text-xs sm:text-sm transition-all hover:bg-red-700 active:scale-95 shadow-lg shadow-red-900/20">បាទ (បោះបង់)</button></div></div></Modal>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-10 gap-4">
                <h1 className="hidden md:flex text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter items-center gap-3 sm:gap-4">
                    <span className="text-blue-500">កុម្ម៉ង់ថ្មី</span>
                    <span className="text-[9px] sm:text-[10px] bg-blue-600/20 text-blue-400 px-3 sm:px-4 py-1.5 rounded-full border border-blue-500/20 uppercase tracking-[0.15em] sm:tracking-[0.2em]">{team}</span>
                </h1>
                <button onClick={handleCancelClick} className="hidden md:block px-6 py-2.5 bg-gray-800 border border-gray-700 hover:border-red-500 hover:bg-red-500/10 text-gray-400 hover:text-red-400 font-black rounded-2xl uppercase text-[10px] sm:text-[11px] tracking-widest transition-all active:scale-90">បោះបង់</button>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-3xl border border-white/5 rounded-[1.5rem] sm:rounded-[3rem] p-3 sm:p-10 shadow-2xl">
                <div className="flex justify-between items-center mb-8 sm:mb-12 relative px-2 sm:px-4">
                    <div className="absolute left-6 right-6 sm:left-10 sm:right-10 top-1/2 w-[calc(100%-48px)] sm:w-[calc(100%-80px)] h-0.5 bg-gray-700 -z-10"></div>
                    <div className="absolute left-6 sm:left-10 top-1/2 h-0.5 bg-blue-500 -z-10 transition-all duration-500" style={{ width: `${((currentStep-1)/(STEPS.length-1)) * (100 - (48/400)*100)}%` }}></div>
                    {STEPS.map(step => (
                        <div key={step.number} className={`relative flex flex-col items-center z-10 transition-all duration-500 ${currentStep >= step.number ? 'scale-110' : 'opacity-40 scale-90'}`}>
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-[10px] sm:text-xs border-2 transition-all duration-500 ${currentStep >= step.number ? 'border-blue-500 bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'border-gray-600 bg-gray-800 text-gray-500'}`}>{currentStep > step.number ? "✓" : step.number}</div>
                            <span className={`absolute -bottom-6 sm:-bottom-7 text-[8px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${currentStep >= step.number ? 'text-blue-400' : 'text-gray-600'}`}>{step.title}</span>
                        </div>
                    ))}
                </div>
                 
                 
                <div className="mt-8 sm:mt-16">{renderStepContent()}</div>
                
                {error && <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-xl sm:rounded-2xl text-red-400 text-center text-[10px] sm:text-xs font-bold animate-shake">{error}</div>}
                
                <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-white/5 space-y-3 sm:space-y-4">
                    <div className="flex gap-3 sm:gap-4 h-12 sm:h-16">
                        {currentStep > 1 && (
                            <button type="button" onClick={prevStep} className="flex-1 px-4 sm:px-8 bg-gray-800 border border-gray-700 text-gray-300 rounded-2xl font-black uppercase text-[10px] sm:text-[12px] tracking-[0.15em] transition-all hover:bg-gray-700 flex items-center justify-center gap-2 active:scale-95"><svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M15 19l-7-7 7-7"/></svg>ត្រឡប់</button>
                        )}
                        
                        {currentStep < STEPS.length ? (
                            <button type="button" onClick={nextStep} className="relative flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-[12px] sm:text-[14px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 group overflow-hidden btn-pulse"><div className="absolute inset-0 btn-shimmer pointer-events-none"></div><span className="relative z-10">ជំហានបន្ទាប់</span><svg className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M9 5l7 7-7 7"/></svg></button>
                        ) : (
                             <button type="button" onClick={submitOrder} className="relative flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-[12px] sm:text-[14px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 overflow-hidden" disabled={loading}><div className="absolute inset-0 btn-shimmer pointer-events-none"></div>{loading && undoTimer === null ? <Spinner size="sm" /> : <><span className="relative z-10">បញ្ជូនកម្ម៉ង់ឥឡូវនេះ</span><svg className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 animate-bounce-x" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7"/></svg></>}</button>
                        )}
                    </div>
                    <button onClick={handleCancelClick} className="md:hidden w-full py-4 bg-gray-800/40 text-gray-500 hover:text-red-400 font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all active:scale-95 border border-white/5">បោះបង់ការបញ្ចូល</button>
                </div>
            </div>

            {/* UNDO / GRACE PERIOD OVERLAY */}
            {undoTimer !== null && (
                <div className={`fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md transition-all duration-500 ${isUndoing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                    <div className="relative bg-[#0f172a]/90 border border-white/10 rounded-[2.5rem] p-8 sm:p-12 w-full max-w-sm shadow-[0_20px_70px_rgba(0,0,0,0.5)] text-center overflow-hidden ring-1 ring-white/10">
                        {/* Background Decorative Glow */}
                        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 blur-[80px] rounded-full pointer-events-none"></div>
                        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 blur-[80px] rounded-full pointer-events-none"></div>

                        {/* Circular Progress & Icon */}
                        <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                                {/* Background Circle */}
                                <circle 
                                    cx="50" cy="50" r="45" 
                                    className="stroke-gray-800 fill-none" 
                                    strokeWidth="6" 
                                />
                                {/* Progress Circle */}
                                <circle 
                                    cx="50" cy="50" r="45" 
                                    className="stroke-emerald-500 fill-none transition-all duration-1000 ease-linear" 
                                    strokeWidth="6" 
                                    strokeDasharray={2 * Math.PI * 45}
                                    strokeDashoffset={2 * Math.PI * 45 * (1 - undoTimer / 7)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-white font-mono leading-none">{undoTimer}</span>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">Seconds</span>
                            </div>
                        </div>

                        <div className="space-y-2 mb-10">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">រួចរាល់ហើយ!</h3>
                            <p className="text-gray-400 text-sm font-medium px-4">ការកម្ម៉ង់របស់អ្នកនឹងត្រូវបានបញ្ជូនទៅកាន់ប្រព័ន្ធក្នុងពេលបន្តិចទៀតនេះ...</p>
                        </div>

                        <button 
                            onClick={handleUndo}
                            className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-[0_10px_25px_rgba(239,68,68,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <svg className="w-5 h-5 relative z-10 group-hover:-rotate-90 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            <span className="relative z-10">បញ្ឈប់ការបញ្ជូន (Undo)</span>
                        </button>
                        
                        <p className="mt-6 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] animate-pulse-soft">Processing Order...</p>
                    </div>
                </div>
            )}

            <style>{`.animate-bounce-x { animation: bounce-x 1s infinite ease-in-out; } @keyframes bounce-x { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(5px); } }`}</style>
        </div>
    );
};

export default CreateOrderPage;
