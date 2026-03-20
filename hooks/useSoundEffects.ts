
import { useContext, useCallback, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { NOTIFICATION_SOUNDS } from '../constants';

export const useSoundEffects = () => {
    const { advancedSettings } = useContext(AppContext);
    
    // Notification volume from settings (0.0 to 1.0)
    const baseVolume = advancedSettings?.notificationVolume ?? 0.5;

    // Cache for Audio objects to avoid repeated creation
    const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

    const playSound = useCallback((soundId: string, customVolumeMultiplier = 1) => {
        if (baseVolume <= 0) return;

        try {
            // Find the sound by ID, fallback to 'click' if not found
            const sound = NOTIFICATION_SOUNDS.find(s => s.id === soundId) || 
                          NOTIFICATION_SOUNDS.find(s => s.id === 'click');
            
            if (!sound) return;

            let audio = audioCache.current.get(sound.url);

            if (!audio) {
                audio = new Audio(sound.url);
                audio.load();
                audioCache.current.set(sound.url, audio);
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
        // Core UI Interactions (Very Short, Crisp)
        playClick: () => playSound('click', 0.8), // Standard button click
        playTransition: () => playSound('bubble', 0.5), // Subtle tick for page changes
        playPop: () => playSound('pop', 0.8), // Modal opening/closing
        playHover: () => playSound('professional_2', 0.2), // Extremely soft tick for hovering
        
        // Status Notifications
        playSuccess: () => playSound('success', 1.0),
        playError: () => playSound('error', 1.0),
        playNotify: () => playSound('notify', 1.0),
        
        // Custom sound from settings
        playCustom: () => playSound(advancedSettings?.notificationSound || 'default', 1.0),
        
        playSound
    };
};

