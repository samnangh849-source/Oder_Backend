
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../../context/AppContext';
import { FEATURES } from '../../../constants/permissions';
import Spinner from '../../common/Spinner';
import { getArrayCaseInsensitive, getValueCaseInsensitive } from '../../../constants/settingsConfig';
import { WEB_APP_URL } from '../../../constants';

const PermissionMatrix: React.FC = () => {
    const { appData, updatePermission, showNotification, fetchData } = useContext(AppContext);
    const [updating, setUpdating] = useState<string | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});
    const [syncing, setSyncing] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [registering, setRegistering] = useState<string | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [featureSearch, setFeatureSearch] = useState('');

    const rolesList = getArrayCaseInsensitive(appData, 'roles');
    const permissions = getArrayCaseInsensitive(appData, 'permissions');
    const featureKeys = Object.values(FEATURES);

    const filteredFeatures = useMemo(() => {
        if (!featureSearch.trim()) return featureKeys;
        const q = featureSearch.toLowerCase();
        return featureKeys.filter(f => f.toLowerCase().includes(q) || f.replace(/_/g, ' ').toLowerCase().includes(q));
    }, [featureKeys, featureSearch]);

    // Build the full role list: defined Roles + any role found in Users table
    // that doesn't have a matching entry in the Roles table (case-insensitive).
    // This prevents a mismatch where User.Role = "Sales" but Roles table only has "Sale".
    const allRoleColumns = useMemo(() => {
        // Roles from the Roles table (authoritative list)
        const definedRoles: { name: string; description: string; isOrphan: false }[] = rolesList
            .map((r: any) => {
                const name = (getValueCaseInsensitive(r, 'RoleName') || getValueCaseInsensitive(r, 'Role') || '').trim();
                const description = (getValueCaseInsensitive(r, 'Description') || '').trim();
                return name ? { name, description, isOrphan: false as const } : null;
            })
            .filter(Boolean) as { name: string; description: string; isOrphan: false }[];

        const definedLower = new Set(definedRoles.map(r => r.name.toLowerCase()));

        // Roles found in Users table that are NOT in the Roles table
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

        const orphanRoles: { name: string; description: string; isOrphan: true }[] = [...orphanRoleNames].map(name => ({
            name,
            description: '⚠ ពី Users table (មិនទាន់ register)',
            isOrphan: true as const,
        }));

        return [...definedRoles, ...orphanRoles];
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
                showNotification?.('កំពុង Sync ទិន្នន័យទៅ Sheet...', 'success');
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
                showNotification?.(`Reset ជោគជ័យ — ${json.count} permissions ត្រូវបានបង្កើតឡើងវិញ`, 'success');
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
            // Keep optimistic state briefly so the UI doesn't flicker while
            // appData.permissions propagates from the background fetchData.
            setTimeout(() => {
                setPendingChanges(prev => {
                    const next = { ...prev };
                    delete next[lockKey];
                    return next;
                });
            }, 2000);
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

    if (!allRoleColumns.length) return (
        <div className="flex flex-col items-center justify-center py-20 px-4 gap-4 bg-[#1e2329] border border-[#2b3139] rounded-sm">
            <div className="w-12 h-12 bg-[#2b3139] rounded flex items-center justify-center">
                <svg className="w-6 h-6 text-[#848e9c]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-sm font-medium text-[#848e9c]">មិនមានទិន្នន័យតួនាទី (No Roles Found)</p>
        </div>
    );

    const hasOrphans = allRoleColumns.some(r => r.isOrphan);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Feature Search */}
                <div className="relative w-full md:max-w-xs group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#848e9c]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="ស្វែងរកមុខងារ (Search features...)"
                        value={featureSearch}
                        onChange={(e) => setFeatureSearch(e.target.value)}
                        className="w-full bg-[#1e2329] border border-[#2b3139] rounded-sm py-2 pl-10 pr-4 text-sm text-[#eaecef] placeholder:text-[#5e6673] focus:border-[#fcd535] outline-none transition-colors shadow-lg"
                    />
                    {featureSearch && (
                        <button
                            onClick={() => setFeatureSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5e6673] hover:text-[#eaecef]"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Sync DB → Sheet */}
                    <button
                        onClick={handleSyncToSheet}
                        disabled={syncing || resetting}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-sm border border-[#2b3139] bg-[#1e2329] text-[#848e9c] hover:text-[#eaecef] hover:border-[#474d57] transition-colors disabled:opacity-50"
                    >
                        {syncing ? <Spinner size="xs" /> : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        )}
                        Sync to Sheet
                    </button>

                    {/* Reset to Defaults */}
                    {!showResetConfirm ? (
                        <button
                            onClick={() => setShowResetConfirm(true)}
                            disabled={resetting || syncing}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-sm border border-[#F6465D30] bg-[#1e2329] text-[#F6465D] hover:bg-[#F6465D15] hover:border-[#F6465D60] transition-colors disabled:opacity-50"
                        >
                            {resetting ? <Spinner size="xs" /> : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            )}
                            Reset to Defaults
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-[#F6465D50] bg-[#F6465D10]">
                            <span className="text-xs text-[#F6465D] font-medium">លុប Permission ទាំងអស់ ហើយ Reset?</span>
                            <button
                                onClick={handleReset}
                                className="px-3 py-1 text-xs font-bold rounded bg-[#F6465D] text-white hover:opacity-90 transition-opacity"
                            >
                                Confirm
                            </button>
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="px-3 py-1 text-xs font-semibold rounded bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {hasOrphans && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-sm text-xs" style={{ backgroundColor: '#F0B90B10', border: '1px solid #F0B90B30', color: '#F0B90B' }}>
                    <span className="text-base leading-none mt-0.5">⚠</span>
                    <span>
                        <strong>Role ខ្វះ Registration:</strong> columns ដែលមាន "⚠ ពី Users table" = role ដែលប្រើដោយ Users ប៉ុន្តែ មិនទាន់ register ក្នុង Roles table ។
                        Admin អាច toggle permission ផ្ទាល់ ឬ <strong>ចុះឈ្មោះ (Register)</strong> ក្នុង Matrix នេះតែម្ដង ។
                    </span>
                </div>
            )}

            <div className="w-full max-h-[65vh] overflow-y-auto overflow-x-auto no-scrollbar rounded-sm border border-[#2b3139] bg-[#1e2329] relative">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 z-[30] bg-[#1e2329] border-b border-[#2b3139]">
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-[#eaecef] text-sm sticky left-0 z-40 bg-[#1e2329] min-w-[200px] border-r border-[#2b3139]">
                                <span className="text-xs text-[#848e9c] uppercase block mb-1">Access Matrix</span>
                                Feature / Role {featureSearch && <span className="text-[#fcd535] ml-2 text-[10px] normal-case">Filtered: {filteredFeatures.length}</span>}
                            </th>
                            {allRoleColumns.map((role) => (
                                <th
                                    key={role.name}
                                    className="px-6 py-4 text-center font-medium text-sm min-w-[140px] bg-[#1e2329]"
                                    style={{ color: role.isOrphan ? '#F0B90B' : '#EAECEF' }}
                                >
                                    <div
                                        className="text-[10px] block mb-1 font-normal line-clamp-1 truncate"
                                        style={{ color: role.isOrphan ? '#F0B90B99' : '#848E9C' }}
                                        title={role.description}
                                    >
                                        {role.description}
                                    </div>
                                    <div className="flex flex-col items-center gap-2">
                                        <span>{role.name}</span>
                                        {role.isOrphan && (
                                            <button
                                                onClick={() => handleRegisterRole(role.name)}
                                                disabled={registering === role.name}
                                                className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-tight rounded bg-[#F0B90B] text-[#1e2329] hover:bg-[#fcd535] transition-colors disabled:opacity-50"
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
                        {filteredFeatures.length > 0 ? filteredFeatures.map(feature => (
                            <tr key={feature} className="hover:bg-[#2b3139]/30 transition-colors group">
                                <td className="px-6 py-4 sticky left-0 z-10 bg-[#1e2329] group-hover:bg-[#20252b] border-r border-[#2b3139] transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-[#eaecef]">
                                            {feature.replace(/_/g, ' ')}
                                        </span>
                                        <span className="text-xs text-[#848e9c] mt-1">
                                            ID: system.{feature}
                                        </span>
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
                                        <td key={lockKey} className="px-6 py-4 text-center align-middle">
                                            {isAdminRole ? (
                                                <div className="flex items-center justify-center">
                                                    <div className="px-3 py-1 bg-[#2b3139] border border-[#474d57] rounded text-xs text-[#848e9c]">
                                                        Full Access
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleToggle(roleName, feature, isEnabled)}
                                                    disabled={isUpdating}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ${
                                                        isEnabled ? 'bg-[#fcd535]' : 'bg-[#2b3139]'
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow ${
                                                            isEnabled ? 'translate-x-6 bg-[#181a20]' : 'translate-x-1 bg-[#848e9c]'
                                                        } flex items-center justify-center`}
                                                    >
                                                        {isUpdating && <Spinner size="xs" />}
                                                    </span>
                                                </button>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={allRoleColumns.length + 1} className="px-6 py-20 text-center">
                                    <p className="text-sm text-[#848e9c]">រកមិនឃើញមុខងារដែលអ្នកស្វែងរកទេ (No features found)</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PermissionMatrix;
