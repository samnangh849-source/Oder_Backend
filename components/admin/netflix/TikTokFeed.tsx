import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX,
    Play, Pause, ChevronUp, ChevronDown, X, MoreHorizontal,
    Repeat2, Music2
} from 'lucide-react';
import { Movie } from '../../../types';
import { convertGoogleDriveUrl } from '../../../utils/fileUtils';
import HLSPlayer from '../../common/HLSPlayer';

interface TikTokFeedProps {
    shortFilms: Movie[];
    onOpenPlayer: (movie: Movie) => void;
}

// ─── Single Reel Card ──────────────────────────────────────────────
interface ReelCardProps {
    movie: Movie;
    isActive: boolean;
    onOpenPlayer: (movie: Movie) => void;
}

const ReelCard: React.FC<ReelCardProps> = ({ movie, isActive, onOpenPlayer }) => {
    const [isMuted, setIsMuted] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [liked, setLiked] = useState(false);
    const [saved, setSaved] = useState(false);
    const [likeCount] = useState(Math.floor(Math.random() * 90000) + 1000);
    const [commentCount] = useState(Math.floor(Math.random() * 5000) + 100);
    const [showDesc, setShowDesc] = useState(false);
    const [ripple, setRipple] = useState<{x:number,y:number} | null>(null);
    const lastTap = useRef(0);
    const playerRef = useRef<any>(null);

    // Is a real video URL? (not just a thumbnail)
    const isRealVideo = movie.VideoURL && (
        movie.VideoURL.includes('.mp4') ||
        movie.VideoURL.includes('.m3u8') ||
        movie.VideoURL.includes('.webm') ||
        movie.VideoURL.includes('action=hls_playlist')
    );

    // Play/Pause when active changes
    useEffect(() => {
        if (!playerRef.current || !isRealVideo) return;
        if (isActive) {
            playerRef.current.play();
            setIsPlaying(true);
        } else {
            playerRef.current.pause();
            playerRef.current.currentTime = 0;
            setIsPlaying(false);
            setProgress(0);
        }
    }, [isActive, isRealVideo]);

    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.muted = isMuted;
        }
    }, [isMuted]);

    const handleTap = (e: React.MouseEvent) => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTap.current < DOUBLE_TAP_DELAY) {
            // Double tap = like with ripple
            setLiked(true);
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            setTimeout(() => setRipple(null), 900);
        } else {
            // Single tap = play/pause
            if (playerRef.current) {
                if (isPlaying) { playerRef.current.pause(); setIsPlaying(false); }
                else { playerRef.current.play(); setIsPlaying(true); }
            }
        }
        lastTap.current = now;
    };

    return (
        <div className="relative w-full h-full bg-black flex-shrink-0 overflow-hidden">
            {/* Background / Video */}
            {isRealVideo ? (
                <div className="absolute inset-0 w-full h-full pointer-events-none">
                    <HLSPlayer
                        url={movie.VideoURL}
                        hideStatusBar={true}
                        onReady={(p) => {
                            playerRef.current = p;
                            p.muted = isMuted;
                            if (isActive) p.play();
                        }}
                        onProgress={(time, duration) => {
                            if (duration > 0) setProgress((time / duration) * 100);
                        }}
                    />
                </div>
            ) : (
                <img
                    src={convertGoogleDriveUrl(movie.Thumbnail)}
                    alt={movie.Title}
                    className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${isActive ? 'scale-105' : 'scale-100'}`}
                />
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/10" />

            {/* Tap Zone */}
            <div
                className="absolute inset-0 cursor-pointer z-10"
                onClick={handleTap}
            />

            {/* Double-tap heart ripple */}
            {ripple && (
                <div
                    className="absolute pointer-events-none z-30 text-red-500"
                    style={{ left: ripple.x - 40, top: ripple.y - 40 }}
                >
                    <Heart
                        className="w-20 h-20 fill-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                        style={{ animation: 'tiktok-heart 0.8s ease-out forwards' }}
                    />
                </div>
            )}

            {/* Play/Pause Center Icon */}
            {!isPlaying && isActive && isRealVideo && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-20 h-20 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center">
                        <Play className="w-10 h-10 text-white fill-white ml-1" />
                    </div>
                </div>
            )}

            {/* Right Action Bar */}
            <div className="absolute right-4 bottom-28 flex flex-col items-center gap-6 z-20">
                {/* Like */}
                <button
                    onClick={(e) => { e.stopPropagation(); setLiked(!liked); }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${liked ? 'bg-red-500/20 scale-110' : 'bg-black/30 backdrop-blur-sm group-hover:bg-white/10'}`}>
                        <Heart className={`w-7 h-7 transition-all duration-300 ${liked ? 'fill-red-500 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-white'}`} />
                    </div>
                    <span className="text-white text-[10px] font-black drop-shadow-md">
                        {liked ? (likeCount + 1).toLocaleString() : likeCount.toLocaleString()}
                    </span>
                </button>

                {/* Comment */}
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenPlayer(movie); }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm group-hover:bg-white/10 transition-all">
                        <MessageCircle className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-white text-[10px] font-black drop-shadow-md">{commentCount.toLocaleString()}</span>
                </button>

                {/* Save */}
                <button
                    onClick={(e) => { e.stopPropagation(); setSaved(!saved); }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${saved ? 'bg-yellow-500/20' : 'bg-black/30 backdrop-blur-sm group-hover:bg-white/10'}`}>
                        <Bookmark className={`w-7 h-7 transition-all ${saved ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
                    </div>
                    <span className="text-white text-[10px] font-black drop-shadow-md">Save</span>
                </button>

                {/* Share */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigator.share?.({ title: movie.Title, url: window.location.href }).catch(() => {});
                    }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm group-hover:bg-white/10 transition-all">
                        <Share2 className="w-7 h-7 text-white" />
                    </div>
                    <span className="text-white text-[10px] font-black drop-shadow-md">Share</span>
                </button>

                {/* Mute */}
                <button
                    onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm group-hover:bg-white/10 transition-all">
                        {isMuted
                            ? <VolumeX className="w-6 h-6 text-white/70" />
                            : <Volume2 className="w-6 h-6 text-white" />
                        }
                    </div>
                </button>

                {/* Spinning disc */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-gray-800 to-gray-600 border-4 border-gray-600 overflow-hidden flex items-center justify-center animate-spin" style={{ animationDuration: '4s' }}>
                    <Music2 className="w-5 h-5 text-white" />
                </div>
            </div>

            {/* Bottom Info Area */}
            <div className="absolute bottom-8 left-4 right-20 z-20">
                {/* Creator Tag */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white font-black text-xs border-2 border-white/30">
                        {(movie.Title?.[0] || '?').toUpperCase()}
                    </div>
                    <span className="text-white font-black text-sm drop-shadow-md">
                        @{(movie.Country || 'creator').toLowerCase().replace(/\s/g, '_')}
                    </span>
                    <span className="text-[9px] text-white/60 font-bold uppercase border border-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        {movie.Category || 'Short'}
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-white font-black text-base drop-shadow-xl leading-tight mb-2">
                    {movie.Title}
                </h3>

                {/* Description with Read More */}
                {movie.Description && (
                    <div className="mb-3">
                        <p className={`text-white/80 text-xs font-medium leading-relaxed drop-shadow-md ${showDesc ? '' : 'line-clamp-2'}`}>
                            {movie.Description}
                        </p>
                        {movie.Description.length > 80 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowDesc(!showDesc); }}
                                className="text-white/60 text-[10px] font-black mt-0.5"
                            >
                                {showDesc ? 'Less' : 'More'}
                            </button>
                        )}
                    </div>
                )}

                {/* Sound track label */}
                <div className="flex items-center gap-2 overflow-hidden">
                    <Music2 className="w-3 h-3 text-white/60 flex-shrink-0" />
                    <div className="overflow-hidden flex-1">
                        <p className="text-white/60 text-[10px] font-bold whitespace-nowrap" style={{ animation: 'marquee 8s linear infinite' }}>
                            {movie.Language || 'Original Sound'} • {movie.Title}
                        </p>
                    </div>
                </div>

                {/* Watch Full Video Button */}
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenPlayer(movie); }}
                    className="mt-3 flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-white text-[10px] font-black uppercase tracking-wider hover:bg-white/20 transition-all active:scale-95"
                >
                    <Play className="w-3 h-3 fill-white" />
                    Watch Full Video
                </button>
            </div>

            {/* Video Progress Bar */}
            {isRealVideo && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
                    <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <style>{`
                @keyframes tiktok-heart {
                    0% { transform: scale(0) rotate(-20deg); opacity: 1; }
                    50% { transform: scale(1.3) rotate(10deg); opacity: 1; }
                    100% { transform: scale(1) rotate(0deg); opacity: 0; }
                }
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-100%); }
                }
            `}</style>
        </div>
    );
};

