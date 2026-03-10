
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../../context/AppContext';
import Spinner from '../../common/Spinner';

const FEATURES = [
    { id: 'create_order', label: 'បង្កើតការកម្មង់ (Create Order)' },
    { id: 'view_all_orders', label: 'មើលការកម្មង់ទាំងអស់ (View All Orders)' },
    { id: 'edit_order', label: 'កែសម្រួលការកម្មង់ (Edit Order)' },
    { id: 'delete_order', label: 'លុបការកម្មង់ (Delete Order)' },
    { id: 'verify_order', label: 'ផ្ទៀងផ្ទាត់ការកម្មង់ (Verify Order/Check Box)' },
    { id: 'pack_order', label: 'ខ្ចប់ឥវ៉ាន់ (Pack Order)' },
    { id: 'dispatch_order', label: 'ប្រគល់ឱ្យអ្នកដឹក (Dispatch Order)' },
    { id: 'view_reports', label: 'មើលរបាយការណ៍ (View Reports)' },
    { id: 'manage_inventory', label: 'គ្រប់គ្រងស្តុក (Manage Inventory)' },
    { id: 'manage_users', label: 'គ្រប់គ្រងអ្នកប្រើប្រាស់ (Manage Users)' },
    { id: 'manage_settings', label: 'គ្រប់គ្រងការកំណត់ (Manage Settings)' },
];

const PermissionManagement: React.FC = () => {
    const { appData, updatePermission } = useContext(AppContext);
    const [loading, setLoading] = useState<string | null>(null);

    const roles = useMemo(() => {
        if (appData.roles && appData.roles.length > 0) {
            return appData.roles.map(r => r.RoleName).sort();
        }
        
        // Fallback if roles table is empty
        const uniqueRoles = new Set(appData.users?.map(u => u.Role).filter(Boolean));
        ['Sales', 'Fulfillment', 'Admin', 'Driver'].forEach(r => uniqueRoles.add(r));
        return Array.from(uniqueRoles).sort();
    }, [appData.roles, appData.users]);

    const handleToggle = async (role: string, feature: string, currentStatus: boolean) => {
        const id = `${role}-${feature}`;
        setLoading(id);
        try {
            await updatePermission(role, feature, !currentStatus);
        } finally {
            setLoading(null);
        }
    };

    const isEnabled = (role: string, feature: string) => {
        return appData.permissions?.find(p => p.Role === role && p.Feature === feature)?.IsEnabled || false;
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl">
                <p className="text-blue-400 text-xs font-bold leading-relaxed">
                    💡 <span className="underline italic">ចំណាំ:</span> System Admin មានសិទ្ធិប្រើប្រាស់គ្រប់មុខងារទាំងអស់ដោយស្វ័យប្រវត្តិ។ ការកំណត់ខាងក្រោមនេះគឺសម្រាប់ Role ធម្មតា។
                </p>
            </div>

            <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-white/5 bg-black/20">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/10">
                            <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">មុខងារ (Features)</th>
                            {roles.map(role => (
                                <th key={role} className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">{role}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {FEATURES.map(feature => (
                            <tr key={feature.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="p-4">
                                    <p className="text-sm font-bold text-white">{feature.label}</p>
                                    <p className="text-[9px] text-gray-500 font-mono italic">{feature.id}</p>
                                </td>
                                {roles.map(role => {
                                    const active = isEnabled(role, feature.id);
                                    const loadingId = `${role}-${feature.id}`;
                                    const isLoading = loading === loadingId;

                                    return (
                                        <td key={role} className="p-4 text-center">
                                            <button
                                                onClick={() => handleToggle(role, feature.id, active)}
                                                disabled={isLoading}
                                                className={`
                                                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
                                                    ${active ? 'bg-blue-600' : 'bg-gray-700'}
                                                    ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                                `}
                                            >
                                                <span
                                                    className={`
                                                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                                        ${active ? 'translate-x-6' : 'translate-x-1'}
                                                    `}
                                                />
                                                {isLoading && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Spinner size="sm" color="white" />
                                                    </div>
                                                )}
                                            </button>
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

export default PermissionManagement;
