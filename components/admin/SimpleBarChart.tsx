import React, { useState } from 'react';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface ChartData {
    label: string;
    value: number;
    imageUrl?: string;
    [key: string]: any;
}

interface SimpleBarChartProps {
    data: ChartData[];
    title: string;
}

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, title }) => {
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string } | null>(null);

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 min-h-[300px]">
                No data available for chart.
            </div>
        );
    }
    
    const chartHeight = 350;
    const chartWidth = 500;
    const yAxisWidth = 50;
    const xAxisHeight = 100; // Increased height for rotated labels
    const topPadding = 40;   // Space for images
    const barPadding = 10;
    
    const drawableHeight = chartHeight - topPadding - 10;
    const barWidth = (chartWidth / data.length) - barPadding;
    const maxValue = Math.max(...data.map(d => d.value), 0);
    const yScale = maxValue === 0 ? 0 : drawableHeight / maxValue;

    const handleMouseOver = (e: React.MouseEvent, d: ChartData) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const content = `${d.label}: $${d.value.toFixed(2)}`;
        setTooltip({ visible: true, x: rect.left + window.scrollX, y: rect.top + window.scrollY, content });
    };

    const handleMouseOut = () => {
        setTooltip(null);
    };

    const getTicks = (max: number) => {
        if (max === 0) return [0];
        const numTicks = 5;
        let interval = Math.ceil(max / numTicks);
        const magnitude = Math.pow(10, Math.floor(Math.log10(interval || 1)));
        const residual = interval / magnitude;

        if (magnitude > 0) {
             if (residual > 5) interval = 10 * magnitude;
            else if (residual > 2) interval = 5 * magnitude;
            else if (residual > 1) interval = 2 * magnitude;
        }

        if (interval === 0) return [0, max];
        return Array.from({ length: numTicks + 2 }, (_, i) => i * interval).filter(tick => tick <= max * 1.1);
    }
    const yTicks = getTicks(maxValue);

    return (
        <div className="relative">
            <h3 className="text-lg font-bold mb-4 text-white text-center">{title}</h3>
            <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${chartWidth + yAxisWidth} ${chartHeight + xAxisHeight}`} className="min-w-[500px]" preserveAspectRatio="xMinYMin meet">
                    {/* Y-Axis and Grid Lines */}
                    <g className="y-axis">
                        {yTicks.map(tick => (
                            <g key={tick} transform={`translate(0, ${chartHeight - (tick * yScale)})`}>
                                <line x1={yAxisWidth - 5} y1="0" x2={chartWidth + yAxisWidth} y2="0" stroke="#374151" />
                                <text x={yAxisWidth - 10} y="3" textAnchor="end" fill="#9ca3af" fontSize="12">
                                    {tick >= 1000 ? `${(tick/1000).toFixed(0)}k` : tick}
                                </text>
                            </g>
                        ))}
                    </g>
                    
                    {/* Bars and X-Axis Labels */}
                    <g className="bars" transform={`translate(${yAxisWidth}, 0)`}>
                        {data.map((d, i) => {
                            const barHeight = d.value * yScale;
                            const xPos = i * (barWidth + barPadding) + (barPadding / 2);
                            const yPos = chartHeight - barHeight;
                            const imageSize = 30;

                            return (
                                <g key={i}>
                                     {d.imageUrl && (
                                         <image
                                            href={convertGoogleDriveUrl(d.imageUrl)}
                                            x={xPos + barWidth / 2 - imageSize / 2}
                                            y={yPos - imageSize - 5}
                                            height={imageSize}
                                            width={imageSize}
                                            clipPath={`circle(${imageSize/2}px at center)`}
                                        />
                                    )}
                                    <rect
                                        x={xPos}
                                        y={yPos}
                                        width={barWidth}
                                        height={barHeight}
                                        fill="#3b82f6"
                                        className="transition-all duration-300 hover:opacity-80"
                                        onMouseOver={(e) => handleMouseOver(e, d)}
                                        onMouseOut={handleMouseOut}
                                    />
                                    <text
                                        x={xPos + barWidth / 2}
                                        y={chartHeight + 15}
                                        textAnchor="end"
                                        fill="#9ca3af"
                                        fontSize="12"
                                        className="select-none"
                                        transform={`rotate(-60 ${xPos + barWidth / 2},${chartHeight + 15})`}
                                    >
                                        {d.label}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
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

export default SimpleBarChart;
