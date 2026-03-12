
import React, { useState, useEffect } from 'react';

const ScrollToTop: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // We listen to both window and the main content area which might be scrolling
        const toggleVisibility = (e: any) => {
            const target = e.target === document ? window : e.target;
            const scrollPos = target === window ? window.pageYOffset : (target as HTMLElement).scrollTop;
            
            if (scrollPos > 300) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        window.addEventListener('scroll', toggleVisibility, true); // Use capture to catch internal scrolls
        return () => window.removeEventListener('scroll', toggleVisibility, true);
    }, []);

    const scrollToTop = () => {
        // Try to scroll window
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Also try to scroll any internal scrollable main containers
        const mainContainers = document.querySelectorAll('main');
        mainContainers.forEach(container => {
            container.scrollTo({ top: 0, behavior: 'smooth' });
        });
    };

    return (
        <div className={`fixed bottom-24 right-6 z-[100] transition-all duration-500 transform ${isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'}`}>
            <button
                onClick={scrollToTop}
                className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-[0_10px_25px_rgba(37,99,235,0.4)] border border-white/20 flex items-center justify-center transition-all active:scale-90 group"
                title="Back to Top"
            >
                <svg className="w-6 h-6 transform group-hover:-translate-y-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                </svg>
            </button>
        </div>
    );
};

export default ScrollToTop;
