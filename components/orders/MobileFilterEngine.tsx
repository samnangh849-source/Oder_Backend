
import React, { useState, useMemo, useContext } from 'react';
import { FilterState } from './OrderFilters';
import { ParsedOrder, User, AppData } from '../../types';
import SelectFilter from './filters/SelectFilter';
import DateWindowFilter from './filters/DateWindowFilter';
import SearchableProductDropdown from '../common/SearchableProductDropdown';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { AppContext } from '../../context/AppContext';
import { Calendar, User as UserIcon, Users, CreditCard, Truck, Warehouse, MapPin, Package, RotateCcw, Check } from 'lucide-react';

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
    const { playClick, playPop } = useSoundEffects();
    const [activeCategory, setActiveCategory] = useState<string | null>('date');

    const uniqueValues = useMemo(() => {
        const pages = new Set<string>();
        const locations = new Set<string>();
        const shippingMethods = new Set<string>();
        const drivers = new Set<string>();
        const fulfillmentStores = new Set<string>();
        const teams = new Set<string>();
        const customerMap = new Map<string, string>();

        orders.forEach(o => {
            if (o.Page) pages.add(o.Page);
            if (o.Location) locations.add(o.Location);
            if (o['Internal Shipping Method']) shippingMethods.add(o['Internal Shipping Method']);
            if (o['Internal Shipping Details']) drivers.add(o['Internal Shipping Details']);
            if (o['Fulfillment Store']) fulfillmentStores.add(o['Fulfillment Store']);
            if (o.Team) teams.add(o.Team);
            if (o['Customer Name']) customerMap.set(o['Customer Name'], o['Customer Phone'] || '');
        });

        return {
            pages: Array.from(pages).sort(),
            locations: Array.from(locations).sort(),
            shippingMethods: Array.from(shippingMethods).sort(),
            drivers: Array.from(drivers).sort(),
            fulfillmentStores: Array.from(fulfillmentStores).sort(),
            teams: Array.from(teams).sort(),
            customerOptions: Array.from(customerMap.entries()).map(([name, phone]) => ({ label: `${name} (${phone})`, value: name }))
        };
    }, [orders]);

    const updateFilter = (key: keyof FilterState, value: string) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleReset = () => {
        playPop();
        setFilters({
            datePreset: 'this_month', startDate: '', endDate: '', team: '', user: '',
            paymentStatus: '', shippingService: '', driver: '', product: '', bank: '',
            fulfillmentStore: '', store: '', page: '', location: '', internalCost: '',
            customerName: '', isVerified: 'All'
        } as any);
    };

    // Logical grouping of categories for better UX
    const sections = [
        {
            title: language === 'km' ? 'ពេលវេលា និងអតិថិជន' : 'Time & Customers',
            items: [
                { id: 'date', label: language === 'km' ? 'ចន្លោះកាលបរិច្ឆេទ' : 'Time Window', icon: <Calendar size={18} />, value: filters.datePreset === 'custom' ? `${filters.startDate} - ${filters.endDate}` : filters.datePreset },
                { id: 'customer', label: language === 'km' ? 'ស្វែងរកអតិថិជន' : 'Customer Search', icon: <UserIcon size={18} />, value: filters.customerName }
            ]
        },
        {
            title: language === 'km' ? 'ប្រតិបត្តិការ និងក្រុម' : 'Operations & Teams',
            items: [
                { id: 'team', label: language === 'km' ? 'ក្រុម និងអ្នកប្រើប្រាស់' : 'Team & User', icon: <Users size={18} />, value: filters.team || filters.user ? 'Configured' : '' },
                { id: 'telegram', label: language === 'km' ? 'ស្ថានភាព Telegram' : 'Telegram Status', icon: <Package size={18} />, value: filters.telegramStatus },
                { id: 'payment', label: language === 'km' ? 'ស្ថានភាពបង់ប្រាក់' : 'Payment Status', icon: <CreditCard size={18} />, value: filters.paymentStatus }
            ]
        },
        {
            title: language === 'km' ? 'ដឹកជញ្ជូន និងឃ្លាំង' : 'Logistics & Warehouse',
            items: [
                { id: 'logistics', label: language === 'km' ? 'សេវាដឹក និងអ្នកដឹក' : 'Shipping & Driver', icon: <Truck size={18} />, value: filters.shippingService || filters.driver ? 'Configured' : '' },
                { id: 'inventory', label: language === 'km' ? 'ឃ្លាំងទំនិញ' : 'Warehouse Node', icon: <Warehouse size={18} />, value: filters.fulfillmentStore },
                { id: 'location', label: language === 'km' ? 'តំបន់/ទីតាំង' : 'Region/Location', icon: <MapPin size={18} />, value: filters.location }
            ]
        },
        {
            title: language === 'km' ? 'ព័ត៌មានទំនិញ' : 'Product Assets',
            items: [
                { id: 'product', label: language === 'km' ? 'មុខទំនិញ' : 'Product Items', icon: <Package size={18} />, value: filters.product }
            ]
        }
    ];

    const getActiveCount = (id: string) => {
        switch(id) {
            case 'date': return filters.datePreset !== 'all' && filters.datePreset !== 'this_month' ? 1 : 0;
            case 'customer': return filters.customerName ? filters.customerName.split(',').length : 0;
            case 'payment': return filters.paymentStatus ? filters.paymentStatus.split(',').length : 0;
            case 'telegram': return filters.telegramStatus ? filters.telegramStatus.split(',').length : 0;
            case 'team': return (filters.team ? filters.team.split(',').length : 0) + (filters.user ? filters.user.split(',').length : 0);
            case 'inventory': return filters.fulfillmentStore ? filters.fulfillmentStore.split(',').length : 0;
            case 'location': return filters.location ? filters.location.split(',').length : 0;
            case 'logistics': return (filters.shippingService ? 1 : 0) + (filters.driver ? 1 : 0);
            case 'product': return filters.product ? filters.product.split(',').length : 0;
            default: return 0;
        }
    };

    const totalActiveFilters = useMemo(() => {
        let count = 0;
        sections.forEach(s => s.items.forEach(i => count += getActiveCount(i.id)));
        return count;
    }, [filters, sections]);

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
                    border-color: var(--cm-accent);
                    background: #181A20;
                }
                .section-title {
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: var(--cm-text-muted);
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
                    <div className="w-1 h-6 bg-[var(--cm-accent)] rounded-full"></div>
                    <div>
                        <h3 className="text-xs font-black text-[#EAECEF] uppercase tracking-widest">{language === 'km' ? 'ម៉ាស៊ីនចម្រោះ' : 'Filter Engine'}</h3>
                        <p className="text-[9px] font-bold text-[var(--cm-accent)] uppercase">
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
                                            onClick={() => { playClick(); setActiveCategory(isActive ? null : cat.id); }}
                                            className={`filter-category-card flex items-center justify-between p-4 ${isActive ? 'active' : ''}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-sm flex items-center justify-center transition-all ${isActive ? 'text-[var(--cm-accent)]' : 'text-[#707A8A]'}`}>
                                                    {cat.icon}
                                                </div>
                                                <div className="text-left">
                                                    <p className={`text-[12px] font-bold uppercase tracking-tight ${isActive ? 'text-[var(--cm-accent)]' : 'text-[#EAECEF]'}`}>{cat.label}</p>
                                                    {cat.value && !isActive && <p className="text-[10px] text-[var(--cm-accent)] font-medium mt-1 truncate max-w-[180px] opacity-80">{cat.value.replace(/,/g, ', ')}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {count > 0 && <span className="bg-[var(--cm-accent)] text-[#181A20] text-[10px] font-black px-1.5 py-0.5 rounded-sm">{count}</span>}
                                                <svg className={`w-4 h-4 text-[#474D57] transition-transform duration-300 ${isActive ? 'rotate-180 text-[var(--cm-accent)]' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>
                                            </div>
                                        </button>

                                        {isActive && (
                                            <div className="mt-1 mb-3 p-4 bg-[#181A20] border border-[#2B3139] space-y-4 shadow-inner animate-reveal">
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
                                                    <SelectFilter label={language === 'km' ? 'ស្វែងរកអតិថិជន' : 'Customer Search'} value={filters.customerName} onChange={v => updateFilter('customerName', v)} options={uniqueValues.customerOptions} multiple={true} isInline={true} />
                                                )}
                                                {cat.id === 'telegram' && (
                                                    <SelectFilter 
                                                        label={language === 'km' ? 'ស្ថានភាព Telegram' : 'Telegram Status'} 
                                                        value={filters.telegramStatus} 
                                                        onChange={v => updateFilter('telegramStatus', v)} 
                                                        options={[
                                                            { label: 'Sent (បានផ្ញើរ)', value: 'Sent' }, 
                                                            { label: 'Not Sent (មិនទាន់ផ្ញើរ)', value: 'Not Sent' }
                                                        ]} 
                                                        multiple={true} 
                                                        isInline={true} 
                                                    />
                                                )}
                                                {cat.id === 'payment' && (
                                                    <SelectFilter label={language === 'km' ? 'ស្ថានភាពបង់ប្រាក់' : 'Payment Status'} value={filters.paymentStatus} onChange={v => updateFilter('paymentStatus', v)} options={[{label:language === 'km' ? 'បានបង់' : 'Paid', value:'Paid'}, {label:language === 'km' ? 'មិនទាន់បង់' : 'Unpaid', value:'Unpaid'}]} multiple={true} variant="payment" isInline={true} />
                                                )}
                                                {cat.id === 'team' && (
                                                    <div className="space-y-6">
                                                        <SelectFilter label={language === 'km' ? 'បែងចែកតាមក្រុម' : 'Team Allocation'} value={filters.team} onChange={v => updateFilter('team', v)} options={uniqueValues.teams} multiple={true} isInline={true} />
                                                        <SelectFilter label={language === 'km' ? 'អ្នកប្រើប្រាស់' : 'Registered User'} value={filters.user} onChange={v => updateFilter('user', v)} options={usersList.map(u => ({ label: u.FullName, value: u.UserName }))} multiple={true} isInline={true} />
                                                    </div>
                                                )}
                                                {cat.id === 'inventory' && (
                                                    <SelectFilter label={language === 'km' ? 'ឃ្លាំងទំនិញ' : 'Fulfillment Center'} value={filters.fulfillmentStore} onChange={v => updateFilter('fulfillmentStore', v)} options={uniqueValues.fulfillmentStores} multiple={true} isInline={true} />
                                                )}
                                                {cat.id === 'location' && (
                                                    <SelectFilter label={language === 'km' ? 'ទីតាំងភូមិសាស្ត្រ' : 'Geographic Region'} value={filters.location} onChange={v => updateFilter('location', v)} options={uniqueValues.locations} multiple={true} isInline={true} />
                                                )}
                                                {cat.id === 'logistics' && (
                                                    <div className="space-y-6">
                                                        <SelectFilter label={language === 'km' ? 'វិធីសាស្រ្តដឹកជញ្ជូន' : 'Shipping Method'} value={filters.shippingService} onChange={v => updateFilter('shippingService', v)} options={uniqueValues.shippingMethods} multiple={true} isInline={true} />
                                                        <SelectFilter label={language === 'km' ? 'អ្នកដឹកជញ្ជូន' : 'Driver Selection'} value={filters.driver} onChange={v => updateFilter('driver', v)} options={uniqueValues.drivers} multiple={true} isInline={true} />
                                                    </div>
                                                )}
                                                {cat.id === 'product' && (
                                                    <div className="px-1">
                                                        <label className="text-[10px] font-black text-[#707A8A] mb-3 block uppercase tracking-widest ml-1">{language === 'km' ? 'ស្វែងរកទំនិញ' : 'Asset Search'}</label>
                                                        <SearchableProductDropdown products={appData.products} selectedProductName={filters.product} onSelect={v => updateFilter('product', v)} showTagEditor={false} />
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
                    onClick={() => { playPop(); onApply(); }}
                    className="w-full py-4 bg-[var(--cm-accent)] text-[#181A20] font-black uppercase text-[13px] tracking-[0.15em] rounded-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-transparent"
                >
                    <Check size={18} strokeWidth={3} />
                    {language === 'km' ? 'អនុវត្តការចម្រោះ' : 'Apply Filters'}
                </button>
            </div>
        </div>
    );
};

export default MobileFilterEngine;
