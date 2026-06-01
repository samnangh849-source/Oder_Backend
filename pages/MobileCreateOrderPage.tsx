import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import { useSoundEffects } from '../hooks/useSoundEffects';
import OrderGracePeriod from '../components/orders/OrderGracePeriod';
import Spinner from '../components/common/Spinner';
import SearchableProductDropdown from '../components/common/SearchableProductDropdown';
import SearchableProvinceDropdown from '../components/orders/SearchableProvinceDropdown';
import ShippingMethodDropdown from '../components/common/ShippingMethodDropdown';
import SearchablePageDropdown from '../components/common/SearchablePageDropdown';
import BankSelector from '../components/orders/BankSelector';
import DriverSelector from '../components/orders/DriverSelector';
import SetQuantity from '../components/orders/SetQuantity';
import TelegramScheduler from '../components/orders/TelegramScheduler';
import { WEB_APP_URL } from '../constants';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import { TeamPage } from '../types';

interface MobileCreateOrderPageProps {
    team: string;
    onSaveSuccess: () => void;
    onCancel: () => void;
}

const STEPS = [
    { number: 1, title: 'ផលិតផល' },
    { number: 2, title: 'អតិថិជន' },
    { number: 3, title: 'ដឹកជញ្ជូន' },
    { number: 4, title: 'ផ្ទៀងផ្ទាត់' },
];

