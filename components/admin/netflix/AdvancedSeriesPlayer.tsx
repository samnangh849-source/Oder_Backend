import React, { useEffect, useRef, useState } from 'react';
import { 
  X, SkipBack, SkipForward, Maximize, RotateCw, 
  Settings, Lock, Unlock, Loader2, Volume2, VolumeX, Play, Pause
} from 'lucide-react';
import HLSPlayer from '../../common/HLSPlayer';
import { Movie } from '../../../types';

interface AdvancedSeriesPlayerProps {
  movie: Movie;
  nextEpisode?: Movie | null;
  prevEpisode?: Movie | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSelectMovie: (movie: Movie) => void;
  autoPlayNext?: boolean;
}

const AdvancedSeriesPlayer: React.FC<AdvancedSeriesPlayerProps> = ({ 
  movie, nextEpisode, prevEpisode, onClose, onNext, onPrev, onSelectMovie, autoPlayNext = true 
}) => {
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!isLocked) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3500);
    }
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isLocked]);

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

  // Handle Rotation (CSS Based for better compatibility)
  const toggleRotation = () => {
    setIsLandscape(!isLandscape);
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <div 
      ref={playerContainerRef}
      className={`fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden transition-all duration-500 ${
        isLandscape ? 'rotate-90 origin-center scale-110' : ''
      }`}
      style={isLandscape ? { width: '100vh', height: '100vw' } : {}}
      onMouseMove={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
    >
      {/* Video Layer */}
      <div className="w-full h-full relative group">
        <HLSPlayer 
          url={movie.VideoURL} 
          onReady={(player) => {
            player.on('ended', () => {
              if (autoPlayNext && nextEpisode) onNext();
            });
          }}
        />

        {/* Overlay Controls */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-500 bg-black/40 flex flex-col justify-between p-6 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button 
                  onClick={onClose} 
                  className={`p-2 hover:bg-red-600 rounded-full transition-all active:scale-90 bg-black/20 backdrop-blur-md border border-white/10 ${
                    showControls ? 'opacity-100' : 'opacity-40 hover:opacity-100'
                  }`}
                  style={{ pointerEvents: 'auto' }}
               >
                  <X className="w-7 h-7 text-white" />
               </button>
               <div className={`flex flex-col transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                  <h2 className="text-white font-black text-lg truncate max-w-[200px] md:max-w-md italic tracking-tighter uppercase">{movie.Title}</h2>
                  <span className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                     <Loader2 className="w-3 h-3 animate-spin" /> Advanced HLS Proxying
                  </span>
               </div>
            </div>
            <div className={`flex items-center gap-3 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
               <button onClick={toggleRotation} className="p-3 bg-white/10 hover:bg-red-600 rounded-full transition-all border border-white/5 active:scale-90" title="Rotate Screen">
                  <RotateCw className="w-5 h-5" />
               </button>
               <button onClick={toggleFullscreen} className={`p-3 rounded-full transition-all border border-white/5 active:scale-90 ${isFullscreen ? 'bg-red-600 border-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                  <Maximize className="w-5 h-5" />
               </button>
            </div>
          </div>

          {/* Middle Controls (Previous / Lock / Next) */}
          <div className="flex items-center justify-center gap-12 md:gap-24">
             {!isLocked && (
               <button 
                disabled={!prevEpisode}
                onClick={onPrev}
                className={`p-6 rounded-full transition-all ${prevEpisode ? 'hover:bg-white/10 active:scale-95 text-white' : 'opacity-20 cursor-not-allowed'}`}
               >
                <SkipBack className="w-10 h-10 fill-current" />
               </button>
             )}

             <button 
              onClick={() => setIsLocked(!isLocked)} 
              className={`p-5 rounded-full border-2 transition-all active:scale-90 ${isLocked ? 'bg-red-600 border-red-500' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
             >
                {isLocked ? <Lock className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
             </button>

             {!isLocked && (
               <button 
                disabled={!nextEpisode}
                onClick={onNext}
                className={`p-6 rounded-full transition-all ${nextEpisode ? 'hover:bg-white/10 active:scale-95 text-white' : 'opacity-20 cursor-not-allowed'}`}
               >
                <SkipForward className="w-10 h-10 fill-current" />
               </button>
             )}
          </div>

          {/* Bottom Bar (Status / Auto Play Next) */}
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-white/60">
             <div className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                   1080p Ultra
                </span>
                <span className="hidden md:inline">Khmer Dubbing</span>
             </div>
             {nextEpisode && (
               <div className="flex items-center gap-3 animate-bounce">
                  Next Ep: {nextEpisode.Title.split('-').pop()?.trim() || 'Upcoming'}
                  <SkipForward className="w-4 h-4" />
               </div>
             )}
          </div>
        </div>

        {/* Locked Screen Overlay Indicator */}
        {isLocked && !showControls && (
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none opacity-20">
              <Lock className="w-24 h-24 text-white" />
           </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen and (orientation: portrait) {
          .rotate-90 {
            transform: rotate(90deg);
            width: 100vh !important;
            height: 100vw !important;
          }
        }
        :-webkit-full-screen { width: 100%; height: 100%; }
      `}} />
    </div>
  );
};

export default AdvancedSeriesPlayer;
