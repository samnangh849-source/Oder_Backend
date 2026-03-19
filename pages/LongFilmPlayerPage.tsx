import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { 
  ChevronLeft, Share2, Play, Info, Calendar, Globe, Tag,
  Clock, Star, Eye, Zap, Volume2, Settings, Monitor, X, RotateCw
} from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { Movie } from '../types';
import HLSPlayer from '../components/common/HLSPlayer';
import { WEB_APP_URL } from '../constants';
import { convertGoogleDriveUrl } from '../utils/fileUtils';

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

  const relatedMovies = useMemo(() => {
    if (!currentMovie) return [];
    return movies.filter(m => m.ID !== currentMovie.ID && m.Category === currentMovie.Category).slice(0, 10);
  }, [movies, currentMovie]);

  const [watchProgress, setWatchProgress] = useState<Record<string, {time: number, duration: number}>>(() => {
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

  const handleShare = () => {
    if (!currentMovie) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=long_player&movie=${currentMovie.ID}`;
    if (navigator.share) {
      navigator.share({ title: currentMovie.Title, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      showNotification("Link copied! Guests can watch this movie without login.", "success");
    }
  };

  if (!currentMovie) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#080808] text-white">
        <Loader2 className="w-10 h-10 animate-spin text-red-600 mb-4" />
        <p className="text-gray-500 uppercase tracking-widest font-bold text-xs">Loading Cinema Experience...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white font-['Kantumruy_Pro'] flex flex-col overflow-y-auto no-scrollbar">
      {/* Premium Header Overlay */}
      <div className="bg-[#080808] p-4 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setAppState('entertainment')} 
            className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all active:scale-90"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-black italic tracking-tighter uppercase">{currentMovie.Title}</h1>
            <div className="flex gap-3 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                <span>{currentMovie.Language || 'Multiple'}</span>
                <span>•</span>
                <span>{currentMovie.Category || 'Movie'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLandscape}
            title={isLandscape ? 'Exit Landscape' : 'Rotate to Landscape'}
            className={`p-3 rounded-xl border transition-all flex items-center gap-2 text-[11px] font-black uppercase tracking-widest ${
              isLandscape 
                ? 'bg-red-600 border-red-500 text-white' 
                : 'bg-white/5 border-white/5 hover:bg-white/10'
            }`}
          >
            <RotateCw className={`w-4 h-4 transition-transform duration-500 ${isLandscape ? 'rotate-90' : ''}`} />
            {isLandscape ? 'Exit' : 'Rotate'}
          </button>
          <button 
            onClick={handleShare}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      <main className="flex-grow w-full max-w-[1800px] mx-auto px-4 sm:px-8 py-6 flex flex-col gap-8">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-8">
            <div className="flex flex-wrap gap-4 items-center">
               <div className="bg-red-600 px-3 py-1 rounded text-[10px] font-black uppercase">{currentMovie.Category || 'Movie'}</div>
               <div className="flex items-center gap-2 text-green-400 font-bold text-sm"><Star className="w-4 h-4 fill-current" /> {currentMovie.Score || 'N/A'} Score</div>
               <div className="text-gray-400 text-sm font-bold">{currentMovie.AddedAt ? new Date(currentMovie.AddedAt).getFullYear() : '—'}</div>
               <div className="border border-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-gray-400">{currentMovie.Country || 'World'}</div>
            </div>

            <div className="space-y-4">
               <h2 className="text-sm font-black uppercase tracking-[0.3em] text-red-500 italic">About this film</h2>
               <p className="text-xl text-gray-300 leading-relaxed font-medium">
                 {currentMovie.Description || "Enjoy the full cinematic experience of this feature-length film. Immerse yourself in the story and the high-quality production."}
               </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-white/5">
                {[
                  { icon: Globe, label: 'Country', value: currentMovie.Country },
                  { icon: Tag, label: 'Category', value: currentMovie.Category },
                  { icon: Clock, label: 'Language', value: currentMovie.Language },
                  { icon: Calendar, label: 'Year', value: currentMovie.AddedAt ? new Date(currentMovie.AddedAt).getFullYear().toString() : undefined }
                ].map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2 text-gray-500">
                      <item.icon className="w-3.2 h-3.2" />
                      <span className="text-[10px] uppercase font-black tracking-widest">{item.label}</span>
                    </div>
                    <p className="text-sm font-bold">{item.value || 'N/A'}</p>
                  </div>
                ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white italic">Related Movies</h3>
            <div className="grid grid-cols-2 gap-4">
              {relatedMovies.length > 0 ? relatedMovies.map(movie => (
                <div 
                  key={movie.ID} 
                  className="group relative aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer bg-white/5 border border-white/10 hover:border-red-600/50 transition-all shadow-xl hover:scale-105 active:scale-95"
                  onClick={() => setSelectedMovieId(movie.ID)}
                >
                  <img 
                    src={convertGoogleDriveUrl(movie.Thumbnail)} 
                    className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" 
                    alt={movie.Title} 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = `data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'><rect width='300' height='450' fill='%23111'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23444' font-size='14' font-family='sans-serif'>No Image</text></svg>`;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                    <p className="text-[10px] font-black uppercase truncate">{movie.Title}</p>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 py-10 text-center bg-white/5 rounded-2xl border border-white/5 border-dashed">
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No related movies found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Spacing for mobile fixed navigation */}
      <div className="h-20" />
    </div>
  );
};

const Loader2: React.FC<{className?: string}> = ({className}) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

export default LongFilmPlayerPage;
