
import React, { useState, useMemo } from 'react';
import { FilterState } from './OrderFilters';
import { ParsedOrder, User, AppData } from '../../types';
import SelectFilter from './filters/SelectFilter';
import DateWindowFilter from './filters/DateWindowFilter';
import SearchableProductDropdown from '../common/SearchableProductDropdown';
import { useSoundEffects } from '../../hooks/useSoundEffects';

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
            title: 'Time & Customers',
            items: [
                { id: 'date', label: 'Time Window', icon: '📅', value: filters.datePreset === 'custom' ? `${filters.startDate} - ${filters.endDate}` : filters.datePreset },
                { id: 'customer', label: 'Customer Search', icon: '👤', value: filters.customerName }
            ]
        },
        {
            title: 'Operations & Teams',
            items: [
                { id: 'team', label: 'Team & User', icon: '👥', value: filters.team || filters.user ? 'Configured' : '' },
                { id: 'payment', label: 'Payment Status', icon: '💰', value: filters.paymentStatus }
            ]
        },
        {
            title: 'Logistics & Warehouse',
            items: [
                { id: 'logistics', label: 'Shipping & Driver', icon: '🚚', value: filters.shippingService || filters.driver ? 'Configured' : '' },
                { id: 'inventory', label: 'Warehouse Node', icon: '📦', value: filters.fulfillmentStore },
                { id: 'location', label: 'Region/Location', icon: '📍', value: filters.location }
            ]
        },
        {
            title: 'Product Assets',
            items: [
                { id: 'product', label: 'Product Items', icon: '🏷️', value: filters.product }
            ]
        }
    ];

    const getActiveCount = (id: string) => {
        switch(id) {
            case 'date': return filters.datePreset !== 'all' && filters.datePreset !== 'this_month' ? 1 : 0;
            case 'customer': return filters.customerName ? filters.customerName.split(',').length : 0;
            case 'payment': return filters.paymentStatus ? filters.paymentStatus.split(',').length : 0;
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
        <div className="flex flex-col h-full bg-[#0f172a] relative overflow-hidden font-['Kantumruy_Pro']">
            <style>{`
                .filter-category-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .filter-category-card.active {
                    background: rgba(59, 130, 246, 0.08);
                    border-color: rgba(59, 130, 246, 0.3);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
                .apply-button-shadow {
                    box-shadow: 0 -20px 40px rgba(15, 23, 42, 0.95), 0 -10px 20px rgba(15, 23, 42, 0.8);
                }
                .section-title {
                    font-size: 9px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.25em;
                    color: rgba(255, 255, 255, 0.25);
                    margin-bottom: 10px;
                    margin-left: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .section-title::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.05);
                }
            `}</style>

            {/* Summary Header */}
            <div className="flex-shrink-0 px-6 py-4 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-5 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div>
                    <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Filter Engine</h3>
                        <p className="text-[8px] font-bold text-blue-400/60 uppercase tracking-tighter">
                            {totalActiveFilters > 0 ? `${totalActiveFilters} Parameters Active` : 'All context visible'}
                        </p>
                    </div>
                </div>
                <button onClick={handleReset} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-500/10 active:scale-90 transition-all">Reset</button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar px-4 pt-6 pb-44 space-y-8">
                {sections.map((section, sIdx) => (
                    <div key={sIdx} className="animate-reveal" style={{ animationDelay: `${sIdx * 0.1}s` }}>
                        <h4 className="section-title">{section.title}</h4>
                        <div className="grid grid-cols-1 gap-2.5">
                            {section.items.map(cat => {
                                const isActive = activeCategory === cat.id;
                                const count = getActiveCount(cat.id);
                                return (
                                    <div key={cat.id} className="flex flex-col">
                                        <button 
                                            onClick={() => { playClick(); setActiveCategory(isActive ? null : cat.id); }}
                                            className={`filter-category-card flex items-center justify-between p-4 rounded-[1.5rem] ${isActive ? 'active' : ''}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${isActive ? 'bg-blue-600 shadow-lg shadow-blue-900/40 rotate-0' : 'bg-white/5 grayscale opacity-60'}`}>
                                                    {cat.icon}
                                                </div>
                                                <div className="text-left">
                                                    <p className={`text-[11px] font-black uppercase tracking-widest leading-none ${isActive ? 'text-blue-400' : 'text-white'}`}>{cat.label}</p>
                                                    {cat.value && !isActive && <p className="text-[9px] text-blue-400 font-bold mt-1.5 truncate max-w-[180px]">{cat.value.replace(/,/g, ', ')}</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {count > 0 && <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg">{count}</span>}
                                                <svg className={`w-4 h-4 text-gray-600 transition-transform duration-500 ${isActive ? 'rotate-180 text-blue-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3} /></svg>
                                            </div>
                                        </button>

                                        {isActive && (
                                            <div className="mt-2 mb-2 p-4 bg-black/20 rounded-[1.8rem] border border-white/5 animate-reveal space-y-4 shadow-inner">
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
                                                    <SelectFilter label="Customer Search" value={filters.customerName} onChange={v => updateFilter('customerName', v)} options={uniqueValues.customerOptions} multiple={true} isInline={true} />
                                                )}
                                                {cat.id === 'payment' && (
                                                    <SelectFilter label="Payment Status" value={filters.paymentStatus} onChange={v => updateFilter('paymentStatus', v)} options={[{label:'Paid', value:'Paid'}, {label:'Unpaid', value:'Unpaid'}]} multiple={true} variant="payment" isInline={true} />
                                                )}
                                                {cat.id === 'team' && (
                                                    <div className="space-y-6">
                                                        <SelectFilter label="Team Allocation" value={filters.team} onChange={v => updateFilter('team', v)} options={uniqueValues.teams} multiple={true} isInline={true} />
                                                        <SelectFilter label="Registered User" value={filters.user} onChange={v => updateFilter('user', v)} options={usersList.map(u => ({ label: u.FullName, value: u.UserName }))} multiple={true} isInline={true} />
                                                    </div>
                                                )}
                                                {cat.id === 'inventory' && (
                                                    <SelectFilter label="Fulfillment Center" value={filters.fulfillmentStore} onChange={v => updateFilter('fulfillmentStore', v)} options={uniqueValues.fulfillmentStores} multiple={true} isInline={true} />
                                                )}
                                                {cat.id === 'location' && (
                                                    <SelectFilter label="Geographic Region" value={filters.location} onChange={v => updateFilter('location', v)} options={uniqueValues.locations} multiple={true} isInline={true} />
                                                )}
                                                {cat.id === 'logistics' && (
                                                    <div className="space-y-6">
                                                        <SelectFilter label="Shipping Method" value={filters.shippingService} onChange={v => updateFilter('shippingService', v)} options={uniqueValues.shippingMethods} multiple={true} isInline={true} />
                                                        <SelectFilter label="Driver Selection" value={filters.driver} onChange={v => updateFilter('driver', v)} options={uniqueValues.drivers} multiple={true} isInline={true} />
                                                    </div>
                                                )}
                                                {cat.id === 'product' && (
                                                    <div className="px-1">
                                                        <label className="text-[10px] font-black text-gray-500 mb-3 block uppercase tracking-widest ml-1">Asset Search</label>
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
            <div className="absolute bottom-0 left-0 right-0 px-6 pt-10 pb-8 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/95 to-transparent z-[110] pointer-events-none apply-button-shadow border-t border-white/[0.03]">
                <button 
                    onClick={() => { playPop(); onApply(); }}
                    className="w-full py-4.5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[13px] tracking-[0.25em] rounded-2xl shadow-[0_20px_50px_rgba(37,99,235,0.4)] transition-all active:scale-95 pointer-events-auto flex items-center justify-center gap-3 border border-blue-400/20 ring-1 ring-white/10"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
                    Update Environment
                </button>
            </div>
        </div>
    );
};

export default MobileFilterEngine;
