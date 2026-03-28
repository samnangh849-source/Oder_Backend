
import React, { useMemo, useContext } from 'react';
import { AppContext } from '../../context/AppContext';

interface StoreStat {
    name: string;
    revenue: number;
    orders: number;
}

interface SalesStoreTableProps {
    stats: StoreStat[];
    onStatClick: (storeName: string) => void;
}

const SalesStoreTable: React.FC<SalesStoreTableProps> = ({ stats, onStatClick }) => {
    const { advancedSettings } = useContext(AppContext);
    const isLightMode = advancedSettings?.themeMode === 'light';
    const uiTheme = advancedSettings?.uiTheme || 'default';

    const grandTotals = useMemo(() => {
        return stats.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            orders: acc.orders + curr.orders
        }), { revenue: 0, orders: 0 });
    }, [stats]);

    const getAccentColor = () => {
        if (uiTheme === 'binance') return 'text-[#FCD535]';
        if (uiTheme === 'netflix') return 'text-[#e50914]';
        return 'text-indigo-400';
    };

    const getCardBg = () => {
        if (uiTheme === 'binance') return 'bg-[#1E2329] border-[#2B3139]';
        if (uiTheme === 'netflix') return isLightMode ? 'bg-white' : 'bg-[#181818]';
        return isLightMode ? 'bg-white shadow-md border-gray-100' : 'bg-gray-800/40 backdrop-blur-sm border-gray-700/50';
    };

    const getHoverBg = () => {
        if (uiTheme === 'binance') return 'hover:bg-[#2B3139]/30';
        if (uiTheme === 'netflix') return 'hover:bg-white/5';
        return 'hover:bg-indigo-600/5';
    };

    const isBinance = uiTheme === 'binance';

    return (
        <div className={isBinance ? '' : 'space-y-4'}>
            {!isBinance && (
                <h3 className={`text-lg font-black ${isLightMode ? 'text-gray-800' : 'text-white'} flex items-center px-1 uppercase tracking-tight`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${getAccentColor()}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    ឈ្មោះហាង (Brand)
                </h3>
            )}
            <div className={`${getCardBg()} ${isBinance ? 'rounded-none' : 'rounded-2xl'} border transition-all duration-500 overflow-hidden ${isBinance ? '' : 'shadow-xl'} ${uiTheme === 'netflix' ? 'border-white/5' : ''}`}>
                {isBinance && (
                    <div className="px-4 py-3 border-b border-[#2B3139] bg-[#1E2329]">
                        <span className="text-[11px] text-[#848E9C] uppercase tracking-wider font-semibold">Sales Store</span>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className={`text-[10px] ${isBinance ? 'text-[#848E9C] bg-[#0B0E11] border-[#2B3139]' : isLightMode ? 'text-gray-500 bg-gray-50 border-gray-100' : 'text-gray-500 bg-gray-900/50 border-gray-700'} font-${isBinance ? 'semibold' : 'black'} uppercase tracking-${isBinance ? 'wider' : '[0.2em]'} border-b sticky top-0 z-10`}>
                            <tr>
                                <th className="px-4 py-3">ឈ្មោះហាង (Brand)</th>
                                <th className="px-4 py-3 text-center">ការកម្មង់</th>
                                <th className="px-4 py-3 text-right">ចំណូល</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isBinance ? 'divide-[#2B3139]/50' : isLightMode ? 'divide-gray-100' : 'divide-gray-700/30'}`}>
                            {stats.map((store, idx) => (
                                <tr key={store.name} className={`${getHoverBg()} transition-colors group cursor-pointer`} onClick={() => onStatClick(store.name)}>
                                    <td className={`px-4 py-3 font-bold ${isBinance ? 'text-[#EAECEF]' : isLightMode ? 'text-gray-700' : 'text-gray-100'} flex items-center gap-3`}>
                                        <span className={`w-5 h-5 ${isBinance ? 'rounded-[2px] bg-[#2B3139] text-[#848E9C] border-[#474D57]' : 'rounded-lg ' + (isLightMode ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-gray-700 text-gray-400 border-gray-600')} flex items-center justify-center text-[9px] border`}>#{idx + 1}</span>
                                        <span className={`${isBinance ? 'group-hover:text-[#FCD535]' : uiTheme === 'netflix' ? 'group-hover:text-[#e50914]' : 'group-hover:text-indigo-500'} transition-colors`}>{store.name}</span>
                                    </td>
                                    <td className={`px-4 py-3 text-center font-bold tabular-nums ${isBinance ? 'text-[#EAECEF]' : uiTheme === 'netflix' ? 'text-white' : 'text-blue-500'}`}>
                                        {store.orders}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${isBinance ? 'text-[#0ECB81]' : uiTheme === 'netflix' ? 'text-[#e50914]' : 'text-green-500'} transition-colors`}>
                                        ${store.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={3} className={`px-4 py-12 text-center ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'} italic uppercase text-[10px] tracking-widest`}>មិនទាន់មានទិន្នន័យ</td>
                                </tr>
                            )}
                        </tbody>
                        {stats.length > 0 && (
                            <tfoot className={`${isBinance ? 'bg-[#0B0E11] border-[#2B3139]' : isLightMode ? 'bg-gray-50 border-gray-100' : 'bg-gray-900/80 border-gray-700'} font-black border-t-2 ${isBinance ? 'border-t-[#FCD535]/20' : ''}`}>
                                <tr>
                                    <td className={`px-4 py-3 uppercase tracking-widest ${isBinance ? 'text-[#848E9C]' : 'text-gray-500'} text-[10px]`}>សរុបរួម</td>
                                    <td className={`px-4 py-3 text-center text-base whitespace-nowrap tabular-nums ${isBinance ? 'text-[#EAECEF]' : uiTheme === 'netflix' ? 'text-white' : 'text-blue-500'}`}>{grandTotals.orders}</td>
                                    <td className={`px-4 py-3 text-right text-base whitespace-nowrap tabular-nums ${isBinance ? 'text-[#0ECB81]' : uiTheme === 'netflix' ? 'text-[#e50914]' : 'text-green-600'}`}>
                                        ${grandTotals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SalesStoreTable;
