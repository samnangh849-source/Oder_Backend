import React, { useContext, useEffect, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import TopPerformanceUserJourney from '../components/user/TopPerformanceUserJourney';
import { useOrder } from '../context/OrderContext';
import { 
    Activity, Server, LogOut, ChevronLeft, BarChart3, 
    Layers, Search, ChevronRight, Plus, DollarSign, ListChecks, AlertCircle
} from 'lucide-react';

interface DesktopUserJourneyProps {
    onBackToRoleSelect: () => void;
    userTeams: string[];
}

const DesktopUserJourney: React.FC<DesktopUserJourneyProps> = ({ onBackToRoleSelect, userTeams }) => {
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [teamStats, setTeamStats] = useState({ revenue: 0, cost: 0, paid: 0, unpaid: 0, count: 0 });
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('today');
    const [customStart, setCustomStart] = useState(() => new Date().toISOString().split('T')[0]);
    const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split('T')[0]);

    useEffect(() => {
        // Reset stats when team is deselected
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
        setAppState('create_order');
    };

    const handleTeamSelect = (team: string) => {
        setSelectedTeam(team);
    };

    const handleSwitchTeam = () => {
        setSelectedTeam('');
    };

    const filteredTeams = useMemo(() => {
        if (!searchQuery.trim()) return userTeams;
        const q = searchQuery.toLowerCase();
        return userTeams.filter((team: string) => team.toLowerCase().includes(q));
    }, [searchQuery, userTeams]);

    const globalKpiStats = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const filtered = orders.filter(o => {
            if (!o.Timestamp) return false;
            const date = new Date(o.Timestamp);
            if (isNaN(date.getTime())) return false;
            if (dateFilter === 'today') return date >= today && date <= endOfToday;
            if (dateFilter === 'week') {
                const day = now.getDay();
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
                return date >= weekStart && date <= endOfToday;
            }
            if (dateFilter === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && date <= endOfToday;
            if (dateFilter === 'year') return date.getFullYear() === now.getFullYear() && date <= endOfToday;
            if (dateFilter === 'custom') {
                const start = customStart ? new Date(customStart + 'T00:00:00') : null;
                const end = customEnd ? new Date(customEnd + 'T23:59:59') : null;
                if (start && date < start) return false;
                if (end && date > end) return false;
                return true;
            }
            return true;
        });

        const revenue = filtered.reduce((sum, o) => sum + (Number(o['Grand Total']) || 0), 0);
        const uniqueTeams = new Set(filtered.map(o => o.Team).filter(Boolean));

        return {
            total_orders: filtered.length,
            total_revenue: revenue,
            active_teams: uniqueTeams.size,
        };
    }, [orders, dateFilter, customStart, customEnd]);
    
    const formatNumber = (n: number) => {
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toLocaleString();
    }
    
    const kpiBar = (
        <div className="cm-kpi-bar">
            {selectedTeam ? (
                <>
                    <div className="cm-kpi-cell">
                        <div className="cm-kpi-icon orders"><Activity size={14}/></div>
                        <div className="cm-kpi-info">
                            <div className="cm-kpi-label">{language === 'km' ? 'ការបញ្ជាទិញដែលបានចម្រោះ' : 'Filtered Orders'}</div>
                            <div className="cm-kpi-value">{teamStats.count}</div>
                        </div>
                    </div>
                    <div className="cm-kpi-cell">
                        <div className="cm-kpi-icon revenue"><DollarSign size={14}/></div>
                        <div className="cm-kpi-info">
                            <div className="cm-kpi-label">{language === 'km' ? 'ចំណូលដែលបានចម្រោះ' : 'Filtered Revenue'}</div>
                            <div className="cm-kpi-value">${formatNumber(teamStats.revenue)}</div>
                        </div>
                    </div>
                    <div className="cm-kpi-cell">
                        <div className="cm-kpi-icon top"><ListChecks size={14}/></div>
                        <div className="cm-kpi-info">
                            <div className="cm-kpi-label">{language === 'km' ? 'បានបង់ប្រាក់' : 'Paid'}</div>
                            <div className="cm-kpi-value text-[var(--cm-green)]">{teamStats.paid}</div>
                        </div>
                    </div>
                    <div className="cm-kpi-cell">
                        <div className="cm-kpi-icon coverage"><AlertCircle size={14}/></div>
                        <div className="cm-kpi-info">
                            <div className="cm-kpi-label">{language === 'km' ? 'មិនទាន់បង់ប្រាក់' : 'Unpaid'}</div>
                            <div className="cm-kpi-value text-[var(--cm-red)]">{teamStats.unpaid}</div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    <div className="cm-kpi-cell">
                        <div className="cm-kpi-icon orders"><Activity size={14}/></div>
                        <div className="cm-kpi-info">
                            <div className="cm-kpi-label">{language === 'km' ? 'ការបញ្ជាទិញសរុប' : 'Total Orders'}</div>
                            <div className="cm-kpi-value">{globalKpiStats.total_orders}</div>
                        </div>
                    </div>
                    <div className="cm-kpi-cell">
                        <div className="cm-kpi-icon revenue"><BarChart3 size={14}/></div>
                        <div className="cm-kpi-info">
                            <div className="cm-kpi-label">{language === 'km' ? 'ចំណូលសរុប' : 'Total Revenue'}</div>
                            <div className="cm-kpi-value">${formatNumber(globalKpiStats.total_revenue)}</div>
                        </div>
                    </div>
                    <div className="cm-kpi-cell">
                        <div className="cm-kpi-icon coverage"><Server size={14}/></div>
                        <div className="cm-kpi-info">
                            <div className="cm-kpi-label">{language === 'km' ? 'ក្រុមសកម្ម' : 'Active Teams'}</div>
                            <div className="cm-kpi-value">{globalKpiStats.active_teams}</div>
                        </div>
                    </div>
                </>
            )}

            {/* Date Selection Options - Always Visible */}
            <div className="ml-auto flex items-center px-4 gap-1 border-l border-[var(--cm-border)]">
                {(['today', 'week', 'month', 'year', 'custom'] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setDateFilter(f)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all rounded ${
                            dateFilter === f
                            ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)]'
                            : 'text-[var(--cm-text-muted)] hover:text-[var(--cm-text-primary)] hover:bg-[var(--cm-border)]'
                        }`}
                    >
                        {f === 'today' ? (language === 'km' ? 'ថ្ងៃនេះ' : 'Today') :
                            f === 'week' ? (language === 'km' ? 'សប្តាហ៍នេះ' : 'This Week') :
                            f === 'month' ? (language === 'km' ? 'ខែនេះ' : 'Month') :
                            f === 'year' ? (language === 'km' ? 'ឆ្នាំនេះ' : 'Year') :
                            (language === 'km' ? 'កំណត់' : 'Custom')}
                    </button>
                ))}
                {dateFilter === 'custom' && (
                    <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[var(--cm-border)]">
                        <input
                            type="date"
                            value={customStart}
                            max={customEnd}
                            onChange={e => setCustomStart(e.target.value)}
                            className="bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] text-[11px] font-semibold text-[var(--cm-text-primary)] rounded px-2 py-1 outline-none focus:border-[var(--cm-accent)] cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                        />
                        <span className="text-[var(--cm-text-muted)] text-[10px] font-bold">→</span>
                        <input
                            type="date"
                            value={customEnd}
                            min={customStart}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={e => setCustomEnd(e.target.value)}
                            className="bg-[var(--cm-card-bg2)] border border-[var(--cm-border)] text-[11px] font-semibold text-[var(--cm-text-primary)] rounded px-2 py-1 outline-none focus:border-[var(--cm-accent)] cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="cambodia-map-root" style={themeVars}>
            <style>{`
                .cambodia-map-root { font-family: 'Inter', 'Noto Sans Khmer', sans-serif; background: var(--cm-bg); color: var(--cm-text-primary); height: 100vh; width: 100%; display: flex; flex-direction: column; }
                .cm-header { background: var(--cm-card-bg); border-bottom: 1px solid var(--cm-border); padding: 0 20px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; height: 52px; flex-shrink: 0; }
                .cm-header-left { display: flex; align-items: center; gap: 10px; height: 100%; }
                .cm-header-title { display: flex; align-items: center; gap: 10px; }
                .cm-header-title h1 { font-size: 14px; font-weight: 700; margin: 0; color: var(--cm-text-primary); letter-spacing: 0.01em; white-space: nowrap; }
                .cm-logo-icon { width: 26px; height: 26px; background: var(--cm-accent); border-radius: 2px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: var(--cm-accent-text); font-size: 10px; flex-shrink: 0; }
                .cm-header-actions { display: flex; align-items: center; gap: 6px; }
                .cm-icon-btn { background: var(--cm-input-bg); border: 1px solid var(--cm-border); border-radius: 2px; padding: 5px 10px; font-size: 11px; font-weight: 700; cursor: pointer; color: var(--cm-text-secondary); display: flex; align-items: center; gap: 5px; transition: all 0.12s; font-family: inherit; }
                .cm-icon-btn:hover { border-color: var(--cm-accent); color: var(--cm-accent); }
                .cm-kpi-bar { display: flex; align-items: stretch; border-bottom: 1px solid var(--cm-border); background: var(--cm-card-bg2); overflow-x: auto; flex-shrink: 0; }
                .cm-kpi-bar::-webkit-scrollbar { display: none; }
                .cm-kpi-cell { padding: 10px 20px; border-right: 1px solid var(--cm-border); display: flex; align-items: center; gap: 10px; min-width: fit-content; flex-shrink: 0; }
                .cm-kpi-icon { width: 30px; height: 30px; border-radius: 2px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .cm-kpi-icon.orders { background: rgba(240,185,11,0.12); color: var(--cm-accent); }
                .cm-kpi-icon.revenue { background: rgba(14,203,129,0.12); color: var(--cm-green); }
                .cm-kpi-icon.top { background: rgba(14, 203, 129, 0.12); color: var(--cm-green); }
                .cm-kpi-icon.coverage { background: rgba(246, 70, 93, 0.12); color: var(--cm-red); }
                .cm-kpi-info { display: flex; flex-direction: column; gap: 1px; }
                .cm-kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cm-text-muted); }
                .cm-kpi-value { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--cm-text-primary); line-height: 1.2; }
                .cm-layout { display: flex; height: calc(100vh - 103px); overflow: hidden; flex-grow: 1; }
                .cm-sidebar { width: 280px; min-width: 280px; background: var(--cm-card-bg); border-right: 1px solid var(--cm-border); display: flex; flex-direction: column; overflow: hidden; transition: width 0.2s, min-width 0.2s; }
                .cm-sidebar.collapsed { width: 0; min-width: 0; border-right: none; }
                .cm-sidebar-header { padding: 10px 12px; border-bottom: 1px solid var(--cm-border); display: flex; align-items: center; gap: 8px; background: var(--cm-card-bg2); }
                .cm-search-box { position: relative; flex: 1; }
                .cm-search-input { width: 100%; background: var(--cm-input-bg); border: 1px solid var(--cm-border); border-radius: 2px; padding: 6px 10px 6px 30px; font-size: 12px; color: var(--cm-text-primary); outline: none; font-family: inherit; box-sizing: border-box; }
                .cm-search-input:focus { border-color: var(--cm-accent); }
                .cm-search-icon { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--cm-text-muted); width: 13px; height: 13px; pointer-events: none; }
                .cm-team-list { flex: 1; overflow-y: auto; }
                .cm-team-list::-webkit-scrollbar { width: 3px; }
                .cm-team-list::-webkit-scrollbar-thumb { background: var(--cm-border); border-radius: 2px; }
                .cm-team-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px; cursor: pointer; transition: background 0.08s; border-bottom: 1px solid var(--cm-border-subtle); gap: 8px; }
                .cm-team-item:hover { background: var(--cm-hover); }
                .cm-team-item.active { background: var(--cm-accent-light)!important; border-left: 2px solid var(--cm-accent); padding-left: 10px; }
                .cm-team-item-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
                .cm-team-icon { color: var(--cm-text-muted); }
                .cm-team-item.active .cm-team-icon { color: var(--cm-accent); }
                .cm-team-name { font-size: 14px; font-weight: 600; color: var(--cm-text-primary); }
                .cm-map-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--cm-bg); }
                .welcome-area { padding: 20px; }
            `}</style>
            <header className="cm-header">
                <div className="cm-header-left">
                    {selectedTeam ? (
                         <button className="cm-icon-btn mr-4" onClick={handleSwitchTeam} title={language === 'km' ? 'ត្រឡប់ទៅផ្ទាំងគ្រប់គ្រង' : 'Back to Dashboard'}>
                            <ChevronLeft size={18}/>
                        </button>
                    ) : (
                        <button className="cm-icon-btn mr-2" onClick={onBackToRoleSelect} title={t.back}>
                            <ChevronLeft size={18}/>
                        </button>
                    )}
                    <div className="cm-header-title">
                        <div className="cm-logo-icon"><Layers size={14} /></div>
                        <h1>{selectedTeam ? `Team: ${selectedTeam}` : "Operations Dashboard"}</h1>
                    </div>
                </div>
                <div className="cm-header-actions">
                    <button className="cm-icon-btn" onClick={() => setIsSidebarOpen(v => !v)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                    </button>
                    <button className="cm-icon-btn" onClick={() => setLocalLanguage(localLanguage === 'km' ? 'en' : 'km')}>
                        {localLanguage === 'km' ? 'EN' : 'ខ្មែរ'}
                    </button>
                </div>
            </header>
            {kpiBar}
            <div className="cm-layout">
                <aside className={`cm-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
                    <div className="cm-sidebar-header">
                        <div className="cm-search-box">
                            <Search className="cm-search-icon" size={14} />
                            <input type="text" className="cm-search-input" placeholder="Search Teams..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                        </div>
                    </div>
                    <div className="cm-team-list">
                        {filteredTeams.map((team: string) => (
                            <div key={team} className={`cm-team-item ${selectedTeam === team ? 'active' : ''}`} onClick={() => handleTeamSelect(team)}>
                                <div className="cm-team-item-left">
                                    <Server size={16} className="cm-team-icon" />
                                    <span className="cm-team-name">{team}</span>
                                </div>
                                <ChevronRight size={16} style={{color: 'var(--cm-text-muted)'}}/>
                            </div>
                        ))}
                    </div>
                </aside>
                <main className="cm-map-area">
                    {selectedTeam ? (
                        <UserOrdersView
                            onAdd={handleCreateOrder}
                            onStatsUpdate={setTeamStats}
                            dateFilter={
                                dateFilter === 'week' ? 'this_week' :
                                dateFilter === 'month' ? 'this_month' :
                                dateFilter === 'year' ? 'this_year' :
                                dateFilter as any
                            }
                            customStart={dateFilter === 'custom' ? customStart : undefined}
                            customEnd={dateFilter === 'custom' ? customEnd : undefined}
                        />
                    ) : (
                        <div className="welcome-area h-full overflow-y-auto custom-scrollbar">
                            <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-10">
                                <div>
                                    <h2 className="text-xl font-bold mb-2 uppercase tracking-tight italic" style={{color: 'var(--cm-text-primary)'}}>
                                        {language === 'km' ? 'សូមស្វាគមន៍មកកាន់ ផ្ទាំងគ្រប់គ្រងប្រតិបត្តិការ' : 'Welcome to Operations Dashboard'}
                                    </h2>
                                    <p style={{color: 'var(--cm-text-muted)', fontSize: '13px'}}>
                                        {language === 'km' ? 'សូមជ្រើសរើសក្រុមពី Sidebar ដើម្បីមើលការកម្មង់ និងព័ត៌មានលម្អិត។' : 'Select a team from the sidebar to view active orders and details.'}
                                    </p>
                                </div>

                                <TopPerformanceUserJourney orders={orders} language={localLanguage} period={dateFilter as any} />
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default DesktopUserJourney;
