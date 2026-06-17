
import React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-6 h-6 border-2',
        lg: 'w-10 h-10 border-4'
    };
    return (
        <div className={`spinner animate-spin rounded-full ${sizeClasses[size]}`} role="status">
            <span className="sr-only">Loading...</span>
        </div>
    );
};

export default Spinner;