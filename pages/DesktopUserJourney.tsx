
import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { WEB_APP_URL } from '../constants';
import Spinner from '../components/common/Spinner';
import { ChevronLeft, ChevronRight, TrendingUp, Info, Plus, LogOut, ArrowLeftRight } from 'lucide-react';

interface DesktopUserJourneyProps {
    onBackToRoleSelect: () => void;
    userTeams: string[];
}

const DesktopUserJourney: React.FC<DesktopUserJourneyProps> = ({ onBackToRoleSelect, userTeams }) => {
    const {
        setChatVisibility,
        language,
        setAppState,
        selectedTeam,
        setSelectedTeam,
        hasPermission,
        advancedSettings
    } = useContext(AppContext);

    const t = translations[language];
    const { playClick, playTransition, playHover, playTeamSelect } = useSoundEffects();

    // Theme derivation — mirrors MobileUserJourney pattern
    const theme = useMemo(() => {
        const isLightMode = advancedSettings?.themeMode === 'light';
        const uiTheme = advancedSettings?.uiTheme || 'default';
        const br = uiTheme === 'binance' ? 2 : (advancedSettings?.borderRadius ?? 12);

        const accentColor =
            uiTheme === 'netflix' ? '#e50914' :
            uiTheme === 'samsung' ? '#0381fe' :
            uiTheme === 'finance' ? '#10b981' :
            uiTheme === 'binance' ? (isLightMode ? '#FCD535' : '#F0B90B') :
                                    '#3b82f6';

        const accentText = (uiTheme === 'binance' || accentColor === '#FCD535' || accentColor === '#F0B90B')
            ? '#181A20' : '#ffffff';
        const greenOk     = isLightMode ? '#02C076' : '#0ECB81';
        const bg          = isLightMode ? '#F5F5F5' : '#0B0E11';
        const cardBg      = isLightMode ? '#FFFFFF' : '#1E2329';
        const textPrimary = isLightMode ? '#1E2329' : '#EAECEF';
        const textMuted   = isLightMode ? '#707A8A' : '#848E9C';
        const borderColor = isLightMode ? '#E6E8EA' : '#2B3139';
        const cardHover   = isLightMode ? '#F8F9FA' : '#252930';

        return { isLightMode, uiTheme, br, accentColor, accentText, greenOk, bg, cardBg, textPrimary, textMuted, borderColor, cardHover };
    }, [advancedSettings?.themeMode, advancedSettings?.uiTheme, advancedSettings?.borderRadius]);

    const { isLightMode, br, accentColor, accentText, greenOk, bg, cardBg, textPrimary, textMuted, borderColor, cardHover } = theme;

    const [globalRanking, setGlobalRanking] = useState<{name: string, revenue: number}[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    const [rankingPeriod, setRankingPeriod] = useState<'today' | 'this_week' | 'this_month' | 'all'>('today');

    const fetchRanking = useCallback(async () => {
        setIsRankingLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${WEB_APP_URL}/api/teams/ranking?period=${rankingPeriod}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });

            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success' && result.data) {
                    setGlobalRanking(result.data.map((r: any) => ({
                        name: r.Team || 'Unknown',
                        revenue: Number(r.Revenue) || 0
                    })));
                }
            }
        } catch (err) {
            console.error("Failed to fetch team ranking:", err);
        } finally {
            setIsRankingLoading(false);
        }
    }, [rankingPeriod]);

    useEffect(() => {
        setChatVisibility(true);
        if (!selectedTeam) fetchRanking();
    }, [setChatVisibility, selectedTeam, fetchRanking]);

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

    // ─── Team Selection View ───
    if (!selectedTeam) {
        const maxRevenue = globalRanking.reduce((m, r) => Math.max(m, r.revenue), 1);

        return (
            <div className="min-h-full font-sans relative" style={{ backgroundColor: bg, color: textPrimary }}>



                {/* Content */}
                <div className="max-w-[1400px] mx-auto px-6 sm:px-10 py-6 sm:py-8">

                    {/* Page Title Row */}
                    <div className="flex items-end justify-between mb-8">
                        <div className="flex items-start gap-4">
                            <button
                                onClick={onBackToRoleSelect}
                                className="mt-1 p-2 active:scale-90 transition-all"
                                style={{
                                    borderRadius: `${Math.min(br, 12)}px`,
                                    backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139',
                                    color: textMuted,
                                    border: `1px solid ${borderColor}`,
                                }}
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight" style={{ color: textPrimary }}>
                                    {language === 'km' ? 'ផ្ទាំងគ្រប់គ្រងការកម្មង់' : 'Order Dashboard'}
                                </h1>
                                <p className="text-sm mt-1" style={{ color: textMuted }}>
                                    {language === 'km' ? 'ជ្រើសរើសក្រុមការងារដើម្បីចាប់ផ្តើម' : 'Select your team to get started'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border" style={{ borderColor, backgroundColor: `${greenOk}10` }}>
                                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: greenOk }} />
                                <span className="text-xs font-semibold" style={{ color: greenOk }}>
                                    {language === 'km' ? 'ដំណើរការ' : 'Online'}
                                </span>
                            </div>
                            <div className="px-3 py-1.5 rounded-md border" style={{ borderColor, backgroundColor: `${accentColor}10` }}>
                                <span className="text-xs font-semibold" style={{ color: accentColor }}>
                                    {userTeams.length} {language === 'km' ? 'ក្រុម' : 'Teams'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

                        {/* Left: Team Cards */}
                        <div className="lg:col-span-7 space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: textMuted }}>
                                {language === 'km' ? 'ក្រុមរបស់អ្នក' : 'Your Teams'}
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {userTeams.map((team) => (
                                    <button
                                        key={team}
                                        onClick={() => handleTeamSelect(team)}
                                        onMouseEnter={playHover}
                                        className="group text-left flex items-center gap-4 p-4 border transition-all duration-200"
                                        style={{
                                            borderRadius: `${Math.min(br, 12)}px`,
                                            backgroundColor: cardBg,
                                            borderColor,
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.backgroundColor = cardHover;
                                            e.currentTarget.style.borderColor = `${accentColor}60`;
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.backgroundColor = cardBg;
                                            e.currentTarget.style.borderColor = borderColor;
                                        }}
                                    >
                                        <div
                                            className="w-11 h-11 shrink-0 flex items-center justify-center font-bold text-lg"
                                            style={{
                                                borderRadius: `${Math.max(6, Math.round(br / 2))}px`,
                                                backgroundColor: accentColor,
                                                color: accentText,
                                            }}
                                        >
                                            {team.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="flex-grow min-w-0">
                                            <h3 className="text-[15px] font-bold leading-tight truncate" style={{ color: textPrimary }}>
                                                {team}
                                            </h3>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: greenOk }} />
                                                <span className="text-[11px] font-medium" style={{ color: greenOk }}>
                                                    {language === 'km' ? 'ប្រើប្រាស់បាន' : 'Available'}
                                                </span>
                                            </div>
                                        </div>

                                        <div
                                            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md transition-all duration-200"
                                            style={{
                                                backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139',
                                                color: textMuted,
                                            }}
                                        >
                                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right: Ranking Panel */}
                        <div className="lg:col-span-5">
                            <div
                                className="border overflow-hidden"
                                style={{
                                    borderRadius: `${Math.min(br, 12)}px`,
                                    borderColor,
                                    backgroundColor: cardBg,
                                }}
                            >
                                {/* Ranking Header */}
                                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${borderColor}` }}>
                                    <div className="flex items-center gap-2.5">
                                        <TrendingUp className="w-4 h-4" style={{ color: accentColor }} />
                                        <h3 className="text-sm font-bold" style={{ color: textPrimary }}>
                                            {language === 'km' ? 'ចំណាត់ថ្នាក់ក្រុម' : 'Top Team Sales'}
                                        </h3>
                                    </div>
                                    <div
                                        className="flex p-0.5 border"
                                        style={{
                                            borderRadius: `${Math.min(br, 6)}px`,
                                            borderColor,
                                            backgroundColor: isLightMode ? '#F5F5F5' : '#0B0E11',
                                        }}
                                    >
                                        {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setRankingPeriod(p)}
                                                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-all"
                                                style={{
                                                    borderRadius: `${Math.max(2, Math.round(br / 6))}px`,
                                                    backgroundColor: rankingPeriod === p ? accentColor : 'transparent',
                                                    color: rankingPeriod === p ? accentText : textMuted,
                                                }}
                                            >
                                                {p === 'today' ? 'Day' : p === 'this_week' ? 'Wk' : p === 'this_month' ? 'Mo' : 'All'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Ranking List */}
                                <div>
                                    {isRankingLoading ? (
                                        <div className="py-16 flex flex-col items-center justify-center gap-3">
                                            <Spinner size="md" />
                                            <span className="text-xs font-medium" style={{ color: textMuted }}>
                                                {language === 'km' ? 'កំពុងផ្ទុក...' : 'Loading...'}
                                            </span>
                                        </div>
                                    ) : globalRanking.length > 0 ? (
                                        <div>
                                            {/* Column Labels */}
                                            <div className="px-5 py-2.5 flex items-center text-[10px] font-semibold uppercase tracking-wider" style={{ color: textMuted, borderBottom: `1px solid ${borderColor}` }}>
                                                <span className="w-8">#</span>
                                                <span className="flex-grow">{language === 'km' ? 'ក្រុម' : 'Team'}</span>
                                                <span className="text-right w-24">{language === 'km' ? 'ចំណូល' : 'Revenue'}</span>
                                            </div>

                                            {globalRanking.slice(0, 7).map((item, i) => {
                                                const barPct = (item.revenue / maxRevenue) * 100;
                                                const isMyTeam = userTeams.includes(item.name);
                                                const rankColor =
                                                    i === 0 ? '#F0B90B' :
                                                    i === 1 ? '#C0C0C0' :
                                                    i === 2 ? '#CD7F32' :
                                                    textMuted;

                                                return (
                                                    <div
                                                        key={item.name}
                                                        className="px-5 py-3 flex items-center gap-3 transition-colors duration-150"
                                                        style={{ borderBottom: `1px solid ${borderColor}` }}
                                                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = cardHover}
                                                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                    >
                                                        <span className="w-8 text-xs font-bold" style={{ color: rankColor }}>
                                                            {i + 1}
                                                        </span>

                                                        <div className="flex-grow min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                                                                    {item.name}
                                                                </span>
                                                                {isMyTeam && (
                                                                    <span
                                                                        className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                                                                        style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                                                                    >
                                                                        {language === 'km' ? 'ក្រុមខ្ញុំ' : 'My Team'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div
                                                                className="h-1 w-full rounded-full overflow-hidden"
                                                                style={{ backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139' }}
                                                            >
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{
                                                                        width: `${barPct}%`,
                                                                        backgroundColor: i < 3 ? rankColor : (isLightMode ? '#D0D0D0' : '#3D4550'),
                                                                        transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <span className="w-24 text-right text-sm font-bold tabular-nums" style={{ color: i === 0 ? accentColor : textPrimary }}>
                                                            {item.revenue >= 1000 ? `${(item.revenue / 1000).toFixed(1)}K` : item.revenue.toFixed(0)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="py-14 text-center">
                                            <TrendingUp className="w-8 h-8 mx-auto mb-3" style={{ color: textMuted, opacity: 0.3 }} />
                                            <p className="text-sm font-medium" style={{ color: textPrimary }}>
                                                {language === 'km' ? 'មិនទាន់មានទិន្នន័យ' : 'No data yet'}
                                            </p>
                                            <p className="text-xs mt-1" style={{ color: textMuted }}>
                                                {language === 'km' ? 'ទិន្នន័យនឹងបង្ហាញនៅពេលមានការកម្មង់' : 'Sales data will appear once orders are placed.'}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* System Info Footer */}
                                <div className="px-5 py-4" style={{ borderTop: `1px solid ${borderColor}`, backgroundColor: `${accentColor}06` }}>
                                    <div className="flex items-start gap-3">
                                        <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accentColor, opacity: 0.7 }} />
                                        <div>
                                            <p className="text-[11px] font-semibold mb-0.5" style={{ color: textPrimary }}>
                                                {language === 'km' ? 'ព័ត៌មានប្រព័ន្ធ' : 'System Info'}
                                            </p>
                                            <p className="text-[11px] leading-relaxed" style={{ color: textMuted }}>
                                                {language === 'km'
                                                    ? 'ក្រុមទាំងអស់ត្រូវបានតភ្ជាប់។ ការកម្មង់ធ្វើសមកាលកម្មភ្លាមៗ។'
                                                    : 'All teams are connected. Orders sync in real time.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Active Team View ───
    return (
        <div className="min-h-full flex flex-col" style={{ backgroundColor: bg, color: textPrimary, fontFamily: theme.uiTheme === 'binance' ? "'Inter', sans-serif" : undefined }}>
            {/* Team Header Bar */}
            <div
                className="sticky top-0 z-50 px-4 sm:px-6 py-3 flex items-center justify-between"
                style={{
                    backgroundColor: theme.uiTheme === 'binance' ? (isLightMode ? '#FFFFFF' : '#1E2329') : (isLightMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,35,41,0.95)'),
                    ...(theme.uiTheme !== 'binance' ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
                    borderBottom: `1px solid ${borderColor}`,
                }}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSwitchTeam}
                        className="p-1.5 rounded-md transition-all"
                        style={{ color: textMuted, border: `1px solid transparent` }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = cardHover; e.currentTarget.style.borderColor = borderColor; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                        title={language === 'km' ? 'ត្រឡប់ក្រោយ' : 'Back'}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: accentColor }} />
                        <div>
                            <h2 className="text-sm font-bold leading-none" style={{ color: textPrimary }}>{selectedTeam}</h2>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: greenOk }} />
                                <span className="text-[10px] font-semibold" style={{ color: greenOk }}>
                                    {language === 'km' ? 'សកម្ម' : 'Active'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    {hasPermission('create_order') && (
                        <button
                            onClick={handleCreateOrder}
                            className="flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-[12px] transition-all active:scale-95"
                            style={{ backgroundColor: accentColor, color: accentText }}
                        >
                            <Plus className="w-4 h-4" />
                            <span>{language === 'km' ? 'បង្កើតការកម្មង់' : 'Create Order'}</span>
                        </button>
                    )}
                    {userTeams && userTeams.length > 1 && (
                        <button
                            onClick={handleSwitchTeam}
                            className="p-2 rounded-md transition-all"
                            style={{ backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139', color: textMuted, border: `1px solid ${borderColor}` }}
                            title={language === 'km' ? 'ប្តូរក្រុម' : 'Switch Team'}
                        >
                            <ArrowLeftRight className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={onBackToRoleSelect}
                        className="p-2 rounded-md transition-all"
                        style={{ backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139', color: textMuted, border: `1px solid ${borderColor}` }}
                        title={language === 'km' ? 'ប្តូរតួនាទី' : 'Switch Role'}
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1">
                <UserOrdersView onAdd={handleCreateOrder} />
            </div>
        </div>
    );
};

export default DesktopUserJourney;
