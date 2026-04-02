import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import TopPerformanceUserJourney from '../components/user/TopPerformanceUserJourney';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { useOrder } from '../context/OrderContext';
import { 
    Activity, Server, LogOut, ChevronLeft, BarChart3, 
    Layers, Plus, ChevronRight, DollarSign, ListChecks
} from 'lucide-react';

interface MobileUserJourneyProps {
    onBackToRoleSelect: () => void;
    userTeams: string[];
}

const MobileUserJourney: React.FC<MobileUserJourneyProps> = ({ onBackToRoleSelect, userTeams }) => {
    const {
        language,
        setAppState,
        selectedTeam,
        setSelectedTeam,
        hasPermission,
    } = useContext(AppContext);

    const { orders } = useOrder();

    const [localLanguage, setLocalLanguage] = useState<'km' | 'en'>(language);
    const t = translations[localLanguage];
    const { playClick, playTeamSelect } = useSoundEffects();
    const [teamStats, setTeamStats] = useState({ revenue: 0, cost: 0, paid: 0, unpaid: 0, count: 0 });
    const [dateFilter, setDateFilter] = useState<'today' | 'month' | 'year' | 'custom'>('today');

     useEffect(() => {
        if (!selectedTeam) {
            setTeamStats({ revenue: 0, cost: 0, paid: 0, unpaid: 0, count: 0 });
        }
    }, [selectedTeam]);

    const themeVars: React.CSSProperties = {
        '--cm-bg': '#0B0E11',
        '--cm-card-bg': '#1E2329',
        '--cm-card-bg2': '#181A20',
        '--cm-border': '#2B3139',
        '--cm-text-primary': '#EAECEF',
        '--cm-text-secondary': '#B7BDC6',
        '--cm-text-muted': '#707A8A',
        '--cm-accent': '#F0B90B',
        '--cm-accent-text': '#181A20',
        '--cm-green': '#0ECB81',
        '--cm-red': '#F6465D',
      } as React.CSSProperties;

    const handleCreateOrder = () => {
        if (!hasPermission('create_order')) return;
        playClick();
        setAppState('create_order');
    };
    
    const handleTeamSelect = (team: string) => {
        playTeamSelect();
        setSelectedTeam(team);
    };

    const handleSwitchTeam = () => {
        playClick();
        setSelectedTeam('');
    };

    const globalKpiStats = useMemo(() => {
        const now = new Date();
        const filtered = orders.filter(o => {
            const date = new Date(o.Timestamp);
            if (dateFilter === 'today') return date.toDateString() === now.toDateString();
            if (dateFilter === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            if (dateFilter === 'year') return date.getFullYear() === now.getFullYear();
            return true; 
        });

        const revenue = filtered.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0);
        const uniqueTeams = new Set(filtered.map(o => o.Team).filter(Boolean));

        return {
            total_orders: filtered.length,
            total_revenue: revenue,
            active_teams: uniqueTeams.size,
        };
    }, [orders, dateFilter]);
    const formatNumber = (n: number) => n.toLocaleString();

    return (
        <div className="cambodia-map-root-mobile" style={themeVars}>
             <style>{`
                .cambodia-map-root-mobile { font-family: 'Inter', 'Noto Sans Khmer', sans-serif; background: var(--cm-bg); color: var(--cm-text-primary); height: 100vh; width: 100%; display: flex; flex-direction: column; }
                .cm-header-mobile { background: var(--cm-card-bg); border-bottom: 1px solid var(--cm-border); padding: 0 12px; display: flex; align-items: center; justify-content: space-between; height: 52px; flex-shrink: 0; }
                .cm-header-title-mobile { display: flex; align-items: center; gap: 10px; }
                .cm-header-title-mobile h1 { font-size: 16px; font-weight: 700; margin: 0; }
                .cm-logo-icon-mobile { width: 28px; height: 28px; background: var(--cm-accent); border-radius: 2px; display: flex; align-items: center; justify-content: center; }
                .cm-icon-btn-mobile { background: none; border: none; padding: 6px; color: var(--cm-text-secondary); cursor: pointer; }
                .cm-mobile-content { display: flex; flex-direction: column; gap: 16px; overflow-y: auto; flex-grow: 1; }
                .cm-kpi-grid-mobile { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 16px 0; }
                .cm-kpi-card-mobile { background: var(--cm-card-bg2); border: 1px solid var(--cm-border); border-radius: 2px; padding: 12px; }
                .cm-kpi-card-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; color: var(--cm-text-muted); margin-bottom: 8px; text-transform: uppercase; }
                .cm-kpi-card-value { font-size: 20px; font-weight: 700; color: var(--cm-text-primary); }
                .cm-team-list-mobile { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
                .cm-list-header { font-size: 12px; font-weight: 700; color: var(--cm-accent); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
                .cm-team-item-mobile { display: flex; align-items: center; justify-content: space-between; padding: 14px 10px; background: var(--cm-card-bg2); border-radius: 2px; border-left: 3px solid var(--cm-accent); cursor: pointer; }
                .cm-team-item-name-mobile { font-size: 14px; font-weight: 600; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <header className="cm-header-mobile">
                <div className="flex items-center gap-1">
                    {selectedTeam ? (
                        <button className="cm-icon-btn-mobile" onClick={handleSwitchTeam}>
                            <ChevronLeft size={20} color="var(--cm-text-primary)"/>
                        </button>
                    ) : (
                        <button className="cm-icon-btn-mobile" onClick={onBackToRoleSelect}>
                            <ChevronLeft size={20} color="var(--cm-text-primary)"/>
                        </button>
                    )}
                </div>
                
                <div className="cm-header-title-mobile flex-grow">
                    {!selectedTeam && <div className="cm-logo-icon-mobile"><Layers size={16} color="var(--cm-accent-text)"/></div>}
                    <h1 className="truncate max-w-[150px]">{selectedTeam || (language === 'km' ? 'ផ្ទាំងគ្រប់គ្រង' : 'Dashboard')}</h1>
                </div>

                <div className="flex items-center gap-1">
                    <button className="cm-icon-btn-mobile font-bold text-[11px]" onClick={() => setLocalLanguage(language === 'km' ? 'en' : 'km')}>
                        {language === 'km' ? 'EN' : 'ខ្មែរ'}
                    </button>
                </div>
            </header>

            {/* Global Date Filter for Mobile - Always Visible */}
            <div className="flex overflow-x-auto gap-1 px-4 py-2.5 no-scrollbar border-b border-[var(--cm-border)] bg-[var(--cm-card-bg)] flex-shrink-0">
                    {(['today', 'month', 'year', 'custom'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setDateFilter(f)}
                        className={`whitespace-nowrap px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all rounded-full border ${
                            dateFilter === f 
                            ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] border-[var(--cm-accent)] shadow-lg' 
                            : 'text-[var(--cm-text-muted)] border-[var(--cm-border)]'
                        }`}
                    >
                        {f === 'today' ? (language === 'km' ? 'ថ្ងៃនេះ' : 'Today') : 
                        f === 'month' ? (language === 'km' ? 'ខែនេះ' : 'Month') : 
                        f === 'year' ? (language === 'km' ? 'ឆ្នាំនេះ' : 'Year') : 
                        (language === 'km' ? 'កំណត់' : 'Custom')}
                    </button>
                ))}
            </div>

            {selectedTeam ? (
                <div className="flex-grow flex flex-col overflow-hidden">
                     <div className="cm-kpi-grid-mobile flex-shrink-0 !py-3">
                        <div className="cm-kpi-card-mobile">
                            <div className="cm-kpi-card-label"><Activity size={12}/><span>{language === 'km' ? 'ការបញ្ជាទិញ' : 'Orders'}</span></div>
                            <div className="cm-kpi-card-value" style={{color: 'var(--cm-accent)'}}>{teamStats.count}</div>
                        </div>
                        <div className="cm-kpi-card-mobile">
                            <div className="cm-kpi-card-label"><DollarSign size={12}/><span>{language === 'km' ? 'ចំណូល' : 'Revenue'}</span></div>
                            <div className="cm-kpi-card-value" style={{color: 'var(--cm-green)'}}>${formatNumber(teamStats.revenue)}</div>
                        </div>
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <UserOrdersView 
                            onAdd={handleCreateOrder} 
                            onStatsUpdate={setTeamStats} 
                            showColumnSelectorToggle={false} 
                            dateFilter={dateFilter === 'month' ? 'this_month' : dateFilter === 'year' ? 'this_year' : dateFilter as any}
                        />
                    </div>
                </div>
            ) : (
                <div className="cm-mobile-content pb-10">
                    <div className="flex flex-col gap-3 px-4 pt-4 border-b border-[var(--cm-border)] pb-4">
                        <div className="flex overflow-x-auto gap-3 no-scrollbar pb-1">
                            <div className="min-w-[120px] bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] rounded-lg p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--cm-text-muted)] uppercase mb-1">
                                    <Activity size={12}/> {language === 'km' ? 'ការកម្មង់' : 'Orders'}
                                </div>
                                <div className="text-lg font-bold text-[var(--cm-accent)]">{globalKpiStats.total_orders}</div>
                            </div>
                            <div className="min-w-[140px] bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] rounded-lg p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--cm-text-muted)] uppercase mb-1">
                                    <BarChart3 size={12}/> {language === 'km' ? 'ចំណូលសរុប' : 'Total Revenue'}
                                </div>
                                <div className="text-lg font-bold text-[var(--cm-green)]">${formatNumber(globalKpiStats.total_revenue)}</div>
                            </div>
                            <div className="min-w-[120px] bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] rounded-lg p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--cm-text-muted)] uppercase mb-1">
                                    <Server size={12}/> {language === 'km' ? 'ក្រុមសកម្ម' : 'Active Teams'}
                                </div>
                                <div className="text-lg font-bold text-[var(--cm-text-primary)]">{globalKpiStats.active_teams}</div>
                            </div>
                        </div>
                    </div>

                    <div className="cm-team-list-mobile">
                        <div className="cm-list-header">{language === 'km' ? 'ជ្រើសរើសក្រុម' : 'Select a Team'}</div>
                        {userTeams.map((team: string) => (
                            <div key={team} className="cm-team-item-mobile active:bg-[var(--cm-border)] transition-colors" onClick={() => handleTeamSelect(team)}>
                                <span className="cm-team-item-name-mobile">{team}</span>
                                <ChevronRight size={18} style={{color: 'var(--cm-text-muted)'}} />
                            </div>
                        ))}
                    </div>

                    <div className="px-4">
                        <TopPerformanceUserJourney orders={orders} language={localLanguage} period={dateFilter} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobileUserJourney;
