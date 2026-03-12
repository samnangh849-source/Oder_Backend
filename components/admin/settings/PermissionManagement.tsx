
import React, { useContext } from 'react';
import { AppContext } from '../../../context/AppContext';
import PermissionMatrix from './PermissionMatrix';

const PermissionManagement: React.FC = () => {
    const { currentUser } = useContext(AppContext);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* The Main Matrix Component */}
            <div className="bg-gray-800/20 border border-white/5 rounded-[3rem] p-4 lg:p-8 shadow-3xl backdrop-blur-xl relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-blue-600 rounded-full animate-pulse"></div>
                        <h3 className="text-lg font-black text-white uppercase tracking-widest italic">Permission Configuration Matrix</h3>
                    </div>
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/5 rounded-2xl">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Real-time Sync Active</span>
                    </div>
                </div>

                <div className="relative z-10 min-h-[400px]">
                    <PermissionMatrix />
                </div>
                
                {/* Background Decoration */}
                <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-blue-600/10 transition-colors duration-700"></div>
            </div>

            {/* Footer Notice */}
            <div className="flex flex-col md:flex-row justify-center items-center gap-4 py-4 opacity-50">
                <div className="h-px bg-white/10 flex-grow"></div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] italic">Authorized Personnel Only</p>
                <div className="h-px bg-white/10 flex-grow"></div>
            </div>
        </div>
    );
};

export default PermissionManagement;