const MobileCreateOrderPage: React.FC<MobileCreateOrderPageProps> = ({ team, onSaveSuccess, onCancel }) => {
    const { appData, currentUser, language, previewImage, advancedSettings, refreshData } = useContext(AppContext);
    const { playSuccess } = useSoundEffects();
    const t = translations[language];

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recommendationMessage, setRecommendationMessage] = useState<string>('');
    const [carrierLogo, setCarrierLogo] = useState<string>('');

    // Undo Timer State
    const [undoTimer, setUndoTimer] = useState<number | null>(null);
    const [maxUndoTimer, setMaxUndoTimer] = useState<number>(5);
    const [isUndoing, setIsUndoing] = useState(false);
    const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const submitIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const teamPages = useMemo(() => {
        if (!appData.pages) return [];
        const requestedTeam = (team || '').trim().toLowerCase();
        return appData.pages.filter((p: TeamPage) => (p.Team || '').trim().toLowerCase() === requestedTeam);
    }, [appData.pages, team]);

    // Order State
    const [order, setOrder] = useState<any>({
        page: '',
        telegramValue: '',
        fulfillmentStore: '',
        customer: { name: '', phone: '', province: '', district: '', sangkat: '', additionalLocation: '', shippingFee: 0 },
        Products: [],
        shipping: { method: '', cost: 0, service: '' },
        payment: { status: 'Unpaid', info: '' },
        telegram: { schedule: false, time: '' },
        note: '',
        Subtotal: 0,
        grandTotal: 0
    });

    useEffect(() => {
        if (teamPages.length === 1 && !order.page) {
            const pageData = teamPages[0];
            setOrder((prev: any) => ({ 
                ...prev, 
                page: pageData.PageName, 
                telegramValue: pageData.TelegramValue, 
                fulfillmentStore: pageData.DefaultStore || prev.fulfillmentStore 
            }));
        }
    }, [teamPages, order.page]);

    useEffect(() => {
        if (order.fulfillmentStore && order.customer.province && appData.driverRecommendations) {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const today = days[new Date().getDay()];
            
            const recommendation = appData.driverRecommendations.find(r => 
                r.DayOfWeek === today && 
                r.StoreName === order.fulfillmentStore && 
                r.Province === order.customer.province
            );

            if (recommendation) {
                const method = appData.shippingMethods?.find(m => m.MethodName === recommendation.ShippingMethod);
                if (method) {
                    setOrder(prev => ({
                        ...prev,
                        shipping: {
                            ...prev.shipping,
                            method: method.MethodName,
                            service: recommendation.DriverName,
                            cost: method.InternalCost || prev.shipping.cost
                        }
                    }));
                    setRecommendationMessage(`នៅសាខា ${recommendation.StoreName} ថ្ងៃនេះ វេនដឹករបស់ ${recommendation.DriverName}`);
                    return;
                }
            }
        }
        setRecommendationMessage('');
    }, [order.fulfillmentStore, order.customer.province, appData.driverRecommendations, appData.shippingMethods]);

    useEffect(() => {
        const subtotal = order.Products.reduce((acc: number, p: any) => acc + (p.price * p.quantity), 0);
        const grandTotal = subtotal + (Number(order.customer.shippingFee) || 0);
        if (subtotal !== order.Subtotal || grandTotal !== order.grandTotal) {
            setOrder((prev: any) => ({ ...prev, Subtotal: subtotal, grandTotal: grandTotal }));
        }
    }, [order.Products, order.customer.shippingFee]);

    const updateOrder = (updates: any) => setOrder((prev: any) => ({ ...prev, ...updates }));

    const handlePhoneChange = (value: string) => {
        let phoneNumber = value.replace(/[^0-9]/g, '');
        if (phoneNumber.length > 1 && phoneNumber.startsWith('00')) phoneNumber = '0' + phoneNumber.substring(2);
        else if (phoneNumber.length > 0 && !phoneNumber.startsWith('0')) phoneNumber = '0' + phoneNumber;
        
        let foundCarrier = null;
        if (phoneNumber.length >= 2 && appData.phoneCarriers) { 
            foundCarrier = appData.phoneCarriers.find((carrier: any) => (carrier.Prefixes || '').split(',').some((prefix: string) => phoneNumber.startsWith(prefix.trim()))); 
        }
        setCarrierLogo(foundCarrier ? convertGoogleDriveUrl(foundCarrier.CarrierLogoURL) : '');
        setOrder((prev: any) => ({ ...prev, customer: { ...prev.customer, phone: phoneNumber } }));
    };

    const validateStep = (step: number) => {
        setError(null);
        switch (step) {
            case 1:
                if (order.Products.length === 0) { setError('សូមជ្រើសរើសផលិតផលយ៉ាងតិចមួយ។'); return false; }
                return true;
            case 2:
                if (!order.customer.name || !order.customer.phone || !order.customer.province || !order.page || !order.fulfillmentStore) {
                    setError('សូមបំពេញឈ្មោះ, លេខទូរស័ព្ទ, ខេត្ត, Page និងឃ្លាំង។'); return false;
                }
                return true;
            case 3:
                if (!order.shipping.method) { setError('សូមជ្រើសរើសសេវាកម្មដឹកជញ្ជូន។'); return false; }
                return true;
            case 4:
                if (order.telegram.schedule && !order.telegram.time) { setError('សូមជ្រើសរើសពេលវេលាផ្ញើសារ។'); return false; }
                return true;
            default: return true;
        }
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => prev - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleUndo = () => {
        setIsUndoing(true);
        if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
        if (submitIntervalRef.current) clearInterval(submitIntervalRef.current);
        
        setTimeout(() => {
            setUndoTimer(null);
            setIsUndoing(false);
            setLoading(false);
        }, 500);
    };

    const executeSubmit = async () => {
        setLoading(true);
        let phoneToSend = '0' + order.customer.phone.replace(/[^0-9]/g, '').replace(/^0+/, '');
        const addressParts = [order.customer.additionalLocation, order.customer.sangkat, order.customer.district].filter(Boolean);
        const fullAddress = addressParts.join(', ');
        let scheduledTimeStr = order.telegram.schedule ? order.telegram.time : '';
        if (scheduledTimeStr) scheduledTimeStr = scheduledTimeStr.replace('T', ' ');

        const payload = { 
            currentUser, 
            selectedTeam: team, 
            page: order.page, 
            telegramValue: order.telegramValue, 
            customer: { ...order.customer, phone: phoneToSend, shippingFee: Number(order.customer.shippingFee) || 0 }, 
            "Customer Name": order.customer.name,
            "Customer Phone": phoneToSend,
            "Location": order.customer.province,
            "Address Details": fullAddress,
            "Internal Shipping Method": order.shipping.method,
            "Internal Shipping Details": order.shipping.service,
            "Internal Cost": Number(order.shipping.cost) || 0,
            "Payment Status": order.payment.status,
            "Payment Info": order.payment.info,
            "Fulfillment Store": order.fulfillmentStore,
            products: order.Products.map((p: any) => ({ 
                name: p.name, 
                quantity: Number(p.quantity) || 1, 
                originalPrice: Number(p.price) || 0, 
                finalPrice: Number(p.price) || 0, 
                total: Number(p.price * p.quantity) || 0, 
                cost: Number(p.cost) || 0,
                image: p.image
            })), 
            subtotal: Number(order.Subtotal) || 0, 
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
            if (res.ok && result.status === 'success') {
                playSuccess();
                await refreshData();
                onSaveSuccess();
            } else {
                throw new Error(result.message || 'Submit failed');
            }
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        if (!validateStep(4)) return;
        
        setLoading(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

        const grace = advancedSettings?.placingOrderGracePeriod || 5;
        setMaxUndoTimer(grace);
        setUndoTimer(grace);

        let timeLeft = grace;
        submitIntervalRef.current = setInterval(() => {
            timeLeft -= 1;
            setUndoTimer(timeLeft);
            if (timeLeft <= 0) clearInterval(submitIntervalRef.current!);
        }, 1000);

        submitTimeoutRef.current = setTimeout(executeSubmit, grace * 1000);
    };

    const provinces = useMemo(() => {
        if (!appData.locations) return [];
        return [...new Set(appData.locations.map((loc: any) => loc.Province))];
    }, [appData.locations]);

    return (
        <div className="min-h-screen bg-[#020617] pb-32">
            {/* Header Stepper */}
            <div className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={onCancel} className="text-gray-500 text-[10px] font-black uppercase tracking-widest">បោះបង់</button>
                    <span className="text-white text-[11px] font-black uppercase tracking-[0.3em]">បង្កើតការកម្មង់ថ្មី</span>
                    <div className="w-10"></div>
                </div>
                <div className="flex items-center justify-between relative">
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5 -translate-y-1/2 z-0"></div>
                    {STEPS.map((s) => (
                        <div key={s.number} className="relative z-10 flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-500 ${currentStep >= s.number ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-900 text-gray-600 border border-white/5'}`}>
                                {s.number}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest ${currentStep >= s.number ? 'text-blue-400' : 'text-gray-600'}`}>{s.title}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="px-6 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-shake">
                        <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2}/></svg>
                        <p className="text-red-500 text-xs font-bold">{error}</p>
                    </div>
                )}

                {currentStep === 1 && (
                    <div className="space-y-6 animate-reveal">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ជ្រើសរើសផលិតផល</label>
                            <SearchableProductDropdown 
                                products={appData.products} 
                                onSelect={(p) => updateOrder({ Products: [...order.Products, { ...p, quantity: 1, price: p.Price, name: p.ProductName, image: p.ImageURL }] })}
                            />
                        </div>
                        {/* Selected Products List */}
                        <div className="space-y-3 mt-8">
                            {order.Products.map((p: any, i: number) => (
                                <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex items-center gap-4">
                                    <img src={convertGoogleDriveUrl(p.image)} className="w-12 h-12 rounded-xl object-cover" />
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-white text-xs font-bold truncate">{p.name}</h4>
                                        <p className="text-blue-400 text-[10px] font-black">${p.price}</p>
                                    </div>
                                    <SetQuantity 
                                        value={p.quantity} 
                                        onChange={(q) => {
                                            const newProds = [...order.Products];
                                            newProds[i].quantity = q;
                                            updateOrder({ Products: newProds });
                                        }}
                                    />
                                    <button onClick={() => updateOrder({ Products: order.Products.filter((_: any, idx: number) => idx !== i) })} className="text-red-500 p-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5}/></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-6 animate-reveal">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ព័ត៌មានអតិថិជន & Page</label>
                            <SearchablePageDropdown 
                                pages={teamPages}
                                selectedPageName={order.page}
                                onSelect={(pageData) => updateOrder({ 
                                    page: pageData.PageName, 
                                    telegramValue: pageData.TelegramValue, 
                                    fulfillmentStore: pageData.DefaultStore || order.fulfillmentStore 
                                })}
                            />
                            
                            <div className="grid grid-cols-2 gap-3">
                                {appData.stores?.map((s: any) => (
                                    <button key={s.StoreName} onClick={() => updateOrder({ fulfillmentStore: s.StoreName })} className={`p-4 rounded-2xl border-2 text-[10px] font-black uppercase transition-all ${order.fulfillmentStore === s.StoreName ? 'bg-orange-500/10 border-orange-500 text-white' : 'bg-slate-900 border-white/5 text-gray-500'}`}>{s.StoreName}</button>
                                ))}
                            </div>

                            <input type="text" placeholder="ឈ្មោះអតិថិជន*" className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white text-sm" value={order.customer.name} onChange={e => updateOrder({ customer: { ...order.customer, name: e.target.value } })} />
                            
                            <div className="relative">
                                <input type="tel" placeholder="លេខទូរស័ព្ទ*" className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white text-sm pr-12" value={order.customer.phone} onChange={e => handlePhoneChange(e.target.value)} />
                                {carrierLogo && <img src={carrierLogo} className="absolute right-4 top-4 h-6 w-auto object-contain" />}
                            </div>

                            <SearchableProvinceDropdown 
                                provinces={provinces}
                                selectedProvince={order.customer.province}
                                onSelect={(val) => updateOrder({ customer: { ...order.customer, province: val } })}
                            />
                            
                            <input type="text" placeholder="ទីតាំងលម្អិត..." className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white text-sm" value={order.customer.additionalLocation} onChange={e => updateOrder({ customer: { ...order.customer, additionalLocation: e.target.value } })} />
                            
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ថ្លៃសេវាដឹកជញ្ជូន</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[0, 1, 1.5, 2].map(fee => (
                                        <button key={fee} onClick={() => updateOrder({ customer: { ...order.customer, shippingFee: fee } })} className={`py-3 rounded-xl border text-[10px] font-black ${order.customer.shippingFee === fee ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-white/5 text-gray-500'}`}>{fee === 0 ? 'FREE' : `$${fee}`}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-8 animate-reveal">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">សេវាដឹកជញ្ជូន*</label>
                            {recommendationMessage && (
                                <div className="mb-4 p-4 bg-blue-600/10 border border-blue-500/20 rounded-3xl flex items-center gap-3 animate-pulse">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                    <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest leading-relaxed">{recommendationMessage}</span>
                                </div>
                            )}
                            <ShippingMethodDropdown 
                                methods={appData.shippingMethods || []} 
                                selectedMethodName={order.shipping.method} 
                                onSelect={(method) => {
                                    let recommendedDriver = '';
                                    if (method.EnableDriverRecommendation) {
                                        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                        const today = days[new Date().getDay()];

                                        const recommendation = appData.driverRecommendations?.find(r => 
                                            r.DayOfWeek === today && 
                                            r.StoreName === (order.fulfillmentStore || '') && 
                                            r.Province === order.customer.province &&
                                            r.ShippingMethod === method.MethodName
                                        );

                                        if (recommendation) {
                                            recommendedDriver = recommendation.DriverName;
                                        }
                                    }

                                    setOrder((prev: any) => ({
                                        ...prev,
                                        shipping: {
                                            ...prev.shipping,
                                            method: method.MethodName,
                                            cost: method.InternalCost || prev.shipping.cost,
                                            service: method.RequireDriverSelection ? (recommendedDriver || '') : ''
                                        }
                                    }));
                                }}
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ថ្លៃសេវាឲ្យអ្នកដឹក (Internal Cost)*</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    className="w-full bg-white/5 border border-white/5 rounded-3xl p-5 text-white font-black text-xl pr-12 focus:border-blue-500/50 outline-none transition-all" 
                                    value={order.shipping.cost} 
                                    onChange={e => updateOrder({ shipping: { ...order.shipping, cost: e.target.value } })}
                                />
                                <div className="absolute right-0 top-0 bottom-0 pr-6 flex items-center pointer-events-none">
                                    <span className="text-gray-500 font-bold text-lg">$</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(() => {
                                    const method = appData.shippingMethods?.find(m => m.MethodName === order.shipping.method);
                                    const shortcuts = method?.CostShortcuts ? method.CostShortcuts.split(',').map(s => parseFloat(s.trim())) : [1.25, 1.5, 2];
                                    return shortcuts.map(cost => (
                                        <button key={cost} onClick={() => updateOrder({ shipping: { ...order.shipping, cost } })} className={`flex-1 min-w-[70px] py-4 rounded-2xl font-black text-xs border transition-all ${parseFloat(order.shipping.cost) === cost ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-gray-400 active:bg-white/10'}`}>${cost}</button>
                                    ));
                                })()}
                            </div>
                        </div>

                        {appData.shippingMethods?.find(m => m.MethodName === order.shipping.method)?.RequireDriverSelection && (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2">ជ្រើសរើសអ្នកដឹក*</label>
                                <DriverSelector 
                                    drivers={appData.drivers || []} 
                                    selectedDriverName={order.shipping.service} 
                                    onSelect={(val) => updateOrder({ shipping: { ...order.shipping, service: val } })}
                                />
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="space-y-6 animate-reveal">
                        <div className="bg-white/5 border border-white/5 p-6 rounded-[2.5rem] space-y-4">
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">ស្ថានភាពទូទាត់</span>
                                <div className="flex bg-slate-900 p-1 rounded-xl">
                                    <button onClick={() => updateOrder({ payment: { ...order.payment, status: 'Unpaid', info: '' } })} className={`px-4 py-2 rounded-lg text-[10px] font-black ${order.payment.status === 'Unpaid' ? 'bg-red-600 text-white' : 'text-gray-500'}`}>UNPAID</button>
                                    <button onClick={() => updateOrder({ payment: { ...order.payment, status: 'Paid' } })} className={`px-4 py-2 rounded-lg text-[10px] font-black ${order.payment.status === 'Paid' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}>PAID</button>
                                </div>
                            </div>
                            {order.payment.status === 'Paid' && (
                                <BankSelector 
                                    bankAccounts={appData.bankAccounts || []}
                                    selectedBankName={order.payment.info}
                                    onSelect={(bankName) => updateOrder({ payment: { ...order.payment, info: bankName } })}
                                    fulfillmentStore={order.fulfillmentStore}
                                />
                            )}
                        </div>

                        <TelegramScheduler 
                            schedule={order.telegram.schedule}
                            time={order.telegram.time}
                            onChange={(data) => updateOrder({ telegram: data })}
                        />

                        <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-[2.5rem] flex justify-between items-center">
                            <div>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">សរុបរួម</p>
                                <p className="text-3xl font-black text-white tracking-tighter">${order.grandTotal.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">ទំនិញ {order.Products.length}</p>
                                <p className="text-gray-400 text-xs font-bold italic">ដឹកជូន {order.customer.province}</p>
                            </div>
                        </div>

                        <textarea placeholder="ចំណាំបន្ថែម..." value={order.note} rows={4} onChange={(e) => updateOrder({ note: e.target.value })} className="w-full bg-white/5 border border-white/5 rounded-[2rem] p-6 text-white text-sm focus:border-blue-500/50 outline-none transition-all"></textarea>
                    </div>
                )}
            </div>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#020617] via-[#020617] to-transparent z-40">
                <div className="flex gap-3">
                    {currentStep > 1 && (
                        <button onClick={handlePrev} className="flex-1 py-5 bg-white/5 text-gray-400 rounded-[1.8rem] font-black uppercase text-[11px] tracking-widest border border-white/5">ថយក្រោយ</button>
                    )}
                    {currentStep < 4 ? (
                        <button onClick={handleNext} className="flex-[2] py-5 bg-blue-600 text-white rounded-[1.8rem] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-blue-900/40">បន្ទាប់</button>
                    ) : (
                        <button onClick={handleSubmit} className="flex-[2] py-5 bg-emerald-600 text-white rounded-[1.8rem] font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-900/40" disabled={loading}>{loading ? 'កំពុងបញ្ជូន...' : 'បញ្ជូនការកម្មង់'}</button>
                    )}
                </div>
            </div>

            {/* Grace Period Overlay */}
            {undoTimer !== null && (
                <OrderGracePeriod 
                    timer={undoTimer} 
                    maxTimer={maxUndoTimer} 
                    onUndo={handleUndo} 
                    isUndoing={isUndoing} 
                />
            )}
        </div>
    );
};

export default MobileCreateOrderPage;
