
import React, { useState, useMemo, useContext } from 'react';
import { ParsedOrder, User, AppData } from '../../types';
import SelectFilter from './filters/SelectFilter';
import DateWindowFilter from './filters/DateWindowFilter';
import SearchableProductDropdown from '../common/SearchableProductDropdown';
import { AppContext } from '../../context/AppContext';
import { useFilterEngine, FilterState, initialFilterState } from '../../hooks/useFilterEngine';
import { 
    Calendar, User as UserIcon, Users, CreditCard, 
    Truck, Warehouse, MapPin, Package, RotateCcw, 
    Check, Search, ShieldCheck, Tag, LayoutDashboard
} from 'lucide-react';

interface MobileFilterEngineProps {
    filters: FilterState;
    setFilters: (filters: FilterState) => void;
    orders: ParsedOrder[];
    usersList: User[];
    appData: AppData;
    calculatedRange: string;
    onApply: () => void;
}

const MobileFilterEngine: React.FC<MobileFilterEngineProps> = ({
    filters, setFilters, orders, usersList, appData, calculatedRange, onApply
}) => {
    const { language } = useContext(AppContext);
    const { uniqueValues } = useFilterEngine(orders, appData);
    const [activeCategory, setActiveCategory] = useState<string | null>('date');

    const updateFilter = (key: keyof FilterState, value: string) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleReset = () => {
        setFilters(initialFilterState);
    };

    const getActiveCount = (id: string) => {
        const getCount = (key: keyof FilterState) => {
            const val = filters[key];
            if (!val || val === 'all' || val === 'All') return 0;
            if (key === 'datePreset' && val === 'this_month') return 0;
            return String(val).split(',').filter(v => v).length;
        };

        switch(id) {
            case 'date': return getCount('datePreset');
            case 'customer': return getCount('customerName') + (filters.customerSearch ? 1 : 0);
            case 'ops': return getCount('fulfillmentStatus') + getCount('telegramStatus') + getCount('paymentStatus') + getCount('isVerified');
            case 'team': return getCount('team') + getCount('user') + getCount('store') + getCount('page');
            case 'logistics': return getCount('shippingService') + getCount('driver') + getCount('fulfillmentStore') + getCount('location');
            case 'product': return getCount('product') + getCount('internalCost') + getCount('bank');
            default: return 0;
        }
    };

    // Logical grouping of categories for better UX
    const sections = [
        {
            title: language === 'km' ? 'ពេលវេលា និងអតិថិជន' : 'Time & Identity',
            items: [
                { id: 'date', label: language === 'km' ? 'ចន្លោះកាលបរិច្ឆេទ' : 'Time Window', icon: <Calendar size={18} />, value: filters.datePreset === 'custom' ? `${filters.startDate} - ${filters.endDate}` : filters.datePreset },
                { id: 'customer', label: language === 'km' ? 'ស្វែងរកអតិថិជន' : 'Customer Search', icon: <UserIcon size={18} />, value: filters.customerName || filters.customerSearch ? 'Configured' : '' }
            ]
        },
        {
            title: language === 'km' ? 'ប្រតិបត្តិការ និងក្រុម' : 'Operations & Teams',
            items: [
                { id: 'ops', label: language === 'km' ? 'ស្ថានភាពប្រតិបត្តិការ' : 'Operations', icon: <LayoutDashboard size={18} />, value: 'Status & Verification' },
                { id: 'team', label: language === 'km' ? 'ក្រុម និងអ្នកប្រើប្រាស់' : 'Teams & Sources', icon: <Users size={18} />, value: 'Organization' },
            ]
        },
        {
            title: language === 'km' ? 'ដឹកជញ្ជូន និងឃ្លាំង' : 'Logistics & Infrastructure',
            items: [
                { id: 'logistics', label: language === 'km' ? 'ដឹកជញ្ជូន និងទីតាំង' : 'Logistics', icon: <Truck size={18} />, value: 'Shipping & Warehouse' },
            ]
        },
        {
            title: language === 'km' ? 'ព័ត៌មានទំនិញ' : 'Asset & Financial',
            items: [
                { id: 'product', label: language === 'km' ? 'ទំនិញ និងហិរញ្ញវត្ថុ' : 'Assets', icon: <Package size={18} />, value: filters.product || filters.bank ? 'Product & Bank' : '' }
            ]
        }
    ];

    const totalActiveFilters = useMemo(() => {
        let count = 0;
        sections.forEach(s => s.items.forEach(i => count += getActiveCount(i.id)));
        return count;
    }, [filters]);

    return (
        <div className="flex flex-col h-full bg-[#0B0E11] relative overflow-hidden">
            <style>{`
                .filter-category-card {
                    background: #1E2329;
                    border: 1px solid #2B3139;
                    border-radius: 2px;
                    transition: all 0.15s ease-in-out;
                }
                .filter-category-card.active {
                    border-color: #FCD535;
                    background: #181A20;
                }
                .section-title {
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: #707A8A;
                    margin-bottom: 12px;
                    margin-left: 4px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .section-title::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: #2B3139;
                }
            `}</style>

            {/* Summary Header */}
            <div className="flex-shrink-0 px-5 py-4 bg-[#1E2329] border-b border-[#2B3139] flex justify-between items-center sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-6 bg-[#FCD535] rounded-full"></div>
                    <div>
                        <h3 className="text-xs font-black text-[#EAECEF] uppercase tracking-widest">{language === 'km' ? 'ម៉ាស៊ីនចម្រោះ' : 'Filter Engine'}</h3>
                        <p className="text-[9px] font-bold text-[#FCD535] uppercase">
                            {totalActiveFilters > 0 ? `${totalActiveFilters} ${language === 'km' ? 'ប៉ារ៉ាម៉ែត្រកំពុងសកម្ម' : 'Parameters Active'}` : (language === 'km' ? 'បង្ហាញទិន្នន័យទាំងអស់' : 'All context visible')}
                        </p>
                    </div>
                </div>
                <button onClick={handleReset} className="p-2 bg-[#2B3139] text-[#F6465D] rounded-sm active:scale-90 transition-all border border-transparent active:border-[#F6465D]/30">
                    <RotateCcw size={16} />
                </button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar px-4 pt-6 pb-32 space-y-8">
                {sections.map((section, sIdx) => (
                    <div key={sIdx}>
                        <h4 className="section-title">{section.title}</h4>
                        <div className="grid grid-cols-1 gap-2">
                            {section.items.map(cat => {
                                const isActive = activeCategory === cat.id;
                                const count = getActiveCount(cat.id);
                                return (
                                    <div key={cat.id} className="flex flex-col">
                                        <button 
                                            onClick={() => setActiveCategory(isActive ? null : cat.id)}
                                            className={`filter-category-card flex items-center justify-between p-4 ${isActive ? 'active' : ''}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-sm flex items-center justify-center transition-all ${isActive ? 'text-[#FCD535]' : 'text-[#707A8A]'}`}>
                                                    {cat.icon}
                                                </div>
                                                <div className="text-left">
                                                    <p className={`text-[12px] font-bold uppercase tracking-tight ${isActive ? 'text-[#FCD535]' : 'text-[#EAECEF]'}`}>{cat.label}</p>
                                                    {cat.value && !isActive && <p className="text-[10px] text-[#FCD535] font-medium mt-1 truncate max-w-[180px] opacity-80">{cat.value.replace(/,/g, ', ')}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {count > 0 && <span className="bg-[#FCD535] text-[#181A20] text-[10px] font-black px-1.5 py-0.5 rounded-sm">{count}</span>}
                                                <svg className={`w-4 h-4 text-[#474D57] transition-transform duration-300 ${isActive ? 'rotate-180 text-[#FCD535]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>
                                            </div>
                                        </button>

                                        {isActive && (
                                            <div className="mt-1 mb-3 p-4 bg-[#181A20] border border-[#2B3139] space-y-6 shadow-inner animate-reveal">
                                                {cat.id === 'date' && (
                                                    <DateWindowFilter 
                                                        datePreset={filters.datePreset}
                                                        setDatePreset={(v) => setFilters({ ...filters, datePreset: v })}
                                                        startDate={filters.startDate}
                                                        setStartDate={(v) => updateFilter('startDate', v)}
                                                        endDate={filters.endDate}
                                                        setEndDate={(v) => updateFilter('endDate', v)}
                                                        calculatedRange={calculatedRange}
                                                    />
                                                )}
                                                {cat.id === 'customer' && (
                                                    <div className="space-y-6">
                                                        <SelectFilter label={language === 'km' ? 'ស្វែងរកអតិថិជន' : 'Customer Database'} value={filters.customerName} onChange={v => updateFilter('customerName', v)} options={uniqueValues.customerOptions} multiple={true} isInline={true} />
                                                        <div className="px-1">
                                                            <label className="text-[10px] font-black text-[#707A8A] mb-3 block uppercase tracking-widest ml-1">{language === 'km' ? 'ស្វែងរកអត្ថបទ' : 'Direct Text Search'}</label>
                                                            <div className="relative group">
                                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-[#FCD535] transition-colors" />
                                                                <input 
                                                                    type="text"
                                                                    value={filters.customerSearch}
                                                                    onChange={(e) => updateFilter('customerSearch', e.target.value)}
                                                                    placeholder="Name, Phone, ID..."
                                                                    className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm py-3.5 pl-11 pr-4 text-sm text-white focus:border-[#FCD535] outline-none transition-all"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {cat.id === 'ops' && (
                                                    <div className="space-y-8">
                                                        <SelectFilter 
                                                            label="Fulfillment Status" 
                                                            value={filters.fulfillmentStatus} 
                                                            onChange={v => updateFilter('fulfillmentStatus', v)} 
                                                            options={[
                                                                { label: 'Pending (រង់ចាំ)', value: 'Pending' },
                                                                { label: 'Scheduled (បានកំណត់ពេល)', value: 'Scheduled' },
                                                                { label: 'Processing (កំពុងរៀបចំ)', value: 'Processing' },
                                                                { label: 'Ready to Ship (រួចរាល់សម្រាប់ផ្ញើ)', value: 'Ready to Ship' },
                                                                { label: 'Shipped (បានផ្ញើចេញ)', value: 'Shipped' },
                                                                { label: 'Delivered (បានប្រគល់)', value: 'Delivered' },
                                                                { label: 'Cancelled (បានបោះបង់)', value: 'Cancelled' },
                                                                { label: 'Returned (បានបង្វិលវិញ)', value: 'Returned' }
                                                            ]} 
                                                            multiple={true} 
                                                            isInline={true} 
                                                        />
                                                        <div className="grid grid-cols-1 gap-6">
                                                            <SelectFilter label="Payment Status" value={filters.paymentStatus} onChange={v => updateFilter('paymentStatus', v)} options={[{label:'Paid', value:'Paid'}, {label:'Unpaid (COD)', value:'Unpaid'}]} multiple={true} variant="payment" isInline={false} />
                                                            <SelectFilter label="Telegram Status" value={filters.telegramStatus} onChange={v => updateFilter('telegramStatus', v)} options={[{label:'Sent', value:'Sent'}, {label:'Not Sent', value:'Not Sent'}]} multiple={true} isInline={false} />
                                                            <SelectFilter label="Verification" value={filters.isVerified} onChange={v => updateFilter('isVerified', v)} options={[{label:'All', value:'All'}, {label:'Verified', value:'Verified'}, {label:'Unverified', value:'Unverified'}]} isInline={false} />
                                                        </div>
                                                    </div>
                                                )}
                                                {cat.id === 'team' && (
                                                    <div className="space-y-6">
                                                        <SelectFilter label="Operational Team" value={filters.team} onChange={v => updateFilter('team', v)} options={uniqueValues.teams} multiple={true} isInline={true} />
                                                        <SelectFilter label="Registered User" value={filters.user} onChange={v => updateFilter('user', v)} options={usersList.map(u => ({ label: u.FullName, value: u.UserName }))} multiple={true} isInline={true} />
                                                        <div className="grid grid-cols-1 gap-6">
                                                            <SelectFilter label="Brand / Store" value={filters.store} onChange={v => updateFilter('store', v)} options={appData.stores?.map(s => s.StoreName) || []} multiple={true} isInline={false} />
                                                            <SelectFilter label="Source Page" value={filters.page} onChange={v => updateFilter('page', v)} options={uniqueValues.pages} multiple={true} isInline={false} />
                                                        </div>
                                                    </div>
                                                )}
                                                {cat.id === 'logistics' && (
                                                    <div className="space-y-6">
                                                        <SelectFilter label="Shipping Method" value={filters.shippingService} onChange={v => updateFilter('shippingService', v)} options={uniqueValues.shippingMethods} multiple={true} isInline={true} />
                                                        <SelectFilter label="Driver Selection" value={filters.driver} onChange={v => updateFilter('driver', v)} options={uniqueValues.drivers} multiple={true} isInline={true} />
                                                        <div className="grid grid-cols-1 gap-6">
                                                            <SelectFilter label="Fulfillment Center" value={filters.fulfillmentStore} onChange={v => updateFilter('fulfillmentStore', v)} options={uniqueValues.fulfillmentStores} multiple={true} isInline={false} />
                                                            <SelectFilter label="Geographic Region" value={filters.location} onChange={v => updateFilter('location', v)} options={uniqueValues.locations} multiple={true} isInline={false} />
                                                        </div>
                                                    </div>
                                                )}
                                                {cat.id === 'product' && (
                                                    <div className="space-y-8">
                                                        <div className="px-1">
                                                            <label className="text-[10px] font-black text-[#707A8A] mb-3 block uppercase tracking-widest ml-1">Asset Search</label>
                                                            <SearchableProductDropdown products={appData.products} selectedProductName={filters.product} onSelect={v => updateFilter('product', v)} showTagEditor={false} />
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-6">
                                                            <SelectFilter label="Bank Account" value={filters.bank} onChange={v => updateFilter('bank', v)} options={uniqueValues.banks} multiple={true} isInline={false} />
                                                            <SelectFilter label="Internal Cost" value={filters.internalCost} onChange={v => updateFilter('internalCost', v)} options={uniqueValues.costs.map(c => ({ label: `$${c}`, value: c }))} multiple={true} isInline={false} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Premium Floating Apply Button */}
            <div className="absolute bottom-0 left-0 right-0 px-6 py-6 bg-gradient-to-t from-[#0B0E11] via-[#0B0E11]/90 to-transparent z-30">
                <button 
                    onClick={() => onApply()}
                    className="w-full py-4 bg-[#FCD535] text-[#181A20] font-black uppercase text-[13px] tracking-[0.15em] rounded-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-transparent"
                >
                    <Check size={18} strokeWidth={3} />
                    {language === 'km' ? 'អនុវត្តការចម្រោះ' : 'Apply Filters'}
                </button>
            </div>
        </div>
    );
};

export default MobileFilterEngine;
