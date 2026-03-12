
import React, { useState, useEffect, useContext } from 'react';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';
import { AppContext } from '../../context/AppContext';

interface UserAvatarProps {
    avatarUrl?: string;
    name: string;
    size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    onClick?: () => void;
    enablePreview?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ avatarUrl, name, size, className = '', onClick, enablePreview = true }) => {
    const { previewImage } = useContext(AppContext);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgError(false);
    }, [avatarUrl]);

    const getInitials = (n: string) => {
        if (!n) return '?';
        const parts = n.trim().split(' ').filter(Boolean);
        if (parts.length === 0) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    let dimClasses = "";
    // If size is provided, set standard dimensions and text size. 
    // If not, rely on className (useful for responsive headers).
    if (size === 'xxs') dimClasses = "w-5 h-5 text-[8px]";
    else if (size === 'xs') dimClasses = "w-6 h-6 text-[10px]";
    else if (size === 'sm') dimClasses = "w-8 h-8 text-xs";
    else if (size === 'md') dimClasses = "w-10 h-10 text-sm";
    else if (size === 'lg') dimClasses = "w-12 h-12 text-base";
    else if (size === 'xl') dimClasses = "w-16 h-16 text-lg";

    const processedUrl = convertGoogleDriveUrl(avatarUrl);
    // Check if it's the default fallback from utils or we have an error
    const isFallback = processedUrl.includes('placehold.co') && processedUrl.includes('text=N/A');
    
    const showImage = processedUrl && !imgError && !isFallback;

    const bgColors = [
        'bg-blue-600', 'bg-green-600', 'bg-yellow-600', 
        'bg-red-600', 'bg-purple-600', 'bg-pink-600', 
        'bg-indigo-600', 'bg-teal-600'
    ];
    // Generate consistent color from name
    const charCodeSum = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorIndex = charCodeSum % bgColors.length;

    const handleAvatarClick = (e: React.MouseEvent) => {
        if (onClick) {
            onClick();
        } else if (enablePreview && showImage && previewImage) {
            previewImage(processedUrl);
        }
    };

    const baseClasses = `rounded-full object-cover flex-shrink-0 select-none transition-opacity ${(onClick || (enablePreview && showImage)) ? 'cursor-pointer hover:opacity-80' : ''}`;

    if (showImage) {
        return (
            <img 
                src={processedUrl} 
                alt={name} 
                className={`${dimClasses} ${baseClasses} ${className}`}
                onError={() => setImgError(true)}
                onClick={handleAvatarClick}
                referrerPolicy="no-referrer"
            />
        );
    }

    return (
        <div 
            className={`${dimClasses} ${baseClasses} flex items-center justify-center font-bold text-white border border-gray-600 ${bgColors[colorIndex]} ${className}`}
            onClick={handleAvatarClick}
            title={name}
        >
            {getInitials(name)}
        </div>
    );
};

export default UserAvatar;
