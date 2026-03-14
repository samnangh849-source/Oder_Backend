
import { useContext, useCallback, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { NOTIFICATION_SOUNDS } from '../constants';

export const useSoundEffects = () => {
    const { advancedSettings } = useContext(AppContext);
    
    // Lower base volume significantly (8% of the setting for a very soft experience)
    const baseVolume = (advancedSettings.notificationVolume ?? 0.5) * 0.08;

    // Cache for Audio objects to avoid repeated creation
    const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

    const playSound = useCallback((soundId: string, customVolumeMultiplier = 1) => {
        if (baseVolume <= 0) return;

        try {
            const sound = NOTIFICATION_SOUNDS.find(s => s.id === soundId) || NOTIFICATION_SOUNDS.find(s => s.id === 'click');
            if (!sound) return;

            let audio = audioCache.current.get(sound.url);

            if (!audio) {
                audio = new Audio(sound.url);
                // Preload the sound
                audio.load();
                audioCache.current.set(sound.url, audio);
            }

            // Create a clone to allow overlapping sounds of the same type
            const audioClone = audio.cloneNode() as HTMLAudioElement;
            audioClone.volume = Math.min(1, baseVolume * customVolumeMultiplier);
            
            audioClone.play().catch(error => {
                // Silently ignore play errors (usually caused by browser autoplay policies)
                // console.warn("SFX playback blocked:", error);
            });
        } catch (error) {
            console.warn("SFX playback failed:", error);
        }
    }, [baseVolume]);

    return {
        playClick: () => playSound('professional_3', 1.0),
        playSuccess: () => playSound('success', 0.7),
        playError: () => playSound('alert', 0.6),
        playTransition: () => playSound('click', 0.4), // macOS-style single short click (មួយប៉ក់)
        playPop: () => playSound('pop', 0.4),
        playNotify: () => playSound('notify', 0.7),
        playHover: () => playSound('bubble', 0.2), // Extremely soft bubble sound for hovering
        playSound
    };
};
