import React, { useState, useMemo, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder } from '../types';
import StatCard from '../components/performance/StatCard';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Spinner from '../components/common/Spinner';
import SimpleBarChart from '../components/admin/SimpleBarChart';
import { safeParseDate } from '../utils/dateUtils';
import { ChevronLeft, Download, BarChart3, TrendingUp, Package, Layout, Terminal, Activity, Cpu, DollarSign, Layers, Zap } from 'lucide-react';
import SalesStatisticModal from '../components/reports/SalesStatisticModal';
import OrderFilters, { FilterState } from '../components/orders/OrderFilters';
import Modal from '../components/common/Modal';

// Import separate view components
import SalesByPageDesktop from '../components/reports/SalesByPageDesktop';
import SalesByPageTablet from '../components/reports/SalesByPageTablet';
import SalesByPageMobile from '../components/reports/SalesByPageMobile';

interface UserSalesPageReportProps {
    orders: ParsedOrder[];
    onBack: () => void;
    team: string;
    onNavigate?: (filters: any) => void;
    dateFilter?: string;
    customStart?: string;
    customEnd?: string;
    onFilterChange?: (filters: Partial<FilterState>) => void;
}

type SortKey = 'revenue' | 'pageName';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const UserSalesPageReport: React.FC<UserSalesPageReportProps> = ({
    orders: sourceOrders,
    onBack,
    team,
    onNavigate,
    dateFilter: initialDateFilter,
    customStart: initialStart,
    customEnd: initialEnd,
    onFilterChange
}) => {
    const { appData, previewImage, language, advancedSettings } = useContext(AppContext);
    const [showAllPages, setShowAllPages] = useState(true); 
    const [isExporting, setIsExporting] = useState(false);
    const [isStatisticOpen, setIsStatisticOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'revenue', direction: 'desc' });

    // Filter State
    const [filters, setFilters] = useState<FilterState>({
        datePreset: (initialDateFilter as any) || 'all',
        startDate: initialStart || '',
        endDate: initialEnd || '',
        team: team,
        user: '',
        paymentStatus: '',
        shippingService: '',
        driver: '',
        product: '',
        bank: '',
        fulfillmentStore: '',
        store: '',
        page: '',
        location: '',
        internalCost: '',
        customerName: '',
        telegramStatus: '',
        fulfillmentStatus: '',
    });

    // Local state for UI display consistency
    const [activeDateFilter, setActiveDateFilter] = useState(initialDateFilter || 'all');
    const [activeStart, setActiveStart] = useState(initialStart || '');
    const [activeEnd, setActiveEnd] = useState(initialEnd || '');

    // Sync from parent props
    useEffect(() => {
        if (initialDateFilter) {
            setActiveDateFilter(initialDateFilter);
            setFilters(prev => ({ ...prev, datePreset: initialDateFilter as any }));
        }
        if (initialStart) {
            setActiveStart(initialStart);
            setFilters(prev => ({ ...prev, startDate: initialStart }));
        }
        if (initialEnd) {
            setActiveEnd(initialEnd);
            setFilters(prev => ({ ...prev, endDate: initialEnd }));
        }
    }, [initialDateFilter, initialStart, initialEnd]);

    const handleDateShortcut = (id: string) => {
        setActiveDateFilter(id);
        const newFilters = { datePreset: id as any, startDate: '', endDate: '' };
        setFilters(prev => ({ ...prev, ...newFilters }));
        if (onFilterChange) {
            onFilterChange(newFilters);
        }
    };

    const handleApplyFilters = () => {
        setIsFilterOpen(false);
        if (onFilterChange) {
            onFilterChange(filters);
        }
    };

    const toggleSort = (key: SortKey) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };
    const handleNavigate = (key: string, value: string) => {
        if (onNavigate) {
            const filters: any = { team };
            if (key === 'page') filters.page = value;
            onNavigate(filters);
        }
    };
    const handleMonthClick = (pageName: string, monthIndex: number) => {
        if (onNavigate) {
            const year = new Date().getFullYear();
            const targetYear = activeDateFilter === 'last_year' ? year - 1 : year;
            const fmt = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };
            const monthStart = new Date(targetYear, monthIndex, 1);
            const monthEnd = new Date(targetYear, monthIndex + 1, 0, 23, 59, 59);
            onNavigate({ team, page: pageName, datePreset: 'custom', customStart: fmt(monthStart), customEnd: fmt(monthEnd), isMonthlyDrilldown: true });
        }
    };
    const teamOrders = useMemo(() => {
        return sourceOrders.filter(o =>
            (o.Team || '').trim().toLowerCase() === team.trim().toLowerCase()
        );
    }, [sourceOrders, team]);

    const filteredOrders = useMemo(() => {
        if (!activeDateFilter || activeDateFilter === 'all') return teamOrders;
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
            case 'last_week': {
                start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6);
                end = new Date(start); end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999); break;
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
            default: return teamOrders;
        }
        return teamOrders.filter(o => {
            if (!o.Timestamp) return false;
            const d = safeParseDate(o.Timestamp);
            if (!d || isNaN(d.getTime())) return false;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        });
    }, [teamOrders, activeDateFilter, activeStart, activeEnd]);

    const pageStats = useMemo(() => {
        const stats: Record<string, any> = {};
        if (appData.pages) {
            const teamPages = appData.pages.filter(p => (p.Team || '').trim() === team);
            teamPages.forEach(p => {
                stats[p.PageName] = { pageName: p.PageName, teamName: team, logoUrl: p.PageLogoURL || '', revenue: 0, profit: 0, orderCount: 0 };
                MONTHS.forEach(m => { stats[p.PageName][`rev_${m}`] = 0; stats[p.PageName][`prof_${m}`] = 0; });
            });
        }
        filteredOrders.forEach(o => {
            const fs = o.FulfillmentStatus || o['Fulfillment Status'] || 'Pending';
            if (fs === 'Cancelled' || fs === 'Returned') return;
            const page = o.Page || 'Unknown';
            if (!stats[page]) {
                const info = appData.pages?.find(p => p.PageName === page);
                stats[page] = { pageName: page, teamName: team, logoUrl: info?.PageLogoURL || '', revenue: 0, profit: 0, orderCount: 0 };
                MONTHS.forEach(m => { stats[page][`rev_${m}`] = 0; stats[page][`prof_${m}`] = 0; });
            }
            const rev = Number(o['Grand Total']) || 0;
            const cost = (Number(o['Total Product Cost ($)']) || 0) + (Number(o['Internal Cost']) || 0);
            const profit = rev - cost;
            stats[page].revenue += rev;
            stats[page].profit += profit;
            stats[page].orderCount += 1;
            if (o.Timestamp) {
                const d = safeParseDate(o.Timestamp);
                if (d) {
                    const mName = MONTHS[d.getMonth()];
                    stats[page][`rev_${mName}`] += rev;
                    stats[page][`prof_${mName}`] += profit;
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
    }, [filteredOrders, sortConfig, appData.pages, showAllPages, team]);
    const grandTotals = useMemo(() => {
        const totals: any = { revenue: 0, profit: 0, pagesCount: pageStats.length, orders: 0 };
        MONTHS.forEach(m => { totals[`rev_${m}`] = 0; totals[`prof_${m}`] = 0; });
        pageStats.forEach((s: any) => { 
            totals.revenue += s.revenue; totals.profit += s.profit; totals.orders += s.orderCount;
            MONTHS.forEach(m => { totals[`rev_${m}`] += s[`rev_${m}`]; totals[`prof_${m}`] += s[`prof_${m}`]; });
        });
        return totals;
    }, [pageStats]);
    const filterLabel = useMemo(() => {
        const labels: Record<string, string> = {
            today: 'TODAY', yesterday: 'YESTERDAY', this_week: 'THIS WEEK',
            last_week: 'LAST WEEK',
            this_month: 'THIS MONTH', last_month: 'LAST MONTH',
            this_year: 'THIS YEAR', last_year: 'LAST YEAR',
            all: 'ALL TIME',
            custom: activeStart && activeEnd ? `${activeStart} → ${activeEnd}` : 'CUSTOM',
        };
        return labels[activeDateFilter || 'all'] || 'ALL TIME';
    }, [activeDateFilter, activeStart, activeEnd]);

    const calculatedRange = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start: Date | null = null;
        let end: Date | null = new Date();
        end.setHours(23, 59, 59, 999);
        
        switch (filters.datePreset) {
            case 'today': start = today; break;
            case 'yesterday': 
                start = new Date(today); start.setDate(today.getDate() - 1); 
                end = new Date(today); end.setMilliseconds(-1); break;
            case 'this_week': 
                const d = now.getDay(); start = new Date(today); 
                start.setDate(today.getDate() - (d === 0 ? 6 : d - 1)); break;
            case 'last_week':
                start = new Date(today); start.setDate(today.getDate() - now.getDay() - 6);
                end = new Date(start); end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999); break;
            case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last_month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
            case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
            case 'last_year':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999); break;
            case 'all': return 'All time data';
            case 'custom': return `${filters.startDate || '...'} to ${filters.endDate || '...'}`;
            default: start = today;
        }
        const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return start ? `${formatDate(start)} to ${formatDate(end)}` : 'All time data';
    }, [filters.datePreset, filters.startDate, filters.endDate]);

    const handleExportPDF = () => {
        setIsExporting(true);
        setTimeout(() => {
            try {
                const doc = new jsPDF({ orientation: 'landscape' }) as any;
                const pageWidth = doc.internal.pageSize.width;
                doc.setFontSize(18);
                doc.text(`Sales Report - Team: ${team}`, pageWidth / 2, 15, { align: 'center' });
                doc.setFontSize(12);
                doc.text(`Period: ${filterLabel}`, pageWidth / 2, 22, { align: 'center' });
                doc.autoTable({
                    startY: 30, head: [['Metric', 'Value']],
                    body: [['Total Revenue', `$${grandTotals.revenue.toLocaleString()}`], ['Total Orders', grandTotals.orders]],
                    theme: 'grid', headStyles: { fillColor: [41, 128, 185] },
                });
                doc.save(`Page_Report_${team}_${Date.now()}.pdf`);
            } catch (err) { console.error(err); alert("Export failed"); } finally { setIsExporting(false); }
        }, 100);
    };
    const topPagesChartData = useMemo(() => {
        return [...pageStats].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map(p => ({ label: p.pageName, value: p.revenue, imageUrl: p.logoUrl }));
    }, [pageStats]);

    const activeFilterCount = Object.values(filters).filter(v => v !== '' && v !== 'all' && v !== team).length;

    return (
        <div className="fixed inset-0 z-[150] bg-[#0B0E11] overflow-hidden flex flex-col font-sans select-none animate-fade-in">
            {/* Header - Packaging View Style */}
            <header className="flex-shrink-0 bg-[#0B0E11] border-b border-[#2B3139] px-4 py-3 flex items-center justify-between z-10">
                <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={onBack}
                            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-all active:scale-95"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse shadow-[0_0_10px_#3B82F6]"></div>
                                <h1 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                    <Cpu size={22} className="text-blue-500" />
                                    {language === 'km' ? 'មជ្ឈមណ្ឌលបញ្ញាលក់' : 'Sales Intelligence Hub'}
                                    <span className="ml-2 px-2 py-0.5 bg-blue-600/20 text-blue-400 text-[8px] rounded-lg border border-blue-500/30 font-black tracking-widest italic">QUANTUM v2.5</span>
                                </h1>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[10px] text-[#848E9C] font-black uppercase tracking-[0.2em]">NODE: {team}</p>
                                <span className="text-[#474D57] font-black text-[10px]">|</span>
                                <p className="text-[10px] text-[#FCD535] font-black uppercase tracking-[0.2em]">{filterLabel}</p>
                            </div>
                        </div>
                    </div>
                    {/* Quick Date Shortcuts */}
                    <div className="flex items-center gap-1.5 bg-[#1E2329] p-1.5 rounded-2xl border border-[#2B3139] shadow-inner overflow-x-auto no-scrollbar">
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
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
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
                        onClick={() => setIsFilterOpen(true)}
                        className="group relative flex items-center gap-2 px-6 py-3 bg-[#1E2329] hover:bg-[#2B3139] text-[#848E9C] hover:text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-[0.98] shadow-xl border border-[#2B3139]"
                    >
                        <Layers size={14} className="text-blue-500" />
                        Filters
                        {activeFilterCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-[#0B0E11] shadow-lg shadow-blue-900/40">
                                {activeFilterCount}
                            </div>
                        )}
                    </button>
                    <button 
                        onClick={() => setIsStatisticOpen(true)}
                        className="group relative flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-[0.98] shadow-xl shadow-blue-500/20 border border-white/10"
                    >
                        <Cpu size={14} className="group-hover:rotate-90 transition-transform duration-500" />
                        Intelligence Hub
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0B0E11] animate-pulse"></div>
                    </button>
                    <button 
                        onClick={handleExportPDF} 
                        disabled={isExporting} 
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#FCD535] hover:bg-[#FCD535]/90 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-[#FCD535]/10 disabled:opacity-50"
                    >
                        {isExporting ? <Spinner size="xs" /> : <Download size={14} />}
                        Export PDF
                    </button>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#0B0E11] p-4 space-y-6">
                {/* Financial KPIs - Packaging View Card Style */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-[2rem] relative overflow-hidden group hover:border-blue-500/50 transition-all shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 shadow-lg shadow-blue-500/10">
                                <DollarSign size={20} />
                            </div>
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">{language === 'km' ? 'ចំណូលសរុប' : 'Total Revenue'}</p>
                        </div>
                        <h3 className="text-3xl font-black text-white tabular-nums relative z-10">${grandTotals.revenue.toLocaleString()}</h3>
                        <div className="mt-3 flex items-center gap-2 relative z-10">
                            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[70%]" />
                            </div>
                            <span className="text-[10px] font-black text-blue-500">+12%</span>
                        </div>
                    </div>
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-[2rem] relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/10">
                                <TrendingUp size={20} />
                            </div>
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">{language === 'km' ? 'ប្រាក់ចំណេញ' : 'Net Profit'}</p>
                        </div>
                        <h3 className="text-3xl font-black text-[#0ECB81] tabular-nums relative z-10">${grandTotals.profit.toLocaleString()}</h3>
                        <div className="mt-3 flex items-center gap-2 relative z-10">
                            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[65%]" />
                            </div>
                            <span className="text-[10px] font-black text-emerald-500">+8.4%</span>
                        </div>
                    </div>
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-[2rem] relative overflow-hidden group hover:border-indigo-500/50 transition-all shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 shadow-lg shadow-indigo-500/10">
                                <Package size={20} />
                            </div>
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">{language === 'km' ? 'ការកម្មង់' : 'Total Orders'}</p>
                        </div>
                        <h3 className="text-3xl font-black text-white tabular-nums relative z-10">{grandTotals.orders}</h3>
                        <div className="mt-3 flex items-center gap-2 relative z-10">
                            <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md uppercase tracking-widest">Active Orders</span>
                        </div>
                    </div>
                    <div className="bg-[#1E2329] border border-[#2B3139] p-6 rounded-[2rem] relative overflow-hidden group hover:border-purple-500/50 transition-all shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 shadow-lg shadow-purple-500/10">
                                <Layout size={20} />
                            </div>
                            <p className="text-[10px] font-black text-[#848E9C] uppercase tracking-[0.2em]">{language === 'km' ? 'ផេកសកម្ម' : 'Active Pages'}</p>
                        </div>
                        <h3 className="text-3xl font-black text-white tabular-nums relative z-10">{grandTotals.pagesCount}</h3>
                        <div className="mt-3 flex items-center gap-2 relative z-10">
                            <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md uppercase tracking-widest">Digital Nodes</span>
                        </div>
                    </div>
                </div>
                {/* Report Content - Wrap in Surface Container */}
                <div className="bg-[#1E2329] border border-[#2B3139] rounded-2xl overflow-hidden shadow-2xl">
                    <SalesByPageDesktop data={pageStats} grandTotals={grandTotals} sortConfig={sortConfig} onToggleSort={toggleSort} showAllPages={showAllPages} setShowAllPages={setShowAllPages} onExportPDF={handleExportPDF} isExporting={isExporting} onPreviewImage={previewImage} onNavigate={handleNavigate} onMonthClick={handleMonthClick} />
                    <SalesByPageTablet data={pageStats} grandTotals={grandTotals} onPreviewImage={previewImage} onNavigate={handleNavigate} onMonthClick={handleMonthClick} />
                    <SalesByPageMobile data={pageStats} onPreviewImage={previewImage} onNavigate={handleNavigate} onMonthClick={handleMonthClick} />
                </div>
                {/* Analytical Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8">
                    <div className="lg:col-span-8 bg-[#1E2329] border border-[#2B3139] p-6 rounded-2xl shadow-xl">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-1.5 h-6 bg-[#FCD535] rounded-full"></div>
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">{language === 'km' ? 'ផេកដែលមានចំណូលខ្ពស់បំផុត' : 'Top 5 Revenue Pages'}</h3>
                        </div>
                        <div className="bg-[#0B0E11]/50 p-4 rounded-xl border border-white/5">
                            <SimpleBarChart data={topPagesChartData} title="" />
                        </div>
                    </div>
                    <div className="lg:col-span-4 bg-[#1E2329] border border-[#2B3139] p-6 rounded-2xl shadow-xl flex flex-col">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-1.5 h-6 bg-[#0ECB81] rounded-full"></div>
                            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">{language === 'km' ? 'សង្ខេបប្រតិបត្តិការ' : 'Operational Summary'}</h3>
                        </div>
                        <div className="space-y-4 flex-1 flex flex-col justify-center">
                            <div className="bg-[#0B0E11] p-5 rounded-2xl border border-[#2B3139] flex justify-between items-center group hover:border-[#FCD535]/30 transition-all">
                                <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">{language === 'km' ? 'ចំនួន Page សកម្ម' : 'Active Pages'}</span>
                                <span className="text-white font-black text-lg tabular-nums">{grandTotals.pagesCount}</span>
                            </div>
                            <div className="bg-[#0B0E11] p-5 rounded-2xl border border-[#2B3139] flex justify-between items-center group hover:border-[#FCD535]/30 transition-all">
                                <span className="text-[10px] font-black text-[#848E9C] uppercase tracking-widest">{language === 'km' ? 'មធ្យមភាគចំណូល/Page' : 'Avg Revenue/Page'}</span>
                                <span className="text-[#FCD535] font-black text-lg tabular-nums">${(grandTotals.revenue / (grandTotals.pagesCount || 1)).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                            </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-[#2B3139] text-center">
                            <div className="flex items-center justify-center gap-2">
                                <Terminal size={12} className="text-[#848E9C]" />
                                <span className="text-[9px] font-black text-[#474D57] uppercase tracking-[0.3em]">Secure Data Protocol Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <SalesStatisticModal 
                isOpen={isStatisticOpen}
                onClose={() => setIsStatisticOpen(false)}
                orders={teamOrders} initialDateFilter={activeDateFilter} initialStart={activeStart} initialEnd={activeEnd}
                title={language === 'km' ? 'ស្ថិតិលក់តាមផេក' : 'PAGE SALES STATS'}
                subtitle={`TEAM: ${team} | ${filterLabel}`}
            />

            {/* Advanced Custom Filter Modal */}
            <Modal isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} maxWidth="max-w-5xl">
                <div className="p-8 bg-[#0B0E11] rounded-md border border-[#2B3139] overflow-hidden relative flex flex-col h-full">
                    <div className="flex justify-between items-center mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className={`w-1.5 h-10 bg-[#FCD535] rounded-full shadow-[0_0_15px_rgba(252,213,53,0.4)]`}></div>
                            <div>
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic leading-none">Filter Engine</h2>
                                <p className="text-[9px] text-[#848E9C] font-bold uppercase tracking-[0.3em] mt-1.5 ml-0.5">Quantum Analysis Node</p>
                            </div>
                        </div>
                        <button onClick={() => setIsFilterOpen(false)} className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-all active:scale-90 border border-white/5 hover:bg-white/10 shadow-xl">&times;</button>
                    </div>
                    
                    <div className="overflow-y-auto custom-scrollbar pr-4 relative z-10 flex-grow" style={{ maxHeight: 'calc(85vh - 250px)' }}>
                        <OrderFilters 
                            filters={filters} 
                            setFilters={setFilters} 
                            orders={sourceOrders} 
                            usersList={appData.users || []} 
                            appData={appData} 
                            calculatedRange={calculatedRange} 
                        />
                    </div>
                    
                    <div className={`mt-10 flex justify-center relative z-10 border-t border-[#2B3139] pt-8`}>
                        <button 
                            onClick={handleApplyFilters} 
                            className="bg-[#FCD535] text-[#1E2329] hover:bg-[#f0c51d] w-full max-w-md py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-md active:scale-[0.98] transition-all shadow-lg"
                        >
                            Execute Parameters
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
export default UserSalesPageReport;
