
import { useMemo } from 'react';
import { ParsedOrder, AppData } from '../types';
import { safeParseDate } from '../utils/dateUtils';
import { isMatch } from './useFilterEngine';

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface UseSalesPageStatsProps {
    orders: ParsedOrder[];
    appData: AppData;
    team?: string;
    showAllPages: boolean;
    onlyTelegram?: boolean;
    sortConfig: {
        key: 'revenue' | 'profit' | 'teamName' | 'pageName';
        direction: 'asc' | 'desc';
    };
    contextFilters?: any;
}

export const useSalesPageStats = ({
    orders,
    appData,
    team,
    showAllPages,
    onlyTelegram = false,
    sortConfig,
    contextFilters
}: UseSalesPageStatsProps) => {
    
    const pageStats = useMemo(() => {
        const stats: Record<string, any> = {};
        
        const matchesFilters = (pName: string, pTeam: string) => {
            // Priority 1: Context Filters (Admin ReportDashboard)
            if (contextFilters?.team && contextFilters.team !== 'all' && contextFilters.team !== 'All') {
                if (!isMatch(contextFilters.team, pTeam)) return false;
            }
            
            // Priority 2: Direct Team Prop (UserSalesPageReport)
            if (team && team !== 'all' && team !== 'All' && team !== 'All Teams') {
                if (!isMatch(team, pTeam)) return false;
            }

            // Priority 3: Specific Page/Source Filters
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
            if (!stats[page]) {
                const info = appData.pages?.find(p => p.PageName === page);
                // If it wasn't pre-filled because of filters, check if it matches now (from order data)
                if (matchesFilters(page, o.Team || '')) {
                    stats[page] = { 
                        pageName: page, 
                        teamName: o.Team || 'Unassigned', 
                        logoUrl: info?.PageLogoURL || '', 
                        revenue: 0, 
                        profit: 0, 
                        orderCount: 0 
                    };
                    MONTHS.forEach(m => { stats[page][`rev_${m}`] = 0; stats[page][`prof_${m}`] = 0; });
                }
            }

            if (stats[page]) {
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
    }, [orders, sortConfig, appData.pages, showAllPages, team, contextFilters, onlyTelegram]);

    const grandTotals = useMemo(() => {
        const totals: any = { revenue: 0, profit: 0, pagesCount: pageStats.length, orders: 0 };
        MONTHS.forEach(m => { totals[`rev_${m}`] = 0; totals[`prof_${m}`] = 0; });
        
        pageStats.forEach((s: any) => { 
            totals.revenue += s.revenue; 
            totals.profit += s.profit; 
            totals.orders += (s.orderCount || 0);
            MONTHS.forEach(m => { 
                totals[`rev_${m}`] += s[`rev_${m}`]; 
                totals[`prof_${m}`] += s[`prof_${m}`]; 
            });
        });
        return totals;
    }, [pageStats]);

    const topPagesChartData = useMemo(() => {
        return [...pageStats]
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
            .map(p => ({ 
                label: p.pageName, 
                value: p.revenue, 
                imageUrl: p.logoUrl 
            }));
    }, [pageStats]);

    return {
        pageStats,
        grandTotals,
        topPagesChartData
    };
};
