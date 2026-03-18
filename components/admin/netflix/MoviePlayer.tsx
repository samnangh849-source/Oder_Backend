import React, { useEffect } from 'react';
import { X, Share2, Play } from 'lucide-react';
import { Movie } from '../../../types';
import HLSPlayer from '../../common/HLSPlayer';

interface MoviePlayerProps {
  movie: Movie;
  onClose: () => void;
  onShare: (movie: Movie) => void;
  watchProgress: Record<string, { time: number, duration: number }>;
  onSaveProgress: (id: string, time: number, duration: number) => void;
  relatedMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  isMobile?: boolean;
}

const MoviePlayer: React.FC<MoviePlayerProps> = ({
  movie,
  onClose,
  onShare,
  watchProgress,
  onSaveProgress,
  relatedMovies,
  onSelectMovie,
  isMobile = false
}) => {
  const startTime = watchProgress[movie.ID]?.time || 0;

  useEffect(() => {
    // Scroll to top when movie changes
    const container = document.getElementById('movie-player-container');
    if (container) container.scrollTop = 0;
  }, [movie.ID]);

  const renderVideo = () => {
    // Check if it's a known non-video link that should stay as iframe
    const isSocialOrIframeOnly = movie.VideoURL.includes('facebook.com') || 
                                 movie.VideoURL.includes('youtube.com/embed');

    if (!isSocialOrIframeOnly && !movie.VideoURL.includes('<iframe')) {
        return (
            <HLSPlayer 
              url={movie.VideoURL} 
              startTime={startTime} 
              onProgress={(time, duration) => onSaveProgress(movie.ID, time, duration)}
            />
        );
    }

    if (movie.VideoURL.includes('<iframe')) {
      return (
        <div 
          className="w-full h-full bg-black flex items-center justify-center overflow-hidden rounded-xl shadow-2xl"
          dangerouslySetInnerHTML={{ __html: movie.VideoURL }}
        />
      );
    }

    // Default to iframe for specific links
    return (
      <iframe 
        src={movie.VideoURL} 
        className="w-full h-full border-none rounded-xl shadow-2xl" 
        allowFullScreen 
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    );
  };

  if (isMobile) {
    return (
      <div id="movie-player-container" className="fixed inset-0 z-[100] bg-black flex flex-col animate-[fade-in_0.2s_ease-out] overflow-y-auto">
         <div className="p-4 flex items-center justify-between bg-gradient-to-b from-black to-transparent absolute top-0 w-full z-10">
            <button onClick={onClose} className="p-2 bg-black/50 backdrop-blur rounded-full text-white"><X className="w-6 h-6" /></button>
            <Share2 className="w-6 h-6 drop-shadow-md text-white" onClick={() => onShare(movie)} />
         </div>
         <div className="w-full aspect-video mt-16 flex-shrink-0">
           {renderVideo()}
         </div>
         <div className="p-5 flex-1 pb-10">
            <h2 className="text-2xl font-black italic mb-2 text-white">{movie.Title}</h2>
            <div className="flex gap-3 text-[10px] text-gray-400 font-bold mb-4">
               <span>{movie.AddedAt ? new Date(movie.AddedAt).getFullYear() : '2024'}</span>
               {movie.Category && <span>{movie.Category}</span>}
               {movie.Type === 'series' && <span className="text-red-500 uppercase tracking-widest">Series</span>}
            </div>
            <p className="opacity-70 leading-relaxed font-light text-sm mb-6 text-white">{movie.Description || "No description available."}</p>
            
            <h3 className="text-sm font-bold mb-3 uppercase opacity-50 border-t border-white/10 pt-4 text-white">More Like This</h3>
            <div className="grid grid-cols-3 gap-2">
              {relatedMovies.map(m => (
                <div key={m.ID} className="aspect-[2/3] cursor-pointer" onClick={() => onSelectMovie(m)}>
                  <img src={m.Thumbnail} className="w-full h-full object-cover rounded" alt={m.Title} />
                </div>
              ))}
            </div>
         </div>
      </div>
    );
  }

  // Desktop/Tablet View
  return (
    <div id="movie-player-container" className="fixed inset-0 z-[100] bg-black flex flex-col animate-[fade-in_0.3s_ease-out] overflow-y-auto no-scrollbar">
      <div className="p-10 flex items-center justify-between bg-gradient-to-b from-black via-black/80 to-transparent relative z-10">
        <button onClick={onClose} className="text-white hover:scale-110 hover:text-red-500 transition-all bg-black/50 p-3 rounded-full backdrop-blur-md"><X className="w-8 h-8" /></button>
        <h2 className="text-3xl font-black italic drop-shadow-xl text-white">{movie.Title}</h2>
        <button onClick={() => onShare(movie)} className="bg-white/10 hover:bg-white/20 transition-colors px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 text-white"><Share2 className="w-4 h-4" /> Share</button>
      </div>
      <div className="flex-shrink-0 w-full max-w-[1600px] mx-auto relative rounded-xl overflow-hidden shadow-2xl mb-10 aspect-video bg-black">
        {renderVideo()}
      </div>

      <div className="px-10 mb-6">
        <div className="flex gap-4 items-center mb-4 text-sm font-bold text-gray-400">
           <span>{movie.AddedAt ? new Date(movie.AddedAt).getFullYear() : '2024'}</span>
           {movie.Category && <span>{movie.Category}</span>}
           {movie.Type === 'series' && <span className="text-red-500 uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded border border-red-500/30">TV Series</span>}
        </div>
        <p className="text-lg text-gray-300 max-w-4xl mb-6 leading-relaxed drop-shadow-md">{movie.Description || "No description available."}</p>
      </div>
      
      {/* Similar Movies in Player View */}
      <div className="px-10 pb-10">
        <h3 className="text-xl font-bold mb-4 uppercase opacity-50 text-white">More Like This</h3>
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {relatedMovies.map(m => (
            <div key={m.ID} className="min-w-[160px] aspect-[2/3] cursor-pointer hover:scale-105 transition-transform" onClick={() => onSelectMovie(m)}>
              <img src={m.Thumbnail} className="w-full h-full object-cover rounded-md" alt={m.Title} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MoviePlayer;
