
import React, { useState, useContext, useEffect, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import MobileAdminLayout from '../components/admin/MobileAdminLayout';
import DashboardOverview from '../components/admin/DashboardOverview';
import Spinner from '../components/common/Spinner';
import PerformanceTrackingPage from './PerformanceTrackingPage';
import ReportDashboard from './ReportDashboard';
import SettingsDashboard from './SettingsDashboard';
import OrdersDashboard from './OrdersDashboard';
import FulfillmentDashboard from './FulfillmentDashboard';
import PackagingView from './PackagingView';
import DriverDeliveryView from './DriverDeliveryView';
import InventoryManagement from '../components/admin/InventoryManagement';
import EditProfileModal from '../components/common/EditProfileModal';
import AdvancedSettingsModal from '../components/common/AdvancedSettingsModal';
import IncentivesDashboard from './IncentivesDashboard';
import IncentiveProjectDetails from './IncentiveProjectDetails';
import IncentiveExecutionView from '../components/incentives/IncentiveExecutionView';
import { getIncentiveProjects } from '../services/incentiveService';
import { useUrlState } from '../hooks/useUrlState';
import { ParsedOrder } from '../types';
import { useSoundEffects } from '../hooks/useSoundEffects';

type ActiveDashboard = 'admin' | 'orders' | 'reports' | 'settings' | 'fulfillment' | 'packaging' | 'delivery' | 'inventory' | 'incentives';
type AdminView = 'dashboard' | 'performance';
type ReportType = 'overview' | 'performance' | 'profitability' | 'forecasting' | 'shipping' | 'sales_team' | 'sales_page';

const MobileAdminDashboard: React.FC = () => {
    const { 
        appData, currentUser, refreshTimestamp, orders, hasPermission, isOrdersLoading, isSyncing
    } = useContext(AppContext);
    
    const { playTransition } = useSoundEffects();
    
    // --- Navigation State ---
    const [activeDashboard, setActiveDashboard] = useUrlState<ActiveDashboard>('tab', 'admin');
    const [currentAdminView, setCurrentAdminView] = useUrlState<AdminView>('subview', 'dashboard');
    const [activeReport, setActiveReport] = useUrlState<ReportType>('reportType', 'overview');
    const [activeIncentiveProjectId, setActiveIncentiveProjectId] = useUrlState<string>('incentiveProjectId', '');
    const [incentiveViewMode, setIncentiveViewMode] = useUrlState<'manage' | 'execute'>('incentiveMode', 'execute');

    // --- Submenu State ---
    const [isReportSubMenuOpen, setIsReportSubMenuOpen] = useState(false);
    const [isProfileSubMenuOpen, setIsProfileSubMenuOpen] = useState(false);
    const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);
    const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);

    // --- Incentive Logic ---
    const [incentiveProjects, setIncentiveProjects] = useState<any[]>([]);
    useEffect(() => {
        if (activeDashboard === 'incentives') {
            getIncentiveProjects().then(projects => {
                if (Array.isArray(projects)) setIncentiveProjects(projects);
            });
        }
    }, [activeDashboard, activeIncentiveProjectId, refreshTimestamp]);

    // --- Filter State ---
    const [dateFilter, setDateFilter] = useState({
        preset: 'today',
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const [teamFilter, setTeamFilter] = useUrlState<string>('teamFilter', '');
    const [locationFilter, setLocationFilter] = useUrlState<string>('locationFilter', '');
    const [storeFilter, setStoreFilter] = useUrlState<string>('storeFilter', '');
    const [urlDateFilter, setUrlDateFilter] = useUrlState<string>('dateFilter', 'today');
    const [urlStartDate, setUrlStartDate] = useUrlState<string>('startDate', '');
    const [urlEndDate, setUrlEndDate] = useUrlState<string>('endDate', '');
    const [shippingFilter, setShippingFilter] = useUrlState<string>('shippingFilter', '');
    const [driverFilter, setDriverFilter] = useUrlState<string>('driverFilter', '');
    const [brandFilter, setBrandFilter] = useUrlState<string>('brandFilter', '');
    const [paymentFilter, setPaymentFilter] = useUrlState<string>('paymentFilter', '');
    const [userFilter, setUserFilter] = useUrlState<string>('userFilter', '');
    const [pageFilter, setPageFilter] = useUrlState<string>('pageFilter', '');
    const [costFilter, setCostFilter] = useUrlState<string>('costFilter', '');
    const [bankFilter, setBankFilter] = useUrlState<string>('bankFilter', '');
    const [productFilter, setProductFilter] = useUrlState<string>('productFilter', '');

    // --- Data Processing ---
    const filteredData = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return orders.filter(order => {
            if (!order.Timestamp) return false;
            const d = new Date(order.Timestamp);
            if (dateFilter.preset === 'today') return d.toDateString() === now.toDateString();
            if (dateFilter.preset === 'this_week') {
                const day = now.getDay();
                const start = new Date(today);
                start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                return d >= start && d <= end;
            }
            if (dateFilter.preset === 'this_month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            if (dateFilter.preset === 'custom') {
                const start = dateFilter.start ? new Date(dateFilter.start + 'T00:00:00') : null;
                const end = dateFilter.end ? new Date(dateFilter.end + 'T23:59:59') : null;
                if (start && d < start) return false;
                if (end && d > end) return false;
                return true;
            }
            return d.toDateString() === now.toDateString();
        });
    }, [orders, dateFilter]);

    const teamRevenueStats = useMemo(() => {
        const stats: Record<string, { name: string, revenue: number, orders: number }> = {};
        filteredData.forEach(order => {
            let teamName = order.Team || 'Unassigned';
            if (!stats[teamName]) stats[teamName] = { name: teamName, revenue: 0, orders: 0 };
            stats[teamName].revenue += (Number(order['Grand Total']) || 0);
            stats[teamName].orders += 1;
        });
        return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
    }, [filteredData]);

    const storeStats = useMemo(() => {
        const stats: Record<string, { name: string, revenue: number, orders: number }> = {};
        filteredData.forEach(order => {
            let storeName = order['Fulfillment Store'] || 'Unassigned';
            if (!stats[storeName]) stats[storeName] = { name: storeName, revenue: 0, orders: 0 };
            stats[storeName].revenue += (Number(order['Grand Total']) || 0);
            stats[storeName].orders += 1;
        });
        return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
    }, [filteredData]);

    const brandStats = useMemo(() => {
        const stats: Record<string, { name: string, revenue: number, orders: number }> = {};
        filteredData.forEach(order => {
            const pageConfig = appData.pages?.find(p => p.PageName === order.Page);
            const brandName = pageConfig?.DefaultStore || 'Unassigned';
            if (!stats[brandName]) stats[brandName] = { name: brandName, revenue: 0, orders: 0 };
            stats[brandName].revenue += (Number(order['Grand Total']) || 0);
            stats[brandName].orders += 1;
        });
        return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
    }, [filteredData, appData.pages]);

    const provinceStats = useMemo(() => {
        const stats: Record<string, { name: string, revenue: number, orders: number }> = {};
        filteredData.forEach(order => {
            const provinceName = (order.Location || '').split(/[,|\-|/]/)[0].trim();
            if (!provinceName || provinceName.toUpperCase() === 'N/A') return;
            if (!stats[provinceName]) stats[provinceName] = { name: provinceName, revenue: 0, orders: 0 };
            stats[provinceName].revenue += (Number(order['Grand Total']) || 0);
            stats[provinceName].orders += 1;
        });
        return Object.values(stats).sort((a, b) => b.revenue - a.revenue);
    }, [filteredData]);

    // --- Navigation Handlers ---
    const handleNavChange = (id: string) => {
        playTransition();
        if (id === 'reports') setIsReportSubMenuOpen(!isReportSubMenuOpen);
        else {
            if (['dashboard', 'performance'].includes(id)) {
                setActiveDashboard('admin');
                setCurrentAdminView(id as AdminView);
            } else setActiveDashboard(id as ActiveDashboard);
            setIsReportSubMenuOpen(false);
        }
    };

    const handleReportSubNav = (reportId: ReportType) => {
        playTransition();
        setActiveDashboard('reports');
        setActiveReport(reportId);
    };

    const handleNavigateWithFilters = (filters: any) => {
        setTeamFilter(''); setLocationFilter(''); setStoreFilter(''); setBrandFilter('');
        setShippingFilter(''); setDriverFilter(''); setPaymentFilter(''); setUserFilter('');
        setPageFilter(''); setCostFilter(''); setBankFilter(''); setProductFilter('');

        if (filters.team) setTeamFilter(filters.team);
        if (filters.location) setLocationFilter(filters.location);
        if (filters.fulfillmentStore) setStoreFilter(filters.fulfillmentStore);
        if (filters.store) setBrandFilter(filters.store);
        if (filters.shipping) setShippingFilter(filters.shipping);
        if (filters.driver) setDriverFilter(filters.driver);
        if (filters.paymentStatus) setPaymentFilter(filters.paymentStatus);
        if (filters.user) setUserFilter(filters.user);
        if (filters.page) setPageFilter(filters.page);
        if (filters.internalCost) setCostFilter(filters.internalCost);
        if (filters.bank) setBankFilter(filters.bank);
        if (filters.product) setProductFilter(filters.product);

        if (filters.datePreset) {
            setUrlDateFilter(filters.datePreset);
            if (filters.datePreset === 'custom' && filters.startDate && filters.endDate) {
                setUrlStartDate(filters.startDate);
                setUrlEndDate(filters.endDate);
            } else {
                setUrlStartDate(''); setUrlEndDate('');
            }
        }
        setActiveDashboard('orders');
    };

    const navigateToOrders = (filterType: 'team' | 'location' | 'store' | 'brand', value: string) => {
        const filters: any = {};
        if (filterType === 'team') filters.team = value;
        if (filterType === 'location') filters.location = value;
        if (filterType === 'store') filters.fulfillmentStore = value;
        if (filterType === 'brand') filters.store = value;
        filters.datePreset = dateFilter.preset;
        if (dateFilter.preset === 'custom') {
            filters.startDate = dateFilter.start;
            filters.endDate = dateFilter.end;
        }
        handleNavigateWithFilters(filters);
    };

    const renderContent = () => {
        switch (activeDashboard) {
            case 'admin':
                if (currentAdminView === 'dashboard') {
                    return (
                        <DashboardOverview 
                            currentUser={currentUser}
                            parsedOrders={orders}
                            dateFilter={dateFilter}
                            setDateFilter={setDateFilter}
                            teamRevenueStats={teamRevenueStats}
                            provinceStats={provinceStats}
                            storeStats={storeStats}
                            brandStats={brandStats}
                            onTeamClick={(t) => navigateToOrders('team', t)}
                            onProvinceClick={(p) => navigateToOrders('location', p)}
                            onStoreClick={(s) => navigateToOrders('store', s)}
                            onBrandClick={(b) => navigateToOrders('brand', b)}
                        />
                    );
                }
                return <PerformanceTrackingPage orders={orders} users={appData.users || []} targets={appData.targets || []} />;
            case 'orders': 
                if (!hasPermission('view_order_list')) return (
                    <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-reveal">
                        <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center border border-red-500/20 mb-6">
                            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth={2.5}/></svg>
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2 italic">Access Restricted</h3>
                        <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest leading-relaxed">
                            អ្នកមិនមានសិទ្ធិចូលមើលផ្នែកនេះទេ<br/>សូមទាក់ទង System Administrator
                        </p>
                    </div>
                );
                return (
                    <OrdersDashboard 
                        onBack={() => setActiveDashboard('admin')} 
                        initialFilters={{
                            team: teamFilter, location: locationFilter, fulfillmentStore: storeFilter,
                            store: brandFilter, datePreset: urlDateFilter as any, startDate: urlStartDate,
                            endDate: urlEndDate, shippingService: shippingFilter, driver: driverFilter,
                            paymentStatus: paymentFilter, user: userFilter, page: pageFilter,
                            internalCost: costFilter, bank: bankFilter, product: productFilter
                        }}
                    />
                );
            case 'reports': 
                return <ReportDashboard activeReport={activeReport} onBack={() => setActiveDashboard('admin')} onNavigate={handleNavigateWithFilters} />;
            case 'settings': return <SettingsDashboard onBack={() => setActiveDashboard('admin')} />;
            case 'fulfillment': return <FulfillmentDashboard orders={orders} />;
            case 'packaging': return <PackagingView orders={orders} />;
            case 'delivery': return <DriverDeliveryView />;
            case 'inventory': return <InventoryManagement />;
            case 'incentives':
                if (activeIncentiveProjectId) {
                    if (incentiveViewMode === 'execute') return <IncentiveExecutionView projectId={activeIncentiveProjectId} orders={orders} onBack={() => setActiveIncentiveProjectId('')} />;
                    return <IncentiveProjectDetails projectId={activeIncentiveProjectId} onBack={() => setActiveIncentiveProjectId('')} />;
                }
                return <IncentivesDashboard onOpenProject={(id, mode) => { setActiveIncentiveProjectId(id); setIncentiveViewMode(mode); }} />;
            default: return null;
        }
    };

    if (isOrdersLoading && orders.length === 0) {
        return (
            <div className="h-screen bg-[#020617] flex flex-col items-center justify-center gap-6">
                <div className="relative">
                    <Spinner size="lg" />
                    <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
                </div>
                <div className="text-center space-y-2">
                    <p className="text-[10px] font-black text-white uppercase tracking-[0.4em] animate-pulse">Initializing Admin Node</p>
                    <p className="text-[8px] font-bold text-blue-500/40 uppercase tracking-widest">Securing data tunnels...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <MobileAdminLayout
                activeDashboard={activeDashboard}
                currentAdminView={currentAdminView}
                isReportSubMenuOpen={isReportSubMenuOpen}
                setIsReportSubMenuOpen={setIsReportSubMenuOpen}
                isProfileSubMenuOpen={isProfileSubMenuOpen}
                setIsProfileSubMenuOpen={setIsProfileSubMenuOpen}
                setEditProfileModalOpen={setEditProfileModalOpen}
                setAdvancedSettingsOpen={setAdvancedSettingsOpen}
                onNavChange={handleNavChange}
                onReportSubNav={handleReportSubNav}
            >
                <div key={activeDashboard + currentAdminView + activeReport} className="animate-reveal min-h-full">
                    {renderContent()}
                </div>
            </MobileAdminLayout>
            {editProfileModalOpen && <EditProfileModal onClose={() => setEditProfileModalOpen(false)} />}
            {advancedSettingsOpen && <AdvancedSettingsModal onClose={() => setAdvancedSettingsOpen(false)} />}
        </>
    );
};

export default MobileAdminDashboard;
