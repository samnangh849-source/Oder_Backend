import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { User, AppData } from './types';
import { WEB_APP_URL } from './constants';
import { useUrlState } from './hooks/useUrlState';
import Spinner from './components/common/Spinner';
import Modal from './components/common/Modal';
import { AppContext, Language, AdvancedSettings } from './context/AppContext';
import BackgroundMusic from './components/common/BackgroundMusic';
import { CacheService, CACHE_KEYS } from './services/cacheService';
import Toast from './components/common/Toast';

// Retry helper for lazy loading components to handle version mismatches or network errors
const lazyRetry = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  name: string
): React.LazyExoticComponent<T> => {
  return React.lazy(async () => {
    try {
      return await importFn();
    } catch (error: any) {
      console.error(`Failed to load ${name}:`, error);
      // Check if it's a dynamic import error (chunk load failure)
      if (error.message?.includes('dynamically imported module') || error.message?.includes('Importing a module script failed')) {
        const storageKey = `retry_load_${name}`;
        const hasRetried = sessionStorage.getItem(storageKey);
        
        if (!hasRetried) {
          sessionStorage.setItem(storageKey, 'true');
          console.log(`Reloading page to recover from version mismatch for ${name}...`);
          window.location.reload();
          // Return a never-resolving promise to keep the suspense fallback active while reloading
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
};

const LoginPage = lazyRetry(() => import('@/pages/LoginPage'), 'LoginPage');
const RoleSelectionPage = lazyRetry(() => import('@/pages/RoleSelectionPage'), 'RoleSelectionPage');
const AdminDashboard = lazyRetry(() => import('@/pages/AdminDashboard'), 'AdminDashboard');
const UserJourney = lazyRetry(() => import('@/pages/UserJourney'), 'UserJourney');
const DeliveryAgentView = lazyRetry(() => import('@/components/orders/DeliveryAgentView'), 'DeliveryAgentView');
const FulfillmentPage = lazyRetry(() => import('@/pages/FulfillmentPage'), 'FulfillmentPage');
const Header = lazyRetry(() => import('@/components/common/Header'), 'Header');
const ImpersonationBanner = lazyRetry(() => import('@/components/common/ImpersonationBanner'), 'ImpersonationBanner');
const ChatWidget = lazyRetry(() => import('@/components/chat/ChatWidget'), 'ChatWidget');

const initialAppData: AppData = {
    users: [], products: [], pages: [], locations: [],
    shippingMethods: [], drivers: [], bankAccounts: [],
    phoneCarriers: [], colors: [], stores: [], settings: [], targets: [],
    inventory: [], stockTransfers: [], returns: []
};

const App: React.FC = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(null);
    const [appData, setAppData] = useState<AppData>(initialAppData);
    const [refreshTimestamp, setRefreshTimestamp] = useState<number>(Date.now());
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('appLanguage') as Language) || 'en');
    const [appState, setAppState] = useUrlState<'login' | 'role_selection' | 'admin_dashboard' | 'user_journey' | 'confirm_delivery' | 'fulfillment'>('view', 'login');
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    
    // URL Params for Delivery Confirmation
    const urlParams = new URLSearchParams(window.location.search);

    // Handle shortened URL shortcuts (v=cd -> view=confirm_delivery)
    useEffect(() => {
        const v = urlParams.get('v');
        if (v === 'cd' && appState !== 'confirm_delivery') {
            setAppState('confirm_delivery');
        }
    }, [appState, setAppState]);

    const confirmIds = (urlParams.get('i') || urlParams.get('ids'))?.split(',') || [];
    const returnIds = urlParams.get('r')?.split(',') || [];
    const failedIdsParam = urlParams.get('f')?.split(',') || [];
    const confirmStore = urlParams.get('s') || urlParams.get('store') || '';
    const confirmExpires = urlParams.get('e') || urlParams.get('expires');
    const isConfirmExpired = confirmExpires ? Date.now() > parseInt(confirmExpires) : false;
    
    // Notification State
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
    
    // Header Title State for Mobile
    const [mobilePageTitle, setMobilePageTitle] = useState<string | null>(null);

    // Advanced Settings State
    const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(() => {
        const saved = localStorage.getItem('advancedSettings');
        const defaultSettings: AdvancedSettings = { enableFloatingAlerts: true, notificationSound: 'default', notificationVolume: 1.0 };
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch (e) {
                return defaultSettings;
            }
        }
        return defaultSettings;
    });
    
    // Sync Advanced Settings to localStorage
    useEffect(() => {
        localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings));
    }, [advancedSettings]);
    
    // Initialize unreadCount from localStorage
    const [unreadCount, setUnreadCount] = useState(() => {
        const saved = localStorage.getItem('chatUnreadCount');
        return saved ? parseInt(saved, 10) : 0;
    });

    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isChatVisible, setChatVisible] = useState(true);
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);

    const handleLanguageChange = (lang: Language) => {
        setLanguage(lang);
        localStorage.setItem('appLanguage', lang);
    };

    const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
        setNotification({ message, type });
    };

    // Sync unreadCount to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('chatUnreadCount', unreadCount.toString());
    }, [unreadCount]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            document.documentElement.style.setProperty('--x', `${e.clientX}px`);
            document.documentElement.style.setProperty('--y', `${e.clientY}px`);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = useCallback(async (force = false) => {
        // 1. Optimistic Cache Load (Stale-While-Revalidate)
        if (!force) {
            try {
                const cachedData = await CacheService.get<AppData>(CACHE_KEYS.APP_DATA);
                if (cachedData) {
                    console.log("Loaded app data from cache");
                    setAppData(cachedData);
                    setIsGlobalLoading(false); // Unblock UI immediately if cache exists
                }
            } catch (err) {
                console.warn("Cache retrieval error:", err);
            }
        }

        try {
            // 2. Fetch fresh data from API
            const response = await fetch(`${WEB_APP_URL}/api/static-data`);
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success') {
                    const rawData = result.data || {};
                    const processedData = {
                        ...initialAppData,
                        ...rawData,
                        pages: rawData.pages || rawData.TeamsPages || [],
                        users: rawData.users || rawData.Users || [],
                        products: rawData.products || rawData.Products || [],
                        settings: rawData.settings || rawData.Settings || [],
                        inventory: rawData.inventory || [],
                        stockTransfers: rawData.stockTransfers || [],
                        returns: rawData.returns || [],
                    };
                    
                    setAppData(processedData);
                    // Update cache
                    CacheService.set(CACHE_KEYS.APP_DATA, processedData);
                    console.log("App data updated from network");
                }
            }
        } catch (e) {
            console.error("Data Fetch Error:", e);
            // If offline and no cache was loaded in step 1, UI will remain in loading state or show error if we handle it here.
            // But since step 1 handles existing cache, this catch block ensures we don't crash on network fail.
        } finally {
            setIsGlobalLoading(false);
        }
    }, []);

    const determineAppState = useCallback((user: User) => {
        // All users now go through role selection to choose between Sales or Fulfillment
        // Only System Admins will see the "Admin Dashboard" option inside RoleSelectionPage
        setAppState('role_selection');
    }, [setAppState]);

    useEffect(() => {
        // Use CacheService for Session Management
        const initSession = async () => {
            try {
                const session = await CacheService.get<{ user: User, timestamp: number }>(CACHE_KEYS.SESSION);
                
                if (session && session.user) {
                    setCurrentUser(session.user);
                    fetchData(); // This is async but we don't await it here to avoid blocking
                    if (appState === 'login') determineAppState(session.user);
                } else {
                    // Session expired or doesn't exist
                    setIsGlobalLoading(false);
                }
            } catch (e) {
                console.warn("Session init error:", e);
                setIsGlobalLoading(false);
            }
        };

        initSession();
    }, [fetchData]);

    const login = async (user: User) => {
        setCurrentUser(user);
        // Save session using CacheService (48h default)
        await CacheService.set(CACHE_KEYS.SESSION, { user, timestamp: Date.now() });
        fetchData(true); // Force fetch on login
        determineAppState(user);
    };

    const logout = async () => {
        setCurrentUser(null);
        setAppState('login');
        await CacheService.remove(CACHE_KEYS.SESSION);
        // Note: We keep APP_DATA cache to make next login faster
    };

    const refreshData = async () => {
        await fetchData(true); // Force fetch
        setRefreshTimestamp(Date.now());
    };

    // --- SYSTEM UPDATE REAL-TIME POLLING ---
    useEffect(() => {
        // Only poll if user is logged in
        if (!currentUser) return;

        const checkForUpdates = async () => {
            try {
                // Fetch ONLY static data silently (no loading spinner) to check settings
                const response = await fetch(`${WEB_APP_URL}/api/static-data`);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success') {
                        const rawData = result.data || {};
                        const newSettings = rawData.settings || rawData.Settings || [];
                        
                        // Only update settings part of state to avoid full re-render flickering
                        setAppData(prev => {
                            // Simple check if settings actually changed to prevent loop
                            if (JSON.stringify(prev.settings) !== JSON.stringify(newSettings)) {
                                return { ...prev, settings: newSettings };
                            }
                            return prev;
                        });
                    }
                }
            } catch (err) {
                console.warn("Silent poll failed", err);
            }
        };

        // Poll every 15 seconds
        const intervalId = setInterval(checkForUpdates, 15000);
        return () => clearInterval(intervalId);
    }, [currentUser]);

    // System Update Action Trigger
    useEffect(() => {
        if (!appData?.settings || !currentUser) return;

        const systemSetting = Array.isArray(appData.settings) 
            ? appData.settings.find((s: any) => s.Key === 'SystemVersion') 
            : null;

        if (systemSetting && systemSetting.Value) {
            const serverVersion = String(systemSetting.Value);
            const localVersion = localStorage.getItem('systemVersion');

            // If versions differ
            if (localVersion !== serverVersion) {
                console.log(`System Update Detected: ${localVersion} -> ${serverVersion}`);
                
                // Update local version immediately to prevent loop if we just refresh
                localStorage.setItem('systemVersion', serverVersion);
                
                // Force Logout if action dictates
                if (systemSetting.Action === 'ForceLogout') {
                    showNotification("System Updated. Updating...", 'info');
                    // Add a slight delay for user to see the message
                    setTimeout(() => {
                        logout();
                        window.location.reload(); 
                    }, 2000);
                }
            }
        }
    }, [appData.settings, currentUser]);

    const updateCurrentUser = async (updatedData: Partial<User>) => {
        if (currentUser) {
            const newUser = { ...currentUser, ...updatedData };
            setCurrentUser(newUser);
            // Update session in cache
            await CacheService.set(CACHE_KEYS.SESSION, { user: newUser, timestamp: Date.now() });
        }
    };

    // --- PROACTIVE NOTIFICATION PERMISSION REQUEST ---
    useEffect(() => {
        if (!currentUser) return;

        const checkAndRequestPermission = async () => {
            if ('Notification' in window && Notification.permission === 'default') {
                // Show an in-app hint first to prepare the user
                setTimeout(() => {
                    showNotification("សូមបើក Notification ដើម្បីទទួលបានដំណឹងទម្លាក់ការកម្មង់ថ្មីៗ", 'info');
                }, 3000);

                // We need a user gesture for most browsers. 
                // We'll add a one-time click listener to the window to trigger the prompt.
                const triggerPrompt = async () => {
                    console.log("Proactively requesting notification permission...");
                    await Notification.requestPermission();
                    window.removeEventListener('click', triggerPrompt);
                };
                window.addEventListener('click', triggerPrompt);
                return () => window.removeEventListener('click', triggerPrompt);
            }
        };

        checkAndRequestPermission();
    }, [currentUser]);

    const shouldShowHeader = useMemo(() => appState !== 'admin_dashboard', [appState]);

    const containerClass = useMemo(() => 
        (appState === 'admin_dashboard' || appState === 'role_selection') ? 'w-full' : 'w-full px-2 sm:px-6', 
    [appState]);

    const paddingClass = useMemo(() => {
        if (appState === 'role_selection' || appState === 'login') return 'pt-0 pb-0';
        const basePadding = isMobile ? 'pt-14' : 'pt-20';
        return `${shouldShowHeader ? basePadding : 'pt-0'} pb-24 md:pb-8`;
    }, [appState, shouldShowHeader, isMobile]);

    if (isGlobalLoading) return <div className="flex h-screen items-center justify-center bg-gray-950"><Spinner size="lg" /></div>;

    return (
        <AppContext.Provider value={{
            currentUser, appData, login, logout, refreshData, refreshTimestamp,
            originalAdminUser, returnToAdmin: () => {}, previewImage: (u) => setPreviewImageUrl(u),
            updateCurrentUser, setUnreadCount, unreadCount, updateProductInData: () => {}, apiKey: '',
            setAppState, setOriginalAdminUser, fetchData, setCurrentUser, setChatVisibility: setChatVisible,
            isSidebarCollapsed, setIsSidebarCollapsed, setIsChatOpen,
            isMobileMenuOpen, setIsMobileMenuOpen,
            language, setLanguage: handleLanguageChange,
            showNotification,
            mobilePageTitle, setMobilePageTitle,
            advancedSettings, setAdvancedSettings
        }}>
            <div className="min-h-screen relative z-10">
                <BackgroundMusic />
                <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner size="lg" /></div>}>
                    {appState === 'confirm_delivery' ? (
                        <DeliveryAgentView orderIds={confirmIds} returnOrderIds={returnIds} failedOrderIds={failedIdsParam} storeName={confirmStore} />
                    ) : currentUser && appState !== 'login' ? (
                        <>
                            {originalAdminUser && <ImpersonationBanner />}
                            {shouldShowHeader && <Header appState={appState} onBackToRoleSelect={() => setAppState('role_selection')} />}
                            <main className={`${containerClass} ${paddingClass} transition-all duration-300`}>
                                {appState === 'admin_dashboard' && <AdminDashboard />}
                                {appState === 'user_journey' && <UserJourney onBackToRoleSelect={() => setAppState('role_selection')} />}
                                {appState === 'fulfillment' && <FulfillmentPage />}
                                {appState === 'role_selection' && <RoleSelectionPage onSelect={(s) => setAppState(s as any)} />}
                            </main>
                            <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                        </>
                    ) : (
                        <LoginPage />
                    )}
                </Suspense>
                
                {/* Global Notification Toast */}
                {notification && advancedSettings.enableFloatingAlerts && (
                    <Toast 
                        message={notification.message} 
                        type={notification.type} 
                        onClose={() => setNotification(null)} 
                    />
                )}

                {previewImageUrl && (
                    <Modal isOpen={true} onClose={() => setPreviewImageUrl(null)} maxWidth="max-w-4xl">
                        <div className="relative p-2"><img src={previewImageUrl} className="max-h-[85vh] w-full object-contain rounded-xl" alt="Preview" /></div>
                    </Modal>
                )}
            </div>
        </AppContext.Provider>
    );
};

export default App;