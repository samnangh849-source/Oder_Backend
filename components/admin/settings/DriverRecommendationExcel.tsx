
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { AppContext } from '../../../context/AppContext';
import { WEB_APP_URL } from '../../../constants';
import { translations } from '../../../translations';
import Spinner from '../../common/Spinner';
import { CacheService, CACHE_KEYS } from '../../../services/cacheService';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DriverRecommendationExcel: React.FC = () => {
    const { appData, language, refreshData, showNotification } = useContext(AppContext);
    const t = translations[language];
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [gridData, setGridData] = useState<Record<string, Record<string, { driver: string, method: string, id?: number }>>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Prepare options
    const driverOptions = useMemo(() => (appData.drivers || []).map(d => d.DriverName), [appData.drivers]);
    const methodOptions = useMemo(() => (appData.shippingMethods || []).map(m => m.MethodName), [appData.shippingMethods]);
    
    // Get unique Store + Province combinations from existing recommendations and system data
    const rowKeys = useMemo(() => {
        const keys = new Set<string>();
        
        // From existing recommendations
        (appData.driverRecommendations || []).forEach(rec => {
            keys.add(`${rec.StoreName} ||| ${rec.Province}`);
        });
        
        // From stores and provinces (optional, but good for empty setup)
        const stores = (appData.stores || []).map(s => s.StoreName);
        const provinces = Array.from(new Set((appData.locations || []).map(l => l.Province)));
        
        stores.forEach(s => {
            provinces.forEach(p => {
                // keys.add(`${s} ||| ${p}`); // Uncomment if you want to show ALL possible combinations
            });
        });

        return Array.from(keys).sort();
    }, [appData.driverRecommendations, appData.stores, appData.locations]);

    // Initialize Grid Data
    useEffect(() => {
        const newGrid: Record<string, Record<string, { driver: string, method: string, id?: number }>> = {};
        
        rowKeys.forEach(key => {
            newGrid[key] = {};
            DAYS_OF_WEEK.forEach(day => {
                newGrid[key][day] = { driver: '', method: '' };
            });
        });

        (appData.driverRecommendations || []).forEach(rec => {
            const key = `${rec.StoreName} ||| ${rec.Province}`;
            if (newGrid[key]) {
                newGrid[key][rec.DayOfWeek] = { 
                    driver: rec.DriverName || '', 
                    method: rec.ShippingMethod || '',
                    id: rec.ID
                };
            }
        });

        setGridData(newGrid);
        setHasChanges(false);
    }, [appData.driverRecommendations, rowKeys]);

    const handleCellChange = (rowKey: string, day: string, field: 'driver' | 'method', value: string) => {
        setGridData(prev => ({
            ...prev,
            [rowKey]: {
                ...prev[rowKey],
                [day]: {
                    ...prev[rowKey][day],
                    [field]: value
                }
            }
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const updates: any[] = [];
            const additions: any[] = [];

            Object.entries(gridData).forEach(([rowKey, days]) => {
                const [store, province] = rowKey.split(' ||| ');
                Object.entries(days).forEach(([day, data]) => {
                    if (data.id) {
                        // Check if changed compared to original (optional optimization, but let's just send all for now or check)
                        const original = appData.driverRecommendations?.find(r => r.ID === data.id);
                        if (original && (original.DriverName !== data.driver || original.ShippingMethod !== data.method)) {
                            updates.push({
                                primaryKey: { ID: data.id },
                                newData: {
                                    DriverName: data.driver,
                                    ShippingMethod: data.method
                                }
                            });
                        }
                    } else if (data.driver || data.method) {
                        // New recommendation
                        additions.push({
                            DayOfWeek: day,
                            StoreName: store,
                            Province: province,
                            DriverName: data.driver,
                            ShippingMethod: data.method
                        });
                    }
                });
            });

            // Perform updates
            for (const update of updates) {
                await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        sheetName: 'DriverRecommendations',
                        ...update
                    })
                });
            }

            // Perform additions
            for (const addition of additions) {
                // Determine next ID locally for immediate UI feedback (optional but good)
                const res = await fetch(`${WEB_APP_URL}/api/admin/add-row`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        sheetName: 'DriverRecommendations',
                        newData: addition
                    })
                });
            }

            showNotification(t.profile_updated || "Saved successfully", "success");
            await refreshData();
            setHasChanges(false);
        } catch (err) {
            console.error("Save error:", err);
            showNotification("Failed to save changes", "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (rowKeys.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-900/30 rounded-3xl border border-dashed border-gray-700">
                <div className="text-4xl mb-4">💡</div>
                <div className="text-gray-500 font-bold">{t.no_recommendations}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-fade-in">
            <div className="flex justify-between items-center mb-4 px-2">
                <div className="text-xs font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-4 py-2 rounded-full border border-blue-400/20">
                    {t.excel_view} Mode
                </div>
                {hasChanges && (
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="btn btn-primary !py-2 !px-6 text-xs font-black flex items-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
                    >
                        {isSaving ? <Spinner size="sm" /> : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> {t.save_changes}</>}
                    </button>
                )}
            </div>

            <div className="flex-grow overflow-auto no-scrollbar rounded-2xl border border-gray-700/50 bg-gray-900/20">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-800/80 sticky top-0 z-20 backdrop-blur-md border-b border-gray-700">
                            <th className="p-4 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest min-w-[200px] border-r border-gray-700/50">{t.store_province}</th>
                            {DAYS_OF_WEEK.map(day => (
                                <th key={day} className="p-4 text-center text-[10px] font-black text-gray-500 uppercase tracking-widest min-w-[180px] border-r border-gray-700/50">
                                    {t[day.slice(0, 3).toLowerCase()] || day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {rowKeys.map(key => {
                            const [store, province] = key.split(' ||| ');
                            return (
                                <tr key={key} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 border-r border-gray-700/50 sticky left-0 z-10 bg-gray-900/90 backdrop-blur-sm">
                                        <div className="font-black text-white text-sm">{store}</div>
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">{province}</div>
                                    </td>
                                    {DAYS_OF_WEEK.map(day => (
                                        <td key={day} className="p-2 border-r border-gray-700/50 min-w-[180px]">
                                            <div className="flex flex-col gap-1.5">
                                                <select 
                                                    value={gridData[key]?.[day]?.driver || ''} 
                                                    onChange={(e) => handleCellChange(key, day, 'driver', e.target.value)}
                                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-200 focus:border-blue-500 focus:ring-0 outline-none cursor-pointer"
                                                >
                                                    <option value="">-- {t.select_driver} --</option>
                                                    {driverOptions.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                                <select 
                                                    value={gridData[key]?.[day]?.method || ''} 
                                                    onChange={(e) => handleCellChange(key, day, 'method', e.target.value)}
                                                    className="w-full bg-blue-600/5 border border-blue-500/20 rounded-lg px-2 py-1.5 text-[10px] font-bold text-blue-400 focus:border-blue-500 focus:ring-0 outline-none cursor-pointer"
                                                >
                                                    <option value="">-- Method --</option>
                                                    {methodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DriverRecommendationExcel;
