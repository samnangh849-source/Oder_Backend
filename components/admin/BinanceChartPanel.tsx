import React from 'react';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface ChartDataPoint {
    name: string;
    value: number;
    value2?: number;
}

interface BinanceChartPanelProps {
    title: string;
    data: ChartDataPoint[];
    chartType: 'area' | 'bar';
    height?: number;
    valueLabel?: string;
    value2Label?: string;
}

const BinanceTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#1E2329] border border-[#2B3139] p-3 text-[12px]" style={{ borderRadius: '2px' }}>
            <div className="text-[#848E9C] mb-1">{label}</div>
            {payload.map((entry: any, i: number) => (
                <div key={i} className="font-semibold tabular-nums" style={{ color: entry.color }}>
                    {entry.name}: ${Number(entry.value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </div>
            ))}
        </div>
    );
};

const BinanceChartPanel: React.FC<BinanceChartPanelProps> = ({
    title, data, chartType, height = 240, valueLabel = 'Revenue', value2Label = 'Unpaid'
}) => {
    return (
        <div className="bg-[#1E2329] p-5">
            <div className="text-[12px] text-[#848E9C] uppercase tracking-wider font-semibold mb-4">
                {title}
            </div>
            <ResponsiveContainer width="100%" height={height}>
                {chartType === 'area' ? (
                    <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: '#848E9C', fontSize: 11 }}
                            axisLine={{ stroke: '#2B3139' }}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: '#848E9C', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                        />
                        <Tooltip content={<BinanceTooltip />} />
                        <defs>
                            <linearGradient id="binanceYellowGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#FCD535" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="#FCD535" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="value"
                            name={valueLabel}
                            stroke="#FCD535"
                            strokeWidth={2}
                            fill="url(#binanceYellowGrad)"
                        />
                    </AreaChart>
                ) : (
                    <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2B3139" vertical={false} />
                        <XAxis
                            dataKey="name"
                            tick={{ fill: '#848E9C', fontSize: 11 }}
                            axisLine={{ stroke: '#2B3139' }}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: '#848E9C', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<BinanceTooltip />} />
                        <Bar dataKey="value" name={valueLabel} fill="#0ECB81" radius={[2, 2, 0, 0]} />
                        {data.some(d => d.value2 !== undefined) && (
                            <Bar dataKey="value2" name={value2Label} fill="#F6465D" radius={[2, 2, 0, 0]} />
                        )}
                    </BarChart>
                )}
            </ResponsiveContainer>
        </div>
    );
};

export default BinanceChartPanel;
