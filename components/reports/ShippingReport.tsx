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
    const { advancedSettings, language } = useContext(AppContext);
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

    // Cost per order average
    const avgCostPerOrder = shippingStats.totalOrders > 0 ? shippingStats.totalInternalCost / shippingStats.totalOrders : 0;
    const avgFeePerOrder = shippingStats.totalOrders > 0 ? shippingStats.totalCustomerFee / shippingStats.totalOrders : 0;
    const profitMargin = shippingStats.totalInternalCost > 0 ? (shippingStats.netShipping / shippingStats.totalCustomerFee) * 100 : 0;

    return (
        <div className="space-y-6 animate-fade-in pb-12 select-none">
            
            {/* Header Section */}
            <div className={`${styles.headerBg} border backdrop-blur-md`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}>
                {/* Title Row */}
                <div className="flex justify-between items-center px-5 pt-5 pb-4">
                    <div className="flex items-center gap-3">
                        {onBack && (
                            <button onClick={onBack} className={`p-2 transition-all active:scale-95 ${styles.buttonSecondary}`} style={uiTheme === 'binance' ? { borderRadius: '4px', border: 'none', background: 'transparent' } : { border: 'none' }}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full" style={{ backgroundColor: styles.accent }}></div>
                            <div>
                                <h2 className={`text-base font-black ${styles.primaryText} uppercase tracking-tight`}>របាយការណ៍ដឹកជញ្ជូន</h2>
                                <p className={`text-[9px] ${styles.secondaryText} font-bold uppercase tracking-widest`}>Shipping & Fulfillment Cost Analysis</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Store Filter */}
                        <div className={`flex items-center border ${styles.tableBorder} ${styles.innerBg}`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}>
                            <span className={`text-[9px] font-bold ${styles.secondaryText} uppercase px-3 whitespace-nowrap`}>Store</span>
                            <select 
                                value={storeFilter} 
                                onChange={(e) => setStoreFilter(e.target.value)}
                                className={`bg-transparent border-none text-[10px] font-bold ${styles.primaryText} focus:ring-0 cursor-pointer py-2 pr-6 pl-1 uppercase`}
                            >
                                <option value="All" className={styles.innerBg}>All</option>
                                {appData.stores?.map(s => (
                                    <option key={s.StoreName} value={s.StoreName} className={styles.innerBg}>{s.StoreName}</option>
                                ))}
                            </select>
                        </div>

                        {/* Export Excel */}
                        <button 
                            onClick={handleExportExcel}
                            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${uiTheme === 'binance' ? 'bg-[#0ECB81] text-[#1E2329] hover:bg-[#0bb371]' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                            style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Excel
                        </button>

                        {/* Print */}
                        <button 
                            onClick={handleOpenPrintView}
                            className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${uiTheme === 'binance' ? 'bg-[#F6465D] text-white hover:bg-[#e03f54]' : 'bg-red-600 text-white hover:bg-red-700'}`}
                            style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                            Print
                        </button>
                    </div>
                </div>

                {/* Date Filter Tabs */}
                <div className={`flex items-center justify-between px-5 pb-0 border-b ${styles.tableBorder}`}>
                    <div className="flex items-center">
                        {(['today', 'yesterday', 'this_week', 'this_month', 'last_month', 'all'] as const).map(preset => (
                            <button
                                key={preset}
                                onClick={() => setDateFilter(preset)}
                                className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                                    dateFilter === preset 
                                    ? `${styles.primaryText} border-[${styles.accent}]` 
                                    : `${styles.secondaryText} border-transparent hover:${styles.primaryText}`
                                }`}
                                style={dateFilter === preset ? { borderBottomColor: styles.accent } : { borderBottomColor: 'transparent' }}
                            >
                                {preset.replace('_', ' ')}
                            </button>
                        ))}
                        <button
                            onClick={() => setDateFilter('custom')}
                            className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                                dateFilter === 'custom' 
                                ? `${styles.primaryText} border-[${styles.accent}]` 
                                : `${styles.secondaryText} border-transparent hover:${styles.primaryText}`
                            }`}
                            style={dateFilter === 'custom' ? { borderBottomColor: styles.accent } : { borderBottomColor: 'transparent' }}
                        >
                            Custom
                        </button>
                    </div>

                    {/* Period indicator */}
                    <div className={`text-[9px] font-bold ${styles.secondaryText} uppercase tracking-wider pb-2`}>
                        {dateFilter === 'custom' ? `${startDate} → ${endDate}` : dateFilter.replace('_', ' ')}
                    </div>
                </div>

                {/* Custom Date Range */}
                {dateFilter === 'custom' && (
                    <div className={`flex items-center gap-3 mx-5 mt-3 mb-1 ${styles.innerBg} p-3 border ${styles.tableBorder} animate-fade-in-down`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}>
                        <input 
                            type="date" 
                            value={startDate} 
                            onChange={e => setStartDate(e.target.value)} 
                            className={`${styles.innerBg} border ${styles.tableBorder} px-3 py-1.5 ${styles.primaryText} text-xs font-bold focus:ring-0 focus:border-[${styles.accent}] outline-none`}
                            style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}
                        />
                        <span className={`${styles.secondaryText} font-bold text-xs uppercase`}>to</span>
                        <input 
                            type="date" 
                            value={endDate} 
                            onChange={e => setEndDate(e.target.value)} 
                            className={`${styles.innerBg} border ${styles.tableBorder} px-3 py-1.5 ${styles.primaryText} text-xs font-bold focus:ring-0 focus:border-[${styles.accent}] outline-none`}
                            style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}
                        />
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { 
                        label: language === 'km' ? 'ចំណាយដឹកជញ្ជូន' : 'Shipping Cost', 
                        sublabel: language === 'km' ? 'សរុបផ្ទៃក្នុង' : 'Internal Total',
                        value: `$${shippingStats.totalInternalCost.toLocaleString()}`,
                        subvalue: `$${avgCostPerOrder.toFixed(2)}/order`,
                        color: uiTheme === 'binance' ? '#F6465D' : '#f97316',
                        icon: '🚚'
                    },
                    { 
                        label: language === 'km' ? 'ថ្លៃដឹកពីអតិថិជន' : 'Customer Fees', 
                        sublabel: language === 'km' ? 'ប្រាក់ចំណូល' : 'Revenue',
                        value: `$${shippingStats.totalCustomerFee.toLocaleString()}`,
                        subvalue: `$${avgFeePerOrder.toFixed(2)}/order`,
                        color: uiTheme === 'binance' ? '#FCD535' : '#3b82f6',
                        icon: '💰'
                    },
                    { 
                        label: language === 'km' ? 'តុល្យភាព' : 'Net Balance', 
                        sublabel: shippingStats.netShipping >= 0 ? (language === 'km' ? 'ចំណេញ' : 'Profit') : (language === 'km' ? 'ខាត' : 'Loss'),
                        value: `$${shippingStats.netShipping.toLocaleString()}`,
                        subvalue: `${profitMargin.toFixed(1)}% margin`,
                        color: shippingStats.netShipping >= 0 ? (uiTheme === 'binance' ? '#0ECB81' : '#10b981') : (uiTheme === 'binance' ? '#F6465D' : '#ef4444'),
                        icon: '⚖️'
                    },
                    { 
                        label: language === 'km' ? 'កញ្ចប់សរុប' : 'Total Packages', 
                        sublabel: language === 'km' ? 'ចំនួន' : 'Count',
                        value: shippingStats.totalOrders.toLocaleString(),
                        subvalue: `${shippingStats.methods.length} carriers`,
                        color: uiTheme === 'binance' ? '#F0B90B' : '#8b5cf6',
                        icon: '📦'
                    }
                ].map((card, i) => (
                    <div key={i} className={`${styles.cardBg} border p-4`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}>
                        <div className="flex items-start justify-between mb-3">
                            <span className="text-xl">{card.icon}</span>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color, opacity: 0.6 }}></div>
                        </div>
                        <div className={`text-[9px] font-bold ${styles.secondaryText} uppercase tracking-wider mb-1`}>{card.label}</div>
                        <div className={`text-xl font-black ${styles.primaryText} tabular-nums mb-1`}>{card.value}</div>
                        <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-bold ${styles.secondaryText}`}>{card.sublabel}</span>
                            <span className={`text-[9px] font-bold tabular-nums`} style={{ color: card.color }}>{card.subvalue}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-8 space-y-4">
                    {/* Table 1: Methods (Shipping Companies) */}
                    <div className={`${styles.cardBg} border p-5`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}>
                        <h3 className={`text-[10px] font-black ${styles.primaryText} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: styles.accent }}></div>
                            {language === 'km' ? 'សង្ខេបតាមក្រុមហ៊ុនដឹកជញ្ជូន' : 'By Shipping Carrier'}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className={`text-[9px] ${styles.secondaryText} font-bold uppercase tracking-wider border-b ${styles.tableBorder}`}>
                                    <tr>
                                        <th className="px-3 py-2.5">{language === 'km' ? 'ក្រុមហ៊ុន' : 'Carrier'}</th>
                                        <th className="px-3 py-2.5 text-center">{language === 'km' ? 'ចំនួន' : 'Orders'}</th>
                                        <th className="px-3 py-2.5 text-right">{language === 'km' ? 'ទឹកប្រាក់' : 'Cost ($)'}</th>
                                        <th className="px-3 py-2.5 w-32">{language === 'km' ? 'សមាមាត្រ' : 'Distribution'}</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${styles.tableBorder}`}>
                                    {shippingStats.methods.map((m, i) => {
                                        const pct = shippingStats.totalInternalCost > 0 ? (m.cost / shippingStats.totalInternalCost) * 100 : 0;
                                        return (
                                            <tr key={i} className={`${styles.tableRowHover} transition-colors`}>
                                                <td className={`px-3 py-2.5 font-bold ${styles.primaryText} flex items-center gap-2.5`}>
                                                    <img src={convertGoogleDriveUrl(m.logo)} className={`w-7 h-7 object-contain ${styles.innerBg} p-0.5 border ${styles.tableBorder}`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined} alt="" />
                                                    <span className="text-[10px] uppercase tracking-wider">{m.name}</span>
                                                </td>
                                                <td 
                                                    className={`px-3 py-2.5 text-center font-black text-[${styles.accent}] cursor-pointer hover:underline transition-colors tabular-nums text-xs`}
                                                    style={{ color: styles.accent }}
                                                    onClick={() => handleFilterNavigation('shippingFilter', m.name)}
                                                >
                                                    {m.orders}
                                                </td>
                                                <td 
                                                    className={`px-3 py-2.5 text-right font-black ${styles.primaryText} cursor-pointer hover:underline transition-colors tabular-nums text-xs`}
                                                    onClick={() => handleFilterNavigation('shippingFilter', m.name)}
                                                >
                                                    ${m.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 ${styles.innerBg}" style={{ backgroundColor: uiTheme === 'binance' ? '#2B3139' : 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                                                            <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: styles.accent, borderRadius: '2px' }}></div>
                                                        </div>
                                                        <span className={`text-[9px] font-bold ${styles.secondaryText} tabular-nums w-10 text-right`}>{pct.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className={`${styles.innerBg} border-t ${styles.tableBorder}`}>
                                    <tr>
                                        <td className={`px-3 py-2 text-right text-[9px] font-bold uppercase ${styles.secondaryText} tracking-wider`}>{language === 'km' ? 'សរុប' : 'Total'}</td>
                                        <td className={`px-3 py-2 text-center font-black text-xs tabular-nums`} style={{ color: styles.accent }}>
                                            {shippingStats.methods.reduce((sum, m) => sum + m.orders, 0)}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-black text-sm tabular-nums`} style={{ color: uiTheme === 'binance' ? '#0ECB81' : '#10b981' }}>
                                            ${shippingStats.methods.reduce((sum, m) => sum + m.cost, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Table 2: Drivers */}
                    <div className={`${styles.cardBg} border p-5`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}>
                        <h3 className={`text-[10px] font-black ${styles.primaryText} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: uiTheme === 'binance' ? '#0ECB81' : '#10b981' }}></div>
                            {language === 'km' ? 'សង្ខេបតាមអ្នកដឹក' : 'By Driver'}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className={`text-[9px] ${styles.secondaryText} font-bold uppercase tracking-wider border-b ${styles.tableBorder}`}>
                                    <tr>
                                        <th className="px-3 py-2.5">{language === 'km' ? 'អ្នកដឹក' : 'Driver'}</th>
                                        <th className="px-3 py-2.5 text-center">{language === 'km' ? 'ចំនួន' : 'Orders'}</th>
                                        <th className="px-3 py-2.5 text-right">{language === 'km' ? 'ទឹកប្រាក់' : 'Cost ($)'}</th>
                                        <th className="px-3 py-2.5 w-32">{language === 'km' ? 'សមាមាត្រ' : 'Distribution'}</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${styles.tableBorder}`}>
                                    {shippingStats.drivers.map((d, i) => {
                                        const pct = shippingStats.totalInternalCost > 0 ? (d.cost / shippingStats.totalInternalCost) * 100 : 0;
                                        const driverColor = uiTheme === 'binance' ? '#0ECB81' : '#10b981';
                                        return (
                                            <tr key={i} className={`${styles.tableRowHover} transition-colors`}>
                                                <td className={`px-3 py-2.5 font-bold ${styles.primaryText} flex items-center gap-2.5`}>
                                                    <img src={convertGoogleDriveUrl(d.photo)} className={`w-7 h-7 object-cover border ${styles.tableBorder}`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : { borderRadius: '50%' }} alt="" />
                                                    <span className="text-[10px] uppercase tracking-wider">{d.name}</span>
                                                </td>
                                                <td 
                                                    className={`px-3 py-2.5 text-center font-black cursor-pointer hover:underline transition-colors tabular-nums text-xs`}
                                                    style={{ color: driverColor }}
                                                    onClick={() => handleFilterNavigation('driverFilter', d.name)}
                                                >
                                                    {d.orders}
                                                </td>
                                                <td 
                                                    className={`px-3 py-2.5 text-right font-black ${styles.primaryText} cursor-pointer hover:underline transition-colors tabular-nums text-xs`}
                                                    onClick={() => handleFilterNavigation('driverFilter', d.name)}
                                                >
                                                    ${d.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5" style={{ backgroundColor: uiTheme === 'binance' ? '#2B3139' : 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                                                            <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: driverColor, borderRadius: '2px' }}></div>
                                                        </div>
                                                        <span className={`text-[9px] font-bold ${styles.secondaryText} tabular-nums w-10 text-right`}>{pct.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className={`${styles.innerBg} border-t ${styles.tableBorder}`}>
                                    <tr>
                                        <td className={`px-3 py-2 text-right text-[9px] font-bold uppercase ${styles.secondaryText} tracking-wider`}>{language === 'km' ? 'សរុប' : 'Total'}</td>
                                        <td className={`px-3 py-2 text-center font-black text-xs tabular-nums`} style={{ color: uiTheme === 'binance' ? '#0ECB81' : '#10b981' }}>
                                            {shippingStats.drivers.reduce((sum, d) => sum + d.orders, 0)}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-black text-sm tabular-nums`} style={{ color: uiTheme === 'binance' ? '#0ECB81' : '#10b981' }}>
                                            ${shippingStats.drivers.reduce((sum, d) => sum + d.cost, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Table 3: Fulfillment Stores (Stock) */}
                    <div className={`${styles.cardBg} border p-5`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}>
                        <h3 className={`text-[10px] font-black ${styles.primaryText} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: uiTheme === 'binance' ? '#F0B90B' : '#f97316' }}></div>
                            {language === 'km' ? 'សង្ខេបតាមឃ្លាំង' : 'By Fulfillment Store'}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className={`text-[9px] ${styles.secondaryText} font-bold uppercase tracking-wider border-b ${styles.tableBorder}`}>
                                    <tr>
                                        <th className="px-3 py-2.5">{language === 'km' ? 'ឃ្លាំង' : 'Store'}</th>
                                        <th className="px-3 py-2.5 text-center">{language === 'km' ? 'ចំនួន' : 'Orders'}</th>
                                        <th className="px-3 py-2.5 text-right">{language === 'km' ? 'ទឹកប្រាក់' : 'Cost ($)'}</th>
                                        <th className="px-3 py-2.5 w-32">{language === 'km' ? 'សមាមាត្រ' : 'Distribution'}</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${styles.tableBorder}`}>
                                    {shippingStats.stores.map((s, i) => {
                                        const pct = shippingStats.totalInternalCost > 0 ? (s.cost / shippingStats.totalInternalCost) * 100 : 0;
                                        const storeColor = uiTheme === 'binance' ? '#F0B90B' : '#f97316';
                                        return (
                                            <tr key={i} className={`${styles.tableRowHover} transition-colors`}>
                                                <td className={`px-3 py-2.5 font-bold ${styles.primaryText} flex items-center gap-2.5`}>
                                                    <span className={`w-7 h-7 flex items-center justify-center text-[9px] font-black border ${styles.tableBorder} ${styles.secondaryText}`} style={{ backgroundColor: uiTheme === 'binance' ? '#0B0E11' : 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>#{i + 1}</span>
                                                    <span className="text-[10px] uppercase tracking-wider">{s.name}</span>
                                                </td>
                                                <td 
                                                    className={`px-3 py-2.5 text-center font-black cursor-pointer hover:underline transition-colors tabular-nums text-xs`}
                                                    style={{ color: storeColor }}
                                                    onClick={() => handleFilterNavigation('fulfillmentStore', s.name)}
                                                >
                                                    {s.orders}
                                                </td>
                                                <td 
                                                    className={`px-3 py-2.5 text-right font-black ${styles.primaryText} cursor-pointer hover:underline transition-colors tabular-nums text-xs`}
                                                    onClick={() => handleFilterNavigation('fulfillmentStore', s.name)}
                                                >
                                                    ${s.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5" style={{ backgroundColor: uiTheme === 'binance' ? '#2B3139' : 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                                                            <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: storeColor, borderRadius: '2px' }}></div>
                                                        </div>
                                                        <span className={`text-[9px] font-bold ${styles.secondaryText} tabular-nums w-10 text-right`}>{pct.toFixed(1)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className={`${styles.innerBg} border-t ${styles.tableBorder}`}>
                                    <tr>
                                        <td className={`px-3 py-2 text-right text-[9px] font-bold uppercase ${styles.secondaryText} tracking-wider`}>{language === 'km' ? 'សរុប' : 'Total'}</td>
                                        <td className={`px-3 py-2 text-center font-black text-xs tabular-nums`} style={{ color: uiTheme === 'binance' ? '#F0B90B' : '#f97316' }}>
                                            {shippingStats.stores.reduce((sum, s) => sum + s.orders, 0)}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-black text-sm tabular-nums`} style={{ color: uiTheme === 'binance' ? '#0ECB81' : '#10b981' }}>
                                            ${shippingStats.stores.reduce((sum, s) => sum + s.cost, 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                {/* AI Analysis Sidebar */}
                <div className="lg:col-span-4">
                    <div className={`${styles.cardBg} border p-5 h-full flex flex-col relative overflow-hidden`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : undefined}>
                        <div className="flex justify-between items-center mb-4 relative z-10">
                            <h3 className={`text-[10px] font-black ${styles.primaryText} uppercase tracking-widest`}>{language === 'km' ? 'ការវិភាគដោយ AI' : 'AI Analysis'}</h3>
                            <GeminiButton onClick={handleAnalyze} isLoading={loadingAnalysis} variant={uiTheme === 'binance' ? 'primary' : 'default'}>Compute</GeminiButton>
                        </div>
                        <div className={`flex-grow ${styles.innerBg} p-4 border ${styles.tableBorder} overflow-y-auto custom-scrollbar min-h-[300px] relative z-10`} style={uiTheme === 'binance' ? { borderRadius: '4px' } : { borderRadius: '12px' }}>
                            {analysis ? (
                                <div className={`text-[10px] ${styles.secondaryText} font-bold leading-relaxed`}>{analysis}</div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full opacity-30 text-center">
                                    <div className="text-2xl mb-3">📊</div>
                                    <p className={`text-[9px] font-bold uppercase tracking-wider ${styles.secondaryText}`}>{language === 'km' ? 'ចុច Compute ដើម្វីវិភាគ' : 'Click Compute to Analyze'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShippingReport;