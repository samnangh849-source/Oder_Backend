import React, { useState } from 'react';
import { IncentiveCalculator, AppData } from '../../../types';
import { MousePointer2, Target, Users, ShieldCheck, Box, UserX, Search } from 'lucide-react';
import { getArrayCaseInsensitive, getValueCaseInsensitive } from '../../../constants/settingsConfig';

interface Step3TargetEntitiesProps {
    calcData: Partial<IncentiveCalculator>;
    appData: AppData;
    updateField: (field: keyof IncentiveCalculator, value: any) => void;
    toggleApplyTo: (item: string) => void;
    toggleExcludeTarget: (item: string) => void;
}

const Step3TargetEntities: React.FC<Step3TargetEntitiesProps> = ({ calcData, appData, updateField, toggleApplyTo, toggleExcludeTarget }) => {
    const roles = getArrayCaseInsensitive(appData, 'roles');
    const [userSearch, setUserSearch] = useState('');

    const filteredUsers = (appData.users || []).filter(u => 
        u.FullName.toLowerCase().includes(userSearch.toLowerCase()) || 
        u.UserName.toLowerCase().includes(userSearch.toLowerCase())
    ).slice(0, 10);

    return (
        <div className="space-y-10">
            <div className="flex items-center gap-4 border-b border-[#1A1A1A] pb-6">
                <div className="w-10 h-10 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#F0B90B]" />
                </div>
                <div>
                    <h3 className="text-lg font-black text-[#EAECEF] uppercase tracking-[0.2em]">Target_Scope_Def</h3>
                    <p className="text-[9px] font-mono text-[#707A8A] uppercase tracking-widest mt-0.5">Map protocol to specific roles, teams, or metrics</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Inclusion Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <MousePointer2 className="w-3.5 h-3.5 text-[#707A8A]" />
                        <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Inclusion_Matrix</label>
                    </div>
                    <div className="bg-[#050505] border border-[#1A1A1A] rounded p-5 max-h-[400px] overflow-y-auto space-y-6 custom-scrollbar transition-all hover:border-[#F0B90B]/20">
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-[#F0B90B] uppercase tracking-[0.2em] flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" />
                                Roles_Protocol
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {roles.map((r, idx) => {
                                    const roleName = getValueCaseInsensitive(r, 'RoleName') || getValueCaseInsensitive(r, 'Role');
                                    return (
                                        <button 
                                            key={roleName || idx} 
                                            type="button" 
                                            onClick={() => toggleApplyTo(`Role:${roleName}`)} 
                                            className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-all uppercase tracking-widest ${calcData.applyTo?.includes(`Role:${roleName}`) ? 'bg-[#F0B90B] text-black border-[#F0B90B] shadow-lg shadow-[#F0B90B]/10' : 'bg-[#121212] border-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF]'}`}
                                        >
                                            {roleName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="space-y-3 pt-4 border-t border-[#1A1A1A]">
                            <span className="text-[10px] font-black text-[#F0B90B] uppercase tracking-[0.2em] flex items-center gap-2">
                                <Users className="w-3 h-3" />
                                Teams_Sync
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(appData.pages?.map(p => p.Team))).filter(t => t).map(team => (
                                    <button 
                                        key={team} 
                                        type="button" 
                                        onClick={() => toggleApplyTo(`Team:${team}`)} 
                                        className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-all uppercase tracking-widest ${calcData.applyTo?.includes(`Team:${team}`) ? 'bg-[#F0B90B] text-black border-[#F0B90B] shadow-lg shadow-[#F0B90B]/10' : 'bg-[#121212] border-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF]'}`}
                                    >
                                        {team}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exclusion Section */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <UserX className="w-3.5 h-3.5 text-red-500" />
                        <label className="text-[9px] font-black text-red-500/80 uppercase tracking-[0.2em]">Exclusion_List</label>
                    </div>
                    <div className="bg-[#050505] border border-red-500/10 rounded p-5 max-h-[400px] overflow-y-auto space-y-6 custom-scrollbar transition-all hover:border-red-500/30">
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#707A8A]" />
                                <input 
                                    type="text"
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    placeholder="SEARCH STAFF TO EXCLUDE..."
                                    className="w-full bg-[#121212] border border-[#1A1A1A] rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-bold text-[#EAECEF] focus:border-red-500/40 outline-none transition-all placeholder:text-[#333]"
                                />
                            </div>
                            
                            <div className="flex flex-wrap gap-2 min-h-[40px]">
                                {filteredUsers.map(u => (
                                    <button 
                                        key={u.UserName}
                                        type="button"
                                        onClick={() => toggleExcludeTarget(`User:${u.UserName}`)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-widest flex items-center gap-2 ${calcData.excludeTargets?.includes(`User:${u.UserName}`) ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-[#121212] border-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF] hover:border-red-500/20'}`}
                                    >
                                        {u.FullName}
                                        {calcData.excludeTargets?.includes(`User:${u.UserName}`) && <UserX size={10} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-[#1A1A1A]">
                            <span className="text-[10px] font-black text-[#707A8A] uppercase tracking-[0.2em] flex items-center gap-2 italic">
                                Exclusion_Rules (Roles)
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {roles.map((r, idx) => {
                                    const roleName = getValueCaseInsensitive(r, 'RoleName') || getValueCaseInsensitive(r, 'Role');
                                    return (
                                        <button 
                                            key={roleName || idx} 
                                            type="button" 
                                            onClick={() => toggleExcludeTarget(`Role:${roleName}`)} 
                                            className={`px-3 py-1.5 rounded text-[10px] font-bold border transition-all uppercase tracking-widest ${calcData.excludeTargets?.includes(`Role:${roleName}`) ? 'bg-red-500/20 text-red-500 border-red-500/40' : 'bg-[#121212] border-[#1A1A1A] text-[#707A8A] hover:text-[#EAECEF]'}`}
                                        >
                                            {roleName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-8 border-t border-[#1A1A1A] grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-[#707A8A]" />
                        <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Core_Performance_Metric</label>
                    </div>
                    <select 
                        value={calcData.metricType} onChange={e => updateField('metricType', e.target.value)}
                        className="w-full h-11 bg-[#050505] border border-[#1A1A1A] rounded px-4 text-[11px] font-bold text-[#EAECEF] outline-none focus:border-[#F0B90B]/50 transition-all cursor-pointer uppercase tracking-widest"
                    >
                        <option value="Sales Amount">SALES_AMOUNT_VOLUME</option>
                        <option value="Number of Orders">ORDER_COUNT_INT</option>
                        <option value="Revenue">GROSS_REVENUE_FLOW</option>
                        <option value="Profit">NET_PROFIT_MARGIN</option>
                    </select>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Box className="w-3.5 h-3.5 text-[#707A8A]" />
                        <label className="text-[9px] font-black text-[#707A8A] uppercase tracking-[0.2em]">Measurement_Unit</label>
                    </div>
                    <div className="flex p-1 bg-[#050505] rounded border border-[#1A1A1A]">
                        {['USD', 'Count', '%'].map(u => (
                            <button 
                                key={u} 
                                onClick={() => updateField('metricUnit', u)} 
                                className={`flex-1 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${calcData.metricUnit === u ? 'bg-[#2B3139] text-[#F0B90B] shadow-lg' : 'text-[#707A8A] hover:text-[#EAECEF]'}`}
                            >
                                {u === 'USD' ? 'CURRENCY' : u === 'Count' ? 'INTEGER' : 'PERCENT'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step3TargetEntities;