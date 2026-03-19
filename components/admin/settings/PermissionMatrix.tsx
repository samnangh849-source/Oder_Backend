
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
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-2">
                <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">មិនមានទិន្នន័យតួនាទី (No Roles Found)</p>
        </div>
    );

    return (
        <div className="w-full max-h-[65vh] overflow-y-auto overflow-x-auto no-scrollbar rounded-[2rem] border border-white/5 bg-gray-950/40 backdrop-blur-md relative">
            <table className="w-full border-collapse">
                <thead className="sticky top-0 z-[30]">
                    <tr className="border-bottom border-white/5 shadow-xl">
                        <th className="p-6 text-left bg-[#0f172a] border-b border-white/10 sticky left-0 z-40 min-w-[200px]">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Access Matrix</span>
                            <h3 className="text-sm font-black text-white uppercase tracking-tighter">Feature / Role</h3>
                        </th>
                        {roles.map(role => (
                            <th key={role.roleName} className="p-6 text-center min-w-[140px] bg-[#0f172a] border-b border-white/10">
                                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1 line-clamp-1">{role.description}</div>
                                <div className="text-sm font-black text-white uppercase tracking-widest">{role.roleName}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {featureKeys.map(feature => (
                        <tr key={feature} className="hover:bg-white/[0.02] transition-colors group">
                            {/* Feature Label */}
                            <td className="p-6 sticky left-0 z-10 bg-[#0f172a] group-hover:bg-[#1e293b] border-r border-white/5 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-white uppercase tracking-wide">
                                        {feature.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">
                                        ID: system.{feature}
                                    </span>
                                </div>
                            </td>

                            {/* Role Toggles */}
                            {roles.map(role => {
                                const lockKey = `${role.roleName}-${feature}`;
                                // ── Optimistic first, then server data ─────────────────────────
                                const serverEnabled = permissions.find(p =>
                                    (p.role || '').toLowerCase() === (role.roleName || '').toLowerCase() &&
                                    (p.feature || '').toLowerCase() === (feature || '').toLowerCase()
                                )?.isEnabled || false;
                                
                                const isEnabled = lockKey in pendingChanges
                                    ? pendingChanges[lockKey]
                                    : serverEnabled;

                                const isUpdating = updating === lockKey;
                                const isAdminRole = role.roleName.toLowerCase() === 'admin';

                                return (
                                    <td key={lockKey} className="p-6 text-center">
                                        {isAdminRole ? (
                                            <div className="flex items-center justify-center">
                                                <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                                    <span className="text-[9px] font-black text-blue-500 uppercase italic">Full Access</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleToggle(role.roleName, feature, isEnabled)}
                                                disabled={isUpdating}
                                                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 focus:outline-none shadow-inner ${
                                                    isEnabled ? 'bg-blue-600 shadow-blue-900/20' : 'bg-gray-800'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-xl ${
                                                        isEnabled ? 'translate-x-8' : 'translate-x-1'
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
