
import React from 'react';
import { Notification } from '../../types';
import FloatingAlert from './FloatingAlert';

interface NotificationStackProps {
    notifications: Notification[];
    onRemove: (id: string) => void;
}

const NotificationStack: React.FC<NotificationStackProps> = ({ notifications, onRemove }) => {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
            {notifications.map((n, index) => (
                <div 
                    key={n.id} 
                    className="pointer-events-auto transition-all duration-500 ease-out"
                    style={{ 
                        transform: `translateY(${index * 10}px) scale(${1 - index * 0.05})`,
                        zIndex: 100 - index,
                        opacity: index > 3 ? 0 : 1,
                        display: index > 3 ? 'none' : 'block'
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
