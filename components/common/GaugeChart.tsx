
import React from 'react';

interface GaugeChartProps {
    value: number; // A percentage value from 0 to 100+
    label?: string;
}

const GaugeChart: React.FC<GaugeChartProps> = ({ value, label }) => {
    const clampedValue = Math.max(0, value);
    const percentage = Math.min(clampedValue / 100, 1);
    
    const radius = 80;
    const strokeWidth = 14;
    const innerRadius = radius - strokeWidth / 2;
    const circumference = 2 * Math.PI * innerRadius;
    const arc = circumference * 0.75; // 270 degrees arc
    const strokeDashoffset = arc * (1 - percentage); 

    const getColor = () => {
        if (clampedValue < 50) return "#ef4444"; // Red
        if (clampedValue < 90) return "#f59e0b"; // Amber
        return "#10b981"; // Emerald/Green
    };
    const color = getColor();
    
    return (
        <div className="relative flex items-center justify-center w-full max-w-[280px] mx-auto h-[220px]">
            <svg viewBox="0 0 200 160" className="w-full h-full transform transition-all duration-700">
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                    <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
                {/* Background Arc */}
                <path
                    d={`M 35 130 A ${innerRadius} ${innerRadius} 0 1 1 165 130`}
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className="opacity-40"
                />
                {/* Value Arc */}
                <path
                    d={`M 35 130 A ${innerRadius} ${innerRadius} 0 1 1 165 130`}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={arc}
                    strokeDashoffset={strokeDashoffset}
                    style={{ 
                        transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        filter: clampedValue > 0 ? 'url(#gaugeGlow)' : 'none'
                    }}
                />
                {/* Text Group */}
                <g className="text-center select-none">
                    <text x="100" y="95" textAnchor="middle" className="text-5xl font-black fill-white tracking-tighter">
                        {`${Math.round(clampedValue)}%`}
                    </text>
                    {label && (
                        <text x="100" y="122" textAnchor="middle" className="text-[8px] font-black uppercase tracking-[0.2em] fill-gray-500">
                            {label}
                        </text>
                    )}
                </g>
            </svg>
        </div>
    );
};

export default GaugeChart;
