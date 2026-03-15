
import React, { useState, useRef, useEffect, useMemo, useContext } from 'react';
import { WEEKLY_MUSIC_URLS } from '../../constants';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { AppContext } from '../../context/AppContext';

const BackgroundMusic: React.FC = () => {
    const { appState } = useContext(AppContext);
    const audioRef = useRef<HTMLAudioElement>(null);
    // State is still needed for logic, even if UI is hidden
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const volume = 0.3; // Fixed volume at 30% since slider is hidden

    // Determine if music should be playing based on current view
    const shouldPlay = useMemo(() => {
        return appState === 'user_journey' || appState === 'fulfillment';
    }, [appState]);

    // Process the URL based on the current day of the week
    const musicSource = useMemo(() => {
        const today = new Date().getDay(); // 0 (Sun) to 6 (Sat)
        // Convert to our array index: Mon=0, Tue=1, ..., Sat=5, Sun=6
        let index = today === 0 ? 6 : today - 1;
        
        const selectedUrl = WEEKLY_MUSIC_URLS[index] || WEEKLY_MUSIC_URLS[0];
        console.log("🎵 Background Music Source (Day Index:", index, "):", selectedUrl);
        return convertGoogleDriveUrl(selectedUrl, 'audio');
    }, []);

    // Effect to handle volume changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    useEffect(() => {
        setHasError(false);
    }, [musicSource]);

    // NEW: Autoplay and Conditional Playback Logic
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !musicSource) return;

        audio.volume = 0.3;

        const playAudio = async () => {
            if (!shouldPlay) {
                audio.pause();
                setIsPlaying(false);
                return;
            }

            try {
                await audio.play();
                setIsPlaying(true);
                console.log("🔊 Background music playing in view:", appState);
            } catch (error) {
                console.log("🔇 Autoplay blocked or failed. Waiting for interaction...");
            }
        };

        const onUserInteraction = () => {
            if (shouldPlay) {
                playAudio();
            }
            // Remove listeners after first interaction
            window.removeEventListener('click', onUserInteraction);
            window.removeEventListener('touchstart', onUserInteraction);
            window.removeEventListener('keydown', onUserInteraction);
        };

        // If we switch TO a playable view, try to play
        if (shouldPlay) {
            playAudio();
        } else {
            // If we switch AWAY from a playable view, pause immediately
            audio.pause();
            setIsPlaying(false);
        }

        // Add listeners for interaction (in case browser blocks first play)
        window.addEventListener('click', onUserInteraction);
        window.addEventListener('touchstart', onUserInteraction);
        window.addEventListener('keydown', onUserInteraction);

        return () => {
            window.removeEventListener('click', onUserInteraction);
            window.removeEventListener('touchstart', onUserInteraction);
            window.removeEventListener('keydown', onUserInteraction);
        };
    }, [musicSource, shouldPlay, appState]);

    const handleAudioError = (e: any) => {
        console.error("❌ Background Music Error:", e);
        setHasError(true);
        setIsPlaying(false);
    };

    if (!musicSource) return null;

    return (
        <audio 
            ref={audioRef} 
            src={musicSource} 
            loop 
            preload="auto"
            crossOrigin="anonymous"
            onError={handleAudioError}
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        />
    );
};

export default BackgroundMusic;
