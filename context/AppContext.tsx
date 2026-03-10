
import React, { createContext } from 'react';
import { User, AppData, MasterProduct } from '../types';

export type Language = 'en' | 'km';

export interface AdvancedSettings {
    enableFloatingAlerts: boolean;
    enablePrivacyMode?: boolean;
    securityLevel?: 'standard' | 'high';
    notificationSound?: string; // ID from NOTIFICATION_SOUNDS
    notificationVolume?: number; // 0.0 to 1.0
    orderEditGracePeriod?: number; // Time in seconds, minimum 3
    placingOrderGracePeriod?: number; // Time in seconds, minimum 3
    packagingGracePeriod?: number; // Time in seconds, minimum 3
}

export interface AppContextType {
    currentUser: User | null;
    appData: AppData;
    login: (user: User) => void;
    logout: () => void;
    refreshData: () => Promise<void>;
    refreshTimestamp: number;
    originalAdminUser: User | null;
    returnToAdmin: () => void;
    previewImage: (url: string) => void;
    updateCurrentUser: (updatedData: Partial<User>) => void;
    setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
    unreadCount: number;
    updateProductInData: (productName: string, newData: Partial<MasterProduct>) => void;
    apiKey: string;
    setAppState: (newState: 'login' | 'role_selection' | 'admin_dashboard' | 'user_journey') => void;
    setOriginalAdminUser: React.Dispatch<React.SetStateAction<User | null>>;
    fetchData: (force?: boolean) => Promise<void>;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    setChatVisibility: (visible: boolean) => void;
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: (collapsed: boolean) => void;
    setIsChatOpen: (isOpen: boolean) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (isOpen: boolean) => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    showNotification: (message: string, type?: 'success' | 'info' | 'error') => void;
    mobilePageTitle: string | null;
    setMobilePageTitle: (title: string | null) => void;
    advancedSettings: AdvancedSettings;
    setAdvancedSettings: React.Dispatch<React.SetStateAction<AdvancedSettings>>;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
