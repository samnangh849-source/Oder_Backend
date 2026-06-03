import React, { useMemo, useState, useEffect, useContext, useRef } from 'react';
import Modal from '../common/Modal';
import { ParsedOrder } from '../../types';
import { AppContext } from '../../context/AppContext';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { 
    PieChart, Pie, Cell, Sector,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area
} from 'recharts';
import { X, BarChart3, TrendingUp, Package, Activity, Zap, DollarSign, Plus, Edit2, Maximize2, Minimize2, Cpu, Globe, Layers, Search, MousePointer2, RefreshCw, Filter } from 'lucide-react';
import { safeParseDate } from '../../utils/dateUtils';
interface SalesStatisticModalProps {
    initialDateFilter?: string;
    initialStart?: string;
    initialEnd?: string;
    isOpen: boolean;
    onClose: () => void;
    orders: ParsedOrder[];
    title: string;
    subtitle: string;
}
const COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316', '#EAB308', '#10B981'];
const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';
    return (
        <g>
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="scanGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={fill} stopOpacity="0" />
                    <stop offset="50%" stopColor={fill} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={fill} stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Central Dashboard Node */}
            <defs>
                <clipPath id="centerLogoClip">
                    <circle cx={cx} cy={cy} r={innerRadius * 0.7} />
                </clipPath>
            </defs>
            <circle cx={cx} cy={cy} r={innerRadius - 5} fill="white" className="shadow-2xl" />
            <circle cx={cx} cy={cy} r={innerRadius} stroke={fill} strokeWidth={1} fill="none" opacity={0.2} />
            
            <g opacity={1}>
                <circle cx={cx} cy={cy} r={innerRadius * 0.75} fill={fill} opacity={0.05} />
                {payload.logoUrl ? (
                    <image
                        href={convertGoogleDriveUrl(payload.logoUrl)}
                        x={cx - innerRadius * 0.7}
                        y={cy - innerRadius * 0.7}
                        width={innerRadius * 1.4}
                        height={innerRadius * 1.4}
                        clipPath="url(#centerLogoClip)"
                        preserveAspectRatio="xMidYMid slice"
                    />
                ) : (
                    <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-black text-4xl opacity-40 select-none">{payload.name.charAt(0)}</text>
                )}
            </g>
            {/* Scanning Effect */}
            <Sector
                cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 15}
                startAngle={startAngle} endAngle={endAngle} fill="url(#scanGradient)"
                className="animate-pulse"
            />
            <Sector
                cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 15}
                startAngle={startAngle} endAngle={endAngle} fill={fill} filter="url(#glow)"
                opacity={0.8}
            />
            <Sector
                cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle}
                innerRadius={outerRadius + 20} outerRadius={outerRadius + 24} fill={fill} opacity={0.3}
            />
            {/* Connection Lines */}
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={2} strokeDasharray="4 2" />
            <circle cx={ex} cy={ey} r={4} fill={fill} />
            <circle cx={ex} cy={ey} r={8} stroke={fill} strokeWidth={1} fill="none" className="animate-ping" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 15} y={ey - 5} textAnchor={textAnchor} fill="#94A3B8" className="font-bold text-[10px] tracking-widest">CAPACITY: {(percent * 100).toFixed(1)}%</text>
            {(() => {
                const words = payload.name.split(' ');
                const lines: string[] = [];
                let currentLine = '';
                words.forEach((word: string) => {
                    // More aggressive wrapping at 15 chars
                    if ((currentLine + word).length > 15) {
                        if (currentLine) lines.push(currentLine.trim());
                        currentLine = word + ' ';
                    } else {
                        currentLine += word + ' ';
                    }
                });
                lines.push(currentLine.trim());
                const finalLines = lines.filter(l => l).slice(0, 4);
                
                return (
                    <>
                        {finalLines.map((line, i) => (
                            <text 
                                key={i}
                                x={ex + (cos >= 0 ? 1 : -1) * 15} 
                                y={ey + 12 + (i * 12)} 
                                textAnchor={textAnchor} 
                                fill="#111827" 
                                className="font-black text-[11px] uppercase tracking-tight"
                            >
                                {line}
                            </text>
                        ))}
                        <text 
                            x={ex + (cos >= 0 ? 1 : -1) * 15} 
                            y={ey + 15 + (finalLines.length * 12) + 5} 
                            textAnchor={textAnchor} 
                            fill={fill} 
                            className="font-black text-base"
                        >
                            ${value.toLocaleString()}
                        </text>
                    </>
                );
            })()}
        </g>
    );
};
const renderPieLabel = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, outerRadius, name, fill } = props;
    const radius = outerRadius + 20;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const textAnchor = x > cx ? 'start' : 'end';

    return (
        <g>
            <text 
                x={x} 
                y={y} 
                fill={fill} 
                textAnchor={textAnchor} 
                dominantBaseline="central"
                className="font-black text-[9px] uppercase tracking-tighter select-none pointer-events-none"
            >
                {name}
            </text>
            <path 
                d={`M${cx + outerRadius * Math.cos(-midAngle * RADIAN)},${cy + outerRadius * Math.sin(-midAngle * RADIAN)}L${cx + (outerRadius + 10) * Math.cos(-midAngle * RADIAN)},${cy + (outerRadius + 10) * Math.sin(-midAngle * RADIAN)}`}
                stroke={fill}
                strokeWidth={1}
                opacity={0.3}
                fill="none"
            />
        </g>
    );
};

