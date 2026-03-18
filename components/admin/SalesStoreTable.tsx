
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
        if (uiTheme === 'netflix') return 'text-[#e50914]';
        return 'text-indigo-400';
    };

    const getCardBg = () => {
        if (uiTheme === 'netflix') return isLightMode ? 'bg-white' : 'bg-[#181818]';
        return isLightMode ? 'bg-white shadow-md border-gray-100' : 'bg-gray-800/40 backdrop-blur-sm border-gray-700/50';
    };

    const getHoverBg = () => {
        if (uiTheme === 'netflix') return 'hover:bg-white/5';
        return 'hover:bg-indigo-600/5';
    };

    return (
        <div className="space-y-4">
            <h3 className={`text-lg font-black ${isLightMode ? 'text-gray-800' : 'text-white'} flex items-center px-1 uppercase tracking-tight`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mr-2 ${getAccentColor()}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                ឈ្មោះហាង (Brand)
            </h3>
            <div className={`${getCardBg()} rounded-2xl border transition-all duration-500 overflow-hidden shadow-xl ${uiTheme === 'netflix' ? 'border-white/5' : ''}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className={`text-[10px] ${isLightMode ? 'text-gray-500 bg-gray-50 border-gray-100' : 'text-gray-500 bg-gray-900/50 border-gray-700'} font-black uppercase tracking-[0.2em] border-b sticky top-0 z-10`}>
                            <tr>
                                <th className="px-6 py-4">ឈ្មោះហាង (Brand)</th>
                                <th className="px-6 py-4 text-center">ការកម្មង់</th>
                                <th className="px-6 py-4 text-right">ចំណូល</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isLightMode ? 'divide-gray-100' : 'divide-gray-700/30'}`}>
                            {stats.map((store, idx) => (
                                <tr key={store.name} className={`${getHoverBg()} transition-colors group cursor-pointer`} onClick={() => onStatClick(store.name)}>
                                    <td className={`px-6 py-4 font-bold ${isLightMode ? 'text-gray-700' : 'text-gray-100'} flex items-center gap-3`}>
                                        <span className={`w-6 h-6 rounded-lg ${isLightMode ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-gray-700 text-gray-400 border-gray-600'} flex items-center justify-center text-[10px] border`}>#{idx + 1}</span>
                                        <span className={`${uiTheme === 'netflix' ? 'group-hover:text-[#e50914]' : 'group-hover:text-indigo-500'} transition-colors`}>{store.name}</span>
                                    </td>
                                    <td className={`px-6 py-4 text-center font-black ${uiTheme === 'netflix' ? 'text-white' : 'text-blue-500'}`}>
                                        {store.orders}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-black ${uiTheme === 'netflix' ? 'text-[#e50914]' : 'text-green-500'} transition-colors`}>
                                        ${store.revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {stats.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-gray-500 italic uppercase text-[10px] tracking-widest">មិនទាន់មានទិន្នន័យ</td>
                                </tr>
                            )}
                        </tbody>
                        {stats.length > 0 && (
                            <tfoot className={`${isLightMode ? 'bg-gray-50 border-gray-100' : 'bg-gray-900/80 border-gray-700'} font-black border-t-2`}>
                                <tr>
                                    <td className="px-6 py-4 uppercase tracking-widest text-gray-500 text-[10px]">សរុបរួម</td>
                                    <td className={`px-6 py-4 text-center text-base whitespace-nowrap tabular-nums ${uiTheme === 'netflix' ? 'text-white' : 'text-blue-500'}`}>{grandTotals.orders}</td>
                                    <td className={`px-6 py-4 text-right text-base whitespace-nowrap tabular-nums ${uiTheme === 'netflix' ? 'text-[#e50914]' : 'text-green-600'}`}>
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
