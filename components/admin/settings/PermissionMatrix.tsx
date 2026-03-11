
import React, { useContext, useState } from 'react';
import { AppContext } from '../../../context/AppContext';
import { FEATURES } from '../../../constants/permissions';
import Spinner from '../../common/Spinner';

const PermissionMatrix: React.FC = () => {
    const { appData, updatePermission, currentUser } = useContext(AppContext);
    const [updating, setUpdating] = useState<string | null>(null); // To show loading on specific toggle

    const roles = appData.roles || [];
    const permissions = appData.permissions || [];
    
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

    if (!roles.length) return <div className="p-10 text-center text-gray-500">មិនមានទិន្នន័យ Role ឡើយ</div>;

    return (
        <div className="w-full overflow-x-auto custom-scrollbar rounded-[2rem] border border-white/5 bg-gray-950/40 backdrop-blur-md">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-bottom border-white/5">
                        <th className="p-6 text-left bg-gray-900/50 sticky left-0 z-20 min-w-[200px]">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Access Matrix</span>
                            <h3 className="text-sm font-black text-white uppercase tracking-tighter">Feature / Role</h3>
                        </th>
                        {roles.map(role => (
                            <th key={role.RoleName} className="p-6 text-center min-w-[140px]">
                                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">{role.Description}</div>
                                <div className="text-sm font-black text-white uppercase tracking-widest">{role.RoleName}</div>
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
                                    (p.Role || '').toLowerCase() === (role.RoleName || '').toLowerCase() && 
                                    (p.Feature || '').toLowerCase() === (feature || '').toLowerCase()
                                )?.IsEnabled || false;
                                
                                const isUpdating = updating === `${role.RoleName}-${feature}`;
                                const isAdminRole = role.RoleName.toLowerCase() === 'admin';

                                return (
                                    <td key={`${role.RoleName}-${feature}`} className="p-6 text-center">
                                        {isAdminRole ? (
                                            <div className="flex items-center justify-center">
                                                <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                                    <span className="text-[9px] font-black text-blue-500 uppercase italic">Full Access</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleToggle(role.RoleName, feature, isEnabled)}
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
