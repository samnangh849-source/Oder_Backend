import React, { useState, useEffect, useContext, useMemo } from 'react';
import { ChevronLeft, Share2, Play, Globe, Tv, Film, Loader2, RotateCw, Star, Info, Calendar, Tag, Clock } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { Movie } from '../types';
import HLSPlayer from '../components/common/HLSPlayer';
import { WEB_APP_URL } from '../constants';
import { convertGoogleDriveUrl } from '../utils/fileUtils';

// Inline SVG fallback — never broken (replaces via.placeholder.com)
const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'%3E%3Crect width='300' height='450' fill='%23141414'/%3E%3Ccircle cx='150' cy='225' r='36' fill='%23222'/%3E%3Cpolygon points='140,208 140,242 172,225' fill='%23444'/%3E%3C/svg%3E";

// ── Reusable Recommendation Card ──────────────────────────────────────────────
const RecoCard: React.FC<{
  movie: Movie;
  badge?: string;
  badgeColor?: string;
  onClick: () => void;
}> = ({ movie, badge, badgeColor = 'bg-red-600/20 text-red-400 border-red-500/20', onClick }) => (
  <div
    className="group relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer bg-white/5 border border-white/10 hover:border-white/30 transition-all duration-300 active:scale-95 hover:scale-[1.03] shadow-lg hover:shadow-2xl"
    onClick={onClick}
  >
    <img
      src={convertGoogleDriveUrl(movie.Thumbnail) || FALLBACK_SVG}
      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
      alt={movie.Title}
      onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_SVG; }}
    />
    {/* Gradient overlay */}
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent p-3 flex flex-col justify-end">
      {badge && (
        <span className={`self-start text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border mb-1.5 ${badgeColor}`}>
          {badge}
        </span>
      )}
      <p className="text-[9px] font-black uppercase truncate leading-tight">{movie.Title}</p>
      <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{movie.Category || '—'}</p>
    </div>
    {/* Play overlay on hover */}
    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30">
        <Play className="w-4 h-4 fill-current ml-0.5" />
      </div>
    </div>
  </div>
);

