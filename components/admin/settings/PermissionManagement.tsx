
import React, { useContext } from 'react';
import { AppContext } from '../../../context/AppContext';
import PermissionMatrix from './PermissionMatrix';

const PermissionManagement: React.FC = () => {
    const { currentUser } = useContext(AppContext);

    return (
        <div className="font-sans animate-fade-in w-full bg-[#181a20] min-h-full">
            <div className="max-w-6xl mx-auto space-y-8 p-6 lg:p-10">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2b3139] pb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-5 bg-[#fcd535] rounded-sm"></div>
                        <h3 className="text-xl font-semibold text-[#eaecef]">Permission Configuration Matrix</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#0ecb81] shadow-[0_0_8px_rgba(14,203,129,0.5)] animate-pulse"></div>
                        <span className="text-sm font-medium text-[#0ecb81]">Real-time Sync Active</span>
                    </div>
                </div>

                <div className="relative z-10 min-h-[400px]">
                    <PermissionMatrix />
                </div>
                
                {/* Footer Notice */}
                <div className="flex flex-col md:flex-row justify-center items-center gap-4 py-8">
                    <div className="h-px bg-[#2b3139] flex-grow max-w-xs"></div>
                    <p className="text-xs font-semibold text-[#5e6673] uppercase tracking-wider">Authorized Personnel Only</p>
                    <div className="h-px bg-[#2b3139] flex-grow max-w-xs"></div>
                </div>
            </div>
        </div>
    );
};

export default PermissionManagement;
