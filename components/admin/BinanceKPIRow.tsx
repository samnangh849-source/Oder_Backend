import React from 'react';

interface KPIMetrics {
    revenue: number;
    orders: number;
    paid: number;
    unpaid: number;
}

interface BinanceKPIRowProps {
    metrics: KPIMetrics;
    language?: 'en' | 'km';
}

const BinanceKPIRow: React.FC<BinanceKPIRowProps> = ({ metrics, language = 'en' }) => {
    const cells = [
        {
            label: language === 'km' ? 'ចំណូលសរុប' : 'Total Revenue',
            value: `$${metrics.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            color: 'text-[#EAECEF]',
        },
        {
            label: language === 'km' ? 'ចំនួនការកម្មង់' : 'Total Orders',
            value: metrics.orders.toLocaleString(),
            color: 'text-[#EAECEF]',
        },
        {
            label: language === 'km' ? 'បានបង់រួច' : 'Paid Orders',
            value: metrics.paid.toLocaleString(),
            color: 'text-[#0ECB81]',
        },
        {
            label: language === 'km' ? 'មិនទាន់ទូទាត់' : 'Unpaid Orders',
            value: metrics.unpaid.toLocaleString(),
            color: 'text-[#F6465D]',
        },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-[#2B3139]">
            {cells.map((cell, i) => (
                <div key={i} className="bg-[#1E2329] p-5">
                    <div className="text-[11px] text-[#848E9C] uppercase tracking-wider font-medium mb-2">
                        {cell.label}
                    </div>
                    <div className={`text-2xl font-bold tabular-nums ${cell.color}`}>
                        {cell.value}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BinanceKPIRow;
