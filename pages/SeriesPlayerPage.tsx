import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { 
  ChevronLeft, SkipBack, SkipForward, Maximize, RotateCw, 
  Lock, Unlock, Loader2, Play, Pause, X, Info, Calendar, Globe, Tag,
  Share2, List, PlayCircle, MoreVertical, Download, Heart
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
  const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null;

  const [isLocked, setIsLocked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Handle Scroll for Sticky Header
  useEffect(() => {
    const handleScroll = (e: any) => {
      setIsScrolled(e.target.scrollTop > 100);
    };
    const container = document.getElementById('app-main-scroll-container');
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!isLocked) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 4000);
    }
  };

  const handleShare = () => {
    if (!currentMovie) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=series_player&movie=${currentMovie.ID}`;
    navigator.clipboard.writeText(shareUrl);
    showNotification("តំណភ្ជាប់ត្រូវបានចម្លង!", "success");
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLocked) return;
    if (player) {
      try {
        if (typeof player.togglePlay === 'function') {
           player.togglePlay();
        } else if (typeof player.play === 'function') {
           if (player.paused) player.play().catch(() => {});
           else player.pause();
        }
      } catch (e) {
        console.warn("Toggle play failed", e);
      }
    }
  };

  if (isLoadingMovies && !currentMovie) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-red-600 mx-auto mb-4" />
            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">Loading Cinema Experience</p>
        </div>
      </div>
    );
  }

  if (!currentMovie && !isLoadingMovies) {
    return (
        <div className="flex h-screen items-center justify-center bg-[#0a0a0a] text-white p-6">
          <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 border border-white/10">
                 <X className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4">រកមិនឃើញវីដេអូ <br/> <span className="text-white/40">Movie Not Found</span></h2>
              <p className="text-white/40 text-sm mb-10 leading-relaxed font-light">សោកស្តាយ វីដេអូដែលលោកអ្នកកំពុងស្វែងរកមិនមានក្នុងប្រព័ន្ធ ឬត្រូវបានលុបចេញ។</p>
              <button 
                onClick={() => setAppState('entertainment')}
                className="w-full bg-red-600 hover:bg-red-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-2xl shadow-red-900/20"
              >
                Explore more movies
              </button>
          </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Kantumruy_Pro'] selection:bg-red-600/30">
      
      {/* 1. PREMIUM FLOATING HEADER */}
      <div className={`fixed top-0 left-0 right-0 z-[150] px-6 md:px-12 py-6 transition-all duration-700 flex items-center justify-between ${
        isScrolled ? 'bg-black/80 backdrop-blur-2xl border-b border-white/5 opacity-100 translate-y-0 shadow-2xl' : 'bg-transparent opacity-100 translate-y-0'
      }`}>
        <div className="flex items-center gap-6">
            {currentUser && (
                <button 
                    onClick={() => setAppState('entertainment')} 
                    className="group p-3 bg-white/5 rounded-full hover:bg-red-600 transition-all active:scale-90 border border-white/10"
                >
                    <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                </button>
            )}
            <div className="flex flex-col">
                <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mb-0.5 animate-pulse">Now Playing</span>
                <h2 className="text-lg md:text-xl font-black italic uppercase tracking-tighter truncate max-w-[200px] md:max-w-2xl leading-none">
                    {currentMovie.Title}
                </h2>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Theater Mode Active</span>
            </div>
            {currentUser && (
                <button onClick={handleShare} className="p-3 bg-white/5 rounded-full hover:bg-emerald-600 transition-all border border-white/10" title="Share Movie">
                    <Share2 className="w-5 h-5" />
                </button>
            )}
        </div>
      </div>

      {/* 2. THEATER SECTION (VIDEO & COMMAND CENTER) */}
      <div className="relative pt-24 md:pt-32 pb-10 px-4 md:px-10 lg:px-20 max-w-[1920px] mx-auto">
        <div className="relative group">
            {/* Visual Glow behind player */}
            <div className="absolute -inset-4 bg-gradient-to-r from-red-600/10 via-transparent to-blue-600/10 rounded-[3rem] blur-[100px] opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
            
            <div 
                ref={playerContainerRef}
                className={`relative w-full bg-black rounded-[2rem] md:rounded-[3.5rem] shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-1000 border border-white/5 ${
                isLandscape ? 'fixed inset-0 z-[200] rotate-90 origin-center scale-110 rounded-none' : 'h-[40vh] sm:h-[60vh] md:h-[75vh] lg:h-[85vh]'
                }`}
            >
                {/* Fullscreen Exit Button */}
                {isFullscreen && (
                    <button 
                        onClick={toggleFullscreen}
                        className="absolute top-6 right-6 z-[250] p-4 bg-black/50 hover:bg-red-600 text-white rounded-full backdrop-blur-md transition-all border border-white/10 active:scale-90"
                        title="Exit Fullscreen"
                    >
                        <X className="w-8 h-8" />
                    </button>
                )}

                <HLSPlayer 
                url={currentMovie.VideoURL} 
                onReady={(p) => {
                    setPlayer(p);
                    setIsPlaying(!p.paused);
                    p.on('play', () => setIsPlaying(true));
                    p.on('pause', () => setIsPlaying(false));
                    p.on('ended', () => {
                    if (autoPlay && nextEpisode) setSelectedMovieId(nextEpisode.ID);
                    });
                }}
                />

                {/* Locked Screen Overlay */}
                {isLocked && (
                <div className="absolute inset-0 z-[210] flex items-center justify-center bg-black/40 backdrop-blur-[2px] pointer-events-none">
                    <div className="bg-red-600/20 p-16 rounded-full border-2 border-red-600/30 animate-pulse">
                        <Lock className="w-24 h-24 text-red-600 opacity-40" />
                    </div>
                </div>
                )}
            </div>
        </div>
      </div>

      {/* 2.5 THEATER COMMAND CENTER (BELOW VIDEO) */}
      {!isLandscape && (
        <div className="bg-[#050505] border-y border-white/5 py-10 px-6 lg:px-20">
            <div className="max-w-[1800px] mx-auto">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-12">
                    
                    {/* Title Section */}
                    <div className="flex-grow max-w-2xl">
                        <div className="flex items-center gap-4 mb-4">
                            <span className="bg-red-600 px-3 py-1 rounded text-[10px] font-black uppercase italic tracking-widest shadow-lg">TV Series</span>
                            <div className="h-4 w-px bg-white/10"></div>
                            <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Currently Watching</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter uppercase leading-[1.1]">
                            {currentMovie.Title}
                        </h1>
                    </div>

                    {/* MAIN PLAYBACK HUD */}
                    <div className="flex items-center justify-center gap-6">
                        <div className="flex items-center gap-3 bg-white/[0.03] backdrop-blur-3xl p-2 rounded-full border border-white/5 shadow-xl">
                            {!isLocked && (
                                <button 
                                    disabled={!prevEpisode}
                                    onClick={(e) => { e.stopPropagation(); prevEpisode && setSelectedMovieId(prevEpisode.ID); }}
                                    className={`p-4 rounded-full transition-all duration-300 ${prevEpisode ? 'text-white/60 hover:bg-white/10 hover:text-white active:scale-90' : 'opacity-10 cursor-not-allowed'}`}
                                >
                                    <SkipBack className="w-6 h-6 fill-current" />
                                </button>
                            )}

                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsLocked(!isLocked); }} 
                                    className={`p-4 rounded-full border transition-all active:scale-90 ${isLocked ? 'bg-red-600 border-red-500 scale-105 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-white/10 border-white/10 hover:bg-white/20'}`}
                                >
                                    {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5 text-white/80" />}
                                </button>

                                {!isLocked && (
                                    <button 
                                        onClick={togglePlay}
                                        className="relative group p-8 rounded-full bg-red-600 text-white hover:bg-red-500 transition-all duration-500 shadow-[0_0_40px_rgba(220,38,38,0.4)] active:scale-95 border-2 border-red-500/30 overflow-hidden"
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-8 h-8 fill-current relative z-10" />
                                        ) : (
                                            <Play className="w-8 h-8 fill-current translate-x-0.5 relative z-10" />
                                        )}
                                    </button>
                                )}
                            </div>

                            {!isLocked && (
                                <button 
                                    disabled={!nextEpisode}
                                    onClick={(e) => { e.stopPropagation(); nextEpisode && setSelectedMovieId(nextEpisode.ID); }}
                                    className={`p-4 rounded-full transition-all duration-300 ${nextEpisode ? 'text-white/60 hover:bg-white/10 hover:text-white active:scale-90' : 'opacity-10 cursor-not-allowed'}`}
                                >
                                    <SkipForward className="w-6 h-6 fill-current" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Secondary Actions HUD */}
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button 
                            onClick={() => setAutoPlay(!autoPlay)}
                            className={`group relative flex items-center gap-4 px-6 py-3 rounded-full border transition-all duration-500 overflow-hidden ${
                                autoPlay 
                                ? 'bg-red-600/10 border-red-600/50 shadow-[0_0_20px_rgba(220,38,38,0.2)]' 
                                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08]'
                            }`}
                        >
                            {/* Animated Background for Active State */}
                            {autoPlay && (
                                <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 via-transparent to-transparent animate-pulse"></div>
                            )}
                            
                            <div className="relative flex items-center gap-3 z-10">
                                <div className={`w-12 h-6 rounded-full relative transition-all duration-500 p-1 border ${
                                    autoPlay 
                                    ? 'bg-red-600 border-red-500 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_15px_rgba(220,38,38,0.4)]' 
                                    : 'bg-black/40 border-white/10'
                                }`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-[0_2px_10px_rgba(0,0,0,0.5)] transform ${
                                        autoPlay ? 'translate-x-6 scale-110' : 'translate-x-0'
                                    }`}>
                                        {/* Optional: Tiny dot inside knob for tactile feel */}
                                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full transition-colors ${autoPlay ? 'bg-red-600' : 'bg-gray-300'}`}></div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                                        autoPlay ? 'text-red-500' : 'text-white/40 group-hover:text-white'
                                    }`}>
                                        Auto Next
                                    </span>
                                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest leading-none">
                                        {autoPlay ? 'Active' : 'Off'}
                                    </span>
                                </div>
                            </div>
                        </button>
                        
                        <div className="flex items-center gap-2 bg-white/[0.03] backdrop-blur-xl p-1.5 rounded-full border border-white/10 shadow-xl">
                            <button onClick={toggleFullscreen} className="p-3.5 bg-white/5 rounded-full border border-white/5 hover:bg-white/20 text-white/60 hover:text-white transition-all active:scale-90" title="Fullscreen">
                                <Maximize className="w-5 h-5" />
                            </button>
                            <button onClick={() => setIsLandscape(!isLandscape)} className="p-3.5 bg-white/5 rounded-full border border-white/5 hover:bg-blue-600/80 hover:text-white text-white/60 transition-all active:scale-90" title="Rotate Screen">
                                <RotateCw className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
      )}

      {/* 3. INFORMATION & CONTENT AREA */}
      {!isLandscape && (
        <div className="max-w-[1800px] mx-auto px-6 md:px-12 lg:px-20 py-10 pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
            
            {/* Left Section: Extensive Info */}
            <div className="lg:col-span-8 space-y-12">
              <div className="space-y-8">
                {/* Visual Header Chips */}
                <div className="flex flex-wrap items-center gap-4">
                    <span className="bg-red-600/10 text-red-600 px-4 py-1.5 rounded-full text-[11px] font-black uppercase italic tracking-[0.2em] border border-red-600/20 shadow-lg shadow-red-900/10">Premium TV Series</span>
                    <span className="bg-white/5 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-[0.2em] border border-white/10 backdrop-blur-md">{currentMovie.Category}</span>
                    <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-full text-[11px] font-black text-white/40 uppercase tracking-[0.2em] border border-white/10 ml-auto">
                        <Calendar className="w-4 h-4" />
                        {currentMovie.AddedAt ? new Date(currentMovie.AddedAt).getFullYear() : '2024'}
                    </div>
                </div>

                {/* Giant Title */}
                <h1 className="text-5xl md:text-8xl font-black text-white italic tracking-tighter uppercase leading-[0.95] drop-shadow-2xl">
                    {currentMovie.Title}
                </h1>

                {/* Metadata Dashboard */}
                <div className="flex flex-wrap items-center gap-10 text-[12px] font-black text-white/40 uppercase tracking-[0.3em] border-y border-white/5 py-10">
                    <div className="flex items-center gap-4 group">
                        <div className="p-3 bg-blue-600/10 rounded-2xl group-hover:bg-blue-600 transition-colors">
                            <Globe className="w-5 h-5 text-blue-500 group-hover:text-white" />
                        </div>
                        {currentMovie.Country}
                    </div>
                    <div className="flex items-center gap-4 group">
                        <div className="p-3 bg-emerald-600/10 rounded-2xl group-hover:bg-emerald-600 transition-colors">
                            <Info className="w-5 h-5 text-emerald-500 group-hover:text-white" />
                        </div>
                        {currentMovie.Language}
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/10">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        1080P ULTRA HD
                    </div>
                    <div className="flex items-center gap-4 ml-auto text-red-500 cursor-pointer hover:text-red-400 group transition-all">
                        <div className="p-3 bg-red-600/10 rounded-2xl group-hover:bg-red-600 transition-colors">
                            <Heart className="w-5 h-5 group-hover:text-white" />
                        </div>
                        <span className="hidden sm:inline">Add to My List</span>
                    </div>
                </div>

                {/* Synopsis Card */}
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-600/20 to-blue-600/20 rounded-[3rem] blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                    <div className="relative p-10 md:p-14 rounded-[3.5rem] bg-white/[0.02] border border-white/5 shadow-2xl overflow-hidden backdrop-blur-3xl">
                        <div className="flex items-center gap-4 mb-8 text-red-600">
                            <PlayCircle className="w-8 h-8" />
                            <h3 className="text-[12px] font-black uppercase tracking-[0.4em]">សេចក្តីសង្ខេប • Detailed Synopsis</h3>
                        </div>
                        <p className="text-white/60 leading-[1.8] text-xl font-light italic">
                            {currentMovie.Description || 'មិនទាន់មានការពិពណ៌នាសម្រាប់រឿងនេះនៅឡើយទេ។ សូមរង់ចាំការអាប់ដេតព័ត៌មានបន្ថែមក្នុងពេលឆាប់ៗនេះ។'}
                        </p>
                    </div>
                </div>
              </div>

              {/* Episode Grid Section (Only for logged in users) */}
              {currentUser && (
                <div className="pt-16 border-t border-white/5">
                    <div className="flex items-center justify-between mb-12">
                        <div className="flex items-center gap-6">
                            <div className="w-2 h-12 bg-red-600 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)]"></div>
                            <h2 className="text-4xl font-black italic uppercase tracking-tighter">បញ្ជីភាគរឿង <span className="text-white/10 ml-2">Series Episodes</span></h2>
                        </div>
                        <div className="text-[11px] font-black text-white/30 uppercase tracking-[0.4em] bg-white/5 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md">
                            {episodes.length} Episodes Total
                        </div>
                    </div>
                    <EpisodeSelector 
                        currentMovie={currentMovie}
                        allEpisodes={episodes}
                        onSelectEpisode={(ep) => {
                            setSelectedMovieId(ep.ID);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    />
                </div>
              )}
            </div>

            {/* Right Section: Sidebar Dashboard (Desktop Only) */}
            {currentUser && (
                <div className="hidden lg:block lg:col-span-4">
                    <div className="sticky top-32 space-y-10">
                        {/* Visual Up Next */}
                        <UpNextCard nextEpisode={nextEpisode} onSelect={() => nextEpisode && setSelectedMovieId(nextEpisode.ID)} />
                        
                        {/* Cinema Stats */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] text-center hover:bg-white/5 transition-all cursor-default shadow-xl backdrop-blur-md group">
                                <div className="text-3xl font-black italic text-red-600 mb-2 group-hover:scale-110 transition-transform">{episodes.length}</div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Total ភាគ</div>
                            </div>
                            <div className="bg-white/[0.02] border border-white/5 p-8 rounded-[2.5rem] text-center hover:bg-white/5 transition-all cursor-default shadow-xl backdrop-blur-md group">
                                <div className="text-3xl font-black italic text-emerald-500 mb-2 group-hover:scale-110 transition-transform">4K</div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Quality</div>
                            </div>
                        </div>

                        {/* Premium Ad Space */}
                        <div className="aspect-[4/5] bg-gradient-to-br from-red-900/20 via-black to-blue-900/10 border border-white/5 rounded-[3.5rem] p-12 flex flex-col items-center justify-center text-center overflow-hidden relative group cursor-pointer shadow-2xl">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-red-600/10 rounded-full blur-[80px]"></div>
                            <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-10 shadow-[0_0_60px_rgba(220,38,38,0.4)] group-hover:scale-110 transition-transform duration-700">
                                <PlayCircle className="w-12 h-12 text-white" />
                            </div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Theater Pro</h3>
                            <p className="text-[11px] text-white/30 font-bold uppercase tracking-[0.2em] leading-relaxed">Unlock the full power <br/> of cinematic streaming.</p>
                        </div>
                    </div>
                </div>
            )}

          </div>
        </div>
      )}

      {/* Global CSS for Smooth Transitions */}
      <style dangerouslySetInnerHTML={{ __html: `
        :-webkit-full-screen { width: 100%; height: 100%; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        #app-main-scroll-container { scroll-behavior: smooth; }
        @media screen and (orientation: portrait) {
          .rotate-90 {
            transform: rotate(90deg);
            width: 100vh !important;
            height: 100vw !important;
          }
        }
      `}} />
    </div>
  );
};

