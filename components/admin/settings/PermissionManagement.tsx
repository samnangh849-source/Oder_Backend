
import React, { useContext } from 'react';
import { AppContext } from '../../../context/AppContext';
import PermissionMatrix from './PermissionMatrix';

const PermissionManagement: React.FC = () => {
    const { currentUser } = useContext(AppContext);

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Info Section */}
            <div className="relative overflow-hidden bg-blue-600/10 border border-blue-500/20 p-8 rounded-[2.5rem] shadow-2xl group">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/30 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040L3 14.535a12 12 0 001.218 5.463l7.782 4.002 7.782-4.002a12 12 0 001.218-5.463l-.618-8.591z" />
                        </svg>
                    </div>
                    <div className="flex-grow text-center md:text-left">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">Role-Based Access Control (RBAC)</h2>
                        <p className="text-blue-400/80 text-xs font-bold leading-relaxed mt-1 max-w-2xl">
                            ប្រព័ន្ធគ្រប់គ្រងសិទ្ធិអនុញ្ញាតឱ្យអ្នកកំណត់មុខងារនីមួយៗសម្រាប់ក្រុមការងារ (Roles)។ 
                            <span className="text-white font-black mx-1 underline italic">System Admin</span> 
                            នឹងទទួលបានសិទ្ធិពេញលេញដោយស្វ័យប្រវត្តិលើគ្រប់ផ្នែកទាំងអស់នៃកម្មវិធី។
                        </p>
                    </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            </div>

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
