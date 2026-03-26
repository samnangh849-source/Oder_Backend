
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder, User } from '../types';
import ReportsView from '../components/admin/ReportsView';
import Spinner from '../components/common/Spinner';
import { WEB_APP_URL } from '../constants';
import SalesByTeamPage from './SalesByTeamPage';
import SalesByPageReport from './SalesByPageReport';
import Modal from '../components/common/Modal';
import OrderFilters, { FilterState } from '../components/orders/OrderFilters';
import { useUrlState } from '../hooks/useUrlState';

type ReportType = 'overview' | 'performance' | 'profitability' | 'forecasting' | 'shipping' | 'sales_team' | 'sales_page';

interface ReportDashboardProps {
    activeReport: ReportType;
    onBack: () => void;
    onNavigate?: (filters: any) => void;
}

const ReportDashboard: React.FC<ReportDashboardProps> = ({ activeReport, onBack, onNavigate }) => {
    const { appData, refreshTimestamp, setMobilePageTitle, orders, isOrdersLoading, advancedSettings } = useContext(AppContext);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    const uiTheme = advancedSettings?.uiTheme || 'default';
    const isLightMode = advancedSettings?.themeMode === 'light';

    // Theme-specific styles
    const getThemeStyles = () => {
        switch (uiTheme) {
            case 'binance':
                return {
                    headerBg: 'bg-[#1E2329] border-[#2B3139]',
                    accentText: 'text-[#FCD535]',
                    accentBg: 'bg-[#FCD535]',
                    dotColor: 'bg-[#FCD535]',
                    filterBtn: 'border-[#2B3139] hover:bg-[#2B3139] text-[#848E9C]',
                    modalBg: 'bg-[#0B0E11]',
                    modalBorder: 'border-[#2B3139]',
                    modalIndicator: 'bg-[#FCD535] shadow-[0_0_15px_rgba(252,213,53,0.4)]',
                    primaryBtn: 'bg-[#FCD535] text-[#1E2329] hover:bg-[#f0c51d]'
                };
            case 'netflix':
                return {
                    headerBg: 'bg-[#141414] border-white/5',
                    accentText: 'text-[#e50914]',
                    accentBg: 'bg-[#e50914]',
                    dotColor: 'bg-[#e50914]',
                    filterBtn: 'border-white/10 hover:bg-white/5 text-gray-400',
                    modalBg: 'bg-[#141414]',
                    modalBorder: 'border-white/5',
                    modalIndicator: 'bg-[#e50914] shadow-[0_0_15px_rgba(229,9,20,0.4)]',
                    primaryBtn: 'bg-[#e50914] text-white hover:bg-[#b9090b]'
                };
            default:
                return {
                    headerBg: 'bg-gray-800/20 border-white/5',
                    accentText: 'text-blue-400',
                    accentBg: 'bg-blue-600',
                    dotColor: 'bg-blue-500',
                    filterBtn: 'border-gray-700 hover:bg-gray-700 text-gray-300',
                    modalBg: 'bg-[#0f172a]',
                    modalBorder: 'border-white/5',
                    modalIndicator: 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]',
                    primaryBtn: 'bg-blue-600 text-white hover:bg-blue-700'
                };
        }
    };

    const styles = getThemeStyles();
    
    // Updated titles to match user request (English, Uppercase to match style)
    const reportTitles: Record<ReportType, string> = {
        overview: 'OVERVIEW',
        sales_team: 'SALES TEAM REPORT',
        sales_page: 'SALES PAGE REPORT',
        performance: 'PERFORMANCE',
        profitability: 'PROFITABILITY',
        shipping: 'SHIPPING COST',
        forecasting: 'FORECASTING'
    };

    // Update Mobile Header Title
    useEffect(() => {
        setMobilePageTitle(reportTitles[activeReport]);
        return () => setMobilePageTitle(null);
    }, [activeReport, setMobilePageTitle]);
    
    // Sync All Filters with URL
    const [urlDate, setUrlDate] = useUrlState<string>('dateFilter', 'this_month');
    const [urlStart, setUrlStart] = useUrlState<string>('startDate', '');
    const [urlEnd, setUrlEnd] = useUrlState<string>('endDate', '');
    const [urlCustomer, setUrlCustomer] = useUrlState<string>('customerFilter', '');
    const [urlTeam, setUrlTeam] = useUrlState<string>('teamFilter', '');
    const [urlUser, setUrlUser] = useUrlState<string>('userFilter', '');
    const [urlPayment, setUrlPayment] = useUrlState<string>('paymentFilter', '');
    const [urlShipping, setUrlShipping] = useUrlState<string>('shippingFilter', '');
    const [urlDriver, setUrlDriver] = useUrlState<string>('driverFilter', '');
    const [urlProduct, setUrlProduct] = useUrlState<string>('productFilter', '');
    const [urlBank, setUrlBank] = useUrlState<string>('bankFilter', '');
    const [urlFulfillment, setUrlFulfillment] = useUrlState<string>('fulfillmentFilter', '');
    const [urlStore, setUrlStore] = useUrlState<string>('storeFilter', '');
    const [urlPage, setUrlPage] = useUrlState<string>('pageFilter', '');
    const [urlLocation, setUrlLocation] = useUrlState<string>('locationFilter', '');
    const [urlCost, setUrlCost] = useUrlState<string>('costFilter', '');

    const [filters, setFilters] = useState<FilterState>({
        datePreset: (urlDate as any) || 'this_month',
        startDate: urlStart || '',
        endDate: urlEnd || '',
        team: urlTeam || '',
        user: urlUser || '',
        paymentStatus: urlPayment || '',
        shippingService: urlShipping || '',
        driver: urlDriver || '',
        product: urlProduct || '',
        bank: urlBank || '',
        fulfillmentStore: urlFulfillment || '',
        store: urlStore || '',
        page: urlPage || '',
        location: urlLocation || '',
        internalCost: urlCost || '',
        customerName: urlCustomer || '',
    });

    // Update URL when filter changes
    useEffect(() => {
        if (filters.datePreset !== urlDate) setUrlDate(filters.datePreset);
        if (filters.startDate !== urlStart) setUrlStart(filters.startDate);
        if (filters.endDate !== urlEnd) setUrlEnd(filters.endDate);
        if (filters.customerName !== urlCustomer) setUrlCustomer(filters.customerName);
        if (filters.team !== urlTeam) setUrlTeam(filters.team);
        if (filters.user !== urlUser) setUrlUser(filters.user);
        if (filters.paymentStatus !== urlPayment) setUrlPayment(filters.paymentStatus);
        if (filters.shippingService !== urlShipping) setUrlShipping(filters.shippingService);
        if (filters.driver !== urlDriver) setUrlDriver(filters.driver);
        if (filters.product !== urlProduct) setUrlProduct(filters.product);
        if (filters.bank !== urlBank) setUrlBank(filters.bank);
        if (filters.fulfillmentStore !== urlFulfillment) setUrlFulfillment(filters.fulfillmentStore);
        if (filters.store !== urlStore) setUrlStore(filters.store);
        if (filters.page !== urlPage) setUrlPage(filters.page);
        if (filters.location !== urlLocation) setUrlLocation(filters.location);
        if (filters.internalCost !== urlCost) setUrlCost(filters.internalCost);
    }, [filters, urlDate, urlStart, urlEnd, urlCustomer, urlTeam, urlUser, urlPayment, urlShipping, urlDriver, urlProduct, urlBank, urlFulfillment, urlStore, urlPage, urlLocation, urlCost, setUrlDate, setUrlStart, setUrlEnd, setUrlCustomer, setUrlTeam, setUrlUser, setUrlPayment, setUrlShipping, setUrlDriver, setUrlProduct, setUrlBank, setUrlFulfillment, setUrlStore, setUrlPage, setUrlLocation, setUrlCost]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await fetch(`${WEB_APP_URL}/api/users`);
                const data = await res.json();
                if (data.status === 'success') setUsersList(data.data || []);
            } catch (e) {}
        };
        fetchUsers();
    }, [refreshTimestamp]);

    const calculatedRange = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start: Date | null = null;
        let end: Date | null = new Date();
        switch (filters.datePreset) {
            case 'today': start = today; break;
            case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
            case 'this_week': const day = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); break;
            case 'last_week': start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59); break;
            case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
            case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
            case 'last_year': start = new Date(now.getFullYear() - 1, 0, 1); end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59); break;
            case 'all': return 'All time data stream';
            case 'custom': return `${filters.startDate || '...'} to ${filters.endDate || '...'}`;
        }

        // Use local date parts to construct string to avoid timezone shifts
        const formatDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        return start ? `${formatDate(start)} to ${formatDate(end)}` : 'All time data stream';
    }, [filters.datePreset, filters.startDate, filters.endDate]);

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            if (filters.datePreset !== 'all') {
                const d = new Date(o.Timestamp);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                let start: Date | null = null, end: Date | null = new Date();

                switch (filters.datePreset) {
                    case 'today': 
                        start = today; 
                        end = new Date(today); 
                        end.setHours(23, 59, 59, 999); 
                        break;
                    case 'yesterday': start = new Date(today); start.setDate(today.getDate() - 1); end = new Date(today); end.setMilliseconds(-1); break;
                    case 'this_week': const day = now.getDay(); start = new Date(today); start.setDate(today.getDate() - (day === 0 ? 6 : day - 1)); break;
                    case 'last_week': start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6); end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59); break;
                    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
                    case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); break;
                    case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
                    case 'last_year': start = new Date(now.getFullYear() - 1, 0, 1); end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59); break;
                    case 'custom':
                        if (filters.startDate) start = new Date(filters.startDate + 'T00:00:00');
                        if (filters.endDate) end = new Date(filters.endDate + 'T23:59:59');
                        break;
                }
                if (start && d < start) return false;
                if (end && d > end) return false;
            }

            // Helper for multi-select checking
            const isMatch = (filterValue: string, orderValue: string, partial = false) => {
                if (!filterValue) return true;
                const selectedValues = filterValue.split(',').map(v => v.trim().toLowerCase());
                const val = (orderValue || '').trim().toLowerCase();
                if (partial) {
                    return selectedValues.some(sv => val.includes(sv));
                }
                return selectedValues.includes(val);
            };

            if (!isMatch(filters.team, o.Team)) return false;
            if (!isMatch(filters.user, o.User || '')) return false;
            if (!isMatch(filters.paymentStatus, o['Payment Status'])) return false;
            if (!isMatch(filters.shippingService, o['Internal Shipping Method'])) return false;
            if (!isMatch(filters.driver, o['Internal Shipping Details'])) return false;
            if (!isMatch(filters.bank, o['Payment Info'])) return false;
            if (!isMatch(filters.fulfillmentStore, o['Fulfillment Store'])) return false;
            if (!isMatch(filters.page, o.Page)) return false;
            if (!isMatch(filters.location, o.Location, true)) return false; // Partial match for Location
            if (!isMatch(filters.internalCost, String(o['Internal Cost']))) return false;

            // Product Filter (Multi-select support)
            if (filters.product) {
                const selectedProducts = filters.product.split(',').map(v => v.trim().toLowerCase());
                if (!o.Products.some(p => selectedProducts.includes((p.name || '').toLowerCase()))) return false;
            }

            // Store (Brand) Filter (Multi)
            if (filters.store) {
               const pageConfig = appData.pages?.find(p => p.PageName === o.Page);
               const orderStore = pageConfig ? pageConfig.DefaultStore : null;
               if (!isMatch(filters.store, orderStore || '')) return false;
            }

            // Customer Name Filter (Multi-Select Logic)
            if (!isMatch(filters.customerName, o['Customer Name'])) return false;

            return true;
        });
    }, [orders, filters, appData.pages]);

    if (isOrdersLoading && orders.length === 0) return <div className={`flex h-screen items-center justify-center ${uiTheme === 'binance' ? 'bg-[#0B0E11]' : 'bg-gray-950'}`}><Spinner size="lg" /></div>;

    const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== 'this_month' && v !== 'all').length;

    return (
        <div className="animate-fade-in space-y-4 pb-20 select-none">
            {/* Header (Compact) */}
            <div className={`flex flex-col sm:flex-row justify-between items-center gap-3 ${styles.headerBg} p-3 lg:p-4 rounded-md border backdrop-blur-md`}>
                <div>
                    <h1 className="hidden sm:block text-lg font-black text-white uppercase tracking-tight italic leading-none">{reportTitles[activeReport]}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dotColor} animate-pulse`}></span>
                        <p className={`text-[9px] ${styles.accentText} font-black uppercase tracking-widest`}>
                            {calculatedRange} {activeFilterCount > 0 && ` • ${activeFilterCount} Active`}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                        onClick={() => setIsFilterOpen(true)} 
                        className={`relative flex-1 sm:flex-none py-2 px-4 rounded-md border ${styles.filterBtn} flex items-center justify-center gap-2 transition-all active:scale-95 text-[10px] font-black uppercase`}
                    >
                        <svg className={`w-3.5 h-3.5 ${styles.accentText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        Filters
                        {activeFilterCount > 0 && <span className={`absolute -top-1 -right-1 w-4 h-4 ${styles.accentBg} text-white text-[8px] font-black rounded-full flex items-center justify-center border border-gray-900`}>{activeFilterCount}</span>}
                    </button>
                </div>
            </div>

            {/* Dynamic Report Content Area */}
            <div className="min-h-[500px]">
                {activeReport === 'overview' && <ReportsView orders={filteredOrders} reportType="overview" allOrders={orders} dateFilter={filters.datePreset} />}
                {activeReport === 'sales_team' && <SalesByTeamPage orders={filteredOrders} onBack={onBack} />}
                {activeReport === 'sales_page' && (
                    <SalesByPageReport 
                        orders={filteredOrders} 
                        onBack={onBack} 
                        onNavigate={onNavigate}
                        contextFilters={filters}
                        dateFilter={filters.datePreset}
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                    />
                )}
                {activeReport === 'shipping' && (
                    <ReportsView 
                        orders={filteredOrders} 
                        reportType="shipping" 
                        allOrders={orders} 
                        dateFilter={filters.datePreset} 
                        startDate={filters.startDate} 
                        endDate={filters.endDate} 
                        onNavigate={onNavigate}
                        contextFilters={filters} 
                    />
                )}
                {activeReport === 'profitability' && <ReportsView orders={filteredOrders} reportType="profitability" allOrders={orders} dateFilter={filters.datePreset} />}
                {activeReport === 'performance' && <ReportsView orders={filteredOrders} reportType="performance" allOrders={orders} dateFilter={filters.datePreset} />}
                {activeReport === 'forecasting' && <ReportsView orders={orders} reportType="forecasting" allOrders={orders} dateFilter={filters.datePreset} />}
            </div>

            {/* Global Filter Modal */}
            <Modal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} maxWidth="max-w-5xl">
                <div className={`p-8 ${styles.modalBg} rounded-md border ${styles.modalBorder} overflow-hidden relative flex flex-col h-full`}>
                    <div className="flex justify-between items-center mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className={`w-1.5 h-10 ${styles.modalIndicator} rounded-full`}></div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Engine</h2>
                                <p className="text-[9px] text-[#848E9C] font-bold uppercase tracking-[0.3em] mt-1.5 ml-0.5">Report Analysis Subsystem</p>
                            </div>
                        </div>
                        <button onClick={() => setIsFilterOpen(false)} className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10 shadow-xl">&times;</button>
                    </div>
                    
                    <div className="overflow-y-auto custom-scrollbar pr-4 relative z-10 flex-grow" style={{ maxHeight: 'calc(85vh - 250px)' }}>
                        <OrderFilters 
                            filters={filters} 
                            setFilters={setFilters} 
                            orders={orders} 
                            usersList={usersList} 
                            appData={appData} 
                            calculatedRange={calculatedRange} 
                        />
                    </div>
                    
                    <div className={`mt-10 flex justify-center relative z-10 border-t ${styles.modalBorder} pt-8`}>
                        <button 
                            onClick={() => setIsFilterOpen(false)} 
                            className={`${styles.primaryBtn} w-full max-w-md py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-md active:scale-[0.98] transition-all shadow-lg`}
                        >
                            Apply Report Parameters
                        </button>
                    </div>
                    {uiTheme !== 'binance' && (
                        <>
                            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                            <div className="absolute -top-20 -left-20 w-60 h-60 bg-indigo-600/5 rounded-full blur-[80px] pointer-events-none"></div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default ReportDashboard;