const SalesStatisticModal: React.FC<SalesStatisticModalProps> = ({
isOpen, onClose, orders, title, subtitle,
    initialDateFilter, initialStart, initialEnd
}) => {
    const { appData, language } = useContext(AppContext);
    const [offlineSale, setOfflineSale] = useState<number>(() => {
        const saved = localStorage.getItem('global_offline_sale_value');
        return saved ? parseFloat(saved) : 0;
    });
    const [isEditingOffline, setIsEditingOffline] = useState(false);
    const [tempOffline, setTempOffline] = useState(offlineSale.toString());
    const [activePieIndex, setActivePieIndex] = useState(0);
    const [isPieMaximized, setIsPieMaximized] = useState(false);
    const [zoomScale, setZoomScale] = useState(1);
    const [activeDateRange, setActiveDateRange] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom'>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedVelocityPages, setSelectedVelocityPages] = useState<string[]>([]);
    const [productSearchQueries, setProductSearchQueries] = useState<Record<string, string>>({});
    const [openProductSelector, setOpenProductSelector] = useState<string | null>(null);
    const [pageProductMapping, setPageProductMapping] = useState<Record<string, string[]>>(() => {
        try {
            const saved = localStorage.getItem('global_page_product_mapping');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const handlePageProductSelect = (pageName: string, productName: string) => {
        setPageProductMapping(prev => {
            const current = prev[pageName] || [];
            let updated;
            if (current.includes(productName)) {
                updated = current.filter(p => p !== productName);
            } else if (current.length < 3) {
                updated = [...current, productName];
            } else {
                updated = [current[1], current[2], productName]; // Keep max 3
            }
            const nextState = { ...prev, [pageName]: updated };
            localStorage.setItem('global_page_product_mapping', JSON.stringify(nextState));
            return nextState;
        });
    };
    
    useEffect(() => {
        if (isOpen) {
            setActiveDateRange((initialDateFilter as any) || "all");
            setCustomStart(initialStart || "");
            setCustomEnd(initialEnd || "");
        }
    }, [isOpen, initialDateFilter, initialStart, initialEnd]);

    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        localStorage.setItem('global_offline_sale_value', offlineSale.toString());
    }, [offlineSale]);

    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container) return;
        const handleWheel = (e: WheelEvent) => {
            if (isPieMaximized) {
                e.preventDefault();
                const delta = e.deltaY * -0.001;
                setZoomScale(prev => Math.min(Math.max(prev + delta, 0.4), 3));
            }
        };
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [isPieMaximized]);

    const handleSaveOffline = () => {
        setOfflineSale(parseFloat(tempOffline) || 0);
        setIsEditingOffline(false);
    };

    const filteredOrders = useMemo(() => {
        if (activeDateRange === 'all') return orders;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return orders.filter(o => {
            const d = safeParseDate(o.Timestamp);
            if (!d) return false;
            if (activeDateRange === 'today') return d >= startOfToday;
            if (activeDateRange === 'this_week') {
                const day = now.getDay();
                const startOfWeek = new Date(startOfToday);
                startOfWeek.setDate(startOfToday.getDate() - (day === 0 ? 6 : day - 1));
                return d >= startOfWeek;
            }
            if (activeDateRange === 'this_month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return d >= startOfMonth;
            }
            if (activeDateRange === 'last_month') {
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                return d >= start && d <= end;
            }
            if (activeDateRange === 'custom') {
                if (customStart) {
                    const start = new Date(customStart + 'T00:00:00');
                    if (d < start) return false;
                }
                if (customEnd) {
                    const end = new Date(customEnd + 'T23:59:59');
                    if (d > end) return false;
                }
                return true;
            }
            return true;
        });
    }, [orders, activeDateRange, customStart, customEnd]);

    const stats = useMemo(() => {
        const parsedOrders: ParsedOrder[] = orders.map(o => {
            let p: Product[] = [];
            try {
                p = JSON.parse(o["Products (JSON)"] || '[]');
            } catch {
                p = [];
            }
            return { ...o, Products: p };
        });

        const onlineTotal = filteredOrders.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0);
        const orderCount = filteredOrders.length;
        const avgOrderValue = orderCount > 0 ? onlineTotal / orderCount : 0;
        const pageTotals: Record<string, number> = {};
        filteredOrders.forEach(o => {
            const page = o.Page || 'Unknown';
            pageTotals[page] = (pageTotals[page] || 0) + (Number(o['Grand Total']) || 0);
        });
        const sortedPages = Object.keys(pageTotals).sort();
        let topPage = { name: 'N/A', value: 0 };
        sortedPages.forEach(name => {
            if (pageTotals[name] > topPage.value) {
                topPage = { name, value: pageTotals[name] };
            }
        });
        const pieData = sortedPages.map(name => {
            const pageInfo = appData.pages?.find(p => p.PageName === name);
            return { name, value: pageTotals[name], logoUrl: pageInfo?.PageLogoURL || '' };
        });
        if (offlineSale > 0) pieData.push({ name: 'Offline Sale', value: offlineSale, logoUrl: '' });
        
        const lineChartData = Array.from({ length: 8 }, (_, i) => ({ name: `P${i + 1}`, timestamp: 0 }));
        lineChartData.forEach(p => sortedPages.forEach(page => (p as any)[page] = 0));
        
        if (filteredOrders.length > 0) {
            const ts = filteredOrders.map(o => safeParseDate(o.Timestamp)?.getTime()).filter(t => t) as number[];
            const minT = Math.min(...ts), maxT = Math.max(...ts);
            const range = maxT - minT || 1;
            const step = range / 8;

            lineChartData.forEach((d, i) => {
                const bucketMiddle = minT + (i * step) + (step / 2);
                const date = new Date(bucketMiddle);
                d.name = date.toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US', { month: 'short', day: 'numeric' });
                d.timestamp = bucketMiddle;
            });

            filteredOrders.forEach(o => {
                const t = safeParseDate(o.Timestamp)?.getTime();
                if (!t) return;
                const idx = Math.min(Math.floor((t - minT) / step), 7);
                const page = o.Page || 'Unknown';
                if (lineChartData[idx]) (lineChartData[idx] as any)[page] = ((lineChartData[idx] as any)[page] || 0) + (Number(o['Grand Total']) || 0);
            });
        }
        const now = new Date();
        const barChartData = (() => {
            const currentTotal = filteredOrders.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0);
            
            // Calculate the same period in the previous month
            let prevTotal = 0;
            let currentLabel = language === 'km' ? 'បច្ចុប្បន្ន' : 'Current';
            let prevLabel = language === 'km' ? 'មុន' : 'Previous';

            if (activeDateRange !== 'all') {
                let filterStart: Date | null = null;
                let filterEnd: Date | null = null;

                if (activeDateRange === 'today') {
                    filterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    filterEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                } else if (activeDateRange === 'this_week') {
                    const day = now.getDay();
                    filterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
                    filterEnd = new Date(now);
                } else if (activeDateRange === 'this_month') {
                    filterStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    filterEnd = new Date(now);
                } else if (activeDateRange === 'custom') {
                    if (customStart) filterStart = new Date(customStart + 'T00:00:00');
                    if (customEnd) filterEnd = new Date(customEnd + 'T23:59:59');
                }

                if (filterStart) {
                    const formatLabel = (s: Date, e: Date) => {
                        const sD = s.getDate();
                        const eD = e.getDate();
                        const sM = s.toLocaleString(language === 'km' ? 'km-KH' : 'default', { month: 'short' });
                        const eM = e.toLocaleString(language === 'km' ? 'km-KH' : 'default', { month: 'short' });
                        if (sM === eM) {
                            if (sD === eD) return `${sD} ${sM}`;
                            return `${sD}-${eD} ${sM}`;
                        }
                        return `${sD} ${sM}-${eD} ${eM}`;
                    };

                    const actualEnd = filterEnd || new Date();
                    currentLabel = formatLabel(filterStart, actualEnd);

                    const prevMonthStart = new Date(filterStart);
                    prevMonthStart.setMonth(filterStart.getMonth() - 1);
                    
                    const prevMonthEnd = new Date(actualEnd);
                    prevMonthEnd.setMonth(actualEnd.getMonth() - 1);
                    
                    prevLabel = formatLabel(prevMonthStart, prevMonthEnd);

                    orders.forEach(o => {
                        const od = safeParseDate(o.Timestamp);
                        if (od && od >= prevMonthStart && od <= prevMonthEnd) {
                            prevTotal += (Number(o['Grand Total']) || 0);
                        }
                    });
                }
            }

            return [
                { name: prevLabel, value: prevTotal, type: 'previous' },
                { name: currentLabel, value: currentTotal, type: 'current' }
            ];
        })();

        const last3Months = Array.from({ length: 3 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
            return {
                key: `ខែ ${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: `ខែ ${String(d.getMonth() + 1).padStart(2, '0')}`
            };
        });

        const bottomCharts = sortedPages.map((p, idx) => {
            const mData: Record<string, number> = {};
            const mOrders: Record<string, number> = {};
            const pMapping = pageProductMapping[p] || [];
            const productPerformance: Record<string, { revenue: number, quantity: number }> = {};
            pMapping.forEach(prod => productPerformance[prod] = { revenue: 0, quantity: 0 });

            // Initialize with 0s for the last 3 months
            last3Months.forEach(m => {
                mData[m.key] = 0;
                mOrders[m.key] = 0;
            });

            // Use the full orders pool instead of filteredOrders to always show 3 month history
            parsedOrders.filter(o => (o.Page || 'Unknown') === p).forEach(o => {
                const d = safeParseDate(o.Timestamp);
                if (d) { 
                    const key = `ខែ ${String(d.getMonth() + 1).padStart(2, '0')}`;
                    if (mData.hasOwnProperty(key)) {
                        mData[key] = (mData[key] || 0) + (Number(o['Grand Total']) || 0); 
                        mOrders[key] = (mOrders[key] || 0) + 1;

                        // Last 3 months product performance
                        o.Products.forEach(prod => {
                            if (pMapping.includes(prod.name)) {
                                productPerformance[prod.name].revenue += prod.total;
                                productPerformance[prod.name].quantity += prod.quantity;
                            }
                        });
                    }
                }
            });
            
            const monthValues = last3Months.map(m => mData[m.key]);
            const currentMonthValue = monthValues[2];
            const prevMonthValue = monthValues[1];
            let growth = 0;
            if (prevMonthValue > 0) growth = ((currentMonthValue - prevMonthValue) / prevMonthValue) * 100;
            else if (currentMonthValue > 0) growth = 100;

            const pageInfo = appData.pages?.find(page => page.PageName === p);
            const totalOrders = Object.values(mOrders).reduce((a, b) => a + b, 0);

            return { 
                page: p, 
                logoUrl: pageInfo?.PageLogoURL || '',
                color: COLORS[idx % COLORS.length], 
                growth,
                totalOrders,
                productPerformance,
                data: last3Months.map(m => ({ 
                    name: m.label, 
                    value: mData[m.key],
                    orders: mOrders[m.key]
                }))
            };
        });
        return { 
            onlineTotal, 
            total: onlineTotal + offlineSale, 
            orderCount,
            avgOrderValue,
            topPage,
            pieData, 
            lineChartData, 
            barChartData, 
            bottomCharts, 
            sortedPages 
        };
    }, [filteredOrders, offlineSale, appData.pages, language, activeDateRange, customStart, customEnd, orders, pageProductMapping]);


    useEffect(() => {
        if (isOpen && stats.sortedPages.length > 0 && selectedVelocityPages.length === 0) {
            setSelectedVelocityPages(stats.sortedPages);
        }
    }, [isOpen, stats.sortedPages]);
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} fullScreen={true}>
            <div className="bg-[#F1F5F9] text-gray-800 flex flex-col h-screen font-sans overflow-hidden">
                <header className="flex-shrink-0 px-10 py-6 border-b border-gray-200 flex items-center justify-between z-30 bg-white/90 backdrop-blur-xl sticky top-0 shadow-sm">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-gradient-to-tr from-blue-700 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/30 rotate-3 hover:rotate-0 transition-transform duration-500">
                            <Cpu size={28} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">Sales Online Data</h2>
                                <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] rounded-full font-black tracking-[0.2em] shadow-lg shadow-blue-500/20">QUANTUM v2.5</span>
                            </div>
                            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.4em] mt-1 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                                {subtitle}
                            </p>
                        </div>
                    </div>
                    {/* Temporal Shortcuts inside Intelligence Hub */}
                    <div className="hidden lg:flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
                            {[
                                { id: 'all', label: 'All Time', km: 'ទាំងអស់' },
                                { id: 'today', label: 'Today', km: 'ថ្ងៃនេះ' },
                                { id: 'this_week', label: 'This Week', km: 'សប្តាហ៍នេះ' },
                                { id: 'this_month', label: 'This Month', km: 'ខែនេះ' },
                                { id: 'last_month', label: 'Last Month', km: 'ខែមុន' },
                                { id: 'custom', label: 'Custom', km: 'កំណត់ខ្លួនឯង' },
                            ].map((range) => (
                                <button
                                    key={range.id}
                                    onClick={() => setActiveDateRange(range.id as any)}
                                    className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeDateRange === range.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-100 scale-105'
                                            : 'text-gray-400 hover:text-gray-600 hover:bg-white/5'
                                    }`}
                                >
                                    {language === 'km' ? range.km : range.label}
                                </button>
                            ))}
                        </div>
                        {activeDateRange === 'custom' && (
                            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-blue-100 shadow-xl animate-in slide-in-from-top-2 duration-300">
                                <input 
                                    type="date" 
                                    value={customStart} 
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="bg-gray-50 border-none rounded-lg text-[10px] font-black p-1.5 focus:ring-0 text-blue-600"
                                />
                                <span className="text-[10px] font-black text-gray-300 uppercase">to</span>
                                <input 
                                    type="date" 
                                    value={customEnd} 
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="bg-gray-50 border-none rounded-lg text-[10px] font-black p-1.5 focus:ring-0 text-blue-600"
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex flex-col items-end mr-6 border-r border-gray-200 pr-6">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Terminal Status</p>
                            <p className="text-xs font-black text-emerald-600 uppercase">Operational / Secure</p>
                        </div>
                        <button onClick={onClose} className="w-12 h-12 flex items-center justify-center hover:bg-red-50 rounded-2xl transition-all text-gray-400 hover:text-red-600 group">
                            <X size={28} className="group-hover:rotate-90 transition-transform duration-300"/>
                        </button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-10">
                    {/* KPI Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Revenue', value: `$${stats.total.toLocaleString()}`, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50', trend: '+12.5%' },
                            { label: 'Order Volume', value: stats.orderCount.toLocaleString(), icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: '+5.2%' },
                            { label: 'Avg Order Value', value: `$${stats.avgOrderValue.toFixed(2)}`, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', trend: '-2.1%' },
                            { label: 'Top Performance', value: stats.topPage.name, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Peak' },
                        ].map((kpi, i) => (
                            <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                                <div className={`absolute top-0 right-0 w-24 h-24 ${kpi.bg} rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-700 opacity-50`}></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <div className={`w-12 h-12 ${kpi.bg} ${kpi.color} rounded-2xl flex items-center justify-center`}>
                                        <kpi.icon size={24} />
                                    </div>
                                    <span className={`text-[10px] font-black ${kpi.trend.startsWith('+') ? 'text-emerald-600' : kpi.trend === 'Peak' ? 'text-blue-600' : 'text-red-600'} bg-white px-2 py-1 rounded-lg shadow-sm border border-gray-50`}>{kpi.trend}</span>
                                </div>
                                <div className="mt-4 relative z-10">
                                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</p>
                                    <h3 className="text-3xl font-black text-gray-900 mt-1">{kpi.value}</h3>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        {/* Market Equilibrium Chart */}
                        <div 
                            ref={chartContainerRef}
                            className={`lg:col-span-4 transition-all duration-700 relative ${isPieMaximized ? 'fixed inset-10 z-[100] bg-white/98 backdrop-blur-3xl rounded-[4rem] shadow-[0_0_200px_rgba(0,0,0,0.2)] p-12 lg:col-span-12 h-[calc(100vh-80px)] flex flex-col overflow-auto' : 'h-[520px] flex flex-col bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all overflow-hidden'}`}
                        >
                            {/* Background Radar Grid */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="border border-gray-900 rounded-full" style={{ width: `${i * 20}%`, height: `${i * 20}%` }}></div>
                                    ))}
                                    {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                                        <div key={deg} className="absolute h-px bg-gray-900 w-full" style={{ transform: `rotate(${deg}deg)` }}></div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-between mb-8 relative z-10">
                                <div>
                                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3"><Globe size={14} className="text-blue-500" /> Market Equilibrium</h4>
                                    <p className="text-xs font-bold text-gray-400 mt-1">Cross-platform revenue distribution</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isPieMaximized && (
                                        <div className="flex items-center gap-4 mr-6 px-6 py-2 bg-gray-100 rounded-2xl border border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <MousePointer2 size={14} className="text-blue-500" />
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Scroll to Zoom</span>
                                            </div>
                                            <div className="h-4 w-px bg-gray-300"></div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Level: {(zoomScale * 100).toFixed(0)}%</span>
                                                <button onClick={() => setZoomScale(1)} className="p-1 hover:bg-gray-200 rounded-md text-gray-400 hover:text-blue-600 transition-all"><RefreshCw size={12} /></button>
                                            </div>
                                        </div>
                                    )}
                                    <button onClick={() => { setIsPieMaximized(!isPieMaximized); if(isPieMaximized) setZoomScale(1); }} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl text-gray-400 hover:text-blue-600 transition-all">{isPieMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
                                </div>
                            </div>
                            <div className="flex-1 relative flex flex-col lg:flex-row items-center justify-center gap-20">
                                <div className="flex-1 w-full h-full relative group">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
                                            <defs>
                                                {stats.pieData.map((_, i) => (
                                                    <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={1}/>
                                                        <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.7}/>
                                                    </linearGradient>
                                                ))}
                                            </defs>
                                            <Pie 
                                                activeIndex={activePieIndex} 
                                                activeShape={renderActiveShape} 
                                                data={stats.pieData} 
                                                innerRadius={(isPieMaximized ? 120 : 60) * zoomScale} 
                                                outerRadius={(isPieMaximized ? 240 : 120) * zoomScale} 
                                                paddingAngle={8} 
                                                dataKey="value" 
                                                onMouseEnter={(_, i) => setActivePieIndex(i)} 
                                                stroke="none"
                                                label={renderPieLabel}
                                                labelLine={false}
                                                animationDuration={1500}
                                                animationEasing="ease-out"
                                            >
                                                {stats.pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.name === 'Offline Sale' ? '#0D9488' : `url(#grad-${index})`} className="hover:opacity-80 transition-opacity cursor-pointer" />
                                                ))}
                                            </Pie>
                                            <Legend 
                                                verticalAlign="bottom" 
                                                align="center"
                                                iconType="circle"
                                                formatter={(value) => (
                                                    <span style={{ 
                                                        color: '#475569', 
                                                        fontSize: '10px', 
                                                        fontWeight: 900,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.05em',
                                                        display: 'inline-block',
                                                        maxWidth: '120px',
                                                        whiteSpace: 'normal',
                                                        lineHeight: '1.4',
                                                        verticalAlign: 'top'
                                                    }}>
                                                        {value}
                                                    </span>
                                                )}
                                                wrapperStyle={{ 
                                                    paddingTop: '40px', 
                                                    fontFamily: 'monospace' 
                                                }} 
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                {isPieMaximized && (
                                    <div className="w-full lg:w-[450px] space-y-8 animate-in slide-in-from-right-20 duration-700">
                                        <div className="bg-gray-900/90 backdrop-blur-2xl text-white p-12 rounded-[4rem] shadow-[0_40px_100px_rgba(0,0,0,0.3)] border border-white/10 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                            <div className="flex items-center gap-5 mb-8">
                                                <div className="w-3 h-14 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shadow-lg shadow-blue-500/50"></div>
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Data Node</p>
                                                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter">{stats.pieData[activePieIndex]?.name}</h3>
                                                </div>
                                            </div>
                                            <div className="space-y-6">
                                                <div className="p-8 bg-white/5 rounded-3xl border border-white/5 group hover:border-blue-500/30 transition-all">
                                                    <p className="text-6xl font-black text-blue-400 tracking-tighter tabular-nums group-hover:scale-105 transition-transform duration-500">${stats.pieData[activePieIndex]?.value.toLocaleString()}</p>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mt-3">Total Node Valuation</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                                                        <p className="text-2xl font-black text-white">{( (stats.pieData[activePieIndex]?.value / stats.total) * 100).toFixed(1)}%</p>
                                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Market Weight</p>
                                                    </div>
                                                    <div className="p-6 bg-white/5 rounded-2xl border border-white/5 flex flex-col justify-center">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                            <p className="text-xl font-black text-white uppercase tracking-tight">Active</p>
                                                        </div>
                                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Linkage Status</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl">
                                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Search size={14} className="text-blue-500" /> Equilibrium Analysis</h4>
                                            <div className="space-y-4">
                                                {[
                                                    { label: 'Dominance Index', value: '0.84', color: 'text-blue-600' },
                                                    { label: 'Variance Spread', value: '12.4%', color: 'text-emerald-600' },
                                                    { label: 'Network Integrity', value: 'Optimal', color: 'text-indigo-600' }
                                                ].map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:bg-white hover:shadow-lg transition-all">
                                                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{item.label}</span>
                                                        <span className={`text-sm font-black ${item.color} uppercase`}>{item.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Weekly Progression - Simplified & Clean */}
                        <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm h-[520px] flex flex-col hover:shadow-xl transition-all relative overflow-hidden group">
                            {/* Suble Soft Glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none"></div>

                            <div className="relative z-10 mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                            <Activity size={18} />
                                        </div>
                                        <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.2em]">Temporal Velocity</h4>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">
                                        {language === 'km' ? 'គន្លងការអនុវត្តប្រចាំសប្តាហ៍' : 'Weekly performance trajectory'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Simplified Page Selector */}
                                    <div className="flex items-center gap-1.5 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 max-w-[320px] overflow-hidden">
                                        <button 
                                            onClick={() => setSelectedVelocityPages(selectedVelocityPages.length === stats.sortedPages.length ? [] : stats.sortedPages)}
                                            className="p-2 hover:bg-white rounded-xl text-gray-400 hover:text-indigo-600 transition-all shadow-sm flex-shrink-0"
                                            title="Toggle All"
                                        >
                                            <Filter size={14} />
                                        </button>
                                        <div className="h-4 w-px bg-gray-200 flex-shrink-0"></div>
                                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                                            {stats.sortedPages.map((page) => {
                                                const isSelected = selectedVelocityPages.includes(page);
                                                return (
                                                    <button
                                                        key={page}
                                                        onClick={() => {
                                                            setSelectedVelocityPages(prev => 
                                                                isSelected 
                                                                    ? prev.filter(p => p !== page)
                                                                    : [...prev, page]
                                                            );
                                                        }}
                                                        className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                                                            isSelected
                                                                ? 'bg-white text-indigo-600 shadow-sm border-indigo-100'
                                                                : 'bg-transparent text-gray-400 border-transparent hover:text-gray-600'
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="hidden md:flex px-4 py-2 bg-gray-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">
                                        8-Points
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex-1 relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            {stats.sortedPages.map((p, idx) => (
                                                <linearGradient key={`area-grad-${idx}`} id={`area-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0.2}/>
                                                    <stop offset="100%" stopColor={COLORS[idx % COLORS.length]} stopOpacity={0}/>
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} 
                                            dy={10} 
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fontWeight: 800, fill: '#94A3B8' }} 
                                            tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                        />
                                        <Tooltip 
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 min-w-[200px]">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-50 pb-2">{label}</p>
                                                            <div className="space-y-2.5">
                                                                {payload.map((entry: any, index: number) => (
                                                                    <div key={index} className="flex items-center justify-between gap-4">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                                                            <span className="text-[10px] font-bold text-gray-600 uppercase truncate max-w-[100px]">{entry.name}</span>
                                                                        </div>
                                                                        <span className="text-[10px] font-black text-gray-900">${entry.value.toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                                <div className="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between">
                                                                    <span className="text-[9px] font-black text-gray-400 uppercase">Total</span>
                                                                    <span className="text-[11px] font-black text-indigo-600">
                                                                        ${payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        {stats.sortedPages.filter(p => selectedVelocityPages.includes(p)).map((p) => {
                                            const idx = stats.sortedPages.indexOf(p);
                                            return (
                                                <Area 
                                                    key={p} 
                                                    type="monotone" 
                                                    dataKey={p} 
                                                    stroke={COLORS[idx % COLORS.length]} 
                                                    strokeWidth={3} 
                                                    fill={`url(#area-grad-${idx})`}
                                                    dot={false}
                                                    activeDot={{ r: 6, strokeWidth: 2, stroke: 'white', fill: COLORS[idx % COLORS.length] }} 
                                                    animationDuration={1500}
                                                />
                                            );
                                        })}
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                    {/* Summary Interface */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Monthly Histogram */}
                        <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col hover:shadow-2xl transition-all relative overflow-hidden group">
                             <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-50 rounded-full blur-[80px] -ml-24 -mb-24 opacity-40 group-hover:opacity-80 transition-opacity"></div>
                             <div className="flex items-center justify-between mb-10 relative z-10">
                                <div>
                                    <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3"><Layers size={14} className="text-amber-500" /> Aggregate Volume</h4>
                                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tighter">Delta MoM Comparison</p>
                                </div>
                                <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg uppercase border border-amber-100 shadow-sm">Analysis Mode</span>
                             </div>
                             <div className="flex-1 relative z-10 flex items-center justify-center min-h-[180px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.barChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="current-grad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#F59E0B" stopOpacity={1}/>
                                                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.4}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 12, fontWeight: 900, fill: '#64748B', fontFamily: 'monospace' }} 
                                            dy={10} 
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 11, fontWeight: 900, fill: '#94A3B8', fontFamily: 'monospace' }}
                                            width={55}
                                            tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                                        />
                                        <Tooltip 
                                            cursor={{ fill: '#F8FAFC', radius: 12 }} 
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-xl">
                                                            <p className="text-[8px] font-mono text-amber-400 uppercase mb-2 tracking-tighter">Volume / {data.name}</p>
                                                            <div className="flex items-center justify-between gap-8">
                                                                <span className="text-[9px] font-bold text-gray-400 uppercase">{data.type === 'current' ? 'Current Window' : 'Previous Window'}</span>
                                                                <span className={`text-sm font-black font-mono ${data.type === 'current' ? 'text-amber-400' : 'text-gray-400'}`}>${data.value.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={50} animationDuration={2000}>
                                            {stats.barChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.type === 'current' ? 'url(#current-grad)' : '#E2E8F0'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                             </div>
                        </div>
                        {/* Revenue Node Terminal - Simplified & Friendly */}
                        <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 relative overflow-hidden flex flex-col xl:flex-row items-center justify-between gap-10 hover:shadow-xl transition-all duration-500 group">
                            {/* Soft Gradient Background */}
                            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-50/50 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-50/30 rounded-full blur-[80px] -ml-20 -mb-20 pointer-events-none"></div>

                            <div className="relative z-10 space-y-8 flex-1 w-full">
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                                            <DollarSign size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.2em]">Total Gross Revenue</h4>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5 tracking-wider">Overall performance summary</p>
                                        </div>
                                    </div>
                                    
                                    <div className="relative inline-block">
                                        <h2 className="text-7xl font-black text-gray-900 tracking-tighter tabular-nums leading-none">
                                            ${stats.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </h2>
                                        <div className="mt-4 flex items-center gap-3">
                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm">
                                                Verified Data
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="p-6 bg-gray-50/50 rounded-[2rem] border border-gray-100 hover:bg-white hover:shadow-md transition-all group/node">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-600">
                                                <Globe size={20} />
                                            </div>
                                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Digital Sales</p>
                                        </div>
                                        <p className="text-4xl font-black text-gray-900 tracking-tighter">${stats.onlineTotal.toLocaleString()}</p>
                                        <div className="mt-4 flex items-center justify-between text-[10px] font-bold">
                                            <span className="text-gray-400">Market Share</span>
                                            <span className="text-blue-600">{((stats.onlineTotal / (stats.total || 1)) * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-gray-50/50 rounded-[2rem] border border-gray-100 hover:bg-white hover:shadow-md transition-all group/node">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-600">
                                                <Zap size={20} />
                                            </div>
                                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Offline Sales</p>
                                        </div>
                                        <p className="text-4xl font-black text-gray-900 tracking-tighter">${offlineSale.toLocaleString()}</p>
                                        <div className="mt-4 flex items-center justify-between text-[10px] font-bold">
                                            <span className="text-gray-400">Market Share</span>
                                            <span className="text-emerald-600">{((offlineSale / (stats.total || 1)) * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 flex flex-col items-center xl:items-end gap-6">
                                {isEditingOffline ? (
                                    <div className="w-full flex items-center gap-4 bg-white p-6 rounded-[2.5rem] border border-blue-200 shadow-2xl animate-in zoom-in-95 duration-300">
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 ml-4">
                                                {language === 'km' ? 'បញ្ជូលទិន្នន័យ Offline Sale' : 'Input Offline Sale'}
                                            </p>
                                            <div className="flex items-center bg-gray-50 rounded-2xl p-4 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                                <span className="text-2xl font-black text-gray-300 ml-2">$</span>
                                                <input 
                                                    type="number" 
                                                    value={tempOffline} 
                                                    onChange={(e) => setTempOffline(e.target.value)} 
                                                    className="bg-transparent border-none focus:ring-0 text-4xl font-black text-gray-900 w-full pl-3 outline-none" 
                                                    autoFocus 
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveOffline()}
                                                />
                                            </div>
                                        </div>
                                        <button onClick={handleSaveOffline} className="bg-blue-600 text-white px-8 py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30">
                                            {language === 'km' ? 'អនុវត្ត' : 'Update'}
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => { setTempOffline(offlineSale.toString()); setIsEditingOffline(true); }} 
                                        className="flex items-center gap-4 bg-gray-900 text-white px-10 py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl hover:shadow-gray-200 active:scale-95"
                                    >
                                        <Edit2 size={18} />
                                        <span>{language === 'km' ? 'កែសម្រួល Offline Sale' : 'Adjust Offline Sale'}</span>
                                    </button>
                                )}
                            </div>
                        </div>                    </div>
                    {/* Regional Node Performance Grid */}
                    <div className="space-y-10 pb-20 relative">
                        {/* Decorative background grid for tech feel */}
                        <div className="absolute inset-0 pointer-events-none opacity-[0.015] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                        
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/40">
                                        <Layers size={20} />
                                    </div>
                                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-[0.4em]">Decentralized Node Performance</h4>
                                </div>
                                <p className="text-xs font-bold text-gray-400 ml-13">Cross-node valuation & velocity benchmarks (Last 3 Months)</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[8px] font-black text-gray-400">N{i}</div>
                                    ))}
                                </div>
                                <div className="h-8 w-px bg-gray-200"></div>
                                <div className="flex items-center gap-3">
                                    <span className="px-4 py-1.5 bg-white text-gray-500 text-[10px] font-black rounded-xl border border-gray-200 uppercase tracking-widest shadow-sm">Historical Benchmark</span>
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        Live Syncing
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-x-8 gap-y-16 pb-20 relative z-10">
                            {stats.bottomCharts.map((item, idx) => (
                                <div key={item.page} className={`group relative ${openProductSelector === item.page ? 'z-50' : 'z-10'} flex flex-col`}>
                                    {/* Tech Aura Glow */}
                                    <div className="absolute -inset-x-4 -inset-y-8 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 rounded-[4rem] blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none"></div>
                                    
                                    {/* Product Selection UI - Outside and Above the Card */}
                                    <div className="mb-6 relative z-30 px-2 min-h-[140px] flex flex-col justify-end">
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex flex-col">
                                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight leading-none group-hover:text-blue-600 transition-colors">{item.page}</h4>
                                                <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-2 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                                    Boosting Video Posts
                                                </p>
                                            </div>
                                            {(!pageProductMapping[item.page] || pageProductMapping[item.page].length < 3) && (
                                                <div className="relative">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setOpenProductSelector(openProductSelector === item.page ? null : item.page); }}
                                                        className={`flex items-center justify-center w-7 h-7 rounded-xl border-2 border-dashed transition-all shadow-sm ${openProductSelector === item.page ? 'bg-blue-600 border-blue-600 text-white rotate-45' : 'border-gray-200 bg-white/50 text-gray-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'}`}
                                                    >
                                                        <Plus size={14} />
                                                    </button>

                                                    {/* Premium Glass Dropdown */}
                                                    {openProductSelector === item.page && (
                                                        <div className="absolute top-full right-0 mt-3 w-80 bg-white/98 backdrop-blur-2xl rounded-[2rem] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] border border-white animate-in zoom-in-95 slide-in-from-top-2 duration-300 z-[100] overflow-hidden ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
                                                            <div className="p-5 bg-gradient-to-b from-gray-50/80 to-transparent border-b border-gray-100 space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <p className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] flex items-center gap-2">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                                            {language === 'km' ? 'ជ្រើសរើសផលិតផល' : 'Select Product'}
                                                                        </p>
                                                                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Asset Registry Control</span>
                                                                    </div>
                                                                    <div className="bg-blue-50 px-2 py-1 rounded-lg">
                                                                        <span className="text-[10px] font-black text-blue-600 font-mono">03</span>
                                                                    </div>
                                                                </div>
                                                                <div className="relative group/search">
                                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-blue-500 transition-colors">
                                                                        <Search size={14} />
                                                                    </div>
                                                                    <input 
                                                                        type="text" 
                                                                        placeholder="Search products..."
                                                                        value={productSearchQueries[item.page] || ''}
                                                                        onChange={(e) => setProductSearchQueries(prev => ({ ...prev, [item.page]: e.target.value }))}
                                                                        className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 transition-all placeholder:text-gray-300"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="p-3 max-h-[280px] overflow-y-auto custom-scrollbar overscroll-contain space-y-1">
                                                                {(appData.products || [])
                                                                    .filter(p => !p.ProductName?.includes('Delivery'))
                                                                    .filter(p => !productSearchQueries[item.page] || p.ProductName?.toLowerCase().includes(productSearchQueries[item.page].toLowerCase()))
                                                                    .map(p => (
                                                                    <button
                                                                        key={p.ProductName}
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation();
                                                                            handlePageProductSelect(item.page, p.ProductName || ''); 
                                                                            setOpenProductSelector(null); 
                                                                        }}
                                                                        disabled={pageProductMapping[item.page]?.includes(p.ProductName || '')}
                                                                        className="w-full text-left p-2.5 hover:bg-blue-50/50 rounded-2xl disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all flex items-center gap-3.5 group/item border border-transparent hover:border-blue-100 active:scale-[0.98]"
                                                                    >
                                                                        <div className="relative w-11 h-11 shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group-hover/item:border-blue-200 transition-colors">
                                                                            {p.ImageURL ? (
                                                                                <img src={convertGoogleDriveUrl(p.ImageURL)} alt={p.ProductName} className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-110" />
                                                                            ) : (
                                                                                <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300">
                                                                                    <Package size={18} />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                                            <span className="text-[12px] font-black text-gray-900 group-hover/item:text-blue-700 truncate block leading-tight">{p.ProductName}</span>
                                                                            <div className="flex items-center gap-2 mt-1">
                                                                                <span className="text-[9px] font-mono text-gray-400 font-bold tracking-tight uppercase">#{p.Barcode || 'UNTRACKED'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            {(pageProductMapping[item.page] || []).map(prod => {
                                                const prodData = appData.products?.find(p => p.ProductName === prod);
                                                const performance = item.productPerformance?.[prod];
                                                return (
                                                    <div key={prod} className="flex items-center gap-3 bg-white/80 backdrop-blur-md text-gray-800 pl-1 pr-3 py-2 rounded-[1.25rem] border border-gray-200 shadow-sm transition-all hover:shadow-md hover:border-blue-300 group/tag relative overflow-hidden max-w-full">
                                                        <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-white shadow-sm shrink-0">
                                                            {prodData?.ImageURL ? (
                                                                <img src={convertGoogleDriveUrl(prodData.ImageURL)} alt={prod} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                                                                    <Package size={24} />
                                                                </div>
                                                            )}
                                                            <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-600 text-[6px] font-black text-white rounded-md uppercase tracking-tighter shadow-sm animate-pulse">Boosting</div>
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[10px] font-black text-gray-900 leading-tight" title={prod}>{prod}</span>
                                                            {performance && performance.revenue > 0 && (
                                                                <span className="text-[9px] font-bold text-emerald-600 font-mono tracking-tighter mt-1">${performance.revenue.toLocaleString()}</span>
                                                            )}
                                                        </div>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handlePageProductSelect(item.page, prod); }}
                                                            className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-all"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="relative bg-white/90 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm border border-white flex flex-col h-[380px] hover:shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-2 ring-1 ring-black/[0.02]">


                                        {/* Decorative Tech Elements */}
                                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                                            <div className="grid grid-cols-3 gap-1">
                                                {[...Array(9)].map((_, i) => <div key={i} className="w-1 h-1 bg-black rounded-full"></div>)}
                                            </div>
                                        </div>
                                        
                                        <div className="absolute top-6 right-8 flex flex-col items-end gap-0.5 pointer-events-none">
                                            <span className="text-[8px] font-black font-mono text-blue-500/40 tracking-[0.2em] uppercase">Node: INF-{idx.toString().padStart(3, '0')}</span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <span className="text-[6px] font-bold text-gray-300 uppercase tracking-widest">Active Link</span>
                                            </div>
                                        </div>

                                        <div className="mb-6 relative z-10">
                                            <div className="flex items-start justify-between mb-5">
                                                <div className="relative group/logo">
                                                    <div className="absolute -inset-4 bg-blue-400/10 rounded-full blur-2xl opacity-0 group-hover/logo:opacity-100 transition-opacity"></div>
                                                    {item.logoUrl ? (
                                                        <div className="relative w-16 h-16 p-1 bg-white rounded-2xl shadow-xl border border-gray-100 group-hover/logo:rotate-3 transition-transform duration-500">
                                                            <img src={convertGoogleDriveUrl(item.logoUrl)} alt="" className="w-full h-full rounded-[14px] object-cover" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center text-blue-400 relative z-10 shadow-inner border border-blue-100">
                                                            <Cpu size={28} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`flex flex-col items-end gap-1 px-4 py-2 rounded-2xl ${item.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'} border border-current/10 shadow-sm backdrop-blur-sm`}>
                                                    <div className="flex items-center gap-1.5">
                                                        {item.growth >= 0 ? <TrendingUp size={14} className="animate-bounce" /> : <TrendingUp size={14} className="rotate-180" />}
                                                        <span className="text-sm font-black font-mono tracking-tighter">{Math.abs(item.growth).toFixed(1)}%</span>
                                                    </div>
                                                    <span className="text-[8px] font-black uppercase tracking-[0.1em] opacity-60">Node Velocity</span>
                                                </div>
                                            </div>
                                            

                                            

    


                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Velocity</p>
                                                    <p className="text-base font-black text-gray-800 font-mono tracking-tighter">{item.totalOrders} <span className="text-[10px] text-gray-400">OPS</span></p>
                                                </div>
                                                <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Ticket</p>
                                                    <p className="text-base font-black text-gray-800 font-mono tracking-tighter">${item.totalOrders > 0 ? (item.data.reduce((s, d) => s + d.value, 0) / item.totalOrders).toFixed(0) : 0}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 relative z-10 px-0 overflow-hidden min-h-[140px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart 
                                                    data={item.data} 
                                                    margin={{ top: 10, right: 10, left: 15, bottom: 10 }} 
                                                    barGap={8}
                                                >
                                                    <defs>
                                                        <linearGradient id={`node-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor={item.color} stopOpacity={1}/>
                                                            <stop offset="100%" stopColor={item.color} stopOpacity={0.2}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" opacity={0.6} />
                                                    <XAxis 
                                                        dataKey="name" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 11, fontWeight: 900, fill: '#64748B', fontFamily: 'monospace' }} 
                                                        dy={5}
                                                        padding={{ left: 10, right: 10 }}
                                                    />
                                                    <YAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94A3B8', fontFamily: 'monospace' }}
                                                        width={50}
                                                        tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                                                    />
                                                    <Tooltip 
                                                        cursor={{ fill: '#F1F5F9', radius: 12 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-xl">
                                                                        <p className="text-[8px] font-mono text-blue-400 uppercase mb-1 tracking-tighter">{payload[0].payload.name} / INF-NODE</p>
                                                                        <p className="text-lg font-black font-mono leading-none">${payload[0].value.toLocaleString()}</p>
                                                                        <div className="h-px bg-white/10 my-2"></div>
                                                                        <p className="text-[9px] font-bold text-gray-400 uppercase">{payload[0].payload.orders} Transactions</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar dataKey="value" fill={`url(#node-grad-${idx})`} radius={[6, 6, 6, 6]} barSize={40} animationDuration={2000} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between relative z-10">
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Gross Node Val</p>
                                                <p className="text-2xl font-black text-gray-900 font-mono tracking-tighter leading-none">${item.data.reduce((s, d) => s + d.value, 0).toLocaleString()}</p>
                                            </div>
                                            <button className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm group-hover:shadow-blue-500/40 group-hover:rotate-[360deg]">
                                                <Zap size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
export default SalesStatisticModal;
