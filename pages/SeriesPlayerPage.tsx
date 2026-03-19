import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { 
  ChevronLeft, SkipBack, SkipForward, Maximize, RotateCw, 
  Lock, Unlock, Loader2, Play, Pause, X, Info, Calendar, Globe, Tag,
  Share2, List, PlayCircle, MoreVertical, Download, Heart, Star, Eye,
  Clock, Award, Zap, Volume2, Settings, Monitor
} from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { Movie } from '../types';
import HLSPlayer from '../components/common/HLSPlayer';
import EpisodeSelector from '../components/admin/netflix/EpisodeSelector';
import { WEB_APP_URL } from '../constants';

const SeriesPlayerPage: React.FC = () => {
  const { appData, setAppState, selectedMovieId, setSelectedMovieId, showNotification, currentUser } = useContext(AppContext);
  
  const [localMovies, setLocalMovies] = useState<Movie[]>([]);
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);
  const movies = useMemo(() => (appData?.movies?.length ? appData.movies : localMovies), [appData?.movies, localMovies]);

  useEffect(() => {
    if (!appData?.movies?.length && !localMovies.length) {
      const fetchMovies = async () => {
        setIsLoadingMovies(true);
        try {
          const response = await fetch(`${WEB_APP_URL}/api/movies`);
          if (response.ok) {
            const result = await response.json();
            if (result.status === 'success') {
              setLocalMovies(result.data || []);
            }
          }
        } catch (e) {
            console.error("Failed to fetch movies", e);
        } finally {
            setIsLoadingMovies(false);
        }
      };
      fetchMovies();
    }
  }, [appData?.movies]);

  const currentMovie = useMemo(() => 
    movies.find(m => m.ID === selectedMovieId), 
    [movies, selectedMovieId]
  );

  const episodes = useMemo(() => {
    if (!currentMovie) return [];
    const seriesId = currentMovie.SeriesKey || currentMovie.Title.split('-')[0].trim();
    return movies.filter(m => {
      if (currentMovie.SeriesKey && m.SeriesKey) return m.SeriesKey === currentMovie.SeriesKey;
      return m.Title.startsWith(seriesId);
    }).sort((a, b) => {
        const getNum = (s: string) => {
            const m = s.match(/\d+/);
            return m ? parseInt(m[0]) : 0;
        };
        return getNum(a.Title) - getNum(b.Title);
    });
  }, [movies, currentMovie]);

  const currentIndex = episodes.findIndex(e => e.ID === selectedMovieId);
  const nextEpisode = currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;

  // FIX P2: Derive season number dynamically from episode grouping
  const seasonLabel = useMemo(() => {
    if (!currentMovie) return 'Season 01';
    // Try to extract season from SeriesKey or Title e.g. "S2", "Season 2"
    const seasonMatch = (currentMovie.SeriesKey || currentMovie.Title).match(/s(?:eason)?\s*(\d+)/i);
    const num = seasonMatch ? seasonMatch[1].padStart(2, '0') : '01';
    return `Season ${num}`;
  }, [currentMovie]);
  
  const [isLocked, setIsLocked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // Handle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // FIX P1: Landscape mode — use Screen Orientation API when available,
  // fallback to CSS transform only as last resort
  const toggleLandscape = useCallback(async () => {
    const screen = window.screen as any;
    if (!isLandscape) {
      // Enter landscape
      if (playerContainerRef.current?.requestFullscreen) {
        try {
          await playerContainerRef.current.requestFullscreen();
          if (screen?.orientation?.lock) {
            await screen.orientation.lock('landscape').catch(() => {});
          }
          setIsFullscreen(true);
        } catch {
          // fallback: just set landscape CSS flag
        }
      }
      setIsLandscape(true);
    } else {
      // Exit landscape
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
      if (screen?.orientation?.unlock) {
        screen.orientation.unlock();
      }
      setIsLandscape(false);
    }
  }, [isLandscape]);

  // Sync landscape state with fullscreen exit (e.g. pressing Escape)
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isLandscape) {
        setIsLandscape(false);
        const screen = window.screen as any;
        if (screen?.orientation?.unlock) screen.orientation.unlock();
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isLandscape]);

  // Handle Scroll for Sticky Header
  useEffect(() => {
    const handleScroll = (e: any) => {
      setIsScrolled(e.target.scrollTop > 80);
    };
    const container = document.getElementById('app-main-scroll-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // AUTO-SCROLL TO PLAYER LOGIC
  useEffect(() => {
    if (selectedMovieId) {
      const timer = setTimeout(() => {
        if (playerContainerRef.current) {
          const rect = playerContainerRef.current.getBoundingClientRect();
          const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
          if (!isVisible) {
            playerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            const container = document.getElementById('app-main-scroll-container');
            if (container && container.scrollTop > 500) {
              container.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }
        } else {
          const container = document.getElementById('app-main-scroll-container');
          if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedMovieId]);

  const handleShare = () => {
    if (!currentMovie) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=series_player&movie=${currentMovie.ID}`;
    navigator.clipboard.writeText(shareUrl);
    showNotification("តំណភ្ជាប់ត្រូវបានចម្លង!", "success");
  };

  if (isLoadingMovies && !currentMovie) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <div className="relative">
            <div className="absolute inset-0 bg-red-600/20 blur-[50px] animate-pulse rounded-full"></div>
            <div className="relative flex flex-col items-center">
                <Loader2 className="w-16 h-16 animate-spin text-red-600 mb-6" />
                <div className="flex flex-col items-center gap-1">
                    <p className="text-white font-black uppercase tracking-[0.5em] text-xs">Initializing</p>
                    <p className="text-red-600 font-bold text-[8px] uppercase tracking-widest">Cinema Experience</p>
                </div>
            </div>
        </div>
      </div>
    );
  }

  if (!currentMovie && !isLoadingMovies) {
    return (
        <div className="flex h-screen items-center justify-center bg-[#050505] text-white p-6">
          <div className="text-center max-w-md relative">
              <div className="absolute -inset-20 bg-red-600/5 blur-[100px] pointer-events-none"></div>
              <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-10 border border-white/10 backdrop-blur-3xl shadow-2xl rotate-12 group hover:rotate-0 transition-transform duration-700">
                 <X className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-6 leading-tight">រកមិនឃើញវីដេអូ <br/> <span className="text-white/20">Movie Not Found</span></h2>
              <p className="text-white/40 text-sm mb-12 leading-relaxed font-light px-8 italic">សោកស្តាយ វីដេអូដែលលោកអ្នកកំពុងស្វែងរកមិនមានក្នុងប្រព័ន្ធ ឬត្រូវបានលុបចេញពីបណ្ណាល័យរបស់យើង។</p>
              <button 
                onClick={() => setAppState('entertainment')}
                className="group relative w-full bg-red-600 hover:bg-red-700 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all active:scale-95 shadow-[0_20px_40px_rgba(220,38,38,0.3)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                Explore library
              </button>
          </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Kantumruy_Pro'] selection:bg-red-600/30 overflow-x-hidden">
      
      {/* 1. PREMIUM GLASS HEADER */}
      <div className={`fixed top-0 left-0 right-0 z-[150] px-6 md:px-12 py-6 transition-all duration-700 flex items-center justify-between ${
        isScrolled 
        ? 'bg-black/60 backdrop-blur-3xl border-b border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)]' 
        : 'bg-transparent'
      }`}>
        <div className="flex items-center gap-6">
            <button 
                onClick={() => setAppState('entertainment')} 
                className="group p-3.5 bg-white/[0.03] backdrop-blur-xl rounded-2xl hover:bg-red-600 transition-all active:scale-90 border border-white/10 shadow-xl"
            >
                <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>
            {/* FIX P3: Show only a compact ep indicator in header, not the full title */}
            <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping"></span>
                    <span className="text-[9px] font-black text-red-600 uppercase tracking-[0.4em] leading-none">Theater Live</span>
                </div>
                <p className="text-sm md:text-base font-black uppercase tracking-tight truncate max-w-[160px] md:max-w-lg leading-none text-white/70">
                    {currentIndex >= 0 ? `Ep. ${currentIndex + 1} · ` : ''}{currentMovie.Title}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={handleShare} 
                className="p-3.5 bg-white/[0.03] backdrop-blur-xl rounded-2xl hover:bg-emerald-600 transition-all border border-white/10 shadow-xl active:scale-90" 
                title="Share Experience"
            >
                <Share2 className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* 2. THEATER SECTION (CINEMA STAGE) */}
      <div className="relative pt-28 md:pt-36 pb-12 px-4 md:px-10 lg:px-20 max-w-[1920px] mx-auto z-10">
        <div className="relative group">
            {/* Cinematic Background Glows */}
            <div className="absolute -inset-10 bg-gradient-to-r from-red-600/5 via-blue-600/5 to-purple-600/5 rounded-[4rem] blur-[120px] opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
            
            <div 
                ref={playerContainerRef}
                className={`relative w-full bg-black shadow-[0_80px_150px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-700 border border-white/[0.08] ${
                  isLandscape 
                    ? 'fixed inset-0 z-[200] rounded-none border-0' 
                    : 'rounded-[2.5rem] md:rounded-[4rem] h-[35vh] sm:h-[55vh] md:h-[70vh] lg:h-[82vh]'
                }`}
            >
                {/* Fullscreen / Landscape Exit */}
                {(isFullscreen || isLandscape) && (
                    <button 
                        onClick={isLandscape ? toggleLandscape : toggleFullscreen}
                        className="absolute top-8 right-8 z-[250] p-5 bg-black/40 hover:bg-red-600 text-white rounded-3xl backdrop-blur-2xl transition-all border border-white/10 active:scale-90 shadow-2xl"
                    >
                        <X className="w-8 h-8" />
                    </button>
                )}

                <HLSPlayer 
                    key={currentMovie.VideoURL}
                    url={currentMovie.VideoURL} 
                    onReady={(p) => {
                        setPlayer(p);
                        p.on('ended', () => {
                            if (autoPlay && nextEpisode) setSelectedMovieId(nextEpisode.ID);
                        });
                    }}
                />

                {/* Locked State Overlay */}
                {isLocked && (
                    <div className="absolute inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-600/20 blur-[60px] animate-pulse rounded-full"></div>
                            <div className="relative bg-black/40 p-12 rounded-[3rem] border border-red-600/30 flex flex-col items-center gap-6">
                                <Lock className="w-16 h-16 text-red-600" />
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500">Screen Locked</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* 3. INTERACTIVE HUD (UNDER PLAYER) */}
      {!isLandscape && (
        <div className="relative py-12 px-6 lg:px-24 overflow-hidden">
            {/* FIX P3: CSS-only grid pattern instead of external texture URL */}
            <div 
              className="absolute inset-0 opacity-[0.025] pointer-events-none"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 24px,rgba(255,255,255,0.05) 24px,rgba(255,255,255,0.05) 25px),repeating-linear-gradient(90deg,transparent,transparent 24px,rgba(255,255,255,0.05) 24px,rgba(255,255,255,0.05) 25px)' }}
            ></div>
            
            <div className="max-w-[1700px] mx-auto relative z-10">
                <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-12">
                    
                    {/* FIX P3: Hero title only (no duplicate in header) */}
                    <div className="space-y-6 flex-grow">
                        {/* FIX P1: Only show real data — remove hardcoded views/rating */}
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="bg-red-600/10 text-red-500 border border-red-600/20 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]">Premiere</span>
                            {currentMovie.Country && (
                              <>
                                <div className="h-4 w-px bg-white/10"></div>
                                <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                                    <Globe className="w-3.5 h-3.5" />
                                    {currentMovie.Country}
                                </div>
                              </>
                            )}
                            {currentMovie.Language && (
                              <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                                <Info className="w-3.5 h-3.5" />
                                {currentMovie.Language}
                              </div>
                            )}
                        </div>
                        <h1 className="text-4xl md:text-7xl font-black text-white italic tracking-tighter uppercase leading-[0.9] drop-shadow-2xl">
                            {currentMovie.Title}
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 shrink-0">
                        {/* Auto-Next HUD Component — Ultra Premium Toggle */}
                        <div className="bg-neutral-900/60 backdrop-blur-3xl p-1.5 rounded-[2.5rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-1.5 relative overflow-hidden group/hud">
                            {/* Ambient Glow */}
                            <div className={`absolute inset-0 transition-opacity duration-1000 blur-2xl pointer-events-none ${autoPlay ? 'bg-red-600/10 opacity-100' : 'opacity-0'}`} />
                            
                            <button
                                onClick={() => setAutoPlay(!autoPlay)}
                                className={`relative flex items-center gap-3.5 pl-4 pr-3 py-2.5 rounded-[2rem] transition-all duration-500 active:scale-95 group/btn ${
                                    autoPlay 
                                        ? 'bg-gradient-to-r from-red-600/10 to-transparent hover:from-red-600/20' 
                                        : 'hover:bg-white/5'
                                }`}
                                aria-label={`Auto Next ${autoPlay ? 'On' : 'Off'}`}
                            >
                                {/* Icon Container */}
                                <div className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-500 ${
                                    autoPlay 
                                        ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-110' 
                                        : 'bg-white/10 text-white/50 group-hover/btn:bg-white/20 group-hover/btn:text-white/80'
                                }`}>
                                    <SkipForward className={`w-4 h-4 transition-transform duration-500 ${autoPlay ? 'translate-x-0.5' : ''}`} />
                                </div>

                                {/* Label */}
                                <div className="flex flex-col items-start leading-none select-none min-w-[70px]">
                                    <span className={`text-[11px] font-black uppercase tracking-[0.2em] transition-colors duration-500 ${
                                        autoPlay ? 'text-white drop-shadow-md' : 'text-white/50'
                                    }`}>
                                        Auto Next
                                    </span>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 transition-colors duration-500 ${
                                        autoPlay ? 'text-red-400' : 'text-white/30'
                                    }`}>
                                        {autoPlay ? 'បើក · On' : 'បិទ · Off'}
                                    </span>
                                </div>

                                {/* Toggle Track — Ultra Premium Redesign */}
                                <div
                                    className={`relative w-[3.25rem] h-7 rounded-full transition-all duration-500 flex-shrink-0 p-1 ml-2 flex items-center ${
                                        autoPlay
                                            ? 'bg-red-600 border border-red-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_15px_rgba(220,38,38,0.4)]'
                                            : 'bg-black/50 border border-white/20 shadow-inner'
                                    }`}
                                >
                                    {/* Thumb */}
                                    <div
                                        className={`w-5 h-5 rounded-full bg-white transition-all duration-500 flex items-center justify-center shadow-[0_2px_5px_rgba(0,0,0,0.3)] ${
                                            autoPlay
                                                ? 'translate-x-[22px]'
                                                : 'translate-x-0 opacity-70 group-hover/btn:opacity-100'
                                        }`}
                                        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                                            autoPlay ? 'bg-red-600 scale-100' : 'bg-transparent scale-0'
                                        }`} />
                                    </div>
                                </div>
                            </button>
                            
                            <div className="h-8 w-px bg-white/10 mx-1"></div>
                            
                            <div className="flex items-center gap-1.5 p-1">
                                <button onClick={toggleFullscreen} className="p-3.5 hover:bg-white/10 rounded-2xl transition-all text-white/60 hover:text-white active:scale-90" title="Fullscreen">
                                    <Maximize className="w-5 h-5" />
                                </button>
                                {/* FIX P1: Landscape now uses proper API-based toggle */}
                                <button onClick={toggleLandscape} className="p-3.5 hover:bg-blue-600/20 rounded-2xl transition-all text-white/60 hover:text-blue-500 active:scale-90" title="Landscape Mode">
                                    <RotateCw className="w-5 h-5" />
                                </button>
                                {/* FIX P2: Settings button now opens a mini panel */}
                                <div className="relative">
                                  <button 
                                    onClick={() => setIsSettingsOpen(v => !v)} 
                                    className={`p-3.5 rounded-2xl transition-all active:scale-90 ${isSettingsOpen ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`} 
                                    title="Settings"
                                  >
                                      <Settings className="w-5 h-5" />
                                  </button>
                                  {isSettingsOpen && (
                                    <div className="absolute right-0 bottom-full mb-3 w-56 bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl">
                                      <div className="p-3 space-y-1">
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 px-3 pt-2 pb-1">Playback</p>
                                        {['Auto (Recommended)', '1080p · HD', '720p', '480p'].map(q => (
                                          <button key={q} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-[11px] font-bold text-white/60 hover:text-white transition-all">
                                            {q}
                                          </button>
                                        ))}
                                        <div className="border-t border-white/[0.06] my-1"></div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 px-3 pt-2 pb-1">Speed</p>
                                        {['0.75×', '1× (Normal)', '1.25×', '1.5×'].map(s => (
                                          <button key={s} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-[11px] font-bold text-white/60 hover:text-white transition-all">
                                            {s}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
      )}

      {/* 4. MAIN CONTENT & EPISODES */}
      {!isLandscape && (
        <div className="max-w-[1920px] mx-auto px-6 md:px-12 lg:px-24 py-12 pb-40">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
            
            {/* Left Content Column */}
            <div className="lg:col-span-8 space-y-24">
              
              {/* Synopsis Dashboard */}
              <div className="relative">
                <div className="absolute top-0 left-0 w-24 h-px bg-gradient-to-r from-red-600 to-transparent"></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 py-10 border-b border-white/[0.05]">
                    {[
                        { icon: Globe, label: 'Origin', value: currentMovie.Country || '—', color: 'text-blue-500' },
                        { icon: Info, label: 'Language', value: currentMovie.Language || '—', color: 'text-emerald-500' },
                        { icon: Calendar, label: 'Release', value: currentMovie.AddedAt ? new Date(currentMovie.AddedAt).getFullYear().toString() : '—', color: 'text-purple-500' },
                        // FIX P2: Only show "HD" — no fake "4K HDR" claim
                        { icon: Award, label: 'Quality', value: 'HD', color: 'text-yellow-500' }
                    ].map((stat, i) => (
                        <div key={i} className="space-y-3 group">
                            <div className="flex items-center gap-3">
                                <stat.icon className={`w-4 h-4 ${stat.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
                                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{stat.label}</span>
                            </div>
                            <p className="text-sm font-black uppercase tracking-widest truncate">{stat.value}</p>
                        </div>
                    ))}
                </div>

                <div className="pt-12">
                    <div className="flex items-center gap-4 mb-8">
                        <PlayCircle className="w-8 h-8 text-red-600" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.5em] text-white/60">សេចក្តីសង្ខេប • Storyline</h3>
                    </div>
                    <div className="relative group p-10 md:p-14 rounded-[3.5rem] bg-white/[0.01] border border-white/[0.05] shadow-2xl backdrop-blur-3xl overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 blur-[100px] rounded-full -mr-20 -mt-20"></div>
                        <p className="text-xl md:text-2xl text-white/60 leading-[1.8] font-light italic selection:bg-red-600/20">
                            {currentMovie.Description || 'មិនទាន់មានការពិពណ៌នាសម្រាប់រឿងនេះនៅឡើយទេ។ សូមរង់ចាំការអាប់ដេតព័ត៌មានបន្ថែមក្នុងពេលឆាប់ៗនេះ។'}
                        </p>
                    </div>
                </div>
              </div>

              {/* Episode Section */}
              <div id="episodes-list-section" className="pt-10 scroll-mt-32">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
                      <div className="space-y-2">
                          <div className="flex items-center gap-4">
                              <div className="h-px w-12 bg-red-600"></div>
                              <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.5em]">Episodes Library</span>
                          </div>
                          {/* FIX P2: Dynamic season label */}
                          <h2 className="text-5xl font-black italic uppercase tracking-tighter">
                            បញ្ជីភាគរឿង <span className="text-white/10 ml-4 font-light">{seasonLabel}</span>
                          </h2>
                      </div>
                      <div className="flex items-center gap-3 bg-white/[0.03] px-6 py-4 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                          <List className="w-5 h-5 text-white/40" />
                          <span className="text-[11px] font-black uppercase tracking-[0.3em]">{episodes.length} Episodes</span>
                      </div>
                  </div>
                  
                  <EpisodeSelector 
                      currentMovie={currentMovie}
                      allEpisodes={episodes}
                      onSelectEpisode={(ep) => {
                          setSelectedMovieId(ep.ID);
                      }}
                  />
              </div>

            </div>

            {/* Right Sidebar Column */}
            <div className="hidden lg:block lg:col-span-4">
                <div className="sticky top-36 space-y-12">
                    {/* Up Next Card */}
                    <div className="space-y-8">
                        <div className="flex items-center justify-between px-4">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">Coming Next</h4>
                            <Zap className="w-4 h-4 text-yellow-500 fill-current animate-pulse" />
                        </div>
                        <UpNextCard 
                            nextEpisode={nextEpisode} 
                            onSelect={() => nextEpisode && setSelectedMovieId(nextEpisode.ID)} 
                        />
                    </div>

                    {/* Cinema Tip Card */}
                    <div className="p-8 rounded-[2.5rem] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.08] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-red-600/5 translate-y-full group-hover:translate-y-0 transition-transform duration-700"></div>
                        <div className="relative z-10 space-y-4">
                            <Volume2 className="w-6 h-6 text-red-600" />
                            <h5 className="text-[11px] font-black uppercase tracking-widest">Cinema Tip</h5>
                            <p className="text-[10px] text-white/40 leading-relaxed font-bold">Use headphones and activate Landscape Mode for the most immersive theatrical experience.</p>
                        </div>
                    </div>
                </div>
            </div>

          </div>
        </div>
      )}

      {/* Global Enhancement Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        :-webkit-full-screen { width: 100%; height: 100%; background: #000; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(220, 38, 38, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(220, 38, 38, 0.5); }
        #app-main-scroll-container { scroll-behavior: smooth; }
        @keyframes subtle-glow {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
        }
      `}} />
    </div>
  );
};

// --- SUB-COMPONENTS ---

const FALLBACK_THUMBNAIL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'%3E%3Crect width='400' height='250' fill='%23111'/%3E%3Ccircle cx='200' cy='125' r='32' fill='%23222'/%3E%3Cpolygon points='190,110 190,140 218,125' fill='%23444'/%3E%3C/svg%3E";

const UpNextCard = ({ nextEpisode, onSelect }: { nextEpisode: Movie | null, onSelect: () => void }) => (
    <div 
        onClick={nextEpisode ? onSelect : undefined}
        className={`group relative p-1.5 rounded-[3.5rem] transition-all duration-1000 ${
            nextEpisode 
            ? 'bg-gradient-to-br from-white/20 via-transparent to-white/5 cursor-pointer hover:scale-[1.03] active:scale-95' 
            : 'bg-white/5 opacity-40 cursor-not-allowed'
        }`}
    >
        <div className="bg-[#0d0d0d] rounded-[3.3rem] p-8 border border-white/[0.05] relative overflow-hidden backdrop-blur-3xl shadow-3xl">
            {nextEpisode ? (
                <>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-red-600/20 transition-colors duration-1000"></div>
                    
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3 text-red-500">
                            <Clock className="w-4 h-4" />
                            <span className="text-[9px] font-black uppercase tracking-[0.4em]">Queue Next</span>
                        </div>
                        {/* FIX P2: Removed hardcoded "PREMIUM" badge */}
                    </div>
                    
                    {/* FIX P2: onError fallback for broken thumbnail */}
                    <div className="relative aspect-[16/10] rounded-[2.5rem] overflow-hidden mb-8 border border-white/[0.08] group-hover:border-red-600/40 transition-all duration-1000 shadow-2xl">
                        <img 
                          src={nextEpisode.Thumbnail || FALLBACK_THUMBNAIL} 
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_THUMBNAIL; }}
                          alt={nextEpisode.Title}
                          className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-[3000ms]" 
                        />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-700 backdrop-blur-sm">
                            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.8)] scale-75 group-hover:scale-100 transition-all duration-700">
                                <Play className="w-6 h-6 fill-current text-white translate-x-1" />
                            </div>
                        </div>
                    </div>
                    
                    <h4 className="text-xl font-black italic uppercase tracking-tighter line-clamp-2 group-hover:text-red-500 transition-colors leading-tight mb-4">{nextEpisode.Title}</h4>
                    <div className="flex items-center gap-4">
                        <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.3em]">Next Ep</span>
                        <div className="h-1 flex-grow bg-white/5 rounded-full overflow-hidden">
                            <div className="w-0 group-hover:w-full h-full bg-red-600 transition-all duration-[2000ms]"></div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <Monitor className="w-8 h-8 text-white/10" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">End of Season</span>
                    <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest mt-4">Check back soon for more</p>
                </div>
            )}
        </div>
    </div>
);

export default SeriesPlayerPage;
