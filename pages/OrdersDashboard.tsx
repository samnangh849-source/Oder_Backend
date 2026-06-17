
import React, { useState, useEffect } from 'react';
import MobileOrdersDashboard from './MobileOrdersDashboard';
import DesktopOrdersDashboard from './DesktopOrdersDashboard';
import { FilterState } from '../components/orders/OrderFilters';

interface OrdersDashboardProps {
    onBack: () => void;
    initialFilters?: Partial<FilterState>;
}

const OrdersDashboard: React.FC<OrdersDashboardProps> = (props) => {
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
        return <MobileOrdersDashboard {...props} />;
    }

    return <DesktopOrdersDashboard {...props} />;
};

export default OrdersDashboard;
