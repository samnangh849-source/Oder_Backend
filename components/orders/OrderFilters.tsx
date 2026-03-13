
import React, { useMemo } from 'react';
import { ParsedOrder, User, AppData } from '../../types';
import SearchableProductDropdown from '../common/SearchableProductDropdown';
import DateWindowFilter from './filters/DateWindowFilter';
import SelectFilter from './filters/SelectFilter';

export type DateRangePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom';

export interface FilterState {
    datePreset: DateRangePreset;
    startDate: string;
    endDate: string;
    team: string;
    user: string;
    paymentStatus: string;
    shippingService: string;
    driver: string;
    product: string;
    bank: string;
    fulfillmentStore: string;
    store: string;
    page: string;
    location: string;
    internalCost: string;
    customerName: string; // New Field
}

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
    
    // Extract Unique Values
    const uniqueValues = useMemo(() => {
        const pages = new Set<string>();
        const locations = new Set<string>();
        const shippingMethods = new Set<string>();
        const drivers = new Set<string>();
        const fulfillmentStores = new Set<string>();
        const banks = new Set<string>();
        const costs = new Set<string>();
        const teams = new Set<string>();
        
        // Map to store unique customer Name -> Phone relation
        // We use Map to handle duplicate names (though filter usually works on value). 
        // Here we want to present a list. If "Sokha" appears twice with different phones, 
        // this simple logic might merge them if we only key by Name. 
        // Ideally, we'd key by Name, but display "Name (Phone)". 
        const customerMap = new Map<string, string>();

        orders.forEach(o => {
            if (o.Page) pages.add(o.Page);
            if (o.Location) locations.add(o.Location);
            if (o['Internal Shipping Method']) shippingMethods.add(o['Internal Shipping Method']);
            if (o['Internal Shipping Details']) drivers.add(o['Internal Shipping Details']);
            if (o['Fulfillment Store']) fulfillmentStores.add(o['Fulfillment Store']);
            if (o['Payment Info']) banks.add(o['Payment Info']);
            if (o['Internal Cost'] !== undefined) costs.add(String(o['Internal Cost']));
            if (o.Team) teams.add(o.Team);
            
            if (o['Customer Name']) {
                // We store the last phone number seen for this name. 
                // This isn't perfect for duplicate names, but fits the current string-based filter architecture.
                customerMap.set(o['Customer Name'], o['Customer Phone'] || '');
            }
        });

        // Convert customer map to options array
        const customerOptions = Array.from(customerMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, phone]) => ({
                label: `${name} ${phone ? `(${phone})` : ''}`,
                value: name
            }));

        return {
            pages: Array.from(pages).sort(),
            locations: Array.from(locations).sort(),
            shippingMethods: Array.from(shippingMethods).sort(),
            drivers: Array.from(drivers).sort(),
            fulfillmentStores: Array.from(fulfillmentStores).sort(),
            banks: Array.from(banks).sort(),
            costs: Array.from(costs).sort((a, b) => Number(a) - Number(b)),
            teams: Array.from(teams).sort(),
            customerOptions // Use this instead of just names
        };
    }, [orders]);

    const handleReset = () => {
        setFilters({
            datePreset: 'this_month', startDate: '', endDate: '', team: '', user: '',
            paymentStatus: '', shippingService: '', driver: '', product: '', bank: '',
            fulfillmentStore: '', store: '', page: '', location: '', internalCost: '',
            customerName: ''
        });
    };

    const updateFilter = (key: keyof FilterState, value: string) => {
        setFilters({ ...filters, [key]: value });
    };

    return (
        <div className="space-y-10">
            <DateWindowFilter 
                datePreset={filters.datePreset}
                setDatePreset={(v) => setFilters({ ...filters, datePreset: v })}
                startDate={filters.startDate}
                setStartDate={(v) => updateFilter('startDate', v)}
                endDate={filters.endDate}
                setEndDate={(v) => updateFilter('endDate', v)}
                calculatedRange={calculatedRange}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8 px-1">
                
                {/* Customer Name Select Filter (Searchable by Name OR Phone) */}
                <SelectFilter 
                    label="Customer Name (ឈ្មោះអតិថិជន)" 
                    value={filters.customerName} 
                    onChange={(v) => updateFilter('customerName', v)}
                    options={uniqueValues.customerOptions}
                    placeholder="Search by Name or Phone..."
                    multiple={true}
                    searchable={true}
                />

                <SelectFilter 
                    label="Payment Status" 
                    value={filters.paymentStatus} 
                    onChange={(v) => updateFilter('paymentStatus', v)}
                    options={[{ label: 'Paid (រួចរាល់)', value: 'Paid' }, { label: 'Unpaid (COD)', value: 'Unpaid' }]}
                    placeholder="All Statuses"
                    variant="payment"
                    multiple={true}
                />

                <SelectFilter 
                    label="Store (Brand/Sales)" 
                    value={filters.store} 
                    onChange={(v) => updateFilter('store', v)}
                    options={appData.stores?.map(s => s.StoreName) || []}
                    placeholder="All Stores (Brands)"
                    multiple={true}
                />

                <SelectFilter 
                    label="Team Allocation" 
                    value={filters.team} 
                    onChange={(v) => updateFilter('team', v)}
                    options={uniqueValues.teams}
                    placeholder="All Operational Teams"
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

                <SelectFilter 
                    label="Fulfillment Store (Stock)" 
                    value={filters.fulfillmentStore} 
                    onChange={(v) => updateFilter('fulfillmentStore', v)}
                    options={uniqueValues.fulfillmentStores}
                    placeholder="All Fulfillment Centers"
                    multiple={true}
                />

                <SelectFilter 
                    label="Geography (Location)" 
                    value={filters.location} 
                    onChange={(v) => updateFilter('location', v)}
                    options={uniqueValues.locations}
                    placeholder="All Regions"
                    multiple={true}
                />

                <SelectFilter 
                    label="Logistics Method" 
                    value={filters.shippingService} 
                    onChange={(v) => updateFilter('shippingService', v)}
                    options={uniqueValues.shippingMethods}
                    placeholder="All Shipping Methods"
                    multiple={true}
                />

                <SelectFilter 
                    label="Logistics Driver" 
                    value={filters.driver} 
                    onChange={(v) => updateFilter('driver', v)}
                    options={uniqueValues.drivers}
                    placeholder="All Drivers / Details"
                    multiple={true}
                />

                <SelectFilter 
                    label="Merchant Team (User)" 
                    value={filters.user} 
                    onChange={(v) => updateFilter('user', v)}
                    options={(usersList || []).map(u => ({ label: u.FullName, value: u.UserName }))}
                    placeholder="All Registered Users"
                    multiple={true}
                />

                <SelectFilter 
                    label="Exp. Cost (Internal)" 
                    value={filters.internalCost} 
                    onChange={(v) => updateFilter('internalCost', v)}
                    options={uniqueValues.costs.map(c => ({ label: `$${c}`, value: c }))}
                    placeholder="All Costs"
                    multiple={true}
                />

                <SelectFilter 
                    label="គណនីធនាគារ (Bank)" 
                    value={filters.bank} 
                    onChange={(v) => updateFilter('bank', v)}
                    options={uniqueValues.banks}
                    placeholder="All Bank Accounts"
                    multiple={true}
                />

                <div className="sm:col-span-2 xl:col-span-3">
                    <label className="text-[10px] font-black text-gray-500 mb-2 block uppercase tracking-widest ml-2">Asset Selection (Product)</label>
                    <SearchableProductDropdown 
                        products={appData.products} 
                        selectedProductName={filters.product} 
                        onSelect={val => updateFilter('product', val)} 
                        showTagEditor={false} 
                    />
                </div>
            </div>

            <div className="pt-4">
                <button 
                    onClick={handleReset}
                    className="w-full py-4 text-[11px] font-black text-gray-500 uppercase tracking-widest hover:text-white border border-dashed border-gray-800 rounded-2xl transition-all active:scale-95 hover:border-red-500/30 hover:bg-red-500/10"
                >
                    Reset All Configurations
                </button>
            </div>
        </div>
    );
};

export default OrderFilters;
