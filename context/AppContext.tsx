
import React, { createContext } from 'react';
import { User, AppData, MasterProduct, ParsedOrder } from '../types';

export type Language = 'en' | 'km';

export interface AdvancedSettings {
    enableFloatingAlerts: boolean;
    enablePrivacyMode?: boolean;
    securityLevel?: 'standard' | 'high';
    notificationSound?: string; // ID from NOTIFICATION_SOUNDS
    notificationVolume?: number; // 0.0 to 1.0
    musicVolume?: number; // 0.0 to 1.0
    orderEditGracePeriod?: number; // Time in seconds, minimum 3
    placingOrderGracePeriod?: number; // Time in seconds, minimum 3
    packagingGracePeriod?: number; // Time in seconds, minimum 3
    uiTheme?: 'default' | 'neumorphism' | 'samsung' | 'netflix' | 'finance' | 'binance';
    themeMode?: 'light' | 'dark';
    glassIntensity?: number; // 0 to 100
    borderRadius?: number; // 0 to 40
    animationSpeed?: 'none' | 'slow' | 'normal' | 'fast';
    fontStyle?: 'standard' | 'modern' | 'mono';
}

export interface AppContextType {
    currentUser: User | null;
    appData: AppData;
    orders: ParsedOrder[];
    isOrdersLoading: boolean;
    isSyncing: boolean;
    login: (user: User, token: string) => Promise<void>;
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
    appState: 'login' | 'role_selection' | 'admin_dashboard' | 'user_journey' | 'confirm_delivery' | 'fulfillment' | 'create_order' | 'entertainment' | 'watch' | 'series_player';
    setAppState: (newState: 'login' | 'role_selection' | 'admin_dashboard' | 'user_journey' | 'confirm_delivery' | 'fulfillment' | 'create_order' | 'entertainment' | 'watch' | 'series_player') => void;
    setOriginalAdminUser: React.Dispatch<React.SetStateAction<User | null>>;
    fetchData: (force?: boolean) => Promise<void>;
    fetchOrders: (force?: boolean) => Promise<void>;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    setChatVisibility: (visible: boolean) => void;
    hasPermission: (feature: string) => boolean;
    updatePermission: (role: string, feature: string, isEnabled: boolean) => Promise<void>;
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: (collapsed: boolean) => void;
    setIsChatOpen: (isOpen: boolean) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (isOpen: boolean) => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    showNotification: (message: string, type?: 'success' | 'info' | 'error', title?: string) => void;
    mobilePageTitle: string | null;
    setMobilePageTitle: (title: string | null) => void;
    advancedSettings: AdvancedSettings;
    setAdvancedSettings: React.Dispatch<React.SetStateAction<AdvancedSettings>>;
    selectedTeam: string;
    setSelectedTeam: (team: string) => void;
    selectedMovieId: string;
    setSelectedMovieId: (id: string) => void;
    lastMessage: any;
}

export const AppContext = createContext<AppContextType>({} as AppContextType);
