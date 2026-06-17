
import { useState, useEffect, useCallback } from 'react';

/**
 * A custom hook that syncs a state variable with a URL query parameter.
 * Reverted to a stable version with safety checks.
 */
export function useUrlState<T extends string>(param: string, defaultValue: T): [T, (newValue: T) => void] {
    const [state, setState] = useState<T>(() => {
        if (typeof window === 'undefined') return defaultValue;
        const params = new URLSearchParams(window.location.search);
        return (params.get(param) as T) || defaultValue;
    });

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const newValue = (params.get(param) as T) || defaultValue;
            setState(newValue);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [param, defaultValue]);

    const updateState = useCallback((newValue: T) => {
        setState(newValue);
        
        try {
            const url = new URL(window.location.href);
            if (newValue === defaultValue) {
                url.searchParams.delete(param);
            } else {
                url.searchParams.set(param, newValue);
            }
            
            // Standard relative update to avoid SecurityError and double-origin bugs
            window.history.pushState(null, '', url.pathname + url.search);

            // CRITICAL: pushState does not trigger 'popstate' event. 
            // We must manually dispatch it so App.tsx and other instances of this hook react.
            window.dispatchEvent(new PopStateEvent('popstate'));
        } catch (e) {
            // Silently catch to prevent app crash in restricted origins
            console.debug('URL update suppressed');
        }
    }, [param, defaultValue]);

    return [state, updateState];
}
