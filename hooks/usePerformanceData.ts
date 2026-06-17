
import { useMemo } from 'react';
import { ParsedOrder, User, Target } from '../types';

const calculateProfit = (order: ParsedOrder): number => {
    const revenue = order['Grand Total'] || 0;
    const productCost = order['Total Product Cost ($)'] || 0;
    const shippingCost = order['Internal Cost'] || 0;
    return revenue - productCost - shippingCost;
};

const getSafeMonthString = (timestamp: string): string => {
    try {
        if (!timestamp) return new Date().toISOString().slice(0, 7);
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return new Date().toISOString().slice(0, 7);
        return date.toISOString().slice(0, 7); // YYYY-MM
    } catch (e) {
        return new Date().toISOString().slice(0, 7);
    }
}

export const usePerformanceData = (
    orders: ParsedOrder[],
    users: User[],
    targets: Target[]
) => {
    return useMemo(() => {
        const safeUsers = Array.isArray(users) ? users.filter(u => u && u.UserName) : [];
        const safeOrders = Array.isArray(orders) ? orders.filter(o => o && o['Grand Total'] !== undefined) : [];
        const safeTargets = Array.isArray(targets) ? targets : [];

        // Overall Summary
        const totalRevenue = safeOrders.reduce((sum, o) => sum + (o['Grand Total'] || 0), 0);
        const totalProfit = safeOrders.reduce((sum, o) => sum + calculateProfit(o), 0);
        const totalOrders = safeOrders.length;

        const currentMonth = new Date().toISOString().slice(0, 7);

        const byUser = safeUsers.map(user => {
            const userOrders = safeOrders.filter(o => o.User === user.UserName);
            const revenue = userOrders.reduce((sum, o) => sum + (o['Grand Total'] || 0), 0);
            const profit = userOrders.reduce((sum, o) => sum + calculateProfit(o), 0);
            const orderCount = userOrders.length;
            
            const targetData = safeTargets.find(t => t.UserName === user.UserName && t.Month === currentMonth);
            const targetAmount = targetData?.TargetAmount || 0;
            const achievement = targetAmount > 0 ? (revenue / targetAmount) * 100 : 0;

            return {
                userName: user.UserName,
                fullName: user.FullName,
                profilePictureURL: user.ProfilePictureURL,
                team: user.Team,
                revenue,
                profit,
                orderCount,
                target: targetAmount,
                achievement
            };
        });

        const teams = Array.from(new Set(safeUsers.map(u => u.Team).filter(Boolean)));
        const byTeam = teams.map(team => {
            const teamUsers = byUser.filter(u => u.team === team);
            const revenue = teamUsers.reduce((sum, u) => sum + u.revenue, 0);
            const profit = teamUsers.reduce((sum, u) => sum + u.profit, 0);
            const orderCount = teamUsers.reduce((sum, u) => sum + u.orderCount, 0);
            const target = teamUsers.reduce((sum, u) => sum + u.target, 0);
            const achievement = target > 0 ? (revenue / target) * 100 : 0;

            return {
                teamName: team,
                revenue,
                profit,
                orderCount,
                target,
                achievement
            };
        });

        const overallTarget = byTeam.reduce((sum, t) => sum + t.target, 0);
        const overallAchievement = overallTarget > 0 ? (totalRevenue / overallTarget) * 100 : 0;

        // Monthly Trend
        const monthlyTrendMap: Record<string, { revenue: number, profit: number, orders: number }> = {};
        safeOrders.forEach(order => {
            const month = getSafeMonthString(order.Timestamp);
            if (!monthlyTrendMap[month]) {
                monthlyTrendMap[month] = { revenue: 0, profit: 0, orders: 0 };
            }
            monthlyTrendMap[month].revenue += (order['Grand Total'] || 0);
            monthlyTrendMap[month].profit += calculateProfit(order);
            monthlyTrendMap[month].orders += 1;
        });
        
        const monthlyTrend = Object.entries(monthlyTrendMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, data]) => ({ label, value: data.revenue, ...data }));

        return {
            summary: { totalRevenue, totalProfit, totalOrders, overallTarget, overallAchievement },
            byUser,
            byTeam,
            monthlyTrend,
            hasData: safeUsers.length > 0
        };
    }, [orders, users, targets]);
};
