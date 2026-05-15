import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../../context/AppContext';
import { FEATURES } from '../../../constants/permissions';
import Spinner from '../../common/Spinner';
import { getArrayCaseInsensitive, getValueCaseInsensitive } from '../../../constants/settingsConfig';
import { WEB_APP_URL } from '../../../constants';

// Feature Labels and Descriptions for better clarity
const FEATURE_INFO: Record<string, { label: string, desc: string, icon: string }> = {
    [FEATURES.VIEW_ORDER_LIST]: { label: 'បញ្ជីការកម្ម៉ង់', desc: 'មើលបញ្ជីការកម្ម៉ង់ទាំងអស់ក្នុងប្រព័ន្ធ', icon: '📋' },
    [FEATURES.CREATE_ORDER]: { label: 'បង្កើតការកម្ម៉ង់', desc: 'បង្កើតការកម្ម៉ង់ថ្មីសម្រាប់អតិថិជន', icon: '➕' },
    [FEATURES.EDIT_ORDER]: { label: 'កែសម្រួលការកម្ម៉ង់', desc: 'កែប្រែព័ត៌មានការកម្ម៉ង់ដែលមានស្រាប់', icon: '📝' },
    [FEATURES.VERIFY_ORDER]: { label: 'ផ្ទៀងផ្ទាត់ការកម្ម៉ង់', desc: 'បញ្ជាក់ការកម្ម៉ង់ថាត្រឹមត្រូវ', icon: '✅' },
    [FEATURES.DELETE_ORDER]: { label: 'លុបការកម្ម៉ង់', desc: 'លុបការកម្ម៉ង់ចេញពីប្រព័ន្ធ', icon: '🗑️' },
    [FEATURES.VIEW_GLOBAL_ORDERS]: { label: 'មើលការកម្ម៉ង់សកល', desc: 'មើលការកម្ម៉ង់ពីគ្រប់ក្រុមទាំងអស់', icon: '🌍' },
    
    [FEATURES.ACCESS_SALES_PORTAL]: { label: 'Sales Portal', desc: 'ចូលប្រើផ្ទាំងគ្រប់គ្រងការលក់', icon: '🛍️' },
    [FEATURES.ACCESS_FULFILLMENT]: { label: 'Fulfillment', desc: 'ចូលប្រើផ្ទាំងគ្រប់គ្រងការដឹកជញ្ជូន', icon: '🚚' },
    [FEATURES.VIEW_ADMIN_DASHBOARD]: { label: 'Admin Dashboard', desc: 'មើលរបាយការណ៍សង្ខេបកម្រិត Admin', icon: '📊' },
    [FEATURES.VIEW_ENTERTAINMENT]: { label: 'Entertainment', desc: 'ចូលមើលវីដេអូកម្សាន្តក្នុងប្រព័ន្ធ', icon: '🎬' },
    
    [FEATURES.MANAGE_ROLES]: { label: 'គ្រប់គ្រងតួនាទី', desc: 'បន្ថែម ឬកែសម្រួលតួនាទី (Roles)', icon: '👥' },
    [FEATURES.MANAGE_PERMISSIONS]: { label: 'គ្រប់គ្រងសិទ្ធិ', desc: 'កំណត់សិទ្ធិប្រើប្រាស់សម្រាប់តួនាទី', icon: '🔐' },
    [FEATURES.VIEW_REVENUE]: { label: 'មើលចំណូល', desc: 'មើលរបាយការណ៍ចំណូលលម្អិត', icon: '💰' },
    [FEATURES.EXPORT_DATA]: { label: 'ទាញយកទិន្នន័យ', desc: 'ទាញចេញទិន្នន័យជា Excel/CSV', icon: '📤' },
    [FEATURES.MIGRATE_DATA]: { label: 'ផ្ទេរទិន្នន័យ', desc: 'ផ្ទេរទិន្នន័យរវាងប្រព័ន្ធ ឬ Sheets', icon: '🔄' },
    
    [FEATURES.MANAGE_INVENTORY]: { label: 'គ្រប់គ្រងស្តុក', desc: 'គ្រប់គ្រងចំនួនទំនិញក្នុងស្តុក', icon: '📦' },
    [FEATURES.STOCK_TRANSFER]: { label: 'ផ្ទេរស្តុក', desc: 'ផ្ទេរទំនិញរវាងឃ្លាំងផ្សេងៗ', icon: '🚛' },
    [FEATURES.VIEW_TEAM_LEADERBOARD]: { label: 'ចំណាត់ថ្នាក់ក្រុម', desc: 'មើលតារាងចំណាត់ថ្នាក់ការលក់', icon: '🏆' },
    [FEATURES.SET_TARGETS]: { label: 'កំណត់គោលដៅ', desc: 'កំណត់គោលដៅលក់សម្រាប់ក្រុម', icon: '🎯' },
};

