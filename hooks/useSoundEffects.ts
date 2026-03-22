
import { useContext, useCallback, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { NOTIFICATION_SOUNDS, SOUND_URLS } from '../constants';

export const useSoundEffects = () => {
    const { advancedSettings } = useContext(AppContext);
    
    // Notification volume from settings (0.0 to 1.0)
    const baseVolume = advancedSettings?.notificationVolume ?? 0.5;

    // Cache for Audio objects to avoid repeated creation
    const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

    const playSound = useCallback((soundIdOrUrl: string, customVolumeMultiplier = 1) => {
        if (baseVolume <= 0) return;

        try {
            let soundUrl = '';

            // 1. Check if it's a direct URL (starts with http)
            if (soundIdOrUrl.startsWith('http')) {
                soundUrl = soundIdOrUrl;
            } else {
                // 2. Otherwise treat it as an ID and look up in NOTIFICATION_SOUNDS
                const found = NOTIFICATION_SOUNDS.find(s => s.id === soundIdOrUrl);
                if (found) {
                    soundUrl = found.url;
                } else {
                    // Fallback to default click sound if ID not found
                    const defaultSound = NOTIFICATION_SOUNDS.find(s => s.id === 'default') || NOTIFICATION_SOUNDS[0];
                    soundUrl = defaultSound?.url || '';
                }
            }
            
            if (!soundUrl) return;

            let audio = audioCache.current.get(soundUrl);

            if (!audio) {
                audio = new Audio(soundUrl);
                audio.load();
                audioCache.current.set(soundUrl, audio);
            }

            // Create a clone to allow overlapping sounds for fast clicks
            const audioClone = audio.cloneNode() as HTMLAudioElement;
            
            // Apply volume: baseVolume * customMultiplier
            // We apply a significant reduction for UI sounds to make them subtle "ticks"
            audioClone.volume = Math.min(1, baseVolume * customVolumeMultiplier * 0.4);
            
            audioClone.play().catch(error => {
                // Silently ignore play errors (usually autoplay policy)
            });
        } catch (error) {
            console.warn("SFX playback failed:", error);
        }
    }, [baseVolume]);

    return {
        // Core UI Interactions (Using modern clean URLs)
        playClick: () => playSound(SOUND_URLS.TECH_CLICK, 0.7), 
        playTransition: () => playSound(SOUND_URLS.ZIP_SLIDE, 0.4), 
        playPop: () => playSound(SOUND_URLS.CRYSTAL_POP, 0.7), 
        playHover: () => playSound(SOUND_URLS.TECH_CLICK, 0.15), 
        playEntrance: () => playSound(SOUND_URLS.TECH_REVEAL, 0.6), // Matches fadeInUp animation
        playSlide: () => playSound(SOUND_URLS.TECH_CLICK, 0.3), 
        playTeamSelect: () => playSound(SOUND_URLS.TEAM_SELECT, 0.5),
        
        // Status Notifications
        playSuccess: () => playSound('success', 0.9), 
        playError: () => playSound('error', 0.9), 
        playNotify: () => playSound(SOUND_URLS.NOTIFICATION, 1.0),
        
        // Custom sound from settings
        playCustom: () => playSound(advancedSettings?.notificationSound || 'default', 1.0),
        
        playSound
    };
};


