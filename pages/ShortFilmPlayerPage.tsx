import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { 
  ChevronLeft, Share2, Play, Info, Calendar, Globe, Tag,
  Clock, Star, Eye, Zap, Volume2, Settings, Monitor, X, Loader2
} from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { Movie } from '../types';
import HLSPlayer from '../components/common/HLSPlayer';
import { WEB_APP_URL } from '../constants';
import { convertGoogleDriveUrl } from '../utils/fileUtils';

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

  const relatedShorts = useMemo(() => {
    if (!currentMovie) return [];
    return movies.filter(m => m.ID !== currentMovie.ID && m.Type === 'short' && (m.Category === currentMovie.Category || !currentMovie.Category)).slice(0, 12);
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

  const handleShare = () => {
    if (!currentMovie) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?view=watch&movie=${currentMovie.ID}`;
    navigator.clipboard.writeText(shareUrl);
    showNotification("Link copied! Share this short film with others.", "success");
  };

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
            <span className="text-[9px] text-blue-500 font-black uppercase tracking-[0.2em]">Short Film Selection</span>
          </div>
        </div>
        <button 
          onClick={handleShare}
          className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-all"
        >
          <Share2 className="w-5 h-5 opacity-60" />
        </button>
      </div>

      <main className="flex-grow w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Player Section */}
        <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/5 relative group">
          <HLSPlayer 
            url={currentMovie.VideoURL} 
            startTime={startTime} 
            onProgress={(time, duration) => saveProgress(currentMovie.ID, time, duration)}
          />
        </div>

        {/* Content Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-wrap gap-3 items-center">
               <div className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">Short Film</div>
               <span className="text-gray-600">•</span>
               <div className="text-gray-400 text-xs font-bold">{currentMovie.AddedAt ? new Date(currentMovie.AddedAt).getFullYear() : '2024'}</div>
               <span className="text-gray-600">•</span>
               <div className="text-gray-400 text-xs font-bold">{currentMovie.Category || 'General'}</div>
            </div>

            <div className="space-y-3">
               <h2 className="text-2xl font-black italic uppercase tracking-tight">{currentMovie.Title}</h2>
               <p className="text-gray-400 leading-relaxed text-sm">
                 {currentMovie.Description || "Enjoy this premium short film selection. Focused on high-quality storytelling in a concise format."}
               </p>
            </div>

            <div className="pt-6 border-t border-white/5 flex gap-8">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Language</span>
                  <p className="text-xs font-bold">{currentMovie.Language || 'Khmer'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Produced in</span>
                  <p className="text-xs font-bold">{currentMovie.Country || 'Cambodia'}</p>
                </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 italic">More Short Films</h3>
            <div className="grid grid-cols-2 gap-3">
              {relatedShorts.map(movie => (
                <div 
                  key={movie.ID} 
                  className="group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer bg-white/5 border border-white/10 hover:border-blue-500/50 transition-all active:scale-95"
                  onClick={() => {
                    setSelectedMovieId(movie.ID);
                    const container = document.querySelector('main');
                    if(container) container.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <img 
                    src={convertGoogleDriveUrl(movie.Thumbnail)} 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-all" 
                    alt={movie.Title} 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('placeholder')) {
                        target.src = 'https://via.placeholder.com/300x450?text=No+Image';
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-3 flex flex-col justify-end">
                    <p className="text-[9px] font-black uppercase truncate leading-none mb-1">{movie.Title}</p>
                    <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">{movie.Category || 'Short'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <div className="h-10" />
    </div>
  );
};

export default ShortFilmPlayerPage;