// --- SUB-COMPONENT: UP NEXT CARD ---
const UpNextCard = ({ nextEpisode, onSelect }: { nextEpisode: Movie | null, onSelect: () => void }) => (
    <div className="group relative p-1 rounded-[3.5rem] bg-gradient-to-br from-white/10 via-transparent to-white/5 shadow-2xl transition-all duration-1000 hover:scale-[1.02]">
        <div className="bg-[#0a0a0a] rounded-[3.4rem] p-10 border border-white/5 relative overflow-hidden backdrop-blur-3xl">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-600/10 rounded-full blur-[80px] pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4 text-red-500">
                    <PlayCircle className="w-6 h-6 animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-[0.4em]">Up Next</span>
                </div>
                {nextEpisode && (
                    <span className="text-[10px] bg-red-600 text-white px-3 py-1 rounded-full font-black italic tracking-widest shadow-lg">AUTO</span>
                )}
            </div>
            
            {nextEpisode ? (
                <div className="cursor-pointer" onClick={onSelect}>
                    <div className="relative aspect-video rounded-[2.5rem] overflow-hidden mb-8 border border-white/10 group-hover:border-red-600/50 transition-all duration-1000 shadow-2xl">
                        <img src={nextEpisode.Thumbnail} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2000ms]" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-3xl scale-75 group-hover:scale-100 transition-all duration-700">
                                <Play className="w-8 h-8 fill-current text-white translate-x-1" />
                            </div>
                        </div>
                    </div>
                    <h4 className="text-2xl font-black italic uppercase tracking-tighter line-clamp-2 group-hover:text-red-500 transition-colors leading-tight mb-4">{nextEpisode.Title}</h4>
                    <p className="text-[11px] text-white/20 font-black uppercase tracking-[0.3em] flex items-center gap-4">
                        <span className="bg-white/5 px-3 py-1 rounded-lg border border-white/5">Episode Next</span>
                        <span>•</span>
                        <span>{nextEpisode.Language}</span>
                    </p>
                </div>
            ) : (
                <div className="py-16 flex flex-col items-center justify-center text-center opacity-20">
                    <List className="w-16 h-16 mb-6" />
                    <span className="text-[11px] font-black uppercase tracking-[0.4em]">End of Season</span>
                </div>
            )}
        </div>
    </div>
);

export default SeriesPlayerPage;
