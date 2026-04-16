
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../../context/AppContext';
import { FEATURES } from '../../../constants/permissions';
import Spinner from '../../common/Spinner';
import { getArrayCaseInsensitive, getValueCaseInsensitive } from '../../../constants/settingsConfig';

const PermissionMatrix: React.FC = () => {
    const { appData, updatePermission, showNotification } = useContext(AppContext);
    const [updating, setUpdating] = useState<string | null>(null);
    const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

    const rolesList = getArrayCaseInsensitive(appData, 'roles');
    const permissions = getArrayCaseInsensitive(appData, 'permissions');
    const featureKeys = Object.values(FEATURES);

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
            }, 4000);
        } catch (_) {
            setPendingChanges(prev => {
                const next = { ...prev };
                delete next[lockKey];
                return next;
            });
            showNotification?.('Failed to update permission', 'error');
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
        <div className="flex flex-col gap-2">
            {hasOrphans && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-sm text-xs" style={{ backgroundColor: '#F0B90B10', border: '1px solid #F0B90B30', color: '#F0B90B' }}>
                    <span className="text-base leading-none mt-0.5">⚠</span>
                    <span>
                        <strong>Role ខ្វះ Registration:</strong> columns ដែលមាន "⚠ ពី Users table" = role ដែលប្រើដោយ Users ប៉ុន្តែ មិនទាន់ register ក្នុង Roles table ។
                        Admin អាច toggle permission ផ្ទាល់ ឬ ទៅ Settings → Roles ដើម្បីបង្កើត Role entry ជាផ្លូវការ ។
                    </span>
                </div>
            )}

            <div className="w-full max-h-[65vh] overflow-y-auto overflow-x-auto no-scrollbar rounded-sm border border-[#2b3139] bg-[#1e2329] relative">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 z-[30] bg-[#1e2329] border-b border-[#2b3139]">
                        <tr>
                            <th className="px-6 py-4 text-left font-medium text-[#eaecef] text-sm sticky left-0 z-40 bg-[#1e2329] min-w-[200px] border-r border-[#2b3139]">
                                <span className="text-xs text-[#848e9c] uppercase block mb-1">Access Matrix</span>
                                Feature / Role
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
                                    {role.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2b3139]">
                        {featureKeys.map(feature => (
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
                                        ? (getValueCaseInsensitive(matchedPerm, 'IsEnabled') === true)
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
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PermissionMatrix;
