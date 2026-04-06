
import React, { useContext, useState } from 'react';
import { AppContext } from '../../../context/AppContext';
import { FEATURES } from '../../../constants/permissions';
import Spinner from '../../common/Spinner';

const PermissionMatrix: React.FC = () => {
    const { appData, updatePermission, showNotification } = useContext(AppContext);
    const [updating, setUpdating] = useState<string | null>(null);
    // Optimistic state: tracks pending toggle values so toggle doesn't snap back
    // while fetchData() races with SSE or other concurrent refreshes
    const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

    const roles = appData.roles || [];
    const permissions = appData.permissions || [];

    const featureKeys = Object.values(FEATURES);

    const handleToggle = async (role: string, feature: string, currentState: boolean) => {
        const lockKey = `${role}-${feature}`;
        const newValue = !currentState;

        // ── Optimistic update: show new value immediately ──────────────────
        setUpdating(lockKey);
        setPendingChanges(prev => ({ ...prev, [lockKey]: newValue }));

        try {
            await updatePermission(role, feature, newValue);
            // After API success, keep pending for 4s to let fetchData settle.
            // If fetchData returns correct data within 4s, clearing pending is fine.
            setTimeout(() => {
                setPendingChanges(prev => {
                    const next = { ...prev };
                    delete next[lockKey];
                    return next;
                });
            }, 4000);
        } catch (_) {
            // Revert on error: clear pending → toggle snaps back to server state
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

    if (!roles.length) return (
        <div className="flex flex-col items-center justify-center py-20 px-4 gap-4 bg-[#1e2329] border border-[#2b3139] rounded-sm">
            <div className="w-12 h-12 bg-[#2b3139] rounded flex items-center justify-center">
                <svg className="w-6 h-6 text-[#848e9c]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-sm font-medium text-[#848e9c]">មិនមានទិន្នន័យតួនាទី (No Roles Found)</p>
        </div>
    );

    return (
        <div className="w-full max-h-[65vh] overflow-y-auto overflow-x-auto no-scrollbar rounded-sm border border-[#2b3139] bg-[#1e2329] relative">
            <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-[30] bg-[#1e2329] border-b border-[#2b3139]">
                    <tr>
                        <th className="px-6 py-4 text-left font-medium text-[#eaecef] text-sm sticky left-0 z-40 bg-[#1e2329] min-w-[200px] border-r border-[#2b3139]">
                            <span className="text-xs text-[#848e9c] uppercase block mb-1">Access Matrix</span>
                            Feature / Role
                        </th>
                        {roles.map(role => (
                            <th key={role.RoleName} className="px-6 py-4 text-center font-medium text-[#eaecef] text-sm min-w-[140px] bg-[#1e2329]">
                                <div className="text-xs text-[#848e9c] block mb-1 font-normal line-clamp-1 truncate">{role.Description}</div>
                                {role.RoleName}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#2b3139]">
                    {featureKeys.map(feature => (
                        <tr key={feature} className="hover:bg-[#2b3139]/30 transition-colors group">
                            {/* Feature Label */}
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

                            {/* Role Toggles */}
                            {roles.map(role => {
                                const lockKey = `${role.RoleName}-${feature}`;
                                // ── Optimistic first, then server data ─────────────────────────
                                const serverEnabled = permissions.find(p =>
                                    (p.Role || '').toLowerCase() === (role.RoleName || '').toLowerCase() &&
                                    (p.Feature || '').toLowerCase() === (feature || '').toLowerCase()
                                )?.IsEnabled || false;
                                
                                const isEnabled = lockKey in pendingChanges
                                    ? pendingChanges[lockKey]
                                    : serverEnabled;

                                const isUpdating = updating === lockKey;
                                const isAdminRole = (role.RoleName || '').toLowerCase() === 'admin';

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
                                                onClick={() => handleToggle(role.RoleName, feature, isEnabled)}
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
    );
};

export default PermissionMatrix;
