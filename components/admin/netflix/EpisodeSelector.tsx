import React from 'react';
import { Movie } from '../../types';
import { Play } from 'lucide-react';

interface EpisodeSelectorProps {
  currentMovie: Movie;
  allEpisodes: Movie[];
  onSelectEpisode: (movie: Movie) => void;
}

const EpisodeSelector: React.FC<EpisodeSelectorProps> = ({ currentMovie, allEpisodes, onSelectEpisode }) => {
  // Sort episodes by EpisodeNumber or Title
  const sortedEpisodes = [...allEpisodes].sort((a, b) => {
    // Try to extract numbers from title or ID for sorting
    const getNum = (str: string) => {
        const matches = str.match(/\d+/);
        return matches ? parseInt(matches[0]) : 0;
    };
    return getNum(a.Title) - getNum(b.Title) || a.ID.localeCompare(b.ID);
  });

  return (
    <div className="mt-4 mb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">បញ្ជីភាគរឿង</h3>
            <span className="text-sm text-red-400 font-bold px-3 py-1 bg-red-500/10 rounded border border-red-500/20">
              {allEpisodes.length} ភាគ
            </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {sortedEpisodes.map((episode, index) => {
          const isActive = episode.ID === currentMovie.ID;
          
          return (
            <button
              key={episode.ID}
              onClick={() => onSelectEpisode(episode)}
              className={`flex flex-col group relative rounded-xl overflow-hidden transition-all duration-500 ease-out text-left ${
                isActive 
                  ? 'ring-2 ring-red-600 shadow-[0_10px_30px_rgba(229,9,20,0.3)] scale-[1.02] bg-[#1a1a1a]' 
                  : 'hover:scale-[1.05] hover:shadow-[0_10px_30px_rgba(0,0,0,0.8)] bg-black border border-white/5 hover:border-white/20'
              }`}
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-[#111]">
                <img 
                  src={episode.Thumbnail} 
                  alt={episode.Title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                />
                
                {/* Play Overlay */}
                <div className={`absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px] ${isActive ? 'opacity-100 bg-transparent' : ''}`}>
                  <div className={`p-4 rounded-full transition-transform duration-300 ${isActive ? 'bg-red-600 shadow-[0_0_20px_rgba(229,9,20,0.6)] scale-110' : 'bg-white/20 hover:bg-white/30 hover:scale-125'}`}>
                    <Play className={`w-6 h-6 ${isActive ? 'text-white fill-white' : 'text-white'}`} />
                  </div>
                </div>

                {/* Episode Badge */}
                <div className="absolute top-2 left-2 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded shadow-lg text-[11px] text-white font-black border border-white/10 uppercase tracking-widest">
                  ភាគ {index + 1}
                </div>
              </div>
              
              {/* Info Area */}
              <div className="p-4 bg-gradient-to-b from-transparent to-black/50">
                <h4 className={`text-base font-bold truncate transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                  {episode.Title}
                </h4>
                <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">
                        {episode.Language}
                    </span>
                    {isActive && (
                        <span className="flex items-center gap-1.5 text-[10px] text-red-500 font-black uppercase tracking-widest">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            កំពុងចាក់
                        </span>
                    )}
                </div>
              </div>

              {/* Progress Bar (Mockup for watched status) */}
              <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full">
                {isActive && <div className="h-full bg-red-600 w-full shadow-[0_0_10px_#dc2626]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EpisodeSelector;
