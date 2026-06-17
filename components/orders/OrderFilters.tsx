
import React, { useMemo, useContext } from 'react';
import { ParsedOrder, User, AppData } from '../../types';
import SearchableProductDropdown from '../common/SearchableProductDropdown';
import DateWindowFilter from './filters/DateWindowFilter';
import SelectFilter from './filters/SelectFilter';
import { useFilterEngine, FilterState, initialFilterState, DateRangePreset } from '../../hooks/useFilterEngine';
export type { FilterState, DateRangePreset };
export { initialFilterState };
import { AppContext } from '../../context/AppContext';
import { 
    Calendar, Users, Building2, Truck, CreditCard, 
    Warehouse, MapPin, Package, Hash, UserCircle,
    LayoutDashboard, History, CheckCircle2, AlertCircle,
    Tag, Search, RotateCcw
} from 'lucide-react';

interface OrderFiltersProps {
    filters: FilterState;
    setFilters: (filters: FilterState) => void;
    orders: ParsedOrder[];
    usersList: User[];
    appData: AppData;
    calculatedRange: string;
}

const OrderFilters: React.FC<OrderFiltersProps> = ({ 
    filters, setFilters, orders, usersList, appData, calculatedRange 
}) => {
    const { language } = useContext(AppContext);
    const { uniqueValues } = useFilterEngine(orders, appData);
    
    const handleReset = () => {
        setFilters(initialFilterState);
    };

    const updateFilter = (key: keyof FilterState, value: string) => {
        setFilters({ ...filters, [key]: value });
    };

    const getActiveCount = (key: keyof FilterState) => {
        const val = filters[key];
        if (!val || val === 'all' || val === 'All') return 0;
        if (key === 'datePreset' && val === 'this_month') return 0;
        return String(val).split(',').filter(v => v).length;
    };

    const SectionHeader = ({ icon: Icon, title, count }: { icon: any, title: string, count: number }) => (
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#2B3139]">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-sm bg-[#2B3139] flex items-center justify-center text-[#FCD535]">
                    <Icon size={18} />
                </div>
                <h3 className="text-[11px] font-black text-[#EAECEF] uppercase tracking-[0.15em]">{title}</h3>
            </div>
            {count > 0 && (
                <span className="px-2 py-0.5 bg-[#FCD535] text-[#181A20] text-[10px] font-black rounded-sm shadow-lg shadow-[#FCD535]/10 animate-bounce-subtle">
                    {count} ACTIVE
                </span>
            )}
        </div>
    );

    const timeActive = getActiveCount('datePreset');
    const identityActive = getActiveCount('customerName') + getActiveCount('customerSearch');
    const opsActive = getActiveCount('fulfillmentStatus') + getActiveCount('telegramStatus') + getActiveCount('paymentStatus') + getActiveCount('isVerified');
    const teamActive = getActiveCount('team') + getActiveCount('user') + getActiveCount('store') + getActiveCount('page');
    const logisticsActive = getActiveCount('fulfillmentStore') + getActiveCount('location') + getActiveCount('shippingService') + getActiveCount('driver');
    const productActive = getActiveCount('product') + getActiveCount('internalCost') + getActiveCount('bank');

    return (
        <div className="space-y-12 pb-10">
            {/* Time Window Section */}
            <div>
                <SectionHeader icon={Calendar} title={language === 'km' ? 'កាលបរិច្ឆេទ និងពេលវេលា' : 'Time & Temporal Context'} count={timeActive} />
                <div className="px-1">
                    <DateWindowFilter 
                        datePreset={filters.datePreset}
                        setDatePreset={(v) => setFilters({ ...filters, datePreset: v })}
                        startDate={filters.startDate}
                        setStartDate={(v) => updateFilter('startDate', v)}
                        endDate={filters.endDate}
                        setEndDate={(v) => updateFilter('endDate', v)}
                        calculatedRange={calculatedRange}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-12">
                {/* Identity Section */}
                <div>
                    <SectionHeader icon={UserCircle} title={language === 'km' ? 'អត្តសញ្ញាណអតិថិជន' : 'Customer Identity'} count={identityActive} />
                    <div className="space-y-6 px-1">
                        <SelectFilter 
                            label="Customer (ស្វែងរកអតិថិជន)" 
                            value={filters.customerName} 
                            onChange={(v) => updateFilter('customerName', v)}
                            options={uniqueValues.customerOptions}
                            placeholder="Search by Name or Phone..."
                            multiple={true}
                            searchable={true}
                        />
                        <div className="relative">
                            <label className="text-[10px] font-black text-[#707A8A] mb-2 uppercase tracking-widest block">Text Search (ស្វែងរកអត្ថបទ)</label>
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-[#FCD535] transition-colors" />
                                <input 
                                    type="text"
                                    value={filters.customerSearch}
                                    onChange={(e) => updateFilter('customerSearch', e.target.value)}
                                    placeholder="Order ID, Name, Phone..."
                                    className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm py-3 pl-11 pr-4 text-sm text-white focus:border-[#FCD535] outline-none transition-all placeholder:text-gray-600"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Operations Section */}
                <div>
                    <SectionHeader icon={LayoutDashboard} title={language === 'km' ? 'ស្ថានភាពប្រតិបត្តិការ' : 'Operational Status'} count={opsActive} />
                    <div className="grid grid-cols-2 gap-4 px-1">
                        <SelectFilter 
                            label="Fulfillment Status" 
                            value={filters.fulfillmentStatus} 
                            onChange={(v) => updateFilter('fulfillmentStatus', v)}
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
                            placeholder="All Status"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Payment Status" 
                            value={filters.paymentStatus} 
                            onChange={(v) => updateFilter('paymentStatus', v)}
                            options={[{ label: 'Paid (រួចរាល់)', value: 'Paid' }, { label: 'Unpaid (COD)', value: 'Unpaid' }]}
                            placeholder="All Payments"
                            variant="payment"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Telegram" 
                            value={filters.telegramStatus} 
                            onChange={(v) => updateFilter('telegramStatus', v)}
                            options={[
                                { label: 'Sent (បានផ្ញើរ)', value: 'Sent' }, 
                                { label: 'Not Sent (មិនទាន់ផ្ញើរ)', value: 'Not Sent' }
                            ]}
                            placeholder="All Messages"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Verification" 
                            value={filters.isVerified} 
                            onChange={(v) => updateFilter('isVerified', v)}
                            options={[
                                { label: 'All (ទាំងអស់)', value: 'All' },
                                { label: 'Verified (បានផ្ទៀងផ្ទាត់)', value: 'Verified' },
                                { label: 'Unverified (មិនទាន់ផ្ទៀងផ្ទាត់)', value: 'Unverified' }
                            ]}
                            placeholder="All Verification"
                        />
                    </div>
                </div>

                {/* Team & Source Section */}
                <div>
                    <SectionHeader icon={Users} title={language === 'km' ? 'ក្រុម និងប្រភព' : 'Team & Source Context'} count={teamActive} />
                    <div className="grid grid-cols-2 gap-4 px-1">
                        <SelectFilter 
                            label="Operational Team" 
                            value={filters.team} 
                            onChange={(v) => updateFilter('team', v)}
                            options={uniqueValues.teams}
                            placeholder="All Teams"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Registered User" 
                            value={filters.user} 
                            onChange={(v) => updateFilter('user', v)}
                            options={(usersList || []).map(u => ({ label: u.FullName, value: u.UserName }))}
                            placeholder="All Users"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Brand / Store" 
                            value={filters.store} 
                            onChange={(v) => updateFilter('store', v)}
                            options={appData.stores?.map(s => s.StoreName) || []}
                            placeholder="All Brands"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Source Page" 
                            value={filters.page} 
                            onChange={(v) => updateFilter('page', v)}
                            options={uniqueValues.pages}
                            placeholder="All Pages"
                            multiple={true}
                        />
                    </div>
                </div>

                {/* Logistics Section */}
                <div>
                    <SectionHeader icon={Truck} title={language === 'km' ? 'ការដឹកជញ្ជូន និងឃ្លាំង' : 'Logistics & Infrastructure'} count={logisticsActive} />
                    <div className="grid grid-cols-2 gap-4 px-1">
                        <SelectFilter 
                            label="Fulfillment Stock" 
                            value={filters.fulfillmentStore} 
                            onChange={(v) => updateFilter('fulfillmentStore', v)}
                            options={uniqueValues.fulfillmentStores}
                            placeholder="All Centers"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Region / Location" 
                            value={filters.location} 
                            onChange={(v) => updateFilter('location', v)}
                            options={uniqueValues.locations}
                            placeholder="All Regions"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Shipping Method" 
                            value={filters.shippingService} 
                            onChange={(v) => updateFilter('shippingService', v)}
                            options={uniqueValues.shippingMethods}
                            placeholder="All Methods"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Delivery Driver" 
                            value={filters.driver} 
                            onChange={(v) => updateFilter('driver', v)}
                            options={uniqueValues.drivers}
                            placeholder="All Drivers"
                            multiple={true}
                        />
                    </div>
                </div>
            </div>

            {/* Product & Assets Section */}
            <div>
                <SectionHeader icon={Package} title={language === 'km' ? 'ព័ត៌មានទំនិញ' : 'Asset & Financial Context'} count={productActive} />
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-1">
                    <div className="xl:col-span-1 space-y-4">
                        <SelectFilter 
                            label="Bank Account" 
                            value={filters.bank} 
                            onChange={(v) => updateFilter('bank', v)}
                            options={uniqueValues.banks}
                            placeholder="All Accounts"
                            multiple={true}
                        />
                        <SelectFilter 
                            label="Internal Cost" 
                            value={filters.internalCost} 
                            onChange={(v) => updateFilter('internalCost', v)}
                            options={uniqueValues.costs.map(c => ({ label: `$${c}`, value: c }))}
                            placeholder="All Costs"
                            multiple={true}
                        />
                    </div>
                    <div className="xl:col-span-2">
                        <label className="text-[10px] font-black text-[#707A8A] mb-2 uppercase tracking-widest flex items-center gap-2">Asset Selection (Product)</label>
                        <SearchableProductDropdown 
                            products={appData.products} 
                            selectedProductName={filters.product} 
                            onSelect={val => updateFilter('product', val)} 
                            showTagEditor={false} 
                        />
                    </div>
                </div>
            </div>

            <div className="pt-8 border-t border-[#2B3139]">
                <button 
                    onClick={handleReset}
                    className="w-full py-4 bg-[#1E2329] text-[11px] font-black text-[#707A8A] uppercase tracking-[0.25em] hover:text-[#F6465D] border border-[#2B3139] rounded-sm transition-all hover:bg-[#F6465D]/10 hover:border-[#F6465D]/30 flex items-center justify-center gap-3 active:scale-[0.99]"
                >
                    <RotateCcw size={16} />
                    Reset All Engine Configurations
                </button>
            </div>
            
            <style>{`
                @keyframes bounce-subtle {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-2px); }
                }
                .animate-bounce-subtle { animation: bounce-subtle 2s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default OrderFilters;
