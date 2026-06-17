import React, { useState, useRef, useEffect, useMemo } from 'react';
import Spinner from '../common/Spinner';

interface AudioPlayerProps {
    src: string;
    duration?: string; // External duration string (e.g. "0:05")
    isMe?: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, duration: externalDuration, isMe = false }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Convert "MM:SS" string to seconds
    const parseDuration = (dStr?: string): number => {
        if (!dStr) return 0;
        const parts = dStr.split(':');
        if (parts.length !== 2) return 0;
        return (parseInt(parts[0]) * 60) + parseInt(parts[1]);
    };

    const displayDuration = useMemo(() => {
        if (duration > 0) return duration;
        return parseDuration(externalDuration);
    }, [duration, externalDuration]);

    // Clean up event listeners on unmount
    useEffect(() => {
        return () => {
            const audio = audioRef.current;
            if (audio) {
                audio.pause();
                audio.removeAttribute('src'); // Detach source
                audio.load(); // Force reset
            }
        };
    }, []);

    // Setup listeners only once audio element is ready/interacted with
    const attachListeners = (audio: HTMLAudioElement) => {
        const onReady = () => {
            if (audio.duration && isFinite(audio.duration)) {
                setDuration(audio.duration);
                setIsReady(true);
                setError(null);
            }
        };

        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };
        const onError = () => {
            console.error("Audio Error", audio.error);
            setError("Unavailable");
            setIsReady(false);
        };

        // Attach listeners
        audio.onloadedmetadata = onReady;
        audio.oncanplay = onReady;
        audio.ontimeupdate = onTimeUpdate;
        audio.onended = onEnded;
        audio.onerror = onError;
    };

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;

        // If not ready and not playing (first click), load and play
        if (!isReady && !isPlaying && !error) {
            attachListeners(audio);
            // audio.src is already set in JSX, but we need to trigger load explicitly if needed
            // or just play. Safari handles play() well.
            
            // Pause all other audios
            document.querySelectorAll('audio').forEach(el => {
                if (el !== audio) el.pause();
            });

            audio.play().then(() => {
                setIsPlaying(true);
                setIsReady(true); // Assume ready if playing starts
            }).catch(e => {
                console.error("Play failed", e);
                setError("Unavailable");
            });
            return;
        }

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            // Pause all other audios to prevent overlap
            document.querySelectorAll('audio').forEach(el => {
                if (el !== audio) el.pause();
            });
            audio.play().catch(e => console.error("Play failed", e));
            setIsPlaying(true);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const formatTime = (t: number) => {
        if (!isFinite(t) || t < 0) return '0:00';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (error) return <div className="text-[10px] text-red-300 bg-red-900/20 px-2 py-1 rounded">Audio Unavailable</div>;

    return (
        <div className={`flex items-center gap-3 pr-4 pl-1 py-1 rounded-full min-w-[220px] transition-all ${isMe ? 'text-blue-100' : 'text-gray-600 dark:text-gray-300'}`}>
            <audio ref={audioRef} src={src} preload="metadata" />
            
            <button 
                onClick={togglePlayPause} 
                disabled={!isReady && !externalDuration}
                className={`w-9 h-9 flex items-center justify-center rounded-full shadow-md transition-all active:scale-95 flex-shrink-0 ${
                    isMe 
                        ? 'bg-white text-blue-600 hover:bg-gray-100' 
                        : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
            >
                {!isReady && !externalDuration ? <Spinner size="sm" /> : isPlaying ? (
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                    <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
            </button>

            <div className="flex flex-col flex-grow justify-center gap-1 min-w-[120px]">
                 <input
                    type="range"
                    min="0"
                    max={displayDuration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-0 ${
                        isMe 
                            ? 'bg-blue-800/30 accent-white' 
                            : 'bg-gray-300 dark:bg-gray-600 accent-blue-600'
                    }`}
                />
                <div className="flex justify-between w-full text-[10px] font-mono font-medium opacity-90 px-0.5">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(displayDuration)}</span>
                </div>
            </div>
        </div>
    );
};

export default AudioPlayer;