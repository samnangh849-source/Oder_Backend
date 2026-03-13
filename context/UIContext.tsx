import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

export type Language = 'en' | 'km';

export interface AdvancedSettings {
    enableFloatingAlerts: boolean;
    enablePrivacyMode?: boolean;
    securityLevel?: 'standard' | 'high';
    notificationSound?: string;
    notificationVolume?: number;
    orderEditGracePeriod?: number;
    placingOrderGracePeriod?: number;
    packagingGracePeriod?: number;
}

interface UIContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    isSidebarCollapsed: boolean;
    setIsSidebarCollapsed: (collapsed: boolean) => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (isOpen: boolean) => void;
    unreadCount: number;
    setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
    mobilePageTitle: string | null;
    setMobilePageTitle: (title: string | null) => void;
    advancedSettings: AdvancedSettings;
    setAdvancedSettings: React.Dispatch<React.SetStateAction<AdvancedSettings>>;
    isChatOpen: boolean;
    setIsChatOpen: (isOpen: boolean) => void;
    isChatVisible: boolean;
    setChatVisibility: (visible: boolean) => void;
    showNotification: (message: string, type?: 'success' | 'info' | 'error', title?: string) => void;
    notifications: any[];
    removeNotification: (id: string) => void;
}

const UIContext = createContext<UIContextType>({} as UIContextType);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('appLanguage') as Language) || 'en');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(() => {
        const saved = localStorage.getItem('chatUnreadCount');
        return saved ? parseInt(saved, 10) : 0;
    });
    const [mobilePageTitle, setMobilePageTitle] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatVisible, setChatVisibility] = useState(true);
    const [notifications, setNotifications] = useState<any[]>([]);

    const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(() => {
        const saved = localStorage.getItem('advancedSettings');
        const defaultSettings: AdvancedSettings = { 
            enableFloatingAlerts: true, 
            notificationSound: 'default', 
            notificationVolume: 1.0,
            orderEditGracePeriod: 43200,
            placingOrderGracePeriod: 5,
            packagingGracePeriod: 3
        };
        if (saved) {
            try { return { ...defaultSettings, ...JSON.parse(saved) }; } catch (e) { return defaultSettings; }
        }
        return defaultSettings;
    });

    useEffect(() => {
        localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings));
    }, [advancedSettings]);

    useEffect(() => {
        localStorage.setItem('chatUnreadCount', unreadCount.toString());
    }, [unreadCount]);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('appLanguage', lang);
    };

    const showNotification = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info', title?: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications(prev => [...prev, { id, message, type, title }]);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    return (
        <UIContext.Provider value={{
            language, setLanguage, isSidebarCollapsed, setIsSidebarCollapsed,
            isMobileMenuOpen, setIsMobileMenuOpen, unreadCount, setUnreadCount,
            mobilePageTitle, setMobilePageTitle, advancedSettings, setAdvancedSettings,
            isChatOpen, setIsChatOpen, isChatVisible, setChatVisibility,
            showNotification, notifications, removeNotification
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => useContext(UIContext);
