
import React from 'react';
import { Notification } from '../../types';
import FloatingAlert from './FloatingAlert';

interface NotificationStackProps {
    notifications: Notification[];
    onRemove: (id: string) => void;
}

const NotificationStack: React.FC<NotificationStackProps> = ({ notifications, onRemove }) => {
    // We reverse to show newest on top if needed, but currently they stack downwards.
    // Let's keep them stacking downwards from the top right.
    
    return (
        <div className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-[200] flex flex-col gap-3 pointer-events-none">
            {notifications.map((n, index) => (
                <div 
                    key={n.id} 
                    className="pointer-events-auto transition-all duration-500 ease-out w-full"
                    style={{ 
                        // Visual stacking effect
                        transform: `translateY(${index * 4}px) scale(${1 - index * 0.02})`,
                        zIndex: 100 - index,
                        opacity: index > 4 ? 0 : 1,
                        display: index > 4 ? 'none' : 'block'
                    }}
                >
                    <FloatingAlert 
                        isOpen={true}
                        onClose={() => onRemove(n.id)}
                        title={n.title || (n.type === 'success' ? 'ជោគជ័យ' : n.type === 'error' ? 'បញ្ហា' : 'ដំណឹង')}
                        message={n.message}
                        duration={5000 + (index * 500)} // Staggered auto-dismiss
                    />
                </div>
            ))}
        </div>
    );
};

export default NotificationStack;
