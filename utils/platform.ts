
export const isIOS = (): boolean => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

    // Check specifically for iOS devices
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
        return true;
    }

    // Detect iPad on iOS 13+ (which often reports as Macintosh)
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
        return true;
    }

    return false;
};

export const isAndroid = (): boolean => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return /android/i.test(navigator.userAgent);
};
