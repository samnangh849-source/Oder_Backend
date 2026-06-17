import React, { useState, useEffect, useContext, useMemo } from 'react';
import { ChevronLeft, Share2, Play, Globe, Tv, Film, Loader2, RotateCw } from 'lucide-react';
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
}> = ({ movie, badge, badgeColor = 'bg-blue-600/20 text-blue-400 border-blue-500/20', onClick }) => (
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
  <div className="flex items-center gap-3 mb-4">
    <div className="p-1.5 bg-white/5 rounded-lg border border-white/10">{icon}</div>
    <div>
      <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
      <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">{subtitle}</p>
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const ShortFilmPlayerPage: React.FC = () => {
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

  // — More Short Films (same or any category) —
  const relatedShorts = useMemo(() => {
    if (!currentMovie) return [];
    return movies
      .filter(m => m.ID !== currentMovie.ID && m.Type === 'short')
      .slice(0, 10);
  }, [movies, currentMovie]);

  // — Feature Movies —
  const featureMovies = useMemo(() => {
    if (!currentMovie) return [];
    return movies.filter(m => m.Type === 'long').slice(0, 8);
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
    }).slice(0, 8);
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
          // Fallback: request fullscreen on the root element which triggers landscape on most Android
          const el = document.documentElement;
          if (el.requestFullscreen) {
            await el.requestFullscreen().catch(() => {});
          }
        }
      } catch (_) {
        // Silently ignore — happens on iOS where lock is not permitted
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
  const [isVertical, setIsVertical] = useState(false);

  const handleMetadataLoaded = (width: number, height: number) => {
    if (height > width) {
      setIsVertical(true);
    } else {
      setIsVertical(false);
    }
  };

  const handleShare = () => {
    if (!currentMovie) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=short_player&movie=${currentMovie.ID}`;
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
  const handleSelectShort = (movie: Movie) => { setSelectedMovieId(movie.ID); scrollToTop(); };
  const handleSelectLong = (movie: Movie) => { setSelectedMovieId(movie.ID); setAppState('long_player'); };
  const handleSelectSeries = (movie: Movie) => { setSelectedMovieId(movie.ID); setAppState('series_player'); };

  if (!currentMovie) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#080808] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-500 uppercase tracking-widest font-bold text-xs">Loading Short Film...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-['Kantumruy_Pro'] flex flex-col overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="bg-[#080808]/80 p-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAppState('entertainment')}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-black italic tracking-tighter uppercase leading-tight">{currentMovie.Title}</h1>
            <span className="text-[9px] text-blue-500 font-black uppercase tracking-[0.2em]">Short Film</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLandscape}
            title={isLandscape ? 'Exit Landscape' : 'Rotate to Landscape'}
            className={`p-2.5 rounded-full transition-all ${isLandscape ? 'bg-blue-600 text-white' : 'bg-white/5 hover:bg-white/10'}`}
          >
            <RotateCw className={`w-5 h-5 transition-transform duration-500 ${isLandscape ? 'rotate-90' : ''}`} />
          </button>
          <button onClick={handleShare} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all">
            <Share2 className="w-5 h-5 opacity-60" />
          </button>
        </div>
      </div>

      <main className="flex-grow w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-10">
        {/* Player */}
        <div className={`w-full ${isVertical ? 'max-w-md mx-auto aspect-[9/16]' : 'aspect-video'} bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5 transition-all duration-500`}>
          <HLSPlayer
            url={currentMovie.VideoURL}
            startTime={startTime}
            onProgress={(time, duration) => saveProgress(currentMovie.ID, time, duration)}
            onMetadataLoaded={handleMetadataLoaded}
          />
        </div>

        {/* Movie Info */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">
              Short Film
            </div>
            <span className="text-gray-600">•</span>
            <div className="text-gray-400 text-xs font-bold">
              {currentMovie.AddedAt ? new Date(currentMovie.AddedAt).getFullYear() : '2024'}
            </div>
            <span className="text-gray-600">•</span>
            <div className="text-gray-400 text-xs font-bold">{currentMovie.Category || 'General'}</div>
          </div>
          <h2 className="text-2xl font-black italic uppercase tracking-tight">{currentMovie.Title}</h2>
          <div className="relative">
            <p className={`text-gray-400 leading-relaxed text-sm transition-all duration-500 ${!isDescriptionExpanded ? 'line-clamp-2 overflow-hidden' : ''}`}>
              {currentMovie.Description || 'Enjoy this premium short film selection. Focused on high-quality storytelling in a concise format.'}
            </p>
            {currentMovie.Description && currentMovie.Description.length > 100 && (
              <button 
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="mt-1 text-blue-500 text-[9px] font-black uppercase tracking-widest hover:text-blue-400 transition-colors flex items-center gap-1 group"
              >
                {isDescriptionExpanded ? 'Show Less' : 'Read More'}
                <ChevronLeft className={`w-3 h-3 transition-transform duration-300 ${isDescriptionExpanded ? 'rotate-90' : '-rotate-90'}`} />
              </button>
            )}
          </div>
          <div className="pt-4 border-t border-white/5 flex gap-8">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Language</span>
              <p className="text-xs font-bold">{currentMovie.Language || 'Khmer'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Country</span>
              <p className="text-xs font-bold">{currentMovie.Country || 'Cambodia'}</p>
            </div>
          </div>
        </div>

        {/* ── RECOMMENDATIONS ──────────────────────────────────── */}

        {/* 1. More Short Films */}
        {relatedShorts.length > 0 && (
          <section>
            <SectionHeader
              icon={<Film className="w-4 h-4 text-blue-400" />}
              title="More Short Films"
              subtitle="Quick stories to watch"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {relatedShorts.map(movie => (
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

        {/* 2. Feature Movies */}
        {featureMovies.length > 0 && (
          <section>
            <SectionHeader
              icon={<Film className="w-4 h-4 text-yellow-400" />}
              title="Feature Movies"
              subtitle="Full-length cinematic films"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {featureMovies.map(movie => (
                <RecoCard
                  key={movie.ID}
                  movie={movie}
                  badge="Movie"
                  badgeColor="bg-yellow-600/20 text-yellow-400 border-yellow-500/20"
                  onClick={() => handleSelectLong(movie)}
                />
              ))}
            </div>
          </section>
        )}

        {/* 3. TV Series — one poster per series (album) */}
        {seriesAlbums.length > 0 && (
          <section>
            <SectionHeader
              icon={<Tv className="w-4 h-4 text-red-400" />}
              title="TV Series"
              subtitle="Multi-episode series — tap to browse episodes"
            />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {seriesAlbums.map(movie => (
                <div key={movie.ID} className="relative">
                  <RecoCard
                    movie={movie}
                    badge="Series"
                    badgeColor="bg-red-600/20 text-red-400 border-red-500/20"
                    onClick={() => handleSelectSeries(movie)}
                  />
                  {/* Series indicator stripe */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-600 via-red-400 to-transparent rounded-t-xl" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="h-10" />
    </div>
  );
};

export default ShortFilmPlayerPage;
