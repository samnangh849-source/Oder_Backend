import React, { useState, useMemo } from 'react';
import { Movie } from '../../../types';
import HLSPlayer from '../../common/HLSPlayer';
import EpisodeSelector from './EpisodeSelector';
import { ChevronLeft, SkipBack, SkipForward, Info, Calendar, Globe, Tag, CheckCircle2, Play } from 'lucide-react';

interface SeriesPlayerViewProps {
  movie: Movie;
  allMovies: Movie[];
  onBack: () => void;
  onSelectMovie: (movie: Movie) => void;
}

const SeriesPlayerView: React.FC<SeriesPlayerViewProps> = ({ movie, allMovies, onBack, onSelectMovie }) => {
  const [autoPlay, setAutoPlay] = useState(true);

  // Filter episodes that belong to the same series/collection
  // Logic: Movies with the same Category and Country (or similar title pattern)
  const episodes = useMemo(() => {
    return allMovies.filter(m => 
      m.Category === movie.Category && 
      m.Country === movie.Country &&
      m.Type === 'series'
    );
  }, [allMovies, movie]);

  // Find current index, next and previous episodes
  const currentIndex = episodes.findIndex(e => e.ID === movie.ID);
  const nextEpisode = currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;
  const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null;

  const handleNext = () => {
    if (nextEpisode) onSelectMovie(nextEpisode);
  };

  const handlePrev = () => {
    if (prevEpisode) onSelectMovie(prevEpisode);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white pb-24 font-['Kantumruy_Pro']">
      {/* Header / Navigation with subtle gradient */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-black/90 via-black/60 to-transparent pt-4 pb-6 px-6 flex items-center justify-between pointer-events-none">
        <button 
          onClick={onBack}
          className="flex items-center gap-3 text-white/70 hover:text-white transition-all group pointer-events-auto bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 hover:border-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold text-sm tracking-wide uppercase">ត្រឡប់ក្រោយ</span>
        </button>
        
        <div className="flex-1 px-8 text-center hidden md:block">
            <h2 className="text-xl font-black truncate max-w-2xl mx-auto tracking-widest uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                {movie.Title}
            </h2>
        </div>

        <div className="flex items-center gap-4 pointer-events-auto">
            <label className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full ${autoPlay ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-gray-600'}`} />
                <span className="text-xs font-black uppercase tracking-widest text-gray-200">Auto Next</span>
                <input 
                    type="checkbox" 
                    checked={autoPlay} 
                    onChange={(e) => setAutoPlay(e.target.checked)}
                    className="sr-only"
                />
            </label>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 -mt-8 relative z-10">
        {/* Main Player Section with deep shadow */}
        <div className="relative group shadow-[0_20px_50px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden border border-white/10 bg-black transition-transform duration-500 hover:shadow-[0_20px_60px_rgba(229,9,20,0.15)] ring-1 ring-white/5">
            <div className="aspect-video w-full">
                <HLSPlayer 
                    url={movie.VideoURL} 
                    onReady={(player) => {
                        player.on('ended', () => {
                            if (autoPlay && nextEpisode) {
                                setTimeout(() => onSelectMovie(nextEpisode), 2000); // 2 second delay before next
                            }
                        });
                    }}
                />
            </div>
            
            {/* Elegant Controls Overlay */}
            <div className="absolute inset-x-0 bottom-0 pt-24 pb-8 px-8 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex items-end">
                <div className="flex items-center justify-between w-full pointer-events-auto">
                    <div className="flex items-center gap-4">
                        <button 
                            disabled={!prevEpisode}
                            onClick={handlePrev}
                            className={`p-3 rounded-full backdrop-blur-xl transition-all border ${
                                prevEpisode ? 'bg-white/10 hover:bg-white/20 hover:scale-110 border-white/20 text-white' : 'bg-black/40 border-white/5 text-white/30 cursor-not-allowed'
                            }`}
                            title="ភាគមុន"
                        >
                            <SkipBack className="w-6 h-6 fill-current" />
                        </button>
                        <button 
                            disabled={!nextEpisode}
                            onClick={handleNext}
                            className={`p-3 rounded-full backdrop-blur-xl transition-all border ${
                                nextEpisode ? 'bg-white/10 hover:bg-white/20 hover:scale-110 border-white/20 text-white' : 'bg-black/40 border-white/5 text-white/30 cursor-not-allowed'
                            }`}
                            title="ភាគបន្ទាប់"
                        >
                            <SkipForward className="w-6 h-6 fill-current" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Info & Next Episode Split Section */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* Left Side: Metadata */}
            <div className="lg:col-span-8 space-y-6">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight tracking-tight drop-shadow-md">
                        {movie.Title}
                    </h1>
                    <div className="flex flex-wrap items-center gap-6 text-gray-300 font-medium">
                        <span className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-md border border-white/10">
                            <Calendar className="w-4 h-4 text-red-500" />
                            {movie.AddedAt ? new Date(movie.AddedAt).getFullYear() : '2024'}
                        </span>
                        <span className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-gray-500" />
                            {movie.Country} • {movie.Language}
                        </span>
                        <span className="flex items-center gap-2 text-sm uppercase tracking-widest text-red-400 font-bold">
                            <Tag className="w-4 h-4" />
                            {movie.Category}
                        </span>
                    </div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.05] shadow-inner">
                    <div className="flex items-center gap-3 mb-3 text-gray-400">
                        <Info className="w-5 h-5 text-red-500" />
                        <h3 className="font-black uppercase tracking-widest text-xs">សេចក្តីសង្ខេប</h3>
                    </div>
                    <p className="text-gray-300 leading-relaxed text-lg font-light">
                        {movie.Description || 'មិនទាន់មានការពិពណ៌នាសម្រាប់រឿងនេះនៅឡើយទេ។'}
                    </p>
                </div>
            </div>

            {/* Right Side: Up Next Card */}
            <div className="lg:col-span-4">
                <div className="p-1 rounded-2xl bg-gradient-to-b from-red-600/30 to-black overflow-hidden relative">
                    <div className="absolute inset-0 bg-noise opacity-20 mix-blend-overlay"></div>
                    <div className="bg-[#0f0f0f] rounded-xl p-6 relative z-10 h-full border border-red-500/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-red-500 font-black tracking-widest uppercase text-sm flex items-center gap-2">
                                <SkipForward className="w-4 h-4" /> ភាគបន្ទាប់
                            </h3>
                            {autoPlay && nextEpisode && (
                                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded animate-pulse font-bold">AUTO</span>
                            )}
                        </div>
                        
                        {nextEpisode ? (
                            <div className="group cursor-pointer block" onClick={() => onSelectMovie(nextEpisode)}>
                                <div className="relative aspect-[16/9] rounded-lg overflow-hidden mb-4 border border-white/10 shadow-lg group-hover:border-red-500/50 transition-colors">
                                    <img src={nextEpisode.Thumbnail} alt={nextEpisode.Title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                        <div className="bg-white/20 p-3 rounded-full text-white">
                                            <Play className="w-8 h-8 fill-current translate-x-0.5" />
                                        </div>
                                    </div>
                                </div>
                                <h4 className="font-bold text-gray-200 group-hover:text-white transition-colors line-clamp-2 text-lg">
                                    {nextEpisode.Title}
                                </h4>
                                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{nextEpisode.Description}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-40 text-center opacity-50">
                                <CheckCircle2 className="w-12 h-12 mb-3 text-gray-600" />
                                <p className="text-sm font-bold uppercase tracking-widest text-gray-400">បញ្ចប់ត្រឹមនេះ</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

        {/* Separator */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-12"></div>

        {/* Episode Grid */}
        <EpisodeSelector 
            currentMovie={movie}
            allEpisodes={episodes}
            onSelectEpisode={onSelectMovie}
        />
      </div>
    </div>
  );
};

export default SeriesPlayerView;
