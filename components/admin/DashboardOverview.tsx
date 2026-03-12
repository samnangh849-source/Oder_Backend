
import React, { useEffect, useContext } from 'react';
import { User, ParsedOrder } from '../../types';
import StatCard from '../performance/StatCard';
import TeamRevenueTable from './TeamRevenueTable';
import ProvincialMap from './ProvincialMap';
import ProvincialSummaryList from './ProvincialSummaryList';
import DateRangeFilter, { DateRangePreset } from '../common/DateRangeFilter';
import FulfillmentStoreTable from './FulfillmentStoreTable';
import SalesStoreTable from './SalesStoreTable';
import { AppContext } from '../../context/AppContext';

interface DashboardOverviewProps {
    currentUser: User | null;
    parsedOrders: ParsedOrder[];
    
    // Updated props for flexible date filtering
    dateFilter: { preset: string, start: string, end: string };
    setDateFilter: (filter: { preset: string, start: string, end: string }) => void;

    teamRevenueStats: any[];
    provinceStats: any[];
    storeStats: any[];
    brandStats: any[];
    onTeamClick: (team: string) => void;
    onProvinceClick: (province: string) => void;
    onStoreClick: (store: string) => void;
    onBrandClick: (brand: string) => void;
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
    currentUser, parsedOrders, 
    dateFilter, setDateFilter,
    teamRevenueStats, provinceStats, storeStats, brandStats,
    onTeamClick, onProvinceClick, onStoreClick, onBrandClick
}) => {
    // Note: We intentionally do NOT set a mobile page title here.
    // The requirement is to show the App Logo for the Dashboard view.
    
    const getOrderDate = (o: ParsedOrder) => new Date(o.Timestamp);
    
    const filteredMetricsOrders = parsedOrders.filter(o => {
        if (!o.Timestamp) return false;
        const d = getOrderDate(o);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (dateFilter.preset === 'today') {
            return d.toDateString() === now.toDateString();
        } else if (dateFilter.preset === 'this_week') {
            const day = now.getDay();
            const start = new Date(today);
            start.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59);
            return d >= start && d <= end;
        } else if (dateFilter.preset === 'this_month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (dateFilter.preset === 'custom') {
            const start = dateFilter.start ? new Date(dateFilter.start + 'T00:00:00') : null;
            const end = dateFilter.end ? new Date(dateFilter.end + 'T23:59:59') : null;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        }
        return true; // Fallback
    });

    const metrics = {
        revenue: filteredMetricsOrders.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0),
        orders: filteredMetricsOrders.length,
        unpaid: filteredMetricsOrders.filter(o => o['Payment Status'] === 'Unpaid').length
    };

    return (
        <div className="space-y-6 lg:space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-800/10 p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-white/5 backdrop-blur-md">
                <div className="flex flex-col">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-white leading-tight">សួស្តី, {currentUser?.FullName} 👋</h2>
                    <p className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1">
                        {new Date().toLocaleDateString('km-KH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                
                {/* Date Filter Component */}
                <div className="w-full md:w-auto">
                    <DateRangeFilter 
                        dateRange={dateFilter.preset as DateRangePreset}
                        onRangeChange={(r) => setDateFilter({ ...dateFilter, preset: r })}
                        customStart={dateFilter.start}
                        onCustomStartChange={(v) => setDateFilter({ ...dateFilter, start: v })}
                        customEnd={dateFilter.end}
                        onCustomEndChange={(v) => setDateFilter({ ...dateFilter, end: v })}
                    />
                </div>
            </div>

            {/* Metrics - Adaptive Grid for 13" (2 cols) vs 15"+ (3 cols) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                <StatCard label="ចំណូលសរុប" value={`$${metrics.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}`} icon="💰" colorClass="from-blue-600 to-blue-400" />
                <StatCard label="ចំនួនការកម្មង់" value={metrics.orders} icon="📦" colorClass="from-emerald-600 to-emerald-400" />
                <StatCard label="មិនទាន់ទូទាត់" value={metrics.unpaid} icon="⏳" colorClass="from-orange-500 to-yellow-400" />
            </div>
            
            {/* Main Tables */}
            {/* Top row with 3 main breakdown tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <TeamRevenueTable stats={teamRevenueStats} onStatClick={onTeamClick} />
                <SalesStoreTable stats={brandStats} onStatClick={onBrandClick} />
                <FulfillmentStoreTable stats={storeStats} onStatClick={onStoreClick} />
            </div>
            
            {/* Map and Summary row */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
                <div className="xl:col-span-8">
                    <ProvincialMap data={provinceStats} onProvinceClick={onProvinceClick} />
                </div>
                <div className="xl:col-span-4">
                    <ProvincialSummaryList stats={provinceStats} onProvinceClick={onProvinceClick} />
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;
