
import React, { useMemo } from 'react';
import { ParsedOrder } from '../../types';
import { translations } from '../../translations';
import { Trophy, Truck, Users, Calendar } from 'lucide-react';
import { safeParseDate } from '../../utils/dateUtils';

interface TopPerformanceUserJourneyProps {
    orders: ParsedOrder[];
    language: 'km' | 'en';
    period: Period;
}

type Period = 'daily' | 'month' | 'year' | 'custom';

const TopPerformanceUserJourney: React.FC<TopPerformanceUserJourneyProps> = ({ orders, language, period }) => {
    const t = translations[language];

    const periodLabel = useMemo(() => {
        if (period === 'today' || period === 'daily') return language === 'km' ? 'ប្រចាំថ្ងៃ' : 'Daily';
        if (period === 'month') return language === 'km' ? 'ប្រចាំខែ' : 'Monthly';
        if (period === 'year') return language === 'km' ? 'ប្រចាំឆ្នាំ' : 'Yearly';
        return language === 'km' ? 'កំណត់' : 'Custom';
    }, [period, language]);

    const filteredOrders = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        return orders.filter(o => {
            const orderDate = safeParseDate(o.Timestamp);
            if (!orderDate) return false;

            if (period === 'today' || period === 'daily') {
                return orderDate >= today && orderDate <= endOfToday;
            } else if (period === 'month') {
                return orderDate.getMonth() === now.getMonth() && 
                       orderDate.getFullYear() === now.getFullYear() &&
                       orderDate <= endOfToday;
            } else if (period === 'year') {
                return orderDate.getFullYear() === now.getFullYear() &&
                       orderDate <= endOfToday;
            }
            return true;
        });
    }, [orders, period]);

    const topTeams = useMemo(() => {
        const teamStats: Record<string, number> = {};
        filteredOrders.forEach(o => {
            const tName = o.Team || 'Unassigned';
            teamStats[tName] = (teamStats[tName] || 0) + (Number(o['Grand Total']) || 0);
        });

        return Object.entries(teamStats)
            .map(([name, revenue]) => ({ name, revenue }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 3);
    }, [filteredOrders]);

    const topDrivers = useMemo(() => {
        const driverStats: Record<string, number> = {};
        filteredOrders.forEach(o => {
            // Priority: 'Driver Name' > 'Internal Shipping Details'
            const dName = o['Driver Name'] || o['Internal Shipping Details'] || o.InternalShippingDetails || o['Internal Shipping Method'] || '';
            
            const cleanName = (dName || '').toString().split(' (')[0].trim();
            
            if (!cleanName || 
                cleanName.toLowerCase() === 'no driver' || 
                cleanName.toLowerCase() === 'none' || 
                cleanName.toLowerCase() === 'unassigned') return;
            
            // Try both 'Internal Cost' and 'InternalCost'
            const cost = Number(o['Internal Cost']) || Number((o as any).InternalCost) || 0;
            if (cost <= 0) return; 

            driverStats[cleanName] = (driverStats[cleanName] || 0) + cost;
        });

        return Object.entries(driverStats)
            .map(([name, cost]) => ({ name, cost }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 3);
    }, [filteredOrders]);

    const renderCard = (title: string, icon: React.ReactNode, data: { name: string, value: number }[], type: 'revenue' | 'cost') => (
        <div className="flex-1 min-w-[300px] bg-[#1E2329] border border-[#2B3139] rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#2B3139] pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-[#F0B90B15] rounded-lg text-[#F0B90B]">
                        {icon}
                    </div>
                    <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-tight">{title}</h3>
                </div>
                <span className="text-[10px] font-bold text-[#707A8A] uppercase bg-[#0B0E11] px-2 py-1 rounded border border-[#2B3139]">
                    Top 3
                </span>
            </div>

            <div className="flex flex-col gap-2">
                {data.length > 0 ? data.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3 p-3 bg-[#181A20] rounded-lg border border-transparent hover:border-[#F0B90B30] transition-all group">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm ${
                            i === 0 ? 'bg-[#F0B90B20] text-[#F0B90B]' : 
                            i === 1 ? 'bg-[#EAECEF10] text-[#B7BDC6]' : 
                            'bg-[#CD7F3220] text-[#CD7F32]'
                        }`}>
                            {i + 1}
                        </div>
                        <div className="flex-grow min-w-0">
                            <div className="text-xs font-bold text-[#EAECEF] truncate group-hover:text-[#F0B90B] transition-colors">{item.name}</div>
                            <div className="text-[10px] text-[#707A8A] font-medium">{type === 'revenue' ? (language === 'km' ? 'សរុបលក់' : 'Total Sales') : (language === 'km' ? 'សេវាដឹក' : 'Shipping Fee')}</div>
                        </div>
                        <div className={`text-sm font-bold ${type === 'revenue' ? 'text-[#0ECB81]' : 'text-[#F0B90B]'}`}>
                            ${item.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                    </div>
                )) : (
                    <div className="py-8 flex flex-col items-center justify-center text-[#707A8A] gap-2">
                        <div className="w-10 h-10 rounded-full bg-[#181A20] flex items-center justify-center opacity-50">
                            <Calendar size={20} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                            {language === 'km' ? 'មិនមានទិន្នន័យ' : 'No Data Available'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                    <Trophy className="text-[#F0B90B]" size={18} />
                    <h2 className="text-base font-bold text-[#EAECEF] italic uppercase tracking-tighter">
                        {language === 'km' ? 'ចំណាត់ថ្នាក់ឆ្នើម' : 'Top Performance'} <span className="text-[#F0B90B]">{periodLabel}</span>
                    </h2>
                </div>
            </div>

            <div className="flex flex-wrap gap-4">
                {renderCard(
                    language === 'km' ? 'ក្រុមលក់បានច្រើនបំផុត' : 'Top 3 Sales Team', 
                    <Users size={16} />, 
                    topTeams.map(t => ({ name: t.name, value: t.revenue })), 
                    'revenue'
                )}
                {renderCard(
                    language === 'km' ? 'អ្នកដឹកឆ្នើមបំផុត' : 'Top 3 Driver Fees', 
                    <Truck size={16} />, 
                    topDrivers.map(d => ({ name: d.name, value: d.cost })), 
                    'cost'
                )}
            </div>
        </div>
    );
};

export default TopPerformanceUserJourney;
