import React from 'react';
import { Movie } from '../../types';
import { Play, PlayCircle, Clock, Zap, Star } from 'lucide-react';

interface EpisodeSelectorProps {
  currentMovie: Movie;
  allEpisodes: Movie[];
  onSelectEpisode: (movie: Movie) => void;
}

const EpisodeSelector: React.FC<EpisodeSelectorProps> = ({ currentMovie, allEpisodes, onSelectEpisode }) => {
  // Sort episodes by EpisodeNumber or Title
  const sortedEpisodes = [...allEpisodes].sort((a, b) => {
    const getNum = (str: string) => {
        const matches = str.match(/\d+/);
        return matches ? parseInt(matches[0]) : 0;
    };
    return getNum(a.Title) - getNum(b.Title) || a.ID.localeCompare(b.ID);
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-10">
      {sortedEpisodes.map((episode, index) => {
        const isActive = episode.ID === currentMovie.ID;
        
        return (
          <div
            key={episode.ID}
            onClick={() => onSelectEpisode(episode)}
            className={`group relative flex flex-col rounded-[3rem] overflow-hidden transition-all duration-700 cursor-pointer border ${
              isActive 
                ? 'bg-red-600/10 border-red-600/50 shadow-[0_30px_60px_rgba(220,38,38,0.25)] ring-1 ring-red-600/20' 
                : 'bg-white/[0.02] border-white/[0.05] hover:border-white/20 hover:bg-white/[0.05] shadow-2xl hover:-translate-y-2'
            }`}
          >
            {/* Thumbnail Section */}
            <div className="relative aspect-[16/10] overflow-hidden">
              <img 
                src={episode.Thumbnail} 
                alt={episode.Title}
                className={`w-full h-full object-cover transition-transform duration-[3000ms] group-hover:scale-125 ${isActive ? 'scale-110' : 'opacity-60 grayscale-[40%] group-hover:grayscale-0 group-hover:opacity-100'}`}
              />
              
              {/* Overlay with Glow */}
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${isActive ? 'bg-red-600/20 backdrop-blur-[2px]' : 'bg-black/50 group-hover:bg-black/20 group-hover:backdrop-blur-[1px]'}`}>
                <div className={`relative transition-all duration-700 ${isActive ? 'scale-110' : 'scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100'}`}>
                    <div className={`absolute inset-0 blur-2xl rounded-full ${isActive ? 'bg-red-600' : 'bg-white/40'}`}></div>
                    <div className={`relative p-5 rounded-full backdrop-blur-3xl border border-white/20 ${isActive ? 'bg-red-600 shadow-3xl' : 'bg-white/10'}`}>
                        <Play className={`w-8 h-8 text-white fill-current translate-x-0.5`} />
                    </div>
                </div>
              </div>

              {/* Episode Badge */}
              <div className="absolute top-5 left-5 px-5 py-2 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 text-[9px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-red-600 animate-pulse' : 'bg-white/40'}`}></div>
                PART {String(index + 1).padStart(2, '0')}
              </div>

              {/* Resolution Badge (Mock) */}
              <div className="absolute top-5 right-5 p-2 bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                <Zap className="w-3 h-3 text-yellow-500 fill-current" />
              </div>
            </div>

            {/* Info Section */}
            <div className="p-10 relative">
              {/* Dynamic Progress Bar for active state */}
              {isActive && (
                <div className="absolute top-0 left-0 w-full h-1 px-10">
                    <div className="w-full h-full bg-red-600 shadow-[0_0_15px_#dc2626] rounded-full"></div>
                </div>
              )}

              <h4 className={`text-2xl font-black italic uppercase tracking-tighter truncate mb-4 transition-colors duration-500 ${isActive ? 'text-red-500' : 'text-white/70 group-hover:text-white'}`}>
                {episode.Title}
              </h4>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg">
                        <Clock className="w-3 h-3" />
                        45M
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-lg">
                        <Star className="w-3 h-3 fill-current text-yellow-500/50" />
                        HD
                    </div>
                </div>
                
                {isActive ? (
                    <div className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-[0.3em] bg-red-600/10 px-4 py-1.5 rounded-full border border-red-600/20">
                        <PlayCircle className="w-4 h-4 animate-spin-slow" />
                        Playing
                    </div>
                ) : (
                    <div className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em] group-hover:text-white/30 transition-colors">
                        Available
                    </div>
                )}
              </div>
            </div>

            {/* Subtle Active Highlight */}
            {isActive && (
                <div className="absolute -inset-1 bg-red-600/5 blur-2xl rounded-[3rem] -z-10 animate-pulse"></div>
            )}
          </div>
        );
      })}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin-slow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
            animation: spin-slow 8s linear infinite;
        }
      `}} />
    </div>
  );
};

export default EpisodeSelector;
