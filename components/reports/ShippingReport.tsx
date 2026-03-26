import React, { useState, useMemo, useContext } from 'react';
import { ParsedOrder, AppData } from '../../types';
import { analyzeReportData } from '../../services/geminiService';
import GeminiButton from '../common/GeminiButton';
import StatCard from '../performance/StatCard';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { FilterState } from '../orders/OrderFilters';
import { APP_LOGO_URL } from '../../constants';
import Spinner from '../common/Spinner';
import { safeParseDate, getValidDate } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';

interface ShippingReportProps {
    orders: ParsedOrder[];
    appData: AppData;
    dateFilter: string;
    startDate?: string;
    endDate?: string;
    onNavigate?: (filters: any) => void;
    contextFilters?: FilterState;
    onBack?: () => void;
}

const ShippingReport: React.FC<ShippingReportProps> = ({ orders, appData, dateFilter: initialDateFilter, startDate: initialStartDate, endDate: initialEndDate, onNavigate, contextFilters, onBack }) => {
    const { advancedSettings } = useContext(AppContext);
    const uiTheme = advancedSettings?.uiTheme || 'default';
    const isLightMode = advancedSettings?.themeMode === 'light';

    const [analysis, setAnalysis] = useState<string>('');
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);
    const [storeFilter, setStoreFilter] = useState<string>('All');
    
    // Internal Date Filtering State
    const [dateFilter, setDateFilter] = useState(initialDateFilter || 'this_month');
    const [startDate, setStartDate] = useState(initialStartDate || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(initialEndDate || new Date().toISOString().split('T')[0]);

    // Theme-specific styles
    const getThemeStyles = () => {
        switch (uiTheme) {
            case 'binance':
                return {
                    headerBg: 'bg-[#1E2329] border-[#2B3139]',
                    cardBg: 'bg-[#1E2329] border-[#2B3139]',
                    accent: '#FCD535',
                    accentText: 'text-[#FCD535]',
                    secondaryText: 'text-[#848E9C]',
                    primaryText: 'text-[#EAECEF]',
                    innerBg: 'bg-[#0B0E11]',
                    tableRowHover: 'hover:bg-white/5',
                    tableBorder: 'border-[#2B3139]',
                    buttonSecondary: 'bg-[#2B3139] border-[#474D57] text-[#848E9C] hover:text-[#EAECEF]',
                    buttonAccent: 'bg-[#FCD535] text-[#1E2329] hover:bg-[#f0c51d]'
                };
            default:
                return {
                    headerBg: 'bg-gray-900/40 border-white/5',
                    cardBg: 'bg-gray-900/40 border-white/5',
                    accent: '#3b82f6',
                    accentText: 'text-blue-400',
                    secondaryText: 'text-gray-500',
                    primaryText: 'text-white',
                    innerBg: 'bg-black/40',
                    tableRowHover: 'hover:bg-white/5',
                    tableBorder: 'border-white/5',
                    buttonSecondary: 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700',
                    buttonAccent: 'bg-blue-600 text-white hover:bg-blue-700'
                };
        }
    };

    const styles = getThemeStyles();

    // Filter Navigation Handler
    const handleFilterNavigation = (key: string, value: string) => {
        if (onNavigate) {
            const filters: any = {};
            if (contextFilters) {
                if (contextFilters.team) filters.team = contextFilters.team;
                if (contextFilters.store) filters.store = contextFilters.store; 
                if (contextFilters.paymentStatus) filters.paymentStatus = contextFilters.paymentStatus;
                if (contextFilters.user) filters.user = contextFilters.user;
                if (contextFilters.page) filters.page = contextFilters.page;
                if (contextFilters.bank) filters.bank = contextFilters.bank;
                if (contextFilters.product) filters.product = contextFilters.product;
                if (contextFilters.internalCost) filters.internalCost = contextFilters.internalCost;
                if (contextFilters.location) filters.location = contextFilters.location;
            }

            if (key === 'shippingFilter') filters.shipping = value;
            if (key === 'driverFilter') filters.driver = value;     
            if (key === 'fulfillmentStore') filters.fulfillmentStore = value; 
            
            if (storeFilter !== 'All' && key !== 'fulfillmentStore') {
                filters.fulfillmentStore = storeFilter;
            }

            filters.datePreset = dateFilter;
            filters.startDate = startDate;
            filters.endDate = endDate;
            
            onNavigate(filters);
        }
    };

    // --- Date Filtering Logic ---
    const dateFilteredOrders = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startBound: Date | null = null;
        let endBound: Date | null = new Date();

        switch (dateFilter) {
            case 'today': startBound = today; endBound = new Date(today); endBound.setHours(23, 59, 59, 999); break;
            case 'yesterday': startBound = new Date(today); startBound.setDate(today.getDate() - 1); endBound = new Date(today); endBound.setMilliseconds(-1); break;
            case 'this_week': const d = now.getDay(); startBound = new Date(today); startBound.setDate(today.getDate() - (d === 0 ? 6 : d - 1)); endBound = new Date(startBound); endBound.setDate(startBound.getDate() + 6); endBound.setHours(23, 59, 59, 999); break;
            case 'this_month': startBound = new Date(now.getFullYear(), now.getMonth(), 1); break;
            case 'last_month': startBound = new Date(now.getFullYear(), now.getMonth() - 1, 1); endBound = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999); break;
            case 'all': startBound = null; endBound = null; break;
            case 'custom': if (startDate) startBound = getValidDate(startDate + 'T00:00:00'); if (endDate) endBound = getValidDate(endDate + 'T23:59:59'); break;
        }

        return orders.filter(o => {
            if (dateFilter === 'all') return true;
            if (!o.Timestamp) return false;
            const orderDate = safeParseDate(o.Timestamp);
            if (!orderDate) return false;
            if (startBound && orderDate < startBound) return false;
            if (endBound && orderDate > endBound) return false;
            return true;
        });
    }, [orders, dateFilter, startDate, endDate]);

    // 1. Filter Orders based on Store Selection
    const filteredOrders = useMemo(() => {
        if (storeFilter === 'All') return dateFilteredOrders;
        return dateFilteredOrders.filter(o => o['Fulfillment Store'] === storeFilter);
    }, [dateFilteredOrders, storeFilter]);

    // 2. Calculate Stats based on Filtered Orders
    const shippingStats = useMemo(() => {
        const totalInternalCost = filteredOrders.reduce((sum, o) => sum + (Number(o['Internal Cost']) || 0), 0);
        const totalCustomerFee = filteredOrders.reduce((sum, o) => sum + (Number(o['Shipping Fee (Customer)']) || 0), 0);
        const netShipping = totalCustomerFee - totalInternalCost;
        
        const methods: Record<string, { name: string, cost: number, orders: number, logo: string }> = {};
        const drivers: Record<string, { name: string, cost: number, orders: number, photo: string }> = {};
        const stores: Record<string, { name: string, cost: number, orders: number }> = {};

        filteredOrders.forEach(o => {
            const mName = o['Internal Shipping Method'] || 'Other';
            if (!methods[mName]) {
                const info = appData.shippingMethods?.find(sm => sm.MethodName === mName);
                methods[mName] = { name: mName, cost: 0, orders: 0, logo: info?.LogoURL || '' };
            }
            methods[mName].cost += (Number(o['Internal Cost']) || 0);
            methods[mName].orders += 1;

            const dName = o['Driver Name'] || o['Internal Shipping Details'] || 'N/A';
            if (dName !== 'N/A') {
                if (!drivers[dName]) {
                    const info = appData.drivers?.find(d => d.DriverName === dName);
                    drivers[dName] = { name: dName, cost: 0, orders: 0, photo: info?.ImageURL || '' };
                }
                drivers[dName].cost += (Number(o['Internal Cost']) || 0);
                drivers[dName].orders += 1;
            }

            const sName = o['Fulfillment Store'] || 'Unassigned';
            if (!stores[sName]) {
                stores[sName] = { name: sName, cost: 0, orders: 0 };
            }
            stores[sName].cost += (Number(o['Internal Cost']) || 0);
            stores[sName].orders += 1;
        });

        return {
            totalInternalCost,
            totalCustomerFee,
            netShipping,
            totalOrders: filteredOrders.length,
            methods: Object.values(methods).sort((a, b) => b.cost - a.cost),
            drivers: Object.values(drivers).sort((a, b) => b.cost - a.cost),
            stores: Object.values(stores).sort((a, b) => b.cost - a.cost)
        };
    }, [filteredOrders, appData]);

    const handleAnalyze = async () => {
        setLoadingAnalysis(true);
        try {
            const result = await analyzeReportData(shippingStats, { reportType: 'shipping' });
            setAnalysis(result);
        } catch (e) { setAnalysis("AI Analysis error."); } finally { setLoadingAnalysis(false); }
    };

    const handleExportExcel = () => {
        let csvContent = "\uFEFF"; 
        csvContent += "SHIPPING COST REPORT SUMMARY\n";
        csvContent += `Generated Date,${new Date().toLocaleDateString()}\n`;
        csvContent += `Period,${dateFilter === 'custom' ? `${startDate} to ${endDate}` : dateFilter}\n`;
        csvContent += `Filter Store,${storeFilter}\n\n`;
        
        csvContent += "Metric,Value\n";
        csvContent += `Total Internal Cost,${shippingStats.totalInternalCost.toFixed(2)}\n`;
        csvContent += `Total Customer Fee,${shippingStats.totalCustomerFee.toFixed(2)}\n`;
        csvContent += `Net Shipping,${shippingStats.netShipping.toFixed(2)}\n`;
        csvContent += `Total Orders,${shippingStats.totalOrders}\n\n`;

        csvContent += "SHIPPING METHODS (COMPANIES)\n";
        csvContent += "Company Name,Total Orders,Total Cost ($)\n";
        shippingStats.methods.forEach(m => {
            csvContent += `"${m.name}",${m.orders},${m.cost.toFixed(2)}\n`;
        });
        csvContent += "\n";

        csvContent += "DRIVERS\n";
        csvContent += "Driver Name,Total Orders,Total Cost ($)\n";
        shippingStats.drivers.forEach(d => {
            csvContent += `"${d.name}",${d.orders},${d.cost.toFixed(2)}\n`;
        });
        csvContent += "\n";

        csvContent += "FULFILLMENT STORES (STOCK)\n";
        csvContent += "Store Name,Total Orders,Total Cost ($)\n";
        shippingStats.stores.forEach(s => {
            csvContent += `"${s.name}",${s.orders},${s.cost.toFixed(2)}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Shipping_Report_${storeFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- New Tab Print/Export Handler ---
    const handleOpenPrintView = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("Please allow popups to view the report.");
            return;
        }

        const periodText = dateFilter === 'custom' ? `${startDate} to ${endDate}` : dateFilter.toUpperCase();
        
        // Helper to generate rows HTML
        const generateRows = (data: any[], type: string) => {
            return data.map((item, idx) => `
                <tr class="border-b border-gray-200 hover:bg-gray-50">
                    <td class="py-3 px-4 text-sm text-gray-700 font-bold">${idx + 1}</td>
                    <td class="py-3 px-4 text-sm font-bold text-gray-800">${item.name}</td>
                    <td class="py-3 px-4 text-center text-sm font-mono font-bold text-blue-600">${item.orders}</td>
                    <td class="py-3 px-4 text-right text-sm font-mono font-bold text-gray-800">$${item.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
            `).join('');
        };

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="km">
            <head>
                <meta charset="UTF-8">
                <title>Shipping Report - ${storeFilter}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Kantumruy Pro', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    @media print { 
                        .no-print { display: none !important; } 
                        body { background: white; }
                        .page-break { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body class="bg-gray-100 min-h-screen py-10 print:py-0">
                
                <!-- Action Bar (Hidden on Print) -->
                <div class="no-print fixed top-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg flex justify-between items-center z-50">
                    <div class="font-bold text-lg">Shipping Report Preview</div>
                    <div class="flex gap-3">
                        <button onclick="window.close()" class="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 transition">Close</button>
                        <button onclick="window.print()" class="px-6 py-2 rounded bg-blue-600 hover:bg-blue-500 font-bold transition shadow-lg flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z"></path></svg>
                            Print / Save as PDF
                        </button>
                    </div>
                </div>

                <!-- Report Container (A4 Style) -->
                <div class="max-w-[210mm] mx-auto bg-white p-10 shadow-2xl print:shadow-none print:w-full mt-10 print:mt-0 mb-10">
                    
                    <!-- Header -->
                    <div class="flex justify-between items-start border-b-2 border-black pb-6 mb-8">
                        <div>
                            <h1 class="text-3xl font-black text-gray-900 uppercase tracking-tight">របាយការណ៍ដឹកជញ្ជូន</h1>
                            <p class="text-sm text-gray-500 font-bold mt-1 uppercase tracking-widest">Shipping & Fulfillment Cost</p>
                        </div>
                        <div class="text-right">
                            <p class="text-xs font-bold text-gray-500 uppercase">Period</p>
                            <p class="text-sm font-black text-gray-900">${periodText}</p>
                            <p class="text-xs font-bold text-gray-500 uppercase mt-2">Filter Store</p>
                            <p class="text-sm font-black text-blue-600">${storeFilter}</p>
                        </div>
                    </div>

                    <!-- Summary Cards -->
                    <div class="grid grid-cols-3 gap-6 mb-10">
                        <div class="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                            <p class="text-xs font-black text-red-400 uppercase tracking-widest mb-1">Total Internal Cost</p>
                            <p class="text-2xl font-black text-gray-800">$${shippingStats.totalInternalCost.toLocaleString()}</p>
                        </div>
                        <div class="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                            <p class="text-xs font-black text-green-500 uppercase tracking-widest mb-1">Customer Fees</p>
                            <p class="text-2xl font-black text-gray-800">$${shippingStats.totalCustomerFee.toLocaleString()}</p>
                        </div>
                        <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                            <p class="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Total Orders</p>
                            <p class="text-2xl font-black text-gray-800">${shippingStats.totalOrders}</p>
                        </div>
                    </div>

                    <!-- Table 1: Companies -->
                    <div class="mb-10 page-break">
                        <h2 class="text-lg font-black text-blue-800 border-l-4 border-blue-600 pl-3 mb-4 uppercase">1. ក្រុមហ៊ុនដឹកជញ្ជូន (Companies)</h2>
                        <table class="w-full border-collapse">
                            <thead>
                                <tr class="bg-blue-600 text-white">
                                    <th class="py-2 px-4 text-left text-xs font-black uppercase w-12">#</th>
                                    <th class="py-2 px-4 text-left text-xs font-black uppercase">Company Name</th>
                                    <th class="py-2 px-4 text-center text-xs font-black uppercase w-24">Orders</th>
                                    <th class="py-2 px-4 text-right text-xs font-black uppercase w-32">Cost ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateRows(shippingStats.methods, 'company')}
                            </tbody>
                            <tfoot class="bg-gray-100 font-black">
                                <tr>
                                    <td colspan="2" class="py-3 px-4 text-right uppercase text-xs tracking-widest text-gray-500">Total</td>
                                    <td class="py-3 px-4 text-center text-blue-600">${shippingStats.methods.reduce((s,i)=>s+i.orders,0)}</td>
                                    <td class="py-3 px-4 text-right text-gray-900">$${shippingStats.methods.reduce((s,i)=>s+i.cost,0).toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <!-- Table 2: Drivers -->
                    <div class="mb-10 page-break">
                        <h2 class="text-lg font-black text-emerald-700 border-l-4 border-emerald-600 pl-3 mb-4 uppercase">2. អ្នកដឹក (Drivers)</h2>
                        <table class="w-full border-collapse">
                            <thead>
                                <tr class="bg-emerald-600 text-white">
                                    <th class="py-2 px-4 text-left text-xs font-black uppercase w-12">#</th>
                                    <th class="py-2 px-4 text-left text-xs font-black uppercase">Driver Name</th>
                                    <th class="py-2 px-4 text-center text-xs font-black uppercase w-24">Orders</th>
                                    <th class="py-2 px-4 text-right text-xs font-black uppercase w-32">Cost ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateRows(shippingStats.drivers, 'driver')}
                            </tbody>
                            <tfoot class="bg-gray-100 font-black">
                                <tr>
                                    <td colspan="2" class="py-3 px-4 text-right uppercase text-xs tracking-widest text-gray-500">Total</td>
                                    <td class="py-3 px-4 text-center text-blue-600">${shippingStats.drivers.reduce((s,i)=>s+i.orders,0)}</td>
                                    <td class="py-3 px-4 text-right text-gray-900">$${shippingStats.drivers.reduce((s,i)=>s+i.cost,0).toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <!-- Table 3: Stores -->
                    <div class="page-break">
                        <h2 class="text-lg font-black text-orange-700 border-l-4 border-orange-500 pl-3 mb-4 uppercase">3. ឃ្លាំង (Fulfillment Stores)</h2>
                        <table class="w-full border-collapse">
                            <thead>
                                <tr class="bg-orange-500 text-white">
                                    <th class="py-2 px-4 text-left text-xs font-black uppercase w-12">#</th>
                                    <th class="py-2 px-4 text-left text-xs font-black uppercase">Store Name</th>
                                    <th class="py-2 px-4 text-center text-xs font-black uppercase w-24">Orders</th>
                                    <th class="py-2 px-4 text-right text-xs font-black uppercase w-32">Cost ($)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateRows(shippingStats.stores, 'store')}
                            </tbody>
                            <tfoot class="bg-gray-100 font-black">
                                <tr>
                                    <td colspan="2" class="py-3 px-4 text-right uppercase text-xs tracking-widest text-gray-500">Total</td>
                                    <td class="py-3 px-4 text-center text-blue-600">${shippingStats.stores.reduce((s,i)=>s+i.orders,0)}</td>
                                    <td class="py-3 px-4 text-right text-gray-900">$${shippingStats.stores.reduce((s,i)=>s+i.cost,0).toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div class="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
                        Generated by O-System on ${new Date().toLocaleString('km-KH')}
                    </div>

                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12 select-none">
            
            {/* Header Actions */}
            <div className={`flex flex-col gap-4 ${styles.headerBg} p-5 rounded-md border backdrop-blur-md`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <button onClick={onBack} className={`p-3 rounded-md border ${styles.buttonSecondary} transition-all active:scale-95`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                            </button>
                        )}
                        <div>
                            <h2 className={`text-xl font-black ${styles.primaryText} uppercase tracking-tight`}>របាយការណ៍ដឹកជញ្ជូន</h2>
                            <p className={`text-[10px] ${styles.secondaryText} font-bold mt-1 uppercase tracking-widest`}>Shipping & Fulfillment Cost Analysis</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        {(['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'all'] as const).map(preset => (
                            <button
                                key={preset}
                                onClick={() => setDateFilter(preset)}
                                className={`px-4 py-2 text-[9px] font-black uppercase rounded-md transition-all ${dateFilter === preset ? styles.buttonAccent + ' shadow-lg' : styles.buttonSecondary}`}
                            >
                                {preset.replace('_', ' ')}
                            </button>
                        ))}
                        <button
                            onClick={() => setDateFilter('custom')}
                            className={`px-4 py-2 text-[9px] font-black uppercase rounded-md transition-all ${dateFilter === 'custom' ? styles.buttonAccent + ' shadow-lg' : styles.buttonSecondary}`}
                        >
                            Custom
                        </button>
                    </div>
                </div>

                {dateFilter === 'custom' && (
                    <div className={`flex items-center gap-3 ${styles.innerBg} p-3 rounded-md border ${styles.tableBorder} animate-fade-in-down`}>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className={`${styles.innerBg} border ${styles.tableBorder} rounded-md px-4 py-2 ${styles.primaryText} text-xs font-bold focus:ring-2 focus:ring-${uiTheme === 'binance' ? '[#FCD535]' : 'blue-500'}`} 
                        />
                        <span className={`${styles.secondaryText} font-black text-xs uppercase tracking-widest`}>to</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className={`${styles.innerBg} border ${styles.tableBorder} rounded-md px-4 py-2 ${styles.primaryText} text-xs font-bold focus:ring-2 focus:ring-${uiTheme === 'binance' ? '[#FCD535]' : 'blue-500'}`} 
                        />
                    </div>
                )}

                <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t ${styles.tableBorder}`}>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className={`p-1 rounded-md border ${styles.tableBorder} flex items-center w-full sm:w-auto ${styles.innerBg}`}>
                            <span className={`text-[9px] font-bold ${styles.secondaryText} uppercase px-3 whitespace-nowrap`}>Store:</span>
                            <select 
                                value={storeFilter} 
                                onChange={(e) => setStoreFilter(e.target.value)}
                                className={`bg-transparent border-none text-[11px] font-black ${styles.primaryText} focus:ring-0 cursor-pointer py-1.5 pr-8 pl-1 w-full uppercase`}
                            >
                                <option value="All" className={styles.innerBg}>All Stores</option>
                                {appData.stores?.map(s => (
                                    <option key={s.StoreName} value={s.StoreName} className={styles.innerBg}>{s.StoreName}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                            onClick={handleExportExcel}
                            className={`flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-md font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 ${uiTheme === 'binance' ? 'bg-[#0ECB81] text-[#1E2329] hover:bg-[#0bb371]' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Excel
                        </button>
                        <button 
                            onClick={handleOpenPrintView}
                            className={`flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-md font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 ${uiTheme === 'binance' ? 'bg-[#F6465D] text-white hover:bg-[#e03f54]' : 'bg-red-600 text-white hover:bg-red-700'}`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            Print
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="ចំណាយដឹកជញ្ជូនសរុប" value={`$${shippingStats.totalInternalCost.toLocaleString()}`} icon="🚚" colorClass={uiTheme === 'binance' ? "from-[#F6465D] to-[#e03f54]" : "from-orange-600 to-red-500"} />
                <StatCard label="ថ្លៃដឹកពីអតិថិជន" value={`$${shippingStats.totalCustomerFee.toLocaleString()}`} icon="💰" colorClass={uiTheme === 'binance' ? "from-[#FCD535] to-[#f0c51d] !text-[#1E2329]" : "from-blue-600 to-indigo-500"} />
                <StatCard label="តុល្យភាព (Net)" value={`$${shippingStats.netShipping.toLocaleString()}`} icon="⚖️" colorClass={shippingStats.netShipping >= 0 ? (uiTheme === 'binance' ? "from-[#0ECB81] to-[#0bb371]" : "from-emerald-600 to-teal-500") : (uiTheme === 'binance' ? "from-[#F6465D] to-[#e03f54]" : "from-red-600 to-pink-500")} />
                <StatCard label="ចំនួនកញ្ចប់សរុប" value={shippingStats.totalOrders} icon="📦" colorClass={uiTheme === 'binance' ? "from-[#2B3139] to-[#1E2329]" : "from-purple-600 to-blue-500"} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                    {/* Table 1: Methods (Shipping Companies) */}
                    <div className={`page-card !p-6 ${styles.cardBg} rounded-md border`}>
                        <h3 className={`text-[11px] font-black ${styles.primaryText} uppercase tracking-widest mb-6 flex items-center gap-2`}>
                            <div className={`w-1 h-4 ${styles.accent === '#FCD535' ? 'bg-[#FCD535]' : 'bg-blue-500'} rounded-full`}></div>
                            សង្ខេបតាមក្រុមហ៊ុនដឹកជញ្ជូន
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className={`text-[9px] ${styles.secondaryText} font-black uppercase tracking-widest border-b ${styles.tableBorder}`}>
                                    <tr><th className="px-4 py-3">ក្រុមហ៊ុន</th><th className="px-4 py-3 text-center">ចំនួន Orders</th><th className="px-4 py-3 text-right">ទឹកប្រាក់បង់ ($)</th></tr>
                                </thead>
                                <tbody className={`divide-y ${styles.tableBorder}`}>
                                    {shippingStats.methods.map((m, i) => (
                                        <tr key={i} className={styles.tableRowHover}>
                                            <td className={`px-4 py-3 font-bold ${styles.primaryText} flex items-center gap-3`}>
                                                <img src={convertGoogleDriveUrl(m.logo)} className={`w-8 h-8 rounded-md object-contain ${styles.innerBg} p-1 border ${styles.tableBorder}`} alt="" />
                                                <span className="text-[11px] uppercase tracking-wider">{m.name}</span>
                                            </td>
                                            <td 
                                                className={`px-4 py-3 text-center font-black ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-400'} cursor-pointer hover:underline transition-colors tabular-nums`}
                                                onClick={() => handleFilterNavigation('shippingFilter', m.name)}
                                            >
                                                {m.orders}
                                            </td>
                                            <td 
                                                className={`px-4 py-3 text-right font-black ${styles.primaryText} cursor-pointer hover:underline transition-colors tabular-nums`}
                                                onClick={() => handleFilterNavigation('shippingFilter', m.name)}
                                            >
                                                ${m.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className={`${styles.innerBg} border-t-2 ${styles.tableBorder}`}>
                                    <tr>
                                        <td className={`px-4 py-3 text-right text-[9px] font-black uppercase ${styles.secondaryText} tracking-widest`}>Aggregate Cost</td>
                                        <td className={`px-4 py-3 text-center font-black ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-300'} text-base tabular-nums`}>
                                            {shippingStats.methods.reduce((sum, m) => sum + m.orders, 0)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-black ${uiTheme === 'binance' ? 'text-[#0ECB81]' : 'text-emerald-400'} text-base tabular-nums`}>
                                            ${shippingStats.methods.reduce((sum, m) => sum + m.cost, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Table 2: Drivers */}
                    <div className={`page-card !p-6 ${styles.cardBg} rounded-md border`}>
                        <h3 className={`text-[11px] font-black ${styles.primaryText} uppercase tracking-widest mb-6 flex items-center gap-2`}>
                            <div className={`w-1 h-4 ${styles.accent === '#FCD535' ? 'bg-[#FCD535]' : 'bg-emerald-500'} rounded-full`}></div>
                            សង្ខេបតាមអ្នកដឹក (Drivers)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className={`text-[9px] ${styles.secondaryText} font-black uppercase tracking-widest border-b ${styles.tableBorder}`}>
                                    <tr><th className="px-4 py-3">អ្នកដឹក</th><th className="px-4 py-3 text-center">ចំនួន Orders</th><th className="px-4 py-3 text-right">ទឹកប្រាក់បង់ ($)</th></tr>
                                </thead>
                                <tbody className={`divide-y ${styles.tableBorder}`}>
                                    {shippingStats.drivers.map((d, i) => (
                                        <tr key={i} className={styles.tableRowHover}>
                                            <td className={`px-4 py-3 font-bold ${styles.primaryText} flex items-center gap-3`}>
                                                <img src={convertGoogleDriveUrl(d.photo)} className={`w-8 h-8 rounded-full object-cover ${styles.innerBg} border ${styles.tableBorder}`} alt="" />
                                                <span className="text-[11px] uppercase tracking-wider">{d.name}</span>
                                            </td>
                                            <td 
                                                className={`px-4 py-3 text-center font-black ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-400'} cursor-pointer hover:underline transition-colors tabular-nums`}
                                                onClick={() => handleFilterNavigation('driverFilter', d.name)}
                                            >
                                                {d.orders}
                                            </td>
                                            <td 
                                                className={`px-4 py-3 text-right font-black ${styles.primaryText} cursor-pointer hover:underline transition-colors tabular-nums`}
                                                onClick={() => handleFilterNavigation('driverFilter', d.name)}
                                            >
                                                ${d.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className={`${styles.innerBg} border-t-2 ${styles.tableBorder}`}>
                                    <tr>
                                        <td className={`px-4 py-3 text-right text-[9px] font-black uppercase ${styles.secondaryText} tracking-widest`}>Aggregate Cost</td>
                                        <td className={`px-4 py-3 text-center font-black ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-300'} text-base tabular-nums`}>
                                            {shippingStats.drivers.reduce((sum, d) => sum + d.orders, 0)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-black ${uiTheme === 'binance' ? 'text-[#0ECB81]' : 'text-emerald-400'} text-base tabular-nums`}>
                                            ${shippingStats.drivers.reduce((sum, d) => sum + d.cost, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Table 3: Fulfillment Stores (Stock) */}
                    <div className={`page-card !p-6 ${styles.cardBg} rounded-md border`}>
                        <h3 className={`text-[11px] font-black ${styles.primaryText} uppercase tracking-widest mb-6 flex items-center gap-2`}>
                            <div className={`w-1 h-4 ${styles.accent === '#FCD535' ? 'bg-[#FCD535]' : 'bg-orange-500'} rounded-full`}></div>
                            សង្ខេបតាម Fulfillment Store (Stock)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className={`text-[9px] ${styles.secondaryText} font-black uppercase tracking-widest border-b ${styles.tableBorder}`}>
                                    <tr>
                                        <th className="px-4 py-3">ឈ្មោះឃ្លាំង (Store)</th>
                                        <th className="px-4 py-3 text-center">ចំនួន Orders</th>
                                        <th className="px-4 py-3 text-right">ទឹកប្រាក់បង់ ($)</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${styles.tableBorder}`}>
                                    {shippingStats.stores.map((s, i) => (
                                        <tr key={i} className={styles.tableRowHover}>
                                            <td className={`px-4 py-3 font-bold ${styles.primaryText} flex items-center gap-3`}>
                                                <span className={`w-8 h-8 rounded-md ${styles.innerBg} ${styles.secondaryText} flex items-center justify-center text-[9px] font-black border ${styles.tableBorder}`}>#{i + 1}</span>
                                                <span className="text-[11px] uppercase tracking-wider">{s.name}</span>
                                            </td>
                                            <td 
                                                className={`px-4 py-3 text-center font-black ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-400'} cursor-pointer hover:underline transition-colors tabular-nums`}
                                                onClick={() => handleFilterNavigation('fulfillmentStore', s.name)}
                                            >
                                                {s.orders}
                                            </td>
                                            <td 
                                                className={`px-4 py-3 text-right font-black ${styles.primaryText} cursor-pointer hover:underline transition-colors tabular-nums`}
                                                onClick={() => handleFilterNavigation('fulfillmentStore', s.name)}
                                            >
                                                ${s.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className={`${styles.innerBg} border-t-2 ${styles.tableBorder}`}>
                                    <tr>
                                        <td className={`px-4 py-3 text-right text-[9px] font-black uppercase ${styles.secondaryText} tracking-widest`}>Aggregate Cost</td>
                                        <td className={`px-4 py-3 text-center font-black ${uiTheme === 'binance' ? 'text-[#FCD535]' : 'text-blue-300'} text-base tabular-nums`}>
                                            {shippingStats.stores.reduce((sum, s) => sum + s.orders, 0)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-black ${uiTheme === 'binance' ? 'text-[#0ECB81]' : 'text-emerald-400'} text-base tabular-nums`}>
                                            ${shippingStats.stores.reduce((sum, s) => sum + s.cost, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4">
                    <div className={`page-card !p-6 ${styles.cardBg} rounded-md border h-full flex flex-col shadow-2xl relative overflow-hidden group`}>
                        <div className="flex justify-between items-center mb-8 relative z-10">
                            <div><h3 className={`text-[11px] font-black ${styles.primaryText} uppercase tracking-widest`}>ការវិភាគដោយ AI</h3></div>
                            <GeminiButton onClick={handleAnalyze} isLoading={loadingAnalysis} variant={uiTheme === 'binance' ? 'primary' : 'default'}>Compute</GeminiButton>
                        </div>
                        <div className={`flex-grow ${styles.innerBg} rounded-xl p-6 border ${styles.tableBorder} overflow-y-auto custom-scrollbar min-h-[300px] relative z-10 shadow-inner`}>
                            {analysis ? (<div className={`text-[11px] ${styles.secondaryText} font-bold leading-relaxed uppercase tracking-wide`}>{analysis}</div>) : (
                                <div className="flex flex-col items-center justify-center h-full opacity-20 text-center"><p className="text-[9px] font-black uppercase tracking-[0.2em]">Idle - Ready for Input</p></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShippingReport;