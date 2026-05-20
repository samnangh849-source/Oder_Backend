
import React, { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { ParsedOrder } from '../types';
import SimpleBarChart from '../components/admin/SimpleBarChart';
import StatCard from '../components/performance/StatCard';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import Spinner from '../components/common/Spinner';
import { FilterState } from '../components/orders/OrderFilters';

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
}

type SortKey = 'revenue' | 'profit' | 'teamName' | 'pageName';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SalesByPageReport: React.FC<SalesByPageReportProps> = ({ 
    orders, onBack, onNavigate, contextFilters, dateFilter, startDate, endDate 
}) => {
    const { appData, previewImage } = useContext(AppContext);
    const [showAllPages, setShowAllPages] = useState(true); 
    const [onlyTelegram, setOnlyTelegram] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    // CHANGE: Default sort set to 'teamName' ascending
    const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'teamName', direction: 'asc' });

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

    // 1. General Filter Navigation (Clicking Page Name, Totals, etc.)
    const handleFilterNavigation = (key: string, value: string) => {
        if (onNavigate) {
            const filters = getBaseFilters();

            // Apply Specific Drill-Down Overrides
            if (key === 'page') filters.page = value;
            if (key === 'team') filters.team = value;
            
            // Pass current date context
            filters.datePreset = dateFilter;
            filters.startDate = startDate;
            filters.endDate = endDate;
            
            onNavigate(filters);
        }
    };

    // 2. Month-Specific Navigation (Clicking Jan, Feb, etc.)
    const handleMonthClick = (pageName: string, monthIndex: number) => {
        if (onNavigate) {
            const filters = getBaseFilters();
            
            // Determine Year: If filter is "Last Year", use last year. Otherwise assume current year.
            const currentYear = new Date().getFullYear();
            const targetYear = dateFilter === 'last_year' ? currentYear - 1 : currentYear;

            // Construct Date Range for that Month
            const start = new Date(targetYear, monthIndex, 1);
            const end = new Date(targetYear, monthIndex + 1, 0, 23, 59, 59); // Last day of month

            // Helper to format YYYY-MM-DD
            const fmt = (d: Date) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            // Preserve existing filters when navigating
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

    const pageStats = useMemo(() => {
        const stats: Record<string, any> = {};
        
        // Helper to check if a page matches the current team/page filters
        const matchesFilters = (pName: string, pTeam: string) => {
            if (contextFilters?.team) {
                const selectedTeams = contextFilters.team.split(',').map(t => t.trim().toLowerCase());
                if (!selectedTeams.includes((pTeam || '').toLowerCase())) return false;
            }
            if (contextFilters?.page) {
                const selectedPages = contextFilters.page.split(',').map(p => p.trim().toLowerCase());
                if (!selectedPages.includes((pName || '').toLowerCase())) return false;
            }
            // Shortcut Filter: Telegram
            if (onlyTelegram) {
                if (!(pName || '').toLowerCase().startsWith('telegram')) return false;
            }
            return true;
        };

        if (appData.pages) {
            appData.pages.forEach(p => {
                if (matchesFilters(p.PageName, p.Team || '')) {
                    stats[p.PageName] = {
                        pageName: p.PageName,
                        teamName: p.Team || 'Unassigned',
                        logoUrl: p.PageLogoURL || '',
                        revenue: 0,
                        profit: 0,
                        orderCount: 0
                    };
                    MONTHS.forEach(m => { stats[p.PageName][`rev_${m}`] = 0; stats[p.PageName][`prof_${m}`] = 0; });
                }
            });
        }

        orders.forEach(o => {
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
                    const d = new Date(o.Timestamp); 
                    const monthName = MONTHS[d.getMonth()];
                    stats[page][`rev_${monthName}`] += rev; 
                    stats[page][`prof_${monthName}`] += (rev - cost); 
                }
            }
        });

        let result = Object.values(stats);
        if (!showAllPages) {
            result = result.filter(item => item.revenue > 0);
        }

        return result.sort((a: any, b: any) => {
            const mult = sortConfig.direction === 'asc' ? 1 : -1;
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (typeof valA === 'string') return valA.localeCompare(valB) * mult;
            return (valA - valB) * mult;
        });
    }, [orders, sortConfig, appData.pages, showAllPages, contextFilters, onlyTelegram]);

    const grandTotals = useMemo(() => {
        const totals: any = { revenue: 0, profit: 0, pagesCount: pageStats.length };
        MONTHS.forEach(m => { totals[`rev_${m}`] = 0; totals[`prof_${m}`] = 0; });
        pageStats.forEach((s: any) => { 
            totals.revenue += s.revenue; 
            totals.profit += s.profit; 
            MONTHS.forEach(m => { 
                totals[`rev_${m}`] += s[`rev_${m}`]; 
                totals[`prof_${m}`] += s[`prof_${m}`]; 
            }); 
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
            } catch (err) {
                console.error(err);
                alert("Export failed");
            } finally {
                setIsExporting(false);
            }
        }, 100);
    };

    const topPagesChartData = useMemo(() => {
        return [...pageStats]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
            .map(p => ({ label: p.pageName, value: p.revenue, imageUrl: p.logoUrl }));
    }, [pageStats]);

    return (
        <div className="w-full space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard label="ចំណូលសរុប (Total Rev)" value={`$${grandTotals.revenue.toLocaleString()}`} icon="💰" colorClass="from-blue-600 to-indigo-500" />
                <StatCard label="ប្រាក់ចំណេញ (Total Profit)" value={`$${grandTotals.profit.toLocaleString()}`} icon="📈" colorClass="from-emerald-600 to-green-500" />
            </div>

            {/* 1. Desktop View */}
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
            
            {/* 2. Tablet View */}
            <SalesByPageTablet 
                data={pageStats}
                grandTotals={grandTotals} // Pass grandTotals to Tablet
                onPreviewImage={previewImage}
                onNavigate={handleFilterNavigation}
                onMonthClick={handleMonthClick}
            />

            {/* 3. Mobile View */}
            <SalesByPageMobile 
                data={pageStats}
                onPreviewImage={previewImage}
                onNavigate={handleFilterNavigation}
                onMonthClick={handleMonthClick}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-10">
                <div className="lg:col-span-8"><div className="page-card !p-4 bg-gray-800/40 border-gray-700/50"><SimpleBarChart data={topPagesChartData} title="Page ដែលមានចំណូលខ្ពស់បំផុត (Top 5 Pages Revenue)" /></div></div>
                <div className="lg:col-span-4 flex flex-col justify-center page-card !p-5 bg-gray-800/30 border-gray-700/50"><h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-6"><span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>សង្ខេប</h3><div className="space-y-4"><div className="flex justify-between border-b border-white/5 pb-2"><span className="text-xs text-gray-400">ចំនួន Page សកម្ម:</span><span className="text-white font-black text-sm">{grandTotals.pagesCount}</span></div><div className="flex justify-between"><span className="text-xs text-gray-400">មធ្យមភាគ/Page:</span><span className="text-blue-400 font-black text-sm">${(grandTotals.revenue / (grandTotals.pagesCount || 1)).toLocaleString(undefined, {maximumFractionDigits: 0})}</span></div></div></div>
            </div>
        </div>
    );
};

export default SalesByPageReport;
