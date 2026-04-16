
import React, { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder } from '../types';
import StatCard from '../components/performance/StatCard';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Spinner from '../components/common/Spinner';
import SimpleBarChart from '../components/admin/SimpleBarChart';
import { safeParseDate } from '../utils/dateUtils';
import { ChevronLeft, Download, BarChart3, TrendingUp, Package, Layout } from 'lucide-react';

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
}

type SortKey = 'revenue' | 'pageName';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const UserSalesPageReport: React.FC<UserSalesPageReportProps> = ({
    orders: sourceOrders,
    onBack,
    team,
    onNavigate,
    dateFilter,
    customStart,
    customEnd,
}) => {
    const { appData, previewImage, language, advancedSettings } = useContext(AppContext);
    const [showBorders, setShowBorders] = useState(true);
    const [isFrozen, setIsFrozen] = useState(false);
    const [showFillColor, setShowFillColor] = useState(true);
    const [showAllPages, setShowAllPages] = useState(true); 
    const [isExporting, setIsExporting] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'revenue', direction: 'desc' });

    const isBinance = advancedSettings?.uiTheme === 'binance';

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
            const fmt = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };
            const monthStart = new Date(year, monthIndex, 1);
            const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);
            onNavigate({ team, page: pageName, datePreset: 'custom', customStart: fmt(monthStart), customEnd: fmt(monthEnd), isMonthlyDrilldown: true });
        }
    };

    const filteredOrders = useMemo(() => {
        const teamOrders = sourceOrders.filter(o =>
            (o.Team || '').trim().toLowerCase() === team.trim().toLowerCase()
        );

        if (!dateFilter || dateFilter === 'all') return teamOrders;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        let start: Date | null = null;
        let end: Date | null = endOfToday;

        switch (dateFilter) {
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
                if (customStart) start = new Date(customStart + 'T00:00:00');
                if (customEnd) end = new Date(customEnd + 'T23:59:59');
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
    }, [sourceOrders, team, dateFilter, customStart, customEnd]);

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
            this_month: 'THIS MONTH', last_month: 'LAST MONTH',
            this_year: 'THIS YEAR', last_year: 'LAST YEAR',
            all: 'ALL TIME',
            custom: customStart && customEnd ? `${customStart} → ${customEnd}` : 'CUSTOM',
        };
        return labels[dateFilter || 'all'] || 'ALL TIME';
    }, [dateFilter, customStart, customEnd]);

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

    return (
        <div className="w-full space-y-6 select-none animate-fade-in pb-12">
            <style>{`
                .finance-header {
                    background: #1E2329;
                    border-bottom: 1px solid #2B3139;
                    padding: 20px;
                }
            `}</style>

            {/* Premium Header */}
            <div className="finance-header">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-[#2B3139] rounded-sm hover:bg-[#363c45] active:scale-95 transition-all">
                            <ChevronLeft size={20} color="#EAECEF" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-[#EAECEF] uppercase tracking-tighter italic flex items-center gap-2">
                                <BarChart3 size={20} color="#F0B90B" />
                                {language === 'km' ? 'របាយការណ៍លក់តាមផេក' : 'Sales Page Report'}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-1 h-3 bg-[#F0B90B] rounded-full"></div>
                                <p className="text-[10px] text-[#848E9C] font-black uppercase tracking-[0.1em]">TEAM: {team}</p>
                                <span className="text-[10px] text-[#474D57] font-black">·</span>
                                <p className="text-[10px] text-[#F0B90B] font-black uppercase tracking-[0.1em]">{filterLabel}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-[#2B3139] border border-[#474D57] text-[#EAECEF] text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-[#363c45] active:scale-95 transition-all">
                            {isExporting ? <Spinner size="xs" /> : <Download size={14} />}
                            PDF
                        </button>
                    </div>
                </div>

            </div>

            <div className="px-4 space-y-6">
                {/* Financial KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label={language === 'km' ? 'ចំណូលសរុប' : 'Total Revenue'} value={`$${grandTotals.revenue.toLocaleString()}`} icon={<TrendingUp size={18}/>} colorClass="from-[#F0B90B] to-[#FCD535]" variant="minimal" />
                    <StatCard label={language === 'km' ? 'ប្រាក់ចំណេញ' : 'Net Profit'} value={`$${grandTotals.profit.toLocaleString()}`} icon={<TrendingUp size={18}/>} colorClass="from-[#0ECB81] to-[#0bb371]" variant="minimal" />
                    <StatCard label={language === 'km' ? 'ការកម្មង់' : 'Total Orders'} value={grandTotals.orders} icon={<Package size={18}/>} colorClass="from-[#3b82f6] to-[#2563eb]" variant="minimal" />
                    <StatCard label={language === 'km' ? 'ផេកសកម្ម' : 'Active Pages'} value={grandTotals.pagesCount} icon={<Layout size={18}/>} colorClass="from-[#8b5cf6] to-[#7c3aed]" variant="minimal" />
                </div>

                {/* Report Content */}
                <div className="bg-[#1E2329] border border-[#2B3139] rounded-sm overflow-hidden shadow-2xl">
                    <SalesByPageDesktop data={pageStats} grandTotals={grandTotals} sortConfig={sortConfig} onToggleSort={toggleSort} showAllPages={showAllPages} setShowAllPages={setShowAllPages} onExportPDF={handleExportPDF} isExporting={isExporting} onPreviewImage={previewImage} onNavigate={handleNavigate} onMonthClick={handleMonthClick} />
                    <SalesByPageTablet data={pageStats} grandTotals={grandTotals} onPreviewImage={previewImage} onNavigate={handleNavigate} onMonthClick={handleMonthClick} />
                    <SalesByPageMobile data={pageStats} onPreviewImage={previewImage} onNavigate={handleNavigate} onMonthClick={handleMonthClick} />
                </div>

                {/* Analytical Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-8 bg-[#1E2329] border border-[#2B3139] p-6 rounded-sm shadow-xl">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1 h-4 bg-[#F0B90B] rounded-full"></div>
                            <h3 className="text-xs font-black text-[#EAECEF] uppercase tracking-widest">{language === 'km' ? 'ផេកដែលមានចំណូលខ្ពស់បំផុត' : 'Top 5 Revenue Pages'}</h3>
                        </div>
                        <SimpleBarChart data={topPagesChartData} title="" />
                    </div>
                    <div className="lg:col-span-4 bg-[#1E2329] border border-[#2B3139] p-6 rounded-sm shadow-xl flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-1 h-4 bg-[#0ECB81] rounded-full"></div>
                            <h3 className="text-xs font-black text-[#EAECEF] uppercase tracking-widest">{language === 'km' ? 'សង្ខេបប្រតិបត្តិការ' : 'Operational Summary'}</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-[#2B3139] pb-4">
                                <span className="text-[10px] font-bold text-[#848E9C] uppercase">{language === 'km' ? 'ចំនួន Page សកម្ម' : 'Active Pages'}</span>
                                <span className="text-[#EAECEF] font-black text-sm tabular-nums">{grandTotals.pagesCount}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-[#848E9C] uppercase">{language === 'km' ? 'មធ្យមភាគចំណូល/Page' : 'Avg Revenue/Page'}</span>
                                <span className="text-[#F0B90B] font-black text-sm tabular-nums">${(grandTotals.revenue / (grandTotals.pagesCount || 1)).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserSalesPageReport;