const PermissionMatrix: React.FC = () => {
    const { appData, updatePermission, showNotification, fetchData } = useContext(AppContext);
    const [updating, setUpdating] = useState<string | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
    const [syncing, setSyncing] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [registering, setRegistering] = useState<string | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [featureSearch, setFeatureSearch] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
    const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');

    const rolesList = getArrayCaseInsensitive(appData, 'roles');
    const permissions = getArrayCaseInsensitive(appData, 'permissions');
    const featureKeys = Object.values(FEATURES);

    // Group features into logical categories
    const categories = useMemo(() => [
        {
            id: 'core',
            name: 'ប្រតិបត្តិការស្នូល (Core Operations)',
            features: [
                FEATURES.VIEW_ORDER_LIST,
                FEATURES.CREATE_ORDER,
                FEATURES.EDIT_ORDER,
                FEATURES.VERIFY_ORDER,
                FEATURES.DELETE_ORDER,
                FEATURES.VIEW_GLOBAL_ORDERS
            ]
        },
        {
            id: 'module',
            name: 'ការចូលប្រើម៉ូឌុល (Module Access)',
            features: [
                FEATURES.ACCESS_SALES_PORTAL,
                FEATURES.ACCESS_FULFILLMENT,
                FEATURES.VIEW_ADMIN_DASHBOARD,
                FEATURES.VIEW_ENTERTAINMENT,
                FEATURES.VIEW_PROMOTIONS,
                FEATURES.MANAGE_PROMOTIONS
            ]
        },
        {
            id: 'logistics',
            name: 'ស្តុក និង សមិទ្ធផល (Logistics & Performance)',
            features: [
                FEATURES.MANAGE_INVENTORY,
                FEATURES.STOCK_TRANSFER,
                FEATURES.VIEW_TEAM_LEADERBOARD,
                FEATURES.SET_TARGETS
            ]
        },
        {
            id: 'system',
            name: 'ការគ្រប់គ្រងប្រព័ន្ធ (System Management)',
            features: [
                FEATURES.MANAGE_ROLES,
                FEATURES.MANAGE_PERMISSIONS,
                FEATURES.VIEW_REVENUE,
                FEATURES.EXPORT_DATA,
                FEATURES.MIGRATE_DATA
            ]
        }
    ], []);

    const filteredFeatures = useMemo(() => {
        let list = featureKeys;
        if (activeCategory !== 'all') {
            const cat = categories.find(c => c.id === activeCategory);
            if (cat) list = cat.features;
        }

        if (!featureSearch.trim()) return list;
        const q = featureSearch.toLowerCase();
        return list.filter(f => {
            const info = FEATURE_INFO[f];
            return f.toLowerCase().includes(q) || 
                   f.replace(/_/g, ' ').toLowerCase().includes(q) ||
                   (info && (info.label.toLowerCase().includes(q) || info.desc.toLowerCase().includes(q)));
        });
    }, [featureKeys, featureSearch, activeCategory, categories]);

    const isFeatureVisible = (f: string) => filteredFeatures.includes(f);
    const isCategoryVisible = (cat: any) => cat.features.some((f: string) => isFeatureVisible(f));

    const toggleCategory = (id: string) => {
        setCollapsedCategories(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Build the full role list
    const allRoleColumns = useMemo(() => {
        const definedRoles = rolesList
            .map((r: any) => {
                const name = (getValueCaseInsensitive(r, 'RoleName') || getValueCaseInsensitive(r, 'Role') || '').trim();
                const description = (getValueCaseInsensitive(r, 'Description') || '').trim();
                const id = getValueCaseInsensitive(r, 'ID') || 0;
                return name ? { name, description, id, isOrphan: false as const } : null;
            })
            .filter(Boolean) as { name: string; description: string; id: any; isOrphan: false }[];

        const definedLower = new Set(definedRoles.map(r => r.name.toLowerCase()));

        const usersList = getArrayCaseInsensitive(appData, 'users');
        const orphanRoleNames = new Set<string>();
        usersList.forEach((u: any) => {
            const roleField = (getValueCaseInsensitive(u, 'Role') || '').toString();
            roleField.split(',').forEach((part: string) => {
                const r = part.trim();
                if (r && !definedLower.has(r.toLowerCase()) && r.toLowerCase() !== 'admin') {
                    orphanRoleNames.add(r);
                }
            });
        });

        const orphanRoles = [...orphanRoleNames].map(name => ({
            name,
            description: '⚠ មិនទាន់ចុះឈ្មោះ',
            id: '?',
            isOrphan: true as const,
        }));

        // Put Admin first, then defined roles, then orphans
        const adminRole = definedRoles.find(r => r.name.toLowerCase() === 'admin');
        const otherRoles = definedRoles.filter(r => r.name.toLowerCase() !== 'admin');

        return [...(adminRole ? [adminRole] : []), ...otherRoles, ...orphanRoles];
    }, [rolesList, appData]);

    const adminPost = async (path: string): Promise<{ ok: boolean; status: number; json: any }> => {
        const token = localStorage.getItem('token');
        const res = await fetch(`${WEB_APP_URL}${path}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        let json: any = {};
        try { json = await res.json(); } catch { /* non-JSON response */ }
        return { ok: res.ok, status: res.status, json };
    };

    const handleSyncToSheet = async () => {
        setSyncing(true);
        try {
            const { ok, status, json } = await adminPost('/api/admin/permissions/sync-sheet');
            if (ok && json.status === 'success') {
                showNotification?.('ជោគជ័យ: បានធ្វើបច្ចុប្បន្នភាពទៅ Google Sheets រួចរាល់', 'success');
            } else {
                showNotification?.(json.message || `Sync failed (${status})`, 'error');
            }
        } catch (err: any) {
            showNotification?.(err?.message || 'មិនអាច Sync បាន', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const handleReset = async () => {
        setResetting(true);
        setShowResetConfirm(false);
        try {
            const { ok, status, json } = await adminPost('/api/admin/permissions/reset');
            if (ok && json.status === 'success') {
                showNotification?.(`Reset ជោគជ័យ — សិទ្ធិចំនួន ${json.count} ត្រូវបានរៀបចំឡើងវិញ`, 'success');
                await fetchData?.(true);
            } else {
                showNotification?.(json.message || `Reset failed (${status})`, 'error');
            }
        } catch (err: any) {
            showNotification?.(err?.message || 'Reset failed — cannot connect to server', 'error');
        } finally {
            setResetting(false);
        }
    };

    const handleRegisterRole = async (roleName: string) => {
        setRegistering(roleName);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${WEB_APP_URL}/api/admin/roles`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ RoleName: roleName, Description: 'Registered via Permission Matrix' })
            });
            const json = await res.json();
            if (res.ok && json.status === 'success') {
                showNotification?.(`តួនាទី "${roleName}" ត្រូវបានចុះឈ្មោះជោគជ័យ`, 'success');
                await fetchData?.(true);
            } else {
                showNotification?.(json.message || 'Registration failed', 'error');
            }
        } catch (err: any) {
            showNotification?.(err?.message || 'Connection error', 'error');
        } finally {
            setRegistering(null);
        }
    };

    const handleToggle = async (roleName: string, feature: string, currentState: boolean) => {
        if (!roleName) return;
        const lockKey = `${roleName}-${feature}`;
        const newValue = !currentState;

        setUpdating(lockKey);
        setPendingChanges(prev => ({ ...prev, [lockKey]: newValue }));

        try {
            await updatePermission(roleName, feature, newValue);
            setTimeout(() => {
                setPendingChanges(prev => {
                    const next = { ...prev };
                    delete next[lockKey];
                    return next;
                });
            }, 1000);
        } catch (err: any) {
            setPendingChanges(prev => {
                const next = { ...prev };
                delete next[lockKey];
                return next;
            });
            const msg = err?.message || 'Failed to update permission';
            showNotification?.(msg, 'error');
        } finally {
            setUpdating(null);
        }
    };

    const handleMassToggle = async (feature: string, action: 'enable' | 'disable') => {
        const newValue = action === 'enable';
        const targetRoles = allRoleColumns.filter(r => r.name.toLowerCase() !== 'admin');
        
        if (targetRoles.length === 0) return;

        showNotification?.(`កំពុងអនុវត្តចំពោះគ្រប់ Role...`, 'success');
        
        const promises = targetRoles.map(role => {
            const lockKey = `${role.name}-${feature}`;
            setPendingChanges(prev => ({ ...prev, [lockKey]: newValue }));
            return updatePermission(role.name, feature, newValue);
        });

        try {
            await Promise.all(promises);
            showNotification?.(`បានធ្វើបច្ចុប្បន្នភាពមុខងារ "${feature}" សម្រាប់គ្រប់ Role រួចរាល់`, 'success');
            setTimeout(() => setPendingChanges({}), 2000);
        } catch (err: any) {
            showNotification?.('Mass toggle failed for some roles', 'error');
        }
    };

    // Role-based mass toggle (Column toggle)
    const handleRoleMassToggle = async (roleName: string, action: 'enable' | 'disable') => {
        const newValue = action === 'enable';
        const targetFeatures = featureKeys;

        showNotification?.(`កំពុងអនុវត្តសិទ្ធិទាំងអស់សម្រាប់តួនាទី "${roleName}"...`, 'success');

        const promises = targetFeatures.map(feature => {
            const lockKey = `${roleName}-${feature}`;
            setPendingChanges(prev => ({ ...prev, [lockKey]: newValue }));
            return updatePermission(roleName, feature, newValue);
        });

        try {
            await Promise.all(promises);
            showNotification?.(`បានធ្វើបច្ចុប្បន្នភាពសិទ្ធិទាំងអស់សម្រាប់ "${roleName}" រួចរាល់`, 'success');
            setTimeout(() => setPendingChanges({}), 2000);
        } catch (err: any) {
            showNotification?.(`Mass toggle failed for role ${roleName}`, 'error');
        }
    };

    if (!allRoleColumns.length) return (
        <div className="flex flex-col items-center justify-center py-20 px-4 gap-4 bg-[#1e2329] border border-[#2b3139] rounded-sm shadow-xl">
            <div className="w-16 h-16 bg-[#2b3139] rounded-full flex items-center justify-center border border-[#474d57]">
                <svg className="w-8 h-8 text-[#848e9c] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-sm font-medium text-[#848e9c]">មិនមានទិន្នន័យតួនាទី (No Roles Found)</p>
        </div>
    );

    const hasOrphans = allRoleColumns.some(r => r.isOrphan);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col space-y-4 p-5 bg-[#1e2329] border border-[#2b3139] rounded-sm shadow-2xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Feature Search */}
                    <div className="relative w-full lg:max-w-md group">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="ស្វែងរកតាមឈ្មោះមុខងារ (Search features...)"
                            value={featureSearch}
                            onChange={(e) => setFeatureSearch(e.target.value)}
                            className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-sm py-2.5 pl-10 pr-4 text-sm text-[#eaecef] placeholder:text-[#5e6673] focus:border-[#fcd535] outline-none transition-all shadow-inner"
                        />
                        {featureSearch && (
                            <button
                                onClick={() => setFeatureSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5e6673] hover:text-[#eaecef] p-1 rounded-full hover:bg-[#2b3139] transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSyncToSheet}
                            disabled={syncing || resetting}
                            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-sm border border-[#2b3139] bg-[#2b3139] text-[#eaecef] hover:bg-[#474d57] hover:border-[#474d57] transition-all disabled:opacity-50 active:scale-95 shadow-lg group"
                        >
                            {syncing ? <Spinner size="xs" /> : (
                                <svg className="w-4 h-4 text-[#fcd535] group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            )}
                            Sync to Sheets
                        </button>

                        {!showResetConfirm ? (
                            <button
                                onClick={() => setShowResetConfirm(true)}
                                disabled={resetting || syncing}
                                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-sm border border-[#F6465D30] bg-[#F6465D15] text-[#F6465D] hover:bg-[#F6465D] hover:text-white transition-all disabled:opacity-50 active:scale-95 shadow-lg"
                            >
                                {resetting ? <Spinner size="xs" /> : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                )}
                                Reset Matrix
                            </button>
                        ) : (
                            <div className="flex items-center gap-3 px-4 py-2 rounded-sm border border-[#F6465D50] bg-[#F6465D20] animate-fade-in">
                                <span className="text-xs text-[#F6465D] font-bold">តើអ្នកចង់ Reset គ្រប់សិទ្ធិមែនទេ?</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleReset}
                                        className="px-3 py-1.5 text-xs font-black rounded bg-[#F6465D] text-white hover:brightness-110 active:scale-95 transition-all shadow-lg"
                                    >
                                        បាទ/ចាស
                                    </button>
                                    <button
                                        onClick={() => setShowResetConfirm(false)}
                                        className="px-3 py-1.5 text-xs font-bold rounded bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition-colors"
                                    >
                                        ទេ
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Category Quick Filter */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#2b3139]">
                    <span className="text-[10px] uppercase font-bold text-[#5e6673] mr-2">បង្ហាញតាមផ្នែក:</span>
                    <button
                        onClick={() => setActiveCategory('all')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                            activeCategory === 'all' ? 'bg-[#fcd535] text-[#1e2329]' : 'bg-[#2b3139] text-[#848e9c] hover:bg-[#474d57]'
                        }`}
                    >
                        ទាំងអស់
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${
                                activeCategory === cat.id ? 'bg-[#fcd535] text-[#1e2329]' : 'bg-[#2b3139] text-[#848e9c] hover:bg-[#474d57]'
                            }`}
                        >
                            {cat.name.split(' (')[0]}
                        </button>
                    ))}
                </div>
            </div>

            {hasOrphans && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-sm text-xs shadow-md border-l-4 animate-slide-up" style={{ backgroundColor: '#F0B90B10', borderColor: '#F0B90B', color: '#F0B90B' }}>
                    <div className="w-8 h-8 rounded-full bg-[#F0B90B20] flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold">!</span>
                    </div>
                    <span className="font-medium">
                        <strong>Role មិនទាន់ចុះឈ្មោះ:</strong> មានអ្នកប្រើប្រាស់កំពុងប្រើ Role ដែលមិនទាន់មានក្នុងតារាង Roles ។ សូមចុចប៊ូតុង <strong>Register</strong> លើក្បាលតារាងដើម្បីបន្ថែមពួកវាជាផ្លូវការ។
                    </span>
                </div>
            )}

            <div className="w-full max-h-[75vh] overflow-y-auto overflow-x-auto custom-scrollbar rounded-sm border border-[#2b3139] bg-[#0b0e11] relative shadow-2xl group/table">
                <table className="w-full border-collapse text-left table-fixed min-w-max">
                    <thead className="sticky top-0 z-[40] bg-[#1e2329] shadow-md">
                        <tr>
                            <th className="px-6 py-5 text-left font-bold text-[#eaecef] text-sm sticky left-0 z-50 bg-[#1e2329] w-[300px] border-r border-[#2b3139]">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-4 bg-[#fcd535]"></div>
                                    <span className="uppercase tracking-widest text-[11px] text-[#848e9c]">មុខងារប្រព័ន្ធ / មុខនាទី</span>
                                </div>
                            </th>
                            {allRoleColumns.map((role) => (
                                <th
                                    key={role.name}
                                    className="px-4 py-5 text-center font-bold text-sm min-w-[160px] bg-[#1e2329] border-b border-[#2b3139]"
                                    style={{ color: role.isOrphan ? '#F0B90B' : '#EAECEF' }}
                                >
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-mono opacity-40">ID:{role.id}</span>
                                            <span className="text-sm tracking-tight">{role.name}</span>
                                        </div>
                                        
                                        {/* Column Mass Action */}
                                        {role.name.toLowerCase() !== 'admin' && (
                                            <div className="flex items-center gap-1 bg-[#0b0e11] p-0.5 rounded-full border border-[#2b3139]">
                                                <button
                                                    onClick={() => handleRoleMassToggle(role.name, 'enable')}
                                                    title={`បើកសិទ្ធិទាំងអស់សម្រាប់ ${role.name}`}
                                                    className="p-1 rounded-full text-[#0ecb81] hover:bg-[#0ecb8120] transition-colors"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => handleRoleMassToggle(role.name, 'disable')}
                                                    title={`បិទសិទ្ធិទាំងអស់សម្រាប់ ${role.name}`}
                                                    className="p-1 rounded-full text-[#f6465d] hover:bg-[#f6465d20] transition-colors"
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        )}

                                        {role.isOrphan && (
                                            <button
                                                onClick={() => handleRegisterRole(role.name)}
                                                disabled={registering === role.name}
                                                className="mt-1 px-3 py-1 text-[9px] font-black uppercase rounded-full bg-[#F0B90B] text-[#1e2329] hover:bg-[#fcd535] shadow-lg transition-all active:scale-90"
                                            >
                                                {registering === role.name ? '...' : 'Register'}
                                            </button>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2b3139]">
                        {categories.map((cat) => {
                            if (!isCategoryVisible(cat)) return null;
                            const isCollapsed = collapsedCategories[cat.id];
                            
                            return (
                                <React.Fragment key={cat.id}>
                                    {/* Category Header Row */}
                                    <tr 
                                        className="bg-[#181a20] z-20 cursor-pointer hover:bg-[#1e2329] transition-colors"
                                        onClick={() => toggleCategory(cat.id)}
                                    >
                                        <td colSpan={allRoleColumns.length + 1} className="px-6 py-4 border-y border-[#2b3139]">
                                            <div className="flex items-center gap-3">
                                                <div className={`transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}>
                                                    <svg className="w-4 h-4 text-[#fcd535]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                                <span className="text-[12px] font-black uppercase text-[#eaecef] tracking-widest">{cat.name}</span>
                                                <span className="px-2 py-0.5 rounded-full bg-[#2b3139] text-[10px] text-[#848e9c]">
                                                    {cat.features.filter(isFeatureVisible).length} មុខងារ
                                                </span>
                                                <div className="h-px flex-grow bg-gradient-to-r from-[#2b3139] to-transparent ml-4 opacity-30"></div>
                                            </div>
                                        </td>
                                    </tr>
                                    {!isCollapsed && cat.features.map(feature => {
                                        if (!isFeatureVisible(feature)) return null;
                                        const info = FEATURE_INFO[feature];
                                        
                                        return (
                                            <tr key={feature} className="hover:bg-[#fcd535]/[0.02] transition-colors group">
                                                <td className="px-6 py-4 sticky left-0 z-10 bg-[#0b0e11] group-hover:bg-[#12161c] border-r border-[#2b3139] shadow-xl transition-all">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-[#1e2329] border border-[#2b3139] flex items-center justify-center text-lg mt-0.5">
                                                                {info?.icon || '⚙️'}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-[#eaecef] group-hover:text-[#fcd535] transition-colors">
                                                                    {info?.label || feature.replace(/_/g, ' ')}
                                                                </span>
                                                                <span className="text-[10px] text-[#848e9c] mt-0.5 line-clamp-1 max-w-[200px]" title={info?.desc}>
                                                                    {info?.desc || 'មិនមានការពិពណ៌នា'}
                                                                </span>
                                                                <span className="text-[9px] font-mono text-[#5e6673] mt-1 opacity-40 uppercase tracking-tighter">
                                                                    key: {feature}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Row Mass Actions */}
                                                        <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => handleMassToggle(feature, 'enable')}
                                                                title="បើកឱ្យគ្រប់គ្នា"
                                                                className="p-1 rounded bg-[#0ecb8110] text-[#0ecb81] hover:bg-[#0ecb81] hover:text-[#0b0e11] transition-all"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleMassToggle(feature, 'disable')}
                                                                title="បិទគ្រប់គ្នា"
                                                                className="p-1 rounded bg-[#f6465d10] text-[#f6465d] hover:bg-[#f6465d] hover:text-white transition-all"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>

                                                {allRoleColumns.map((role) => {
                                                    const roleName = role.name;
                                                    const lockKey = `${roleName}-${feature}`;
                                                    const matchedPerm = permissions.find(p =>
                                                        (getValueCaseInsensitive(p, 'Role') || '').toLowerCase() === roleName.toLowerCase() &&
                                                        (getValueCaseInsensitive(p, 'Feature') || '').toLowerCase() === feature.toLowerCase()
                                                    );
                                                    const serverEnabled = matchedPerm
                                                        ? Boolean(getValueCaseInsensitive(matchedPerm, 'IsEnabled'))
                                                        : false;

                                                    const isEnabled = lockKey in pendingChanges
                                                        ? pendingChanges[lockKey]
                                                        : serverEnabled;

                                                    const isUpdating = updating === lockKey;
                                                    const isAdminRole = roleName.toLowerCase() === 'admin';

                                                    return (
                                                        <td key={lockKey} className="px-4 py-4 text-center align-middle border-b border-[#2b3139]/30">
                                                            {isAdminRole ? (
                                                                <div className="flex items-center justify-center">
                                                                    <div className="px-3 py-1 bg-[#fcd535]/10 border border-[#fcd535]/30 rounded-full text-[10px] font-black text-[#fcd535] shadow-sm">
                                                                        MASTER
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleToggle(roleName, feature, isEnabled)}
                                                                    disabled={isUpdating}
                                                                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all duration-300 focus:outline-none shadow-md ${
                                                                        isEnabled ? 'bg-[#0ecb81]' : 'bg-[#2b3139]'
                                                                    } ${isUpdating ? 'opacity-50' : 'opacity-100 hover:scale-110'}`}
                                                                >
                                                                    <span
                                                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${
                                                                            isEnabled ? 'translate-x-5.5' : 'translate-x-1'
                                                                        } flex items-center justify-center`}
                                                                    >
                                                                        {isUpdating && <div className="w-2 h-2 border-2 border-[#0ecb81] border-t-transparent rounded-full animate-spin"></div>}
                                                                    </span>
                                                                </button>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                        {filteredFeatures.length === 0 && (
                            <tr>
                                <td colSpan={allRoleColumns.length + 1} className="px-6 py-32 text-center">
                                    <div className="flex flex-col items-center gap-3 opacity-40">
                                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <p className="text-sm font-medium">រកមិនឃើញមុខងារដែលអ្នកស្វែងរកទេ</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #0b0e11; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #2b3139; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #474d57; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}} />
        </div>
    );
};

export default PermissionMatrix;
