import React, { useState, useEffect } from 'react';
import MobileNetflixEntertainment from './MobileNetflixEntertainment';
import DesktopNetflixEntertainment from './DesktopNetflixEntertainment';

interface NetflixEntertainmentProps {
  guestMovieId?: string;
}

const NetflixEntertainment: React.FC<NetflixEntertainmentProps> = ({ guestMovieId }) => {
    // Responsive State
    const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
        if (typeof window !== 'undefined') {
             const width = window.innerWidth;
             if (width < 768) return 'mobile';
             if (width < 1280) return 'tablet';
        }
        return 'desktop';
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width < 768) setScreenSize('mobile');
            else if (width < 1280) setScreenSize('tablet');
            else setScreenSize('desktop');
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (screenSize === 'mobile') {
        return <MobileNetflixEntertainment guestMovieId={guestMovieId} />;
    }

    return <DesktopNetflixEntertainment guestMovieId={guestMovieId} isTablet={screenSize === 'tablet'} />;
};

export default NetflixEntertainment;
