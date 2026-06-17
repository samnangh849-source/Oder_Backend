import React, { useState } from 'react';

interface ChartData {
    label: string;
    value: number;
}

interface SimpleLineChartProps {
    data: ChartData[];
    title: string;
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, title }) => {
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string } | null>(null);

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 min-h-[300px]">
                No data available for chart.
            </div>
        );
    }

    const chartHeight = 300;
    const chartWidth = 500;
    const yAxisWidth = 50;
    const xAxisHeight = 40;
    const padding = { top: 20, right: 20, bottom: xAxisHeight, left: yAxisWidth };

    const maxValue = Math.max(...data.map(d => d.value), 0);
    const yScale = maxValue === 0 ? 0 : (chartHeight - padding.top - padding.bottom) / maxValue;
    const xScale = (chartWidth - padding.left - padding.right) / (data.length - 1 || 1);

    const getPath = () => {
        if (data.length < 2) return '';
        let path = `M ${padding.left},${chartHeight - padding.bottom - data[0].value * yScale}`;
        data.slice(1).forEach((d, i) => {
            const x = padding.left + (i + 1) * xScale;
            const y = chartHeight - padding.bottom - d.value * yScale;
            path += ` L ${x},${y}`;
        });
        return path;
    };

    const handleMouseOver = (e: React.MouseEvent, d: ChartData) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const content = `${d.label}: $${d.value.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
        setTooltip({ visible: true, x: rect.left + window.scrollX, y: rect.top + window.scrollY, content });
    };

    const handleMouseOut = () => {
        setTooltip(null);
    };

    const getTicks = (max: number) => {
        if (max === 0) return [0];
        const numTicks = 5;
        const interval = Math.ceil(max / numTicks / 10) * 10;
        if (interval === 0) return [0, max];
        return Array.from({ length: numTicks + 1 }, (_, i) => i * interval).filter(tick => tick <= max * 1.1);
    };
    const yTicks = getTicks(maxValue);

    return (
        <div className="relative w-full">
            <h3 className="text-sm sm:text-lg font-black mb-6 text-white text-center uppercase tracking-widest">{title}</h3>
            <div className="w-full overflow-hidden">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto" preserveAspectRatio="xMinYMin meet">
                    {/* Y-Axis and Grid Lines */}
                    <g className="y-axis">
                        {yTicks.map(tick => (
                            <g key={tick} transform={`translate(0, ${chartHeight - padding.bottom - (tick * yScale)})`}>
                                <line x1={padding.left - 5} y1="0" x2={chartWidth - padding.right} y2="0" stroke="#374151" />
                                <text x={padding.left - 10} y="3" textAnchor="end" fill="#9ca3af" fontSize="12">
                                    {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
                                </text>
                            </g>
                        ))}
                    </g>

                    {/* X-Axis Labels */}
                    <g className="x-axis">
                         {data.map((d, i) => {
                            // Only show certain labels if there are many to prevent overlapping
                            const total = data.length;
                            const skip = total > 10 ? Math.ceil(total / 6) : (total > 6 ? 2 : 1);
                            if (i % skip !== 0 && i !== total - 1) return null;
                            
                            return (
                                <text
                                    key={i}
                                    x={padding.left + i * xScale}
                                    y={chartHeight - padding.bottom + 20}
                                    textAnchor="middle"
                                    fill="#9ca3af"
                                    fontSize="10"
                                    className="font-bold"
                                >
                                    {d.label}
                                </text>
                            );
                        })}
                    </g>
                    
                    {/* Line path */}
                    <path d={getPath()} fill="none" stroke="#3b82f6" strokeWidth="2" />

                    {/* Data Points and Tooltip Triggers */}
                    {data.map((d, i) => (
                        <circle
                            key={i}
                            cx={padding.left + i * xScale}
                            cy={chartHeight - padding.bottom - d.value * yScale}
                            r="4"
                            fill="#3b82f6"
                            stroke="#111827"
                            strokeWidth="2"
                            onMouseOver={(e) => handleMouseOver(e, d)}
                            onMouseOut={handleMouseOut}
                            className="cursor-pointer"
                        />
                    ))}
                </svg>
            </div>
             {tooltip && (
                <div
                    className="fixed p-2 text-xs text-white bg-gray-900 border border-gray-600 rounded-md shadow-lg z-50"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y - 35,
                        pointerEvents: 'none',
                        transform: 'translateX(-50%)',
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default SimpleLineChart;
