import React, { createContext, useState, useContext, useCallback } from 'react';
import { User } from '../types';
import { CacheService, CACHE_KEYS } from '../services/cacheService';

interface UserContextType {
    currentUser: User | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    originalAdminUser: User | null;
    setOriginalAdminUser: React.Dispatch<React.SetStateAction<User | null>>;
    hasPermission: (feature: string) => boolean;
    logout: () => void;
}

const UserContext = createContext<UserContextType>({} as UserContextType);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);

    const hasPermission = useCallback((feature: string) => {
        if (!currentUser) return false;
        
        // Superusers (IsSystemAdmin or Role: Admin) have all permissions
        const userRoles = (currentUser.Role || '').split(',').map(r => r.trim().toLowerCase());
        if (currentUser.IsSystemAdmin || userRoles.includes('admin')) return true;
        
        if (!currentUser.Permissions || !Array.isArray(currentUser.Permissions)) return false;
        
        // Normalized match (case-insensitive)
        const targetFeature = feature.toLowerCase();
        return currentUser.Permissions.some((p: any) => 
            (p.Feature || '').toLowerCase() === targetFeature && p.IsEnabled
        );
    }, [currentUser]);

    const logout = useCallback(() => {
        setCurrentUser(null);
        setOriginalAdminUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        CacheService.remove(CACHE_KEYS.SESSION);
        window.location.reload();
    }, []);

    return (
        <UserContext.Provider value={{
            currentUser, setCurrentUser, originalAdminUser, setOriginalAdminUser,
            hasPermission, logout
        }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
