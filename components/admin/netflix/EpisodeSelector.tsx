import React from 'react';
import { Movie } from '../../types';
import { Play, PlayCircle } from 'lucide-react';

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {sortedEpisodes.map((episode, index) => {
        const isActive = episode.ID === currentMovie.ID;
        
        return (
          <div
            key={episode.ID}
            onClick={() => onSelectEpisode(episode)}
            className={`group relative flex flex-col rounded-[2.5rem] overflow-hidden transition-all duration-700 cursor-pointer border ${
              isActive 
                ? 'bg-red-600/10 border-red-600/50 shadow-[0_20px_50px_rgba(220,38,38,0.2)]' 
                : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.05] shadow-2xl'
            }`}
          >
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden">
              <img 
                src={episode.Thumbnail} 
                alt={episode.Title}
                className={`w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110 ${isActive ? 'scale-105 opacity-100' : 'opacity-60'}`}
              />
              
              {/* Overlay */}
              <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${isActive ? 'bg-red-600/20' : 'bg-black/40 group-hover:bg-black/20'}`}>
                <div className={`p-5 rounded-full transition-all duration-500 ${isActive ? 'bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.8)] scale-110' : 'bg-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 group-hover:scale-110'}`}>
                  <Play className="w-8 h-8 text-white fill-current translate-x-0.5" />
                </div>
              </div>

              {/* Badge */}
              <div className="absolute top-4 left-4 px-4 py-1.5 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 text-[10px] font-black text-white uppercase tracking-[0.2em]">
                EPISODE {index + 1}
              </div>
            </div>

            {/* Info */}
            <div className="p-8">
              <h4 className={`text-xl font-black italic uppercase tracking-tighter truncate mb-3 ${isActive ? 'text-red-500' : 'text-white/80 group-hover:text-white'}`}>
                {episode.Title}
              </h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest border border-white/10 px-2 py-0.5 rounded">
                        {episode.Language}
                    </span>
                </div>
                {isActive && (
                    <div className="flex items-center gap-2 text-[9px] font-black text-red-500 uppercase tracking-[0.2em] animate-pulse">
                        <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                        NOW PLAYING
                    </div>
                )}
              </div>
            </div>

            {/* Progress/Active Bar */}
            <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5">
                {isActive && <div className="h-full bg-red-600 w-full shadow-[0_0_15px_#dc2626]"></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default EpisodeSelector;
