import React, { createContext, useState, useContext, useCallback } from 'react';
import { User } from '../types';

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
        if (currentUser.IsSystemAdmin) return true;
        if (!currentUser.Permissions) return false;
        return currentUser.Permissions.some((p: any) => p.feature === feature && p.isEnabled);
    }, [currentUser]);

    const logout = useCallback(() => {
        setCurrentUser(null);
        setOriginalAdminUser(null);
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
