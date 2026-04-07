
import React, { useState, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { WEB_APP_URL } from '../constants';
import { convertGoogleDriveUrl } from '../utils/fileUtils';
import PagesPdfExportModal from '../components/admin/PagesPdfExportModal';
import Spinner from '../components/common/Spinner';
import { CacheService, CACHE_KEYS } from '../services/cacheService';
import { 
    configSections, 
    ConfigSection, 
    getValueCaseInsensitive, 
    getArrayCaseInsensitive 
} from '../constants/settingsConfig';
import ConfigEditModal from '../components/admin/settings/ConfigEditModal';
import SystemUpdateModal from '../components/admin/settings/SystemUpdateModal';
import TelegramTemplateManager from '../components/admin/settings/TelegramTemplateManager';
import DatabaseManagement from '../components/admin/settings/DatabaseManagement';
import PermissionManagement from '../components/admin/settings/PermissionManagement';
import DriverRecommendationExcel from '../components/admin/settings/DriverRecommendationExcel';

import { translations } from '../translations';

interface SettingsDashboardProps {
    onBack: () => void;
    initialSection?: string;
}

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({ onBack, initialSection }) => {
    const { appData, refreshData, logout, setMobilePageTitle, language, showNotification } = useContext(AppContext);
    const t = translations[language];
    const [desktopSection, setDesktopSection] = useState<string>(initialSection || 'users');
    const [mobileSection, setMobileSection] = useState<string | null>(initialSection || null);
    const [searchQuery, setSearchQuery] = useState('');
    const [modal, setModal] = useState<{ isOpen: boolean, sectionId: string, item: any | null }>({ isOpen: false, sectionId: '', item: null });
    const [localData, setLocalData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    const [isPdfOpen, setIsPdfOpen] = useState(false);
    const [isExcelView, setIsExcelView] = useState(true);
    
    // System Update State
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);
    
    // Reset search when section changes
    useEffect(() => {
        setSearchQuery('');
    }, [desktopSection, mobileSection]);

    const activeId = (window.innerWidth < 768) ? mobileSection : desktopSection;
    const activeSection = configSections.find(s => s.id === activeId);

    // Update Mobile Header Title
    useEffect(() => {
        const title = activeSection ? (t[`section_${activeSection.id}`] || activeSection.title) : (t.settings || 'ការកំណត់');
        setMobilePageTitle(title);
        return () => setMobilePageTitle(null);
    }, [activeSection, setMobilePageTitle, t]);

    // Ref to always read the latest appData without re-creating the callback
    const appDataRef = useRef(appData);
    appDataRef.current = appData;

    const fetchSectionData = useCallback(async (sectionId: string, forceRefresh = false) => {
        const section = configSections.find(s => s.id === sectionId);
        if (!section || section.id === 'telegramTemplates' || section.id === 'permissions' || section.id === 'database') {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setFetchError(false);
        try {
            // Step 1: Check current appData (always read latest via ref)
            const currentAppData = appDataRef.current;
            const appDataList = getArrayCaseInsensitive(currentAppData, section.dataKey);
            if (!forceRefresh && appDataList.length > 0) {
                setLocalData(appDataList);
                setIsLoading(false);
                return;
            }

            // Step 2: appData is empty — call refreshData() to fetch ALL static data globally
            // This is the SAME call OrderContext uses, ensuring consistent token handling
            try {
                await refreshData();
            } catch (e) {
                console.warn('refreshData failed, trying direct fetch...', e);
            }

            // Step 3: Re-check appData after refresh (read latest via ref)
            const refreshedAppData = appDataRef.current;
            const refreshedList = getArrayCaseInsensitive(refreshedAppData, section.dataKey);
            if (refreshedList.length > 0) {
                setLocalData(refreshedList);
                return;
            }

            // Step 4: Last resort — direct API fetch with fallback token
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || localStorage.getItem('token');
            const headers: HeadersInit = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const staticDataSections = ['pages', 'products', 'shippingMethods', 'drivers',
                'bankAccounts', 'phoneCarriers', 'driverRecommendations', 'roles', 'users',
                'stores', 'colors', 'locations', 'inventory', 'stockTransfers'];

            let endpoint: string;
            if (staticDataSections.includes(sectionId)) {
                endpoint = 'static-data';
            } else if (sectionId === 'systemSettings') {
                endpoint = 'settings';
            } else {
                endpoint = sectionId;
            }

            const res = await fetch(`${WEB_APP_URL}/api/${endpoint}`, { headers });
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success') {
                    let data: any[];
                    if (endpoint === 'static-data') {
                        data = getArrayCaseInsensitive(json.data, section.dataKey);
                    } else {
                        data = Array.isArray(json.data) ? json.data : [];
                    }
                    setLocalData(data);
                } else {
                    setFetchError(true);
                }
            } else {
                setFetchError(true);
            }
        } catch (err) {
            console.error(`Failed to fetch ${sectionId}:`, err);
            setFetchError(true);
        } finally {
            setIsLoading(false);
        }
    }, [refreshData]);

    useEffect(() => {
        if (activeId) fetchSectionData(activeId);
    }, [activeId, fetchSectionData]);

    // Also re-sync localData when appData updates externally (e.g. after global refreshData)
    useEffect(() => {
        if (!activeSection) return;
        const appDataList = getArrayCaseInsensitive(appData, activeSection.dataKey);
        if (appDataList.length > 0) {
            setLocalData(appDataList);
        }
    }, [appData, activeSection]);

    const dataList = useMemo(() => {
        if (!activeSection) return [];
        
        let list = localData;
        const appDataList = getArrayCaseInsensitive(appData, activeSection.dataKey);
        
        // Prefer appData if it has items
        if (appDataList.length > 0) list = appDataList;

        // If we are looking at roles, we ONLY show what's in the list (which now includes auto-generated Admin)
        // No extra filtering needed here as App.tsx handles the Admin existence.

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return list.filter(item => {
                const displayVal = String(getValueCaseInsensitive(item, activeSection.displayField) || '').toLowerCase();
                if (displayVal.includes(q)) return true;
                const pkVal = String(getValueCaseInsensitive(item, activeSection.primaryKeyField) || '').toLowerCase();
                if (pkVal.includes(q)) return true;
                if (activeSection.id === 'products') {
                    const barcode = String(getValueCaseInsensitive(item, 'Barcode') || '').toLowerCase();
                    if (barcode.includes(q)) return true;
                }
                return false;
            });
        }

        return list;
    }, [activeSection, appData, localData, searchQuery]);

    const handleDelete = async (section: ConfigSection, item: any) => {
        const displayValue = getValueCaseInsensitive(item, section.displayField);
        
        // Prevent deleting Admin Role
        if (section.id === 'roles' && String(displayValue || '').toLowerCase() === 'admin') {
            showNotification("មិនអាចលុបតួនាទី Admin បានទេ (Cannot delete Admin role)", "error");
            return;
        }

        if (!window.confirm(`តើអ្នកប្រាកដទេថាចង់លុប "${displayValue}"?`)) return;
        
        setIsLoading(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token;
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const pkValue = getValueCaseInsensitive(item, section.primaryKeyField);
            // Robust conversion for numeric IDs (like Role ID)
            const pkValueConverted = (section.id === 'roles' && pkValue !== undefined && !isNaN(Number(pkValue))) 
                ? Number(pkValue) 
                : pkValue;

            const res = await fetch(`${WEB_APP_URL}/api/admin/delete-row`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    sheetName: section.sheetName, 
                    primaryKey: { [section.primaryKeyField]: pkValueConverted } 
                })
            });
            
            const result = await res.json();
            if (res.ok && result.status === 'success') {
                showNotification("Deleted successfully", "success");
                
                // Clear local list immediately to give visual feedback
                setLocalData(prev => prev.filter(i => getValueCaseInsensitive(i, section.primaryKeyField) !== pkValue));
                
                // Wait 1s for backend to fully commit (Spreadsheet latency) then global refresh
                setTimeout(async () => {
                    await refreshData();
                    if (activeId) fetchSectionData(activeId);
                }, 1000);
            } else {
                throw new Error(result.message || "Delete failed");
            }
        } catch (err: any) { 
            console.error("Delete error:", err);
            showNotification(`លុបមិនបានសម្រេច៖ ${err.message || 'Error'}`, "error"); 
        } finally {
            setIsLoading(false);
        }
    };

    const handleSystemUpdate = async (message: string) => {
        setIsUpdatingSystem(true);
        try {
            await fetch(`${WEB_APP_URL}/api/admin/update-sheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sheetName: 'Settings', 
                    primaryKey: { 'Key': 'SystemVersion' },
                    newData: {
                        'Value': Date.now().toString(),
                        'Action': 'ForceLogout',
                        'Message': message || 'System Update in progress. Please log in again.'
                    } 
                })
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
            logout();
            window.location.reload();
        } catch (err) {
            console.error(err);
            setIsUpdatingSystem(false);
            alert("Update command failed. Check connection.");
        }
    };

    // Mobile Categories View
    if (!activeId) {
        return (
            <div className="p-4 md:hidden animate-fade-in pb-10 bg-[#181a20] min-h-screen">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-xl font-bold text-[#eaecef] flex items-center gap-2">
                            <div className="w-1 h-5 bg-[#fcd535] rounded-sm"></div>
                            {t.settings || 'ការកំណត់'}
                        </h1>
                        <p className="text-[11px] text-[#848e9c] font-medium mt-1 uppercase tracking-widest">Settings & Management</p>
                    </div>
                    <button onClick={onBack} className="p-2 text-[#848e9c] hover:text-[#eaecef] transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                <div className="grid grid-cols-1 border-t border-[#2b3139]">
                    {configSections.map(s => (
                        <button key={s.id} onClick={() => setMobileSection(s.id)} className="flex items-center gap-4 bg-transparent border-b border-[#2b3139] p-4 hover:bg-[#2b3139]/30 active:bg-[#2b3139]/60 transition-all text-left group">
                            <span className="text-2xl grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all">{s.icon}</span>
                            <div className="flex-grow">
                                <h3 className="text-sm font-semibold text-[#eaecef] leading-tight group-hover:text-white transition-colors">{t[`section_${s.id}`] || s.title}</h3>
                                <p className="text-[11px] text-[#5e6673] mt-0.5 line-clamp-1">{t[`desc_${s.id}`] || s.description}</p>
                            </div>
                            <svg className="w-5 h-5 text-[#5e6673] group-hover:text-[#fcd535] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[100rem] mx-auto h-full flex flex-col p-4 lg:p-6 animate-fade-in overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => { if(window.innerWidth < 768) setMobileSection(null); else onBack(); }} className="md:hidden p-2 bg-gray-800 text-white rounded-xl border border-gray-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg></button>
                    <div>
                        <h1 className="hidden sm:flex text-2xl lg:text-3xl font-black text-white items-center gap-3">
                             <span className="hidden md:inline">{activeSection?.icon}</span>
                             {t[`section_${activeSection?.id}`] || activeSection?.title}
                        </h1>
                        <p className="text-xs lg:text-sm text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">{t[`desc_${activeSection?.id}`] || activeSection?.description}</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {activeId !== 'telegramTemplates' && activeId !== 'permissions' && activeId !== 'database' && (
                        <div className="relative flex-grow sm:flex-grow-0 sm:min-w-[240px] lg:min-w-[320px] group">
                            <div className="relative flex items-center">
                                <div className="absolute left-4 text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input 
                                    type="text" 
                                    placeholder={t[`search_${activeSection?.id}`] || `Search ${activeSection?.title}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full !py-3 !pl-11 !pr-10 bg-gray-900/40 backdrop-blur-xl border border-white/5 rounded-2xl text-[13px] font-bold text-white placeholder:text-gray-600 focus:border-blue-500/50 outline-none transition-all shadow-lg"
                                />
                            </div>
                        </div>
                    )}

                    <button onClick={() => setIsUpdateModalOpen(true)} className="flex-1 sm:flex-none btn bg-gray-800 border border-gray-700 hover:text-red-400 px-4 transition-all flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth={2}/></svg></button>
                    {activeId === 'driverRecommendations' && (
                        <button onClick={() => setIsExcelView(!isExcelView)} className="flex-1 sm:flex-none btn btn-secondary px-6 font-black">
                            {isExcelView ? t.table_view : t.excel_view}
                        </button>
                    )}
                    {activeId === 'pages' && <button onClick={() => setIsPdfOpen(true)} className="flex-1 sm:flex-none btn btn-secondary px-6">PDF</button>}
                    {activeId !== 'telegramTemplates' && activeId !== 'permissions' && activeId !== 'database' && (
                        <button onClick={() => setModal({ isOpen: true, sectionId: activeId, item: null })} className="flex-1 sm:flex-none btn btn-primary px-10 font-black">+ {t.add_new}</button>
                    )}
                    <button onClick={onBack} className="hidden md:flex btn btn-secondary px-6">ត្រឡប់</button>
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
                <aside className="hidden md:flex flex-col w-64 flex-shrink-0 overflow-y-auto no-scrollbar pb-20 border-r border-[#2b3139] bg-[#181a20]">
                    {configSections.map(s => (
                        <button 
                            key={s.id} 
                            onClick={() => { setDesktopSection(s.id); setLocalData([]); }} 
                            className={`group relative flex items-center gap-4 px-5 py-4 transition-all hover:bg-[#2b3139]/40 outline-none border-t border-[#2b3139]/20 first:border-0 ${
                                desktopSection === s.id 
                                ? 'bg-[#2b3139]/80 text-[#eaecef]' 
                                : 'text-[#848e9c]'
                            }`}
                        >
                            {desktopSection === s.id && <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#fcd535]" />}
                            <span className={`text-xl transition-all ${desktopSection === s.id ? 'scale-110 grayscale-0 opacity-100' : 'grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-80 scale-95'}`}>{s.icon}</span>
                            <span className={`text-xs uppercase tracking-widest font-bold ${desktopSection === s.id ? 'text-[#eaecef]' : 'text-[#848e9c] group-hover:text-[#eaecef]'}`}>{t[`section_${s.id}`] || s.title}</span>
                        </button>
                    ))}
                </aside>

                <main className="flex-grow min-w-0 h-full overflow-hidden flex flex-col">
                    {activeId === 'telegramTemplates' ? (
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-[3rem] p-8 overflow-y-auto no-scrollbar flex-grow"><TelegramTemplateManager language={language} /></div>
                    ) : activeId === 'database' ? (
                        <div className="flex-grow overflow-y-auto no-scrollbar"><DatabaseManagement /></div>
                    ) : activeId === 'permissions' ? (
                        <div className="flex-grow overflow-y-auto no-scrollbar"><PermissionManagement /></div>
                    ) : (activeId === 'driverRecommendations' && isExcelView) ? (
                        <div className="flex-grow overflow-hidden"><DriverRecommendationExcel /></div>
                    ) : (
                        <div className="bg-gray-800/30 border border-gray-700/50 rounded-3xl overflow-hidden shadow-2xl flex flex-col flex-grow relative">
                            {isLoading && (
                                <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-sm z-50 flex items-center justify-center">
                                    <Spinner size="lg" />
                                </div>
                            )}
                            
                            <div className="hidden md:block overflow-y-auto no-scrollbar flex-grow">
                                <table className="admin-table w-full">
                                    <thead>
                                        <tr className="bg-gray-900/50 border-b border-gray-700 sticky top-0 z-10 backdrop-blur-md">
                                            <th className="w-12 text-center">#</th>
                                            {activeSection?.fields.map(f => <th key={f.name}>{t[`field_${f.name}`] || f.label}</th>)}
                                            <th className="w-32 text-center uppercase tracking-widest text-[10px]">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/30">
                                        {dataList.length > 0 ? dataList.map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-blue-600/5 transition-colors group">
                                                <td className="text-center text-gray-500 font-bold text-xs">{idx + 1}</td>
                                                {activeSection?.fields.map(f => {
                                                    const val = getValueCaseInsensitive(item, f.name);
                                                    return (
                                                        <td key={f.name} className="py-4">
                                                            {f.type === 'image_url' && val ? (
                                                                <img src={convertGoogleDriveUrl(String(val))} className="w-10 h-10 rounded-xl object-contain bg-gray-900 border border-gray-700 p-1" alt="logo" />
                                                            ) : (
                                                                <span className={`text-sm font-bold ${f.type === 'password' ? 'text-gray-600' : 'text-gray-200'}`}>
                                                                    {f.type === 'password' ? '••••••••' : (typeof val === 'boolean' ? (val ? '✅ Active' : '❌ Inactive') : String(val || '-'))}
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => setModal({ isOpen: true, sectionId: activeId, item })} className="p-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>
                                                        <button onClick={() => handleDelete(activeSection!, item)} className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : !isLoading && (
                                            <tr><td colSpan={10} className="py-20 text-center"><div className="text-gray-500 font-bold mb-4">{fetchError ? 'មានបញ្ហាក្នុងការទាញទិន្នន័យ' : 'មិនមានទិន្នន័យត្រូវបានរកឃើញទេ'}</div><button onClick={() => fetchSectionData(activeId!, true)} className="btn btn-secondary text-xs">ចុចដើម្បីសាកល្បងម្ដងទៀត</button></td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="md:hidden divide-y divide-gray-700/50 overflow-y-auto no-scrollbar flex-grow pb-20">
                                {dataList.length > 0 ? dataList.map((item: any, idx: number) => {
                                    const title = getValueCaseInsensitive(item, activeSection?.displayField || '');
                                    const imgField = activeSection?.fields.find(f => f.type === 'image_url');
                                    const imgVal = imgField ? getValueCaseInsensitive(item, imgField.name) : null;
                                    return (
                                        <div key={idx} className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                {imgVal && <img src={convertGoogleDriveUrl(imgVal)} className="w-12 h-12 rounded-xl object-contain bg-gray-900 border border-gray-700 p-1 flex-shrink-0" alt="logo" />}
                                                <div className="min-w-0"><h4 className="text-sm font-black text-white truncate">{String(title || '-')}</h4><p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Item #{idx + 1}</p></div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setModal({ isOpen: true, sectionId: activeId, item })} className="p-2.5 bg-gray-800 text-blue-400 rounded-xl border border-gray-700 active:scale-95 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg></button>
                                                <button onClick={() => handleDelete(activeSection!, item)} className="p-2.5 bg-gray-800 text-red-400 rounded-xl border border-gray-700 active:scale-95 transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg></button>
                                            </div>
                                        </div>
                                    );
                                }) : !isLoading && (
                                    <div className="py-20 text-center"><div className="text-gray-500 font-bold mb-4">{fetchError ? 'មានបញ្ហាក្នុងការទាញទិន្នន័យ' : 'មិនមានទិន្នន័យ'}</div><button onClick={() => fetchSectionData(activeId!, true)} className="btn btn-secondary text-xs">សាកល្បងម្ដងទៀត</button></div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {modal.isOpen && activeSection && (
                <ConfigEditModal 
                    section={activeSection}
                    item={modal.item}
                    onClose={() => setModal({ ...modal, isOpen: false })}
                    onSave={() => { setModal({ ...modal, isOpen: false }); refreshData(); fetchSectionData(activeId!); }}
                />
            )}

            <SystemUpdateModal 
                isOpen={isUpdateModalOpen}
                onClose={() => setIsUpdateModalOpen(false)}
                onConfirm={handleSystemUpdate}
                isProcessing={isUpdatingSystem}
            />

            {isPdfOpen && (
                <PagesPdfExportModal 
                    isOpen={isPdfOpen} 
                    onClose={() => setIsPdfOpen(false)}
                    pages={getArrayCaseInsensitive(appData, 'pages')}
                />
            )}
        </div>
    );
};

export default SettingsDashboard;
