
import React from 'react';
import { Notification } from '../../types';
import FloatingAlert from './FloatingAlert';

interface NotificationStackProps {
    notifications: Notification[];
    onRemove: (id: string) => void;
}

const NotificationStack: React.FC<NotificationStackProps> = ({ notifications, onRemove }) => {
    // Show only the last 3 notifications to avoid cluttering and screen cutoff
    const visibleNotifications = notifications.slice(-3);
    
    return (
        <div className="fixed top-6 right-0 left-0 md:left-auto md:right-6 md:w-[420px] z-[9999] flex flex-col gap-4 pointer-events-none px-4 md:px-0">
            {visibleNotifications.map((n, index) => (
                <div 
                    key={n.id} 
                    className="pointer-events-auto transition-all duration-500 ease-out w-full"
                    style={{ 
                        // Visual stacking effect: Newest is at the top, older ones scale down slightly
                        transform: `scale(${1 - (visibleNotifications.length - 1 - index) * 0.05})`,
                        opacity: 1,
                        zIndex: 100 + index
                    }}
                >
                    <FloatingAlert 
                        isOpen={true}
                        onClose={() => onRemove(n.id)}
                        title={n.title || (n.type === 'success' ? 'SUCCESS' : n.type === 'error' ? 'ERROR' : 'NOTIFICATION')}
                        message={n.message}
                        duration={5000}
                    />
                </div>
            ))}
        </div>
    );
};

export default NotificationStack;
