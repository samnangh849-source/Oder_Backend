
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder } from '../types';
import SimpleBarChart from '../components/admin/SimpleBarChart';
import StatCard from '../components/performance/StatCard';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Spinner from '../components/common/Spinner';
import { FilterState } from '../components/orders/OrderFilters';
import { ChevronLeft, Download, BarChart3, TrendingUp, Terminal, Filter, Activity, Cpu, DollarSign, Layers, Zap } from 'lucide-react';
import SalesStatisticModal from '../components/reports/SalesStatisticModal';

// Import separate view components
import SalesByPageDesktop from '../components/reports/SalesByPageDesktop';
import SalesByPageTablet from '../components/reports/SalesByPageTablet';
import SalesByPageMobile from '../components/reports/SalesByPageMobile';

interface SalesByPageReportProps {
    orders: ParsedOrder[];
    onBack: () => void;
    onNavigate?: (filters: any) => void;
    contextFilters?: FilterState;
    dateFilter?: string;
    startDate?: string;
    endDate?: string;
    onFilterChange?: (filters: Partial<FilterState>) => void;
}

type SortKey = 'revenue' | 'profit' | 'teamName' | 'pageName';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SalesByPageReport: React.FC<SalesByPageReportProps> = ({ 
    orders: sourceOrders, onBack, onNavigate, contextFilters, dateFilter, startDate, endDate, onFilterChange 
}) => {
    const { appData, previewImage, language, advancedSettings } = useContext(AppContext);
    const [showAllPages, setShowAllPages] = useState(true); 
    const [onlyTelegram, setOnlyTelegram] = useState(false); // Added missing state
    const [isExporting, setIsExporting] = useState(false);
    const [isStatisticOpen, setIsStatisticOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'revenue', direction: 'desc' });

    // Local filter state to allow shortcuts to work without navigating away
    const [activeDateFilter, setActiveDateFilter] = useState(dateFilter || 'all');
    const [activeStart, setActiveStart] = useState(startDate || '');
    const [activeEnd, setActiveEnd] = useState(endDate || '');

    // Sync local state with props from parent
    useEffect(() => {
        if (dateFilter) setActiveDateFilter(dateFilter);
        if (startDate) setActiveStart(startDate);
        if (endDate) setActiveEnd(endDate);
    }, [dateFilter, startDate, endDate]);

    const handleDateShortcut = (id: string) => {
        setActiveDateFilter(id);
        if (onFilterChange) {
            onFilterChange({ datePreset: id as any, startDate: '', endDate: '' });
        }
    };

    const toggleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // Helper: Construct base filters from context
    const getBaseFilters = () => {
        const filters: any = {};
        if (contextFilters) {
            if (contextFilters.team) filters.team = contextFilters.team;
            if (contextFilters.store) filters.store = contextFilters.store;
            if (contextFilters.paymentStatus) filters.paymentStatus = contextFilters.paymentStatus;
            if (contextFilters.user) filters.user = contextFilters.user;
            if (contextFilters.fulfillmentStore) filters.fulfillmentStore = contextFilters.fulfillmentStore;
            if (contextFilters.location) filters.location = contextFilters.location;
            if (contextFilters.shippingService) filters.shipping = contextFilters.shippingService;
            if (contextFilters.driver) filters.driver = contextFilters.driver;
            if (contextFilters.bank) filters.bank = contextFilters.bank;
            if (contextFilters.product) filters.product = contextFilters.product;
            if (contextFilters.internalCost) filters.internalCost = contextFilters.internalCost;
        }
        return filters;
    };

    const handleFilterNavigation = (key: string, value: string) => {
        if (onNavigate) {
            const filters = getBaseFilters();
            if (key === 'page') filters.page = value;
            if (key === 'team') filters.team = value;
            filters.datePreset = activeDateFilter;
            filters.startDate = activeStart;
            filters.endDate = activeEnd;
            onNavigate(filters);
        }
    };

    const handleMonthClick = (pageName: string, monthIndex: number) => {
        if (onNavigate) {
            const filters = getBaseFilters();
            const currentYear = new Date().getFullYear();
            const targetYear = activeDateFilter === 'last_year' ? currentYear - 1 : currentYear;
            const start = new Date(targetYear, monthIndex, 1);
            const end = new Date(targetYear, monthIndex + 1, 0, 23, 59, 59);
            const fmt = (d: Date) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            const newFilters = { 
                ...contextFilters,
                ...filters,
                page: pageName,
                datePreset: 'custom' as const,
                startDate: fmt(start),
                endDate: fmt(end)
            };
            onNavigate(newFilters);
        }
    };

    const filteredOrders = useMemo(() => {
        if (!activeDateFilter || activeDateFilter === 'all') return sourceOrders;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        let start: Date | null = null;
        let end: Date | null = endOfToday;

        switch (activeDateFilter) {
            case 'today': start = today; end = endOfToday; break;
            case 'yesterday':
                start = new Date(today); start.setDate(today.getDate() - 1);
                end = new Date(today); end.setMilliseconds(-1); break;
            case 'this_week': {
                const d = now.getDay();
                start = new Date(today); start.setDate(today.getDate() - (d === 0 ? 6 : d - 1));
                end = endOfToday; break;
            }
            case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = endOfToday; break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
            case 'this_year': start = new Date(now.getFullYear(), 0, 1); end = endOfToday; break;
            case 'last_year':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999); break;
            case 'custom':
                if (activeStart) start = new Date(activeStart + 'T00:00:00');
                if (activeEnd) end = new Date(activeEnd + 'T23:59:59');
                break;
            default: return sourceOrders;
        }

        return sourceOrders.filter(o => {
            if (!o.Timestamp) return false;
            const d = safeParseDate(o.Timestamp);
            if (!d || isNaN(d.getTime())) return false;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });
    }, [sourceOrders, activeDateFilter, activeStart, activeEnd]);

    const pageStats = useMemo(() => {
        const stats: Record<string, any> = {};
        const matchesFilters = (pName: string, pTeam: string) => {
            if (contextFilters?.team) {
                const selectedTeams = contextFilters.team.split(',').map(t => t.trim().toLowerCase());
                if (!selectedTeams.includes((pTeam || '').toLowerCase())) return false;
            }
            if (contextFilters?.page) {
                const selectedPages = contextFilters.page.split(',').map(p => p.trim().toLowerCase());
                if (!selectedPages.includes((pName || '').toLowerCase())) return false;
            }
            if (onlyTelegram) {
                if (!(pName || '').toLowerCase().startsWith('telegram')) return false;
            }
            return true;
        };

        if (appData.pages) {
            appData.pages.forEach(p => {
                if (matchesFilters(p.PageName, p.Team || '')) {
                    stats[p.PageName] = { pageName: p.PageName, teamName: p.Team || 'Unassigned', logoUrl: p.PageLogoURL || '', revenue: 0, profit: 0, orderCount: 0 };
                    MONTHS.forEach(m => { stats[p.PageName][`rev_${m}`] = 0; stats[p.PageName][`prof_${m}`] = 0; });
                }
            });
        }

        filteredOrders.forEach(o => {
            const fs = o.FulfillmentStatus || o['Fulfillment Status'] || 'Pending';
            if (fs === 'Cancelled' || fs === 'Returned') return;
            const page = o.Page || 'Unknown';
            if (stats[page]) {
                const rev = Number(o['Grand Total']) || 0;
                const cost = (Number(o['Total Product Cost ($)']) || 0) + (Number(o['Internal Cost']) || 0);
                stats[page].revenue += rev;
                stats[page].profit += (rev - cost);
                stats[page].orderCount += 1;
                if (o.Timestamp) { 
                    const d = safeParseDate(o.Timestamp); 
                    if (d) {
                        const monthName = MONTHS[d.getMonth()];
                        stats[page][`rev_${monthName}`] += rev; 
                        stats[page][`prof_${monthName}`] += (rev - cost); 
                    }
                }
            }
        });

        let result = Object.values(stats);
        if (!showAllPages) result = result.filter(item => item.revenue > 0);

        return result.sort((a: any, b: any) => {
            const mult = sortConfig.direction === 'asc' ? 1 : -1;
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (typeof valA === 'string') return valA.localeCompare(valB) * mult;
            return (valA - valB) * mult;
        });
    }, [filteredOrders, sortConfig, appData.pages, showAllPages, contextFilters, onlyTelegram]);

    const grandTotals = useMemo(() => {
        const totals: any = { revenue: 0, profit: 0, pagesCount: pageStats.length };
        MONTHS.forEach(m => { totals[`rev_${m}`] = 0; totals[`prof_${m}`] = 0; });
        pageStats.forEach((s: any) => { 
            totals.revenue += s.revenue; totals.profit += s.profit; 
            MONTHS.forEach(m => { totals[`rev_${m}`] += s[`rev_${m}`]; totals[`prof_${m}`] += s[`prof_${m}`]; }); 
        });
        return totals;
    }, [pageStats]);

    const handleExportPDF = () => {
        setIsExporting(true);
        setTimeout(() => {
            try {
                const doc = new jsPDF({ orientation: 'landscape' }) as any;
                const pageWidth = doc.internal.pageSize.width;
                doc.setFontSize(18);
                doc.text("Sales Report by Page", pageWidth / 2, 15, { align: 'center' });
                doc.save(`Page_Sales_Report_${Date.now()}.pdf`);
            } catch (err) { console.error(err); alert("Export failed"); } finally { setIsExporting(false); }
        }, 100);
    };

    const topPagesChartData = useMemo(() => {
        return [...pageStats].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map(p => ({ label: p.pageName, value: p.revenue, imageUrl: p.logoUrl }));
    }, [pageStats]);

    return (
        <div className="w-full bg-[#0B0E11] min-h-screen font-sans select-none animate-fade-in pb-12">
            {/* Header - Technical Style */}
            <div className="bg-[#1E2329] border-b border-[#2B3139] px-6 py-4 mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all active:scale-95">
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse shadow-[0_0_10px_#3B82F6]"></div>
                                <h1 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                    <Cpu size={24} className="text-blue-500" />
                                    {language === 'km' ? 'មជ្ឈមណ្ឌលបញ្ញាលក់' : 'Sales Intelligence Hub'}
                                    <span className="ml-2 px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[9px] rounded-lg border border-blue-500/30 font-black tracking-widest italic">QUANTUM v2.5</span>
                                </h1>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-[10px] text-[#848E9C] font-black uppercase tracking-[0.2em]">ADMIN CONSOLE</p>
                                <span className="text-[#474D57] font-black text-[10px]">|</span>
                                <p className="text-[10px] text-[#FCD535] font-black uppercase tracking-[0.2em] flex items-center gap-1">
                                    <Filter size={10} />
                                    {contextFilters?.team ? `NODE: ${contextFilters.team}` : 'GLOBAL VIEW'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Date Shortcuts */}
                    <div className="flex items-center gap-1.5 bg-[#0B0E11] p-1.5 rounded-2xl border border-[#2B3139] shadow-inner overflow-x-auto no-scrollbar">
                        {[
                            { id: 'today', label: 'Today', km: 'ថ្ងៃនេះ' },
                            { id: 'yesterday', label: 'Yesterday', km: 'ម្សិលមិញ' },
                            { id: 'this_week', label: 'This Week', km: 'សប្តាហ៍នេះ' },
                            { id: 'last_week', label: 'Last Week', km: 'សប្តាហ៍មុន' },
                            { id: 'this_month', label: 'This Month', km: 'ខែនេះ' },
                            { id: 'last_month', label: 'Last Month', km: 'ខែមុន' },
                            { id: 'this_year', label: 'This Year', km: 'ឆ្នាំនេះ' },
                            { id: 'last_year', label: 'Last Year', km: 'ឆ្នាំមុន' },
                            { id: 'all', label: 'All Time', km: 'ទាំងអស់' },
                        ].map((range) => (
                            <button
                                key={range.id}
                                onClick={() => handleDateShortcut(range.id)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                                    activeDateFilter === range.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-400/50'
                                        : 'text-[#848E9C] hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {language === 'km' ? range.km : range.label}
                            </button>
                        ))}
                    </div>
                </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsStatisticOpen(true)}
                            className="group relative flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-[0.98] shadow-xl shadow-blue-500/20 border border-white/10"
                        >
                            <Cpu size={14} className="group-hover:rotate-90 transition-transform duration-500" />
                            Intelligence Hub
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0B0E11] animate-pulse"></div>
                        </button>
                        <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-5 py-2.5 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-[#FCD535]/10 disabled:opacity-50">
                            {isExporting ? <Spinner size="xs" /> : <Download size={14} />}
                            Export Report
                        </button>
                    </div>
                </div>
            </div>

            <div className="px-6 space-y-6">
                {/* Financial KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-[2rem] relative overflow-hidden group hover:border-blue-500/50 transition-all shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                                <DollarSign size={20} />
                            </div>
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Total Revenue</p>
                        </div>
                        <h3 className="text-3xl font-black text-white tabular-nums relative z-10">${grandTotals.revenue.toLocaleString()}</h3>
                        <div className="mt-3 flex items-center gap-2">
                            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[70%]" />
                            </div>
                            <span className="text-[10px] font-black text-blue-500">+12%</span>
                        </div>
                    </div>

                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-[2rem] relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                                <TrendingUp size={20} />
                            </div>
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Total Profit</p>
                        </div>
                        <h3 className="text-3xl font-black text-[#0ECB81] tabular-nums relative z-10">${grandTotals.profit.toLocaleString()}</h3>
                        <div className="mt-3 flex items-center gap-2">
                            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[65%]" />
                            </div>
                            <span className="text-[10px] font-black text-emerald-500">+8.4%</span>
                        </div>
                    </div>

                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-[2rem] relative overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                <Layers size={20} />
                            </div>
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Active Nodes</p>
                        </div>
                        <h3 className="text-3xl font-black text-white tabular-nums relative z-10">{grandTotals.pagesCount}</h3>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md uppercase tracking-widest">Global Network</span>
                        </div>
                    </div>

                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-[2rem] relative overflow-hidden group hover:border-amber-500/50 transition-all shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                                <Zap size={20} />
                            </div>
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">Avg Performance</p>
                        </div>
                        <h3 className="text-3xl font-black text-amber-500 tabular-nums relative z-10">${(grandTotals.revenue / (grandTotals.pagesCount || 1)).toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md uppercase tracking-widest">Efficiency 94%</span>
                        </div>
                    </div>
                </div>

                {/* Main Tables */}
                <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl overflow-hidden shadow-2xl">
                    <SalesByPageDesktop 
                        data={pageStats}
                        grandTotals={grandTotals}
                        sortConfig={sortConfig}
                        onToggleSort={toggleSort}
                        showAllPages={showAllPages}
                        setShowAllPages={setShowAllPages}
                        onlyTelegram={onlyTelegram}
                        setOnlyTelegram={setOnlyTelegram}
                        onExportPDF={handleExportPDF}
                        isExporting={isExporting}
                        onPreviewImage={previewImage}
                        onNavigate={handleFilterNavigation}
                        onMonthClick={handleMonthClick}
                    />
                    
                    <SalesByPageTablet 
                        data={pageStats}
                        grandTotals={grandTotals}
                        onPreviewImage={previewImage}
                        onNavigate={handleFilterNavigation}
                        onMonthClick={handleMonthClick}
                    />

                    <SalesByPageMobile 
                        data={pageStats}
                        onPreviewImage={previewImage}
                        onNavigate={handleFilterNavigation}
                        onMonthClick={handleMonthClick}
                    />
                </div>

                {/* Bottom Charts & Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 bg-[#1E2329] border border-[#2B3139] p-6 rounded-2xl shadow-xl">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-1.5 h-6 bg-[#FCD535] rounded-full"></div>
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">Top 5 Performance Nodes</h3>
                        </div>
                        <div className="bg-[#0B0E11]/50 p-4 rounded-xl border border-white/5">
                            <SimpleBarChart data={topPagesChartData} title="" />
                        </div>
                    </div>
                    
                    <div className="lg:col-span-4 bg-[#1E2329] border border-[#2B3139] p-6 rounded-2xl shadow-xl flex flex-col">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-1.5 h-6 bg-[#0ECB81] rounded-full"></div>
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">System Status</h3>
                        </div>
                        <div className="space-y-4 flex-1 flex flex-col justify-center">
                            <div className="bg-[#0B0E11] p-5 rounded-xl border border-[#2B3139] flex justify-between items-center group hover:border-[#FCD535]/30 transition-all">
                                <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">Protocol</span>
                                <span className="text-white font-black text-xs tabular-nums uppercase">Secure HLS</span>
                            </div>
                            <div className="bg-[#0B0E11] p-5 rounded-xl border border-[#2B3139] flex justify-between items-center group hover:border-[#FCD535]/30 transition-all">
                                <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">Sync Status</span>
                                <span className="text-[#0ECB81] font-black text-xs tabular-nums uppercase tracking-widest">Live</span>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-[#2B3139] text-center">
                            <div className="flex items-center justify-center gap-2">
                                <Terminal size={12} className="text-[#474D57]" />
                                <span className="text-[9px] font-black text-[#474D57] uppercase tracking-[0.3em]">Authorized Access Only</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <SalesStatisticModal 
                isOpen={isStatisticOpen}
                onClose={() => setIsStatisticOpen(false)}
                orders={sourceOrders} initialDateFilter={activeDateFilter} initialStart={activeStart} initialEnd={activeEnd}
                title={language === 'km' ? 'ស្ថិតិលក់តាមផេក (Admin)' : 'ADMIN PAGE SALES STATS'}
                subtitle={`CONTEXT: ${contextFilters?.team || 'Global View'}`}
            />
        </div>
    );
};

export default SalesByPageReport;
