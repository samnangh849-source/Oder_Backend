
import { useContext, useCallback, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { NOTIFICATION_SOUNDS } from '../constants';

export const useSoundEffects = () => {
    const { advancedSettings } = useContext(AppContext);
    const audioContextRef = useRef<AudioContext | null>(null);
    
    // Lower base volume significantly (8% of the setting for a very soft experience)
    const baseVolume = (advancedSettings.notificationVolume ?? 0.5) * 0.08;

    // Cache for loaded audio buffers
    const bufferCache = useRef<Map<string, AudioBuffer>>(new Map());

    const playSound = useCallback(async (soundId: string, customVolumeMultiplier = 1) => {
        if (baseVolume <= 0) return;

        try {
            // Initialize AudioContext on first use
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            const context = audioContextRef.current;
            if (context.state === 'suspended') {
                await context.resume();
            }

            const sound = NOTIFICATION_SOUNDS.find(s => s.id === soundId) || NOTIFICATION_SOUNDS.find(s => s.id === 'click');
            if (!sound) return;

            let buffer = bufferCache.current.get(sound.url);

            if (!buffer) {
                const response = await fetch(sound.url);
                const arrayBuffer = await response.arrayBuffer();
                buffer = await context.decodeAudioData(arrayBuffer);
                bufferCache.current.set(sound.url, buffer);
            }

            const source = context.createBufferSource();
            const gainNode = context.createGain();

            source.buffer = buffer;
            // Apply both base volume and a per-sound multiplier
            gainNode.gain.value = baseVolume * customVolumeMultiplier;

            source.connect(gainNode);
            gainNode.connect(context.destination);

            source.start(0);
        } catch (error) {
            console.warn("SFX playback failed:", error);
        }
    }, [baseVolume]);

    return {
        playClick: () => playSound('pop', 0.5), // Short soft pop
        playSuccess: () => playSound('success', 0.5),
        playError: () => playSound('alert', 0.5),
        playTransition: () => playSound('click', 0.4), // macOS-style single short click (មួយប៉ក់)
        playPop: () => playSound('pop', 0.3),
        playNotify: () => playSound('notify', 0.5),
        playHover: () => playSound('bubble', 0.1), // Extremely subtle hover
        playSound
    };
};
