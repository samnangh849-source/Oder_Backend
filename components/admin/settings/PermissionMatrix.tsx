
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../../context/AppContext';
import { FEATURES } from '../../../constants/permissions';
import Spinner from '../../common/Spinner';
import { WEB_APP_URL } from '../../../constants';

const PermissionMatrix: React.FC = () => {
    const { appData, updatePermission, currentUser } = useContext(AppContext);
    const [updating, setUpdating] = useState<string | null>(null); // To show loading on specific toggle
    const [localRoles, setLocalRoles] = useState<any[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);

    const roles = appData.roles && appData.roles.length > 0 ? appData.roles : localRoles;
    const permissions = appData.permissions || [];
    
    // Fetch roles if not present in appData
    useEffect(() => {
        if (!appData.roles || appData.roles.length === 0) {
            const fetchRoles = async () => {
                setIsLoadingRoles(true);
                try {
                    const res = await fetch(`${WEB_APP_URL}/api/roles`);
                    const json = await res.json();
                    if (json.status === 'success') {
                        setLocalRoles(json.data || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch roles in matrix:", err);
                } finally {
                    setIsLoadingRoles(false);
                }
            };
            fetchRoles();
        }
    }, [appData.roles]);

    // Get all features from our constant
    const featureKeys = Object.values(FEATURES);

    const handleToggle = async (role: string, feature: string, currentState: boolean) => {
        const lockKey = `${role}-${feature}`;
        setUpdating(lockKey);
        try {
            await updatePermission(role, feature, !currentState);
        } finally {
            setUpdating(null);
        }
    };

    if (isLoadingRoles) return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Spinner size="lg" />
            <p className="text-xs font-black text-blue-500 uppercase tracking-[0.3em] animate-pulse">Synchronizing Roles...</p>
        </div>
    );

    if (!roles.length) return <div className="p-10 text-center text-gray-500">មិនមានទិន្នន័យ Role ឡើយ</div>;

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
                                const isEnabled = permissions.find(p => 
                                    (p.role || '').toLowerCase() === (role.roleName || '').toLowerCase() && 
                                    (p.feature || '').toLowerCase() === (feature || '').toLowerCase()
                                )?.isEnabled || false;
                                
                                const isUpdating = updating === `${role.roleName}-${feature}`;
                                const isAdminRole = role.roleName.toLowerCase() === 'admin';

                                return (
                                    <td key={`${role.roleName}-${feature}`} className="p-6 text-center">
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
