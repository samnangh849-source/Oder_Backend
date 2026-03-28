
import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../context/AppContext';
import { translations } from '../translations';
import UserOrdersView from '../components/user/UserOrdersView';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { WEB_APP_URL } from '../constants';
import {
    ChevronLeft, ChevronRight, TrendingUp, Plus, LogOut,
    ArrowLeftRight, ChevronDown, BarChart2, ExternalLink,
} from 'lucide-react';

interface MobileUserJourneyProps {
    onBackToRoleSelect: () => void;
    userTeams: string[];
}

// Period label map — module scope, never changes
const PERIOD_LABELS = {
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    all: 'All Time',
} as const;

// Binance-style gold accent
const BNB_ACCENT_DARK  = '#F0B90B';
const BNB_ACCENT_LIGHT = '#FCD535';
const BNB_ACCENT_TEXT  = '#1a1a2e';

// Pure function — no closure over component state
function getMedalStyle(
    i: number,
    accentColor: string,
    accentText: string,
    textMuted: string,
    isLightMode: boolean,
): React.CSSProperties {
    if (i === 0) return { backgroundColor: accentColor, color: accentText };
    if (i === 1) return { backgroundColor: '#C0C0C0', color: '#0d0d0d' };
    if (i === 2) return { backgroundColor: '#CD7F32', color: '#ffffff' };
    return { backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139', color: textMuted };
}

const SkeletonRow: React.FC<{ isLight: boolean }> = ({ isLight }) => (
    <div className="flex items-center gap-3 py-2">
        <div className="w-7 h-7 rounded-lg shrink-0 animate-pulse" style={{ backgroundColor: isLight ? '#e2e8f0' : '#2B3139' }} />
        <div className="flex-grow space-y-1.5">
            <div className="h-2.5 rounded animate-pulse w-2/3" style={{ backgroundColor: isLight ? '#e2e8f0' : '#2B3139' }} />
            <div className="h-1.5 rounded animate-pulse w-full"  style={{ backgroundColor: isLight ? '#edf2f7' : '#1E2329' }} />
        </div>
        <div className="w-12 h-2.5 rounded animate-pulse shrink-0" style={{ backgroundColor: isLight ? '#e2e8f0' : '#2B3139' }} />
    </div>
);

const MobileUserJourney: React.FC<MobileUserJourneyProps> = ({ onBackToRoleSelect, userTeams }) => {
    const {
        setChatVisibility, setMobilePageTitle, language,
        setAppState, selectedTeam, setSelectedTeam,
        hasPermission, advancedSettings,
    } = useContext(AppContext);

    const t = translations[language];
    const { playClick, playTeamSelect } = useSoundEffects();

    // All derived design tokens in one memo — recomputes only when settings change
    const theme = useMemo(() => {
        const isLightMode  = advancedSettings?.themeMode === 'light';
        const uiTheme      = advancedSettings?.uiTheme || 'default';
        const br           = uiTheme === 'binance' ? 2 : 4; // sharp corners (trading terminal style)

        const accentColor  =
            uiTheme === 'netflix' ? '#e50914' :
            uiTheme === 'samsung' ? '#0381fe' :
            uiTheme === 'finance' ? '#10b981' :
            uiTheme === 'binance' ? (isLightMode ? BNB_ACCENT_LIGHT : BNB_ACCENT_DARK) :
            '#3b82f6';
        const accentText   = (uiTheme === 'binance' || accentColor === BNB_ACCENT_LIGHT || accentColor === BNB_ACCENT_DARK)
            ? BNB_ACCENT_TEXT : '#ffffff';
        const greenOk      = isLightMode ? '#02C076' : '#0ECB81';
        const redAlert     = '#F6465D';
        const bg           = isLightMode ? '#F5F5F5' : '#0B0E11';
        const cardBg       = isLightMode ? '#FFFFFF'  : '#1E2329';
        const textPrimary  = isLightMode ? '#1E2329'  : '#EAECEF';
        const textMuted    = isLightMode ? '#707A8A'  : '#848E9C';
        const borderColor  = isLightMode ? '#E6E8EA'  : '#2B3139';

        const headerStyle: React.CSSProperties = uiTheme === 'binance' ? {
            backgroundColor: isLightMode ? '#FFFFFF' : '#1E2329',
            borderBottom: `1px solid ${borderColor}`,
            fontFamily: "'Inter', sans-serif",
        } : {
            backgroundColor: isLightMode ? 'rgba(255,255,255,0.97)' : 'rgba(11,14,17,0.97)',
            backdropFilter: 'blur(var(--glass-blur, 12px))',
            WebkitBackdropFilter: 'blur(var(--glass-blur, 12px))',
            borderBottom: `1px solid ${borderColor}`,
        };

        const iconBtnStyle: React.CSSProperties = {
            borderRadius: `${br}px`,
            backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139',
            color: textMuted,
            border: `1px solid ${borderColor}`,
            transition: 'all var(--anim-duration, 0.2s)',
        };

        return { isLightMode, br, accentColor, accentText, greenOk, redAlert, bg, cardBg, textPrimary, textMuted, borderColor, headerStyle, iconBtnStyle };
    }, [advancedSettings?.themeMode, advancedSettings?.uiTheme]);

    const { isLightMode, br, accentColor, accentText, greenOk, bg, cardBg, textPrimary, textMuted, borderColor, headerStyle, iconBtnStyle } = theme;

    const [globalRanking, setGlobalRanking] = useState<{ name: string; revenue: number }[]>([]);
    const [isRankingLoading, setIsRankingLoading] = useState(false);
    const [rankingPeriod, setRankingPeriod] = useState<'today' | 'this_week' | 'this_month' | 'all'>('today');
    const [expandedRank, setExpandedRank] = useState<string | null>(null);

    const fetchRanking = useCallback(async () => {
        setIsRankingLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${WEB_APP_URL}/api/teams/ranking?period=${rankingPeriod}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
                const result = await res.json();
                if (result.status === 'success' && result.data) {
                    setGlobalRanking(
                        result.data.map((r: any) => ({
                            name: r.Team || 'Unknown',
                            revenue: Number(r.Revenue) || 0,
                        }))
                    );
                }
            }
        } catch (err) {
            console.error('Failed to fetch team ranking:', err);
        } finally {
            setIsRankingLoading(false);
        }
    }, [rankingPeriod]);

    useEffect(() => {
        setChatVisibility(true);
        if (selectedTeam) setMobilePageTitle(selectedTeam);
        else { setMobilePageTitle(null); fetchRanking(); }
        return () => setMobilePageTitle(null);
    }, [selectedTeam, setChatVisibility, setMobilePageTitle, fetchRanking]);

    const handleCreateOrder = () => { if (!hasPermission('create_order')) return; playClick(); setAppState('create_order'); };
    const handleTeamSelect  = (team: string) => { playTeamSelect(); setSelectedTeam(team); };
    const handleSwitchTeam  = () => { playClick(); setSelectedTeam(''); };
    const toggleExpand      = (name: string) => setExpandedRank(prev => prev === name ? null : name);

    if (!selectedTeam) {
        // Single-pass max with reduce — no intermediate mapped array
        const maxRevenue = globalRanking.reduce((m, r) => Math.max(m, r.revenue), 1);

        return (
            <div className="min-h-full w-full flex flex-col pb-24 overflow-hidden" style={{ backgroundColor: bg }}>
                <div className="px-4 pt-4 flex items-center">
                    <button 
                        onClick={onBackToRoleSelect}
                        className="p-2 -ml-2 active:scale-90 transition-all"
                        style={{ color: textMuted }}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                </div>
                <div className="px-4 pt-2 pb-2 space-y-4">

                    {/* Your Teams */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: textMuted }}>
                            My Teams
                        </p>
                        <div className="space-y-2.5">
                            {userTeams.map((team) => (
                                <button
                                    key={team}
                                    onClick={() => handleTeamSelect(team)}
                                    className="w-full text-left flex items-center gap-3.5 px-4 py-3.5 border active:scale-[0.985]"
                                    style={{
                                        borderRadius: `${br}px`,
                                        backgroundColor: cardBg,
                                        borderColor,
                                        transition: 'all var(--anim-duration, 0.2s)',
                                        boxShadow: isLightMode ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                                    }}
                                >
                                    <div
                                        className="w-11 h-11 shrink-0 flex items-center justify-center font-black text-lg"
                                        style={{
                                            borderRadius: `${Math.max(6, Math.round(br / 2))}px`,
                                            backgroundColor: accentColor,
                                            color: accentText,
                                            boxShadow: `0 3px 10px ${accentColor}40`,
                                        }}
                                    >
                                        {team.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h3 className="text-[14px] font-black leading-none truncate" style={{ color: textPrimary }}>
                                            {team}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: greenOk }} />
                                            <span className="text-[10px] font-bold" style={{ color: greenOk }}>Active</span>
                                        </div>
                                    </div>
                                    <div
                                        className="flex items-center gap-1 px-3 py-1.5 shrink-0"
                                        style={{
                                            borderRadius: `${br}px`,
                                            backgroundColor: accentColor,
                                            color: accentText,
                                            fontFamily: 'monospace',
                                            letterSpacing: '0.05em',
                                        }}
                                    >
                                        <span className="text-[10px] font-black">OPEN</span>
                                        <ChevronRight className="w-3 h-3" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Top Team Sales */}
                    <div
                        className="border overflow-hidden"
                        style={{ borderRadius: `${br}px`, borderColor, backgroundColor: cardBg }}
                    >
                        <div
                            className="px-4 pt-4 pb-3 flex items-start justify-between"
                            style={{ borderBottom: `1px solid ${borderColor}` }}
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4" style={{ color: accentColor }} />
                                    <span className="text-[13px] font-black" style={{ color: textPrimary }}>
                                        Sales Ranking
                                    </span>
                                </div>
                                <p className="text-[10px] mt-0.5" style={{ color: textMuted }}>
                                    By revenue · tap to expand
                                </p>
                            </div>
                            <div
                                className="flex border shrink-0 ml-2"
                                style={{
                                    borderRadius: `${Math.min(br, 6)}px`,
                                    borderColor,
                                    backgroundColor: isLightMode ? '#F5F5F5' : '#0B0E11',
                                    padding: '2px',
                                }}
                            >
                                {(['today', 'this_week', 'this_month', 'all'] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => { setRankingPeriod(p); setExpandedRank(null); }}
                                        className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
                                        style={{
                                            borderRadius: `${br}px`,
                                            backgroundColor: rankingPeriod === p ? accentColor : 'transparent',
                                            color: rankingPeriod === p ? accentText : textMuted,
                                            transition: 'all var(--anim-duration, 0.2s)',
                                        }}
                                    >
                                        {p === 'today' ? '1D' : p === 'this_week' ? '1W' : p === 'this_month' ? '1M' : 'ALL'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="divide-y" style={{ borderColor }}>
                            {isRankingLoading ? (
                                <div className="px-4 py-3 space-y-4">
                                    {[0, 1, 2].map(k => <SkeletonRow key={k} isLight={isLightMode} />)}
                                </div>
                            ) : globalRanking.length > 0 ? (
                                globalRanking.slice(0, 5).map((item, i) => {
                                    const barPct   = (item.revenue / maxRevenue) * 100;
                                    const isOpen   = expandedRank === item.name;
                                    const isMyTeam = userTeams.includes(item.name);
                                    const medal    = getMedalStyle(i, accentColor, accentText, textMuted, isLightMode);

                                    return (
                                        <div key={item.name} style={{ borderColor }}>
                                            <button
                                                onClick={() => toggleExpand(item.name)}
                                                className="w-full text-left px-4 py-3.5 flex items-center gap-3"
                                                style={{
                                                    backgroundColor: isOpen ? (isLightMode ? '#FAFAFA' : '#252B33') : 'transparent',
                                                    transition: 'background-color var(--anim-duration, 0.2s)',
                                                }}
                                            >
                                                <div
                                                    className="w-8 h-8 shrink-0 flex items-center justify-center text-[9px] font-black"
                                                    style={{ borderRadius: `${br}px`, ...medal }}
                                                >
                                                    {i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : `#${i + 1}`}
                                                </div>

                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <span className="text-[12px] font-black truncate leading-none" style={{ color: textPrimary }}>
                                                            {item.name}
                                                        </span>
                                                        {isMyTeam && (
                                                            <span
                                                                className="text-[8px] font-black px-1.5 py-0.5 shrink-0"
                                                                style={{ borderRadius: `${br}px`, backgroundColor: `${accentColor}28`, color: accentColor }}
                                                            >
                                                                MINE
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
                                                                backgroundColor: i < 3
                                                                    ? (medal.backgroundColor as string)
                                                                    : (isLightMode ? '#D0D0D0' : '#3D4550'),
                                                                transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[13px] font-black" style={{ color: i === 0 ? accentColor : textPrimary }}>
                                                        {item.revenue >= 1000 ? `${(item.revenue / 1000).toFixed(1)}K` : item.revenue.toFixed(0)}
                                                    </span>
                                                    <ChevronDown
                                                        className="w-3.5 h-3.5"
                                                        style={{
                                                            color: textMuted,
                                                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                            transition: 'transform var(--anim-duration, 0.2s)',
                                                        }}
                                                    />
                                                </div>
                                            </button>

                                            {isOpen && (
                                                <div
                                                    className="px-4 pb-4"
                                                    style={{
                                                        backgroundColor: isLightMode ? '#FAFAFA' : '#252B33',
                                                        borderTop: `1px solid ${borderColor}`,
                                                    }}
                                                >
                                                    <div className="pt-3 space-y-3">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {[
                                                                {
                                                                    label: 'Revenue',
                                                                    value: item.revenue >= 1000 ? `${(item.revenue / 1000).toFixed(2)}K` : item.revenue.toFixed(2),
                                                                    highlight: i === 0,
                                                                },
                                                                {
                                                                    label: 'Rank',
                                                                    value: `#${i + 1}`,
                                                                    sub: `/ ${globalRanking.length}`,
                                                                    highlight: false,
                                                                },
                                                            ].map(stat => (
                                                                <div
                                                                    key={stat.label}
                                                                    className="p-3 border"
                                                                    style={{
                                                                        borderRadius: `${br}px`,
                                                                        backgroundColor: isLightMode ? '#FFFFFF' : '#1E2329',
                                                                        borderColor,
                                                                    }}
                                                                >
                                                                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: textMuted }}>
                                                                        {stat.label}
                                                                    </p>
                                                                    <div className="flex items-baseline gap-1">
                                                                        <p className="text-[16px] font-black leading-none" style={{ color: stat.highlight ? accentColor : textPrimary }}>
                                                                            {stat.value}
                                                                        </p>
                                                                        {stat.sub && (
                                                                            <p className="text-[10px] font-bold" style={{ color: textMuted }}>{stat.sub}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        <div>
                                                            <div className="flex justify-between items-center mb-1.5">
                                                                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>
                                                                    {language === 'km' ? 'ចំណែកធៀបនឹង #1' : 'vs #1'}
                                                                </span>
                                                                <span className="text-[10px] font-black" style={{ color: accentColor }}>
                                                                    {barPct.toFixed(0)}%
                                                                </span>
                                                            </div>
                                                            <div
                                                                className="h-2 w-full rounded-full overflow-hidden"
                                                                style={{ backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139' }}
                                                            >
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{
                                                                        width: `${barPct}%`,
                                                                        backgroundColor: accentColor,
                                                                        transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <p className="text-[9px]" style={{ color: textMuted }}>
                                                            Period:{' '}
                                                            <span className="font-bold" style={{ color: textPrimary }}>
                                                                {PERIOD_LABELS[rankingPeriod]}
                                                            </span>
                                                        </p>

                                                        {isMyTeam && (
                                                            <button
                                                                onClick={() => handleTeamSelect(item.name)}
                                                                className="w-full flex items-center justify-center gap-2 py-2.5 font-black text-[11px] uppercase tracking-wider active:scale-[0.98]"
                                                                style={{
                                                                    borderRadius: `${br}px`,
                                                                    backgroundColor: accentColor,
                                                                    color: accentText,
                                                                    letterSpacing: '0.08em',
                                                                    transition: 'all var(--anim-duration, 0.2s)',
                                                                }}
                                                            >
                                                                <ExternalLink className="w-3.5 h-3.5" />
                                                                Open
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="px-4 py-10 text-center">
                                    <div
                                        className="w-12 h-12 mx-auto mb-3 flex items-center justify-center"
                                        style={{
                                            borderRadius: `${Math.min(br, 12)}px`,
                                            backgroundColor: isLightMode ? '#F0F0F0' : '#2B3139',
                                        }}
                                    >
                                        <TrendingUp className="w-5 h-5" style={{ color: textMuted }} />
                                    </div>
                                    <p className="text-sm font-bold" style={{ color: textPrimary }}>No data yet</p>
                                    <p className="text-[10px] mt-1" style={{ color: textMuted }}>
                                        Sales data will appear here once orders are placed.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full" style={{ 
          backgroundColor: bg,
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))'
        }}>

            <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-30" style={headerStyle}>
                <div className="flex items-center gap-2">
                    <button onClick={handleSwitchTeam} className="p-2 -ml-2 active:scale-90" style={iconBtnStyle}>
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-1 h-6" style={{ backgroundColor: accentColor }} />
                        <div>
                            <span className="text-[9px] font-bold leading-none uppercase tracking-widest" style={{ color: textMuted }}>
                                Team
                            </span>
                            <h2 className="text-[14px] font-black leading-tight mt-0.5 tracking-tight" style={{ color: textPrimary }}>
                                {selectedTeam}
                            </h2>
                        </div>
                    </div>
                    <div
                        className="flex items-center gap-1.5 px-2 py-1 border ml-1"
                        style={{ borderRadius: `${br}px`, borderColor, backgroundColor: `${greenOk}18` }}
                    >
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: greenOk }} />
                        <span className="text-[9px] font-black uppercase" style={{ color: greenOk }}>Live</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {userTeams.length > 1 && (
                        <button onClick={handleSwitchTeam} className="p-2 active:scale-90" style={iconBtnStyle} title="Switch Team">
                            <ArrowLeftRight className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={onBackToRoleSelect} className="p-2 active:scale-90" style={iconBtnStyle} title="Exit">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex-1 px-1">
                <UserOrdersView onAdd={handleCreateOrder} />
            </div>

            {hasPermission('create_order') && createPortal(
                <div className="fixed bottom-24 right-4 z-[60] pointer-events-none">
                    <button
                        onClick={handleCreateOrder}
                        className="w-14 h-14 shadow-xl flex items-center justify-center active:scale-90 pointer-events-auto"
                        style={{
                            borderRadius: `${Math.min(br, 16)}px`,
                            backgroundColor: accentColor,
                            color: accentText,
                            boxShadow: `0 6px 20px ${accentColor}55`,
                            transition: 'all var(--anim-duration, 0.2s)',
                        }}
                    >
                        <Plus className="w-7 h-7" />
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};

export default MobileUserJourney;
