
import React from 'react';
import Spinner from './Spinner';

interface GeminiButtonProps {
    onClick: () => void;
    isLoading: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    className?: string;
}

const GeminiIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
        <path d="M12 2C11.4696 2 10.9609 2.21071 10.5858 2.58579C10.2107 2.96086 10 3.46957 10 4V4.53C8.7 5.2 7.64 6.27 7 7.53L6.5 7.03C6.12275 6.65624 5.6122 6.44963 5.08003 6.44963C4.54786 6.44963 4.03731 6.65624 3.65997 7.03C3.28263 7.40376 3.07602 7.91431 3.07602 8.44648C3.07602 8.97865 3.28263 9.4892 3.65997 9.86297L4.16 10.3C3.5 11.56 2.82 12.98 2.59 14.5H2C1.46957 14.5 0.960859 14.7107 0.585786 15.0858C0.210714 15.4609 0 15.9696 0 16.5C0 17.0304 0.210714 17.5391 0.585786 17.9142C0.960859 18.2893 1.46957 18.5 2 18.5H2.59C3.12 20.31 4.28 21.88 5.84 22.95C6.34 23.23 6.94 23.09 7.22 22.59C7.5 22.09 7.36 21.49 6.86 21.21C5.7 20.41 4.81 19.24 4.34 17.87L12 14.01L19.66 17.87C19.19 19.24 18.3 20.41 17.14 21.21C16.64 21.5 16.5 22.1 16.78 22.59C17.06 23.09 17.66 23.23 18.16 22.95C19.72 21.88 20.88 20.31 21.41 18.5H22C22.5304 18.5 23.0391 18.2893 23.4142 17.9142C23.7893 17.5391 24 17.0304 24 16.5C24 15.9696 23.7893 15.4609 23.4142 15.0858C23.0391 14.7107 22.5304 14.5 22 14.5H21.41C21.18 12.98 20.5 11.56 19.84 10.3L20.34 9.86297C20.7174 9.4892 20.924 8.97865 20.924 8.44648C20.924 7.91431 20.7174 7.40376 20.34 7.03C19.9627 6.65624 19.4521 6.44963 18.92 6.44963C18.3878 6.44963 17.8773 6.65624 17.5 7.03L17 7.53C16.36 6.27 15.3 5.2 14 4.53V4C14 3.46957 13.7893 2.96086 13.4142 2.58579C13.0391 2.21071 12.5304 2 12 2Z" fill="url(#paint0_linear_1_2)"/>
        <defs>
            <linearGradient id="paint0_linear_1_2" x1="12" y1="2" x2="12" y2="22.95" gradientUnits="userSpaceOnUse">
                <stop stopColor="#93c5fd"/>
                <stop offset="1" stopColor="#3b82f6"/>
            </linearGradient>
        </defs>
    </svg>
);


const GeminiButton: React.FC<GeminiButtonProps> = ({ onClick, isLoading, disabled = false, children, className = '' }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isLoading || disabled}
            className={`btn btn-secondary flex items-center justify-center !p-2 text-sm transition-all duration-300 ease-in-out border border-blue-500/50 bg-gray-700 hover:bg-blue-800/40 hover:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:opacity-50 ${className}`}
        >
            {isLoading ? (
                <Spinner size="sm" />
            ) : (
                <GeminiIcon />
            )}
            <span className="ml-1">{children}</span>
        </button>
    );
};

export default GeminiButton;