// ─── Main TikTokFeed ───────────────────────────────────────────────
const TikTokFeed: React.FC<TikTokFeedProps> = ({ shortFilms, onOpenPlayer }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [touchStartY, setTouchStartY] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showTip, setShowTip] = useState(true);

    // Hide tip after 3 seconds
    useEffect(() => {
        const t = setTimeout(() => setShowTip(false), 3000);
        return () => clearTimeout(t);
    }, []);

    const goTo = useCallback((idx: number) => {
        if (isAnimating || idx < 0 || idx >= shortFilms.length) return;
        setIsAnimating(true);
        setCurrentIndex(idx);
        setTimeout(() => setIsAnimating(false), 400);
    }, [isAnimating, shortFilms.length]);

    // Wheel scroll (desktop)
    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.deltaY > 50) goTo(currentIndex + 1);
        else if (e.deltaY < -50) goTo(currentIndex - 1);
    }, [currentIndex, goTo]);

    // Touch (mobile)
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStartY(e.touches[0].clientY);
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        const delta = touchStartY - e.changedTouches[0].clientY;
        if (delta > 50) goTo(currentIndex + 1);
        else if (delta < -50) goTo(currentIndex - 1);
    };

    // Keyboard nav
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') goTo(currentIndex + 1);
            if (e.key === 'ArrowUp') goTo(currentIndex - 1);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [currentIndex, goTo]);

    if (shortFilms.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
                <div className="w-20 h-20 bg-gradient-to-br from-pink-500/20 to-purple-600/20 rounded-3xl flex items-center justify-center border border-pink-500/20">
                    <Repeat2 className="w-10 h-10 text-pink-400" />
                </div>
                <h2 className="text-2xl font-black text-white italic uppercase">No Shorts Yet</h2>
                <p className="text-gray-500 text-sm font-bold">Add some short films to see them here in TikTok style!</p>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-black select-none"
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Reel Stack — snapping translate */}
            <div
                className="w-full h-full transition-transform duration-400 ease-in-out will-change-transform"
                style={{ transform: `translateY(-${currentIndex * 100}%)` }}
            >
                {shortFilms.map((movie, idx) => (
                    <div key={movie.ID || idx} style={{ height: '100vh', width: '100%' }}>
                        <ReelCard
                            movie={movie}
                            isActive={idx === currentIndex}
                            onOpenPlayer={onOpenPlayer}
                        />
                    </div>
                ))}
            </div>

            {/* Navigation arrows (desktop) */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30 hidden md:flex">
                <button
                    onClick={() => goTo(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed border border-white/10"
                >
                    <ChevronUp className="w-5 h-5" />
                </button>
                <button
                    onClick={() => goTo(currentIndex + 1)}
                    disabled={currentIndex === shortFilms.length - 1}
                    className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all disabled:opacity-20 disabled:cursor-not-allowed border border-white/10"
                >
                    <ChevronDown className="w-5 h-5" />
                </button>
            </div>

            {/* Scroll indicator dots */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 z-30">
                {shortFilms.slice(0, 8).map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => goTo(idx)}
                        className={`rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-1.5 h-5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]' : 'w-1 h-1 bg-white/30 hover:bg-white/50'}`}
                    />
                ))}
                {shortFilms.length > 8 && (
                    <span className="text-white/30 text-[8px] font-black mt-1 text-center">+{shortFilms.length - 8}</span>
                )}
            </div>

            {/* Video counter badge */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30">
                <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-white text-[10px] font-black uppercase tracking-widest">
                        {currentIndex + 1} / {shortFilms.length}
                    </span>
                </div>
            </div>

            {/* Initial swipe tip */}
            {showTip && (
                <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
                    <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3 flex items-center gap-3 animate-bounce">
                        <ChevronDown className="w-5 h-5 text-white/70" />
                        <span className="text-white text-xs font-black uppercase tracking-widest">Swipe Up</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TikTokFeed;