// ── Section Header ────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-4 mt-6">
    <div className="p-1.5 bg-white/5 rounded-lg border border-white/10">{icon}</div>
    <div>
      <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">{subtitle}</p>
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const LongFilmPlayerPage: React.FC = () => {
  const { appData, setAppState, selectedMovieId, setSelectedMovieId, showNotification } = useContext(AppContext);

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
            if (result.status === 'success') setLocalMovies(result.data || []);
          }
        } catch (e) {
          console.error('Failed to fetch movies', e);
        } finally {
          setIsLoadingMovies(false);
        }
      };
      fetchMovies();
    }
  }, [appData?.movies]);

  const currentMovie = useMemo(() => movies.find(m => m.ID === selectedMovieId), [movies, selectedMovieId]);

  // — More Feature Movies (same category) —
  const relatedMovies = useMemo(() => {
    if (!currentMovie) return [];
    return movies
      .filter(m => m.ID !== currentMovie.ID && m.Type === 'long')
      .slice(0, 10);
  }, [movies, currentMovie]);

  // — Short Film Recommendations —
  const shortFilms = useMemo(() => {
    if (!currentMovie) return [];
    return movies.filter(m => m.Type === 'short').slice(0, 10);
  }, [movies, currentMovie]);

  // — TV Series — deduplicated: one poster per SeriesKey
  const seriesAlbums = useMemo(() => {
    if (!currentMovie) return [];
    const seen = new Set<string>();
    return movies.filter(m => {
      if (m.Type !== 'series') return false;
      const key = m.SeriesKey || m.Title.split('-')[0].trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  }, [movies, currentMovie]);

  const [watchProgress, setWatchProgress] = useState<Record<string, { time: number; duration: number }>>(() => {
    const saved = localStorage.getItem('movie_progress');
    return saved ? JSON.parse(saved) : {};
  });

  const saveProgress = (id: string, time: number, duration: number) => {
    setWatchProgress(prev => {
      const updated = { ...prev, [id]: { time, duration } };
      localStorage.setItem('movie_progress', JSON.stringify(updated));
      return updated;
    });
  };

  const startTime = useMemo(() => watchProgress[selectedMovieId]?.time || 0, [selectedMovieId, watchProgress]);

  // ── Auto-rotate to Landscape on Mobile/Tablet ──────────────────────────────
  useEffect(() => {
    if (!currentMovie) return;

    const isMobileOrTablet = window.matchMedia('(max-width: 1024px)').matches;
    if (!isMobileOrTablet) return;

    let locked = false;

    const tryLock = async () => {
      try {
        if (screen.orientation && typeof (screen.orientation as any).lock === 'function') {
          await (screen.orientation as any).lock('landscape');
          locked = true;
        } else {
          // Fallback: request fullscreen on the root element
          const el = document.documentElement;
          if (el.requestFullscreen) {
            await el.requestFullscreen().catch(() => {});
          }
        }
      } catch (_) {
        // Silently ignore — common on iOS
      }
    };

    tryLock();

    return () => {
      if (locked) {
        try {
          (screen.orientation as any).unlock?.();
        } catch (_) {}
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [currentMovie?.ID]);

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const handleShare = () => {
    if (!currentMovie) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=long_player&movie=${currentMovie.ID}`;
    if (navigator.share) {
      navigator.share({ title: currentMovie.Title, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      showNotification('Link copied!', 'success');
    }
  };

  const scrollToTop = () => {
    const container = document.getElementById('app-main-scroll-container');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Rotate / Landscape toggle
  const [isLandscape, setIsLandscape] = useState(false);
  const toggleLandscape = async () => {
    if (!isLandscape) {
      try {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen().catch(() => {});
        if (screen?.orientation && typeof (screen.orientation as any).lock === 'function') {
          await (screen.orientation as any).lock('landscape').catch(() => {});
        }
      } catch (_) {}
      setIsLandscape(true);
    } else {
      try {
        if (screen?.orientation && typeof (screen.orientation as any).unlock === 'function') {
          (screen.orientation as any).unlock();
        }
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      } catch (_) {}
      setIsLandscape(false);
    }
  };

  // Handlers for each type
  const handleSelectLong = (movie: Movie) => { setSelectedMovieId(movie.ID); scrollToTop(); };
  const handleSelectShort = (movie: Movie) => { setSelectedMovieId(movie.ID); setAppState('short_player'); };
  const handleSelectSeries = (movie: Movie) => { setSelectedMovieId(movie.ID); setAppState('series_player'); };

  if (!currentMovie) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#080808] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" />
        <p className="text-gray-500 uppercase tracking-widest font-bold text-xs tracking-[0.3em]">Loading Cinema Experience...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-['Kantumruy_Pro'] flex flex-col overflow-y-auto no-scrollbar">
      {/* Premium Header Overlay */}
      <div className="bg-[#080808]/80 p-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAppState('entertainment')}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-90"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-black italic tracking-tighter uppercase leading-tight truncate">{currentMovie.Title}</h1>
            <div className="flex items-center gap-2">
               <span className="text-[9px] text-red-500 font-black uppercase tracking-[0.2em]">Full Movie</span>
               <span className="text-white/10 text-[8px]">|</span>
               <span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">{currentMovie.Category || 'Cinema'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLandscape}
            title={isLandscape ? 'Exit Landscape' : 'Rotate to Landscape'}
            className={`p-2.5 rounded-full transition-all ${isLandscape ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white/5 hover:bg-white/10'}`}
          >
            <RotateCw className={`w-5 h-5 transition-transform duration-500 ${isLandscape ? 'rotate-90' : ''}`} />
          </button>
          <button onClick={handleShare} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all">
            <Share2 className="w-5 h-5 opacity-60" />
          </button>
        </div>
      </div>

      <main className="flex-grow w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-10">
        {/* Cinema Stage */}
        <div className="w-full aspect-video bg-black rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5 relative group">
          <HLSPlayer
            url={currentMovie.VideoURL}
            startTime={startTime}
            onProgress={(time, duration) => saveProgress(currentMovie.ID, time, duration)}
            hideStatusBar={true}
          />
        </div>

        {/* Info & Details Section */}
        <div className="space-y-8">
            <div className="flex flex-wrap gap-3 items-center">
               <div className="bg-red-600/20 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {currentMovie.Category || 'Movie'}
               </div>
               <div className="flex items-center gap-2 text-yellow-500 font-black text-xs">
                  <Star className="w-3.5 h-3.5 fill-current" /> {currentMovie.Score || '9.2'}
               </div>
               <span className="text-white/10">•</span>
               <div className="text-gray-400 text-xs font-bold font-mono tracking-tighter">{currentMovie.AddedAt ? new Date(currentMovie.AddedAt).getFullYear() : '2024'}</div>
               <span className="text-white/10">•</span>
               <div className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] uppercase font-black text-gray-500 border border-white/5">{currentMovie.Country || 'Global'}</div>
            </div>

            <div className="space-y-4 max-w-4xl">
               <h2 className="text-sm font-black uppercase tracking-[0.3em] text-red-600 italic">About this film</h2>
               <div className="relative">
                 <p className={`text-lg sm:text-xl text-gray-300 leading-relaxed font-medium transition-all duration-500 ${!isDescriptionExpanded ? 'line-clamp-3 overflow-hidden' : ''}`}>
                   {currentMovie.Description || "Enjoy the full cinematic experience of this feature-length film. Immerse yourself in the story and the high-quality production."}
                 </p>
                 {currentMovie.Description && currentMovie.Description.length > 150 && (
                   <button 
                     onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                     className="mt-2 text-red-500 text-[10px] font-black uppercase tracking-widest hover:text-red-400 transition-colors flex items-center gap-1 group"
                   >
                     {isDescriptionExpanded ? 'Show Less' : 'Read More'}
                     <ChevronLeft className={`w-3 h-3 transition-transform duration-300 ${isDescriptionExpanded ? 'rotate-90' : '-rotate-90'}`} />
                   </button>
                 )}
               </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8 border-t border-white/5">
                {[
                  { icon: Globe, label: 'Country', value: currentMovie.Country || 'Global' },
                  { icon: Tag, label: 'Category', value: currentMovie.Category || 'General' },
                  { icon: Clock, label: 'Language', value: currentMovie.Language || 'Multiple' },
                  { icon: Calendar, label: 'Quality', value: '4K Ultra HD' }
                ].map((item, i) => (
                  <div key={i} className="space-y-1.5 p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 text-gray-500">
                      <item.icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] uppercase font-black tracking-widest">{item.label}</span>
                    </div>
                    <p className="text-sm font-black text-white">{item.value}</p>
                  </div>
                ))}
            </div>
        </div>

        {/* ── RECOMMENDATIONS ──────────────────────────────────── */}

        {/* 1. More Feature Movies */}
        {relatedMovies.length > 0 && (
          <section>
            <SectionHeader
              icon={<Film className="w-4 h-4 text-red-500" />}
              title="Feature Movies"
              subtitle="More cinematic highlights"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {relatedMovies.map(movie => (
                <RecoCard
                  key={movie.ID}
                  movie={movie}
                  badge="HD"
                  badgeColor="bg-red-600/20 text-red-400 border-red-500/20"
                  onClick={() => handleSelectLong(movie)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 2. Short Film Selection */}
        {shortFilms.length > 0 && (
          <section>
            <SectionHeader
              icon={<Play className="w-4 h-4 text-blue-500" />}
              title="Short Films"
              subtitle="Quick stories for your rest"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {shortFilms.map(movie => (
                <RecoCard
                  key={movie.ID}
                  movie={movie}
                  badge="Short"
                  badgeColor="bg-blue-600/20 text-blue-400 border-blue-500/20"
                  onClick={() => handleSelectShort(movie)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 3. Popular TV Series — deduplicated albums */}
        {seriesAlbums.length > 0 && (
          <section>
            <SectionHeader
              icon={<Tv className="w-4 h-4 text-yellow-500" />}
              title="TV Series"
              subtitle="Multi-episode thrillers"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {seriesAlbums.map(movie => (
                <div key={movie.ID} className="relative">
                  <RecoCard
                    movie={movie}
                    badge="Series"
                    badgeColor="bg-yellow-600/20 text-yellow-400 border-yellow-500/20"
                    onClick={() => handleSelectSeries(movie)}
                  />
                  {/* Series indicator accent */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-600 via-yellow-400 to-transparent rounded-t-xl" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="h-20" />
    </div>
  );
};

export default LongFilmPlayerPage;
