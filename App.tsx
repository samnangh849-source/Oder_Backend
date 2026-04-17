import React, { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { User, AppData, ParsedOrder } from './types';
import { convertGoogleDriveUrl } from './utils/fileUtils';
import { WEB_APP_URL } from './constants';
import { useUrlState } from './hooks/useUrlState';
import { CacheService, CACHE_KEYS } from './services/cacheService';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import LoginPage from './pages/LoginPage';
import UserJourney from './pages/UserJourney';
import AdminDashboard from './pages/AdminDashboard';
import CreateOrderPage from './pages/CreateOrderPage';
import FulfillmentPage from './pages/FulfillmentPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import SeriesPlayerPage from './pages/SeriesPlayerPage';
import LongFilmPlayerPage from './pages/LongFilmPlayerPage';
import ShortFilmPlayerPage from './pages/ShortFilmPlayerPage';
import CambodiaMapPage from './pages/CambodiaMapPage';
import PrintLabelPage from './pages/PrintLabelPage';
import OrderMetadataView from './components/orders/OrderMetadataView';
import NetflixEntertainment from './components/admin/netflix/NetflixEntertainment';
import Header from './components/common/Header';
import Spinner from './components/common/Spinner';
import ChatWidget from './components/chat/ChatWidget';
import Modal from './components/common/Modal';
import DeliveryAgentView from './components/orders/DeliveryAgentView';
import NotificationStack from './components/common/NotificationStack';

import ImpersonationBanner from './components/common/ImpersonationBanner';
import { AppContext, AdvancedSettings } from './context/AppContext';
import { UIProvider, useUI } from './context/UIContext';
import { UserProvider, useUser } from './context/UserContext';
import { OrderProvider, useOrder } from './context/OrderContext';
import { localDbService } from './services/localDbService';
import { translations } from './translations';

const AppContent: React.FC = () => {
    const { 
        notifications, removeNotification, showNotification,
        isSidebarCollapsed, setIsSidebarCollapsed,
        isChatOpen, setIsChatOpen,
        unreadCount, setUnreadCount,
        isMobileMenuOpen, setIsMobileMenuOpen
    } = useUI();

    const {
        currentUser, originalAdminUser, setCurrentUser, setOriginalAdminUser, logout, hasPermission
    } = useUser();

    const {
        orders, setOrders, appData, isOrdersLoading, isSyncing, refreshTimestamp, fetchData, fetchOrders, refreshData
    } = useOrder();

    const [appState, setAppState] = useUrlState<'login' | 'user_journey' | 'admin_dashboard' | 'create_order' | 'fulfillment' | 'role_selection' | 'confirm_delivery' | 'entertainment' | 'watch' | 'series_player' | 'long_player' | 'short_player' | 'cambodia_map' | 'print_label' | 'order_metadata'>('view', 'login');
    const [selectedTeam, setSelectedTeam] = useUrlState<string>('team', '');
    const [selectedMovieId, setSelectedMovieId] = useUrlState<string>('movie', '');
    const [mobilePageTitle, setMobilePageTitle] = useState<string | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [language, setLanguage] = useState<'en' | 'km'>(() => (localStorage.getItem('language') as any) || 'km');
    const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(() => {
        const saved = localStorage.getItem('advancedSettings');
        const defaultSettings: AdvancedSettings = { 
            enableFloatingAlerts: true, 
            enablePrivacyMode: false, 
            notificationVolume: 0.5, 
            notificationSound: 'default',
            uiTheme: 'default',
            themeMode: 'dark',
            glassIntensity: 20,
            borderRadius: 24,
            animationSpeed: 'normal',
            fontStyle: 'standard',
            orderEditGracePeriod: 15,
            placingOrderGracePeriod: 5,
            packagingGracePeriod: 5
        };
        if (saved) {
            try { return { ...defaultSettings, ...JSON.parse(saved) }; } catch (e) { return defaultSettings; }
        }
        return defaultSettings;
    });

    // --- APPLY DYNAMIC CSS VARIABLES ---
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--glass-blur', `${(advancedSettings.glassIntensity || 20) / 2}px`);
        root.style.setProperty('--global-radius', `${advancedSettings.borderRadius || 24}px`);
        
        const animDurations = { none: '0s', slow: '0.6s', normal: '0.3s', fast: '0.1s' };
        root.style.setProperty('--anim-duration', animDurations[advancedSettings.animationSpeed || 'normal']);
        
        const fonts = { 
            standard: "'Kantumruy Pro', sans-serif", 
            modern: "'Inter', sans-serif", 
            mono: "'JetBrains Mono', monospace" 
        };
        root.style.setProperty('--global-font', fonts[advancedSettings.fontStyle || 'standard']);

        // Binance theme overrides — force sharp edges and Inter font
        if (advancedSettings.uiTheme === 'binance') {
            root.style.setProperty('--global-radius', '2px');
            root.style.setProperty('--global-font', "'Inter', sans-serif");
        }
    }, [advancedSettings.glassIntensity, advancedSettings.borderRadius, advancedSettings.animationSpeed, advancedSettings.fontStyle, advancedSettings.uiTheme]);

    const [lastMessage, setLastMessage] = useState<any>(null);

    // Global WebSocket connection for system notifications (Sync, etc.)
    useEffect(() => {
        if (!currentUser) return;
        
        let ws: WebSocket | null = null;
        let reconnectTimeout: any = null;
        let reconnectAttempts = 0;
        let isDisposed = false;

        const scheduleReconnect = () => {
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
            reconnectAttempts++;
            console.log(`⏳ [WS] Attempting reconnect ${reconnectAttempts} in ${Math.round(delay/1000)}s...`);
            reconnectTimeout = setTimeout(connect, delay);
        };

        const connect = async () => {
            if (isDisposed) return;
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || localStorage.getItem('token');
            if (!token) return;

            // Use wss if the backend URL is https, otherwise follow frontend protocol
            const protocol = WEB_APP_URL.startsWith('https') ? 'wss' : (window.location.protocol === 'https:' ? 'wss' : 'ws');
            const host = WEB_APP_URL.replace(/^https?:\/\//, '');
            
            try {
                ws = new WebSocket(`${protocol}://${host}/api/chat/ws?token=${encodeURIComponent(token)}`);
                
                ws.onopen = () => {
                    console.log("🟢 [WS] Connected to System Hub");
                    reconnectAttempts = 0; // Reset attempts on successful connection
                };

                ws.onmessage = (event) => {
                    if (isDisposed) return;
                    try {
                        const data = JSON.parse(event.data);
                        setLastMessage(data);
                    } catch (e) {
                        setLastMessage(event.data);
                    }
                };

                ws.onclose = (event) => {
                    console.log(`🔴 [WS] Disconnected (Code: ${event.code})`);
                    ws = null;
                    if (!isDisposed) {
                        scheduleReconnect();
                    }
                };

                ws.onerror = (error) => {
                    console.error("⚠️ [WS] Connection Error:", error);
                    // Error will trigger onclose, which handles reconnect
                };
            } catch (e) {
                console.error("❌ [WS] Failed to initialize:", e);
                if (!isDisposed) scheduleReconnect();
            }
        };

        connect();

        return () => {
            console.log("🛑 [WS] Cleaning up connection...");
            isDisposed = true;
            if (ws) {
                ws.onclose = null; // Prevent reconnect loop
                ws.close();
            }
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
        };
    }, [currentUser]);

    const tokenRef = useRef<string | null>(null);

    // --- WebSocket Data Sync ---
    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'new_order') {
            console.log("[App] 🔔 New order detected. Refreshing data...");
            fetchOrders(true); // Background sync
        } else if (lastMessage.type === 'update_order') {
            const { orderId, newData } = lastMessage;
            if (orderId && newData) {
                // Prepare normalized data for local state
                const normalizedUpdate = { ...newData };
                if (newData['Fulfillment Status'] && !newData['FulfillmentStatus']) {
                    normalizedUpdate['FulfillmentStatus'] = newData['Fulfillment Status'];
                }
                if (newData['FulfillmentStatus'] && !newData['Fulfillment Status']) {
                    normalizedUpdate['Fulfillment Status'] = newData['FulfillmentStatus'];
                }

                setOrders(prev => {
                    const exists = prev.some(o => o['Order ID'] === orderId);
                    if (!exists) {
                        fetchOrders(true); 
                        return prev;
                    }
                    return prev.map(o => o['Order ID'] === orderId ? { ...o, ...normalizedUpdate } : o);
                });
            }
        } else if (lastMessage.type === 'delete_order') {
            const { orderId } = lastMessage;
            if (orderId) {
                setOrders(prev => prev.filter(o => o['Order ID'] !== orderId));
            }
        } else if (lastMessage.type === 'sync_error') {
            console.error("[App] ❌ Sync Error:", lastMessage.message);
            showNotification(
                lastMessage.message || "ការ Sync ទិន្នន័យទៅ Google Sheets បរាជ័យ!", 
                'error', 
                'Sync Failure'
            );
        } else if (lastMessage.type === 'sheet_webhook_sync') {
             // A sheet was updated directly, trigger a background refresh to catch any changes not captured by optimistic updates
             if (lastMessage.sheetName === 'AllOrders' || lastMessage.sheetName?.startsWith('Orders_')) {
                 fetchOrders(true);
             } else {
                 fetchData(true);
             }
        } else if (lastMessage.type === 'update_permission') {
            // Admin changed a permission — refresh static data so ALL connected users
            // (including non-admin Sales/Staff users) get the updated permission state immediately.
            // Without this, users rely on the 5-minute background poll to see the change.
            console.log("[App] 🔐 Permission updated by admin. Refreshing permissions...");
            fetchData(true);
        }
    }, [lastMessage, fetchOrders, fetchData, setOrders, showNotification]);

    const isMobile = window.innerWidth < 768;
    const isAdmin = useMemo(() => {
        if (!currentUser) return false;
        if (currentUser.IsSystemAdmin) return true;
        const userRoles = (currentUser.Role || '').split(',').map(r => r.trim().toLowerCase());
        return userRoles.includes('admin');
    }, [currentUser]);

    // --- SYNC SETTINGS ---
    useEffect(() => { localStorage.setItem('language', language); }, [language]);
    useEffect(() => { localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings)); }, [advancedSettings]);

    // Handle initial state and auth
    useEffect(() => {
        if (!currentUser && appState !== 'login' && appState !== 'confirm_delivery' && appState !== 'watch' && appState !== 'series_player' && appState !== 'short_player' && appState !== 'long_player' && appState !== 'print_label' && appState !== 'entertainment' && appState !== 'order_metadata') {
            setAppState('login');
        }
    }, [currentUser, appState, setAppState]);

    // Handle deep links for confirm delivery
    const urlParams = new URLSearchParams(window.location.search);
    const confirmIds = useMemo(() => urlParams.get('i')?.split(',').filter(Boolean) || [], []);
    const returnIds = useMemo(() => urlParams.get('r')?.split(',').filter(Boolean) || [], []);
    const failedIdsParam = useMemo(() => urlParams.get('f')?.split(',').filter(Boolean) || [], []);
    const confirmStore = urlParams.get('s') || '';

    useEffect(() => {
        if (urlParams.get('v') === 'cd') setAppState('confirm_delivery');
    }, [setAppState]);

    // --- PERMISSION REFRESH ---
    // Runs whenever appData.permissions changes (e.g. after fetchData, WebSocket update_permission event,
    // or background 5-min poll). Rebuilds currentUser.Permissions from the authoritative server data.
    // NOTE: currentUser?.Permissions is intentionally NOT in the dep array — the JSON comparison
    // inside prevents redundant setCurrentUser calls without causing an update→re-trigger loop.
    useEffect(() => {
        if (!currentUser || !appData?.permissions || !Array.isArray(appData.permissions) || appData.permissions.length === 0) return;

        const userRoles = (currentUser.Role || '').split(',').map(r => r.trim().toLowerCase());

        // Collect all permission rows that match any of the user's roles (case-insensitive)
        const matchedPerms = appData.permissions.filter(p => {
            const role = (p.Role || p.role || '').toLowerCase();
            return userRoles.includes(role);
        });

        // Deduplicate by feature: if a user has multiple roles granting the same feature, prefer enabled
        const mergedPermsMap: Record<string, any> = {};
        matchedPerms.forEach(p => {
            const feature = (p.Feature || p.feature || '').toLowerCase();
            const enabled = p.IsEnabled ?? p.isEnabled ?? p.is_enabled ?? false;
            if (!mergedPermsMap[feature] || enabled) {
                mergedPermsMap[feature] = p;
            }
        });
        const rolePerms = Object.values(mergedPermsMap);

        // Only write to state if content actually changed (avoids re-render cascade)
        const nextPermsStr = JSON.stringify(rolePerms);
        setCurrentUser(prev => {
            if (!prev) return null;
            if (JSON.stringify(prev.Permissions || []) === nextPermsStr) return prev;
            return { ...prev, Permissions: rolePerms };
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.Role, appData?.permissions]);

    useEffect(() => {
        if (currentUser) fetchOrders();
    }, [currentUser, fetchOrders]);

    const fetchPermissions = useCallback(async (token: string) => {
        try {
            const res = await fetch(`${WEB_APP_URL}/api/permissions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const result = await res.json();
                if (result.status === 'success') {
                    return result.data;
                }
            }
        } catch (e) {
            console.error("Failed to fetch user permissions", e);
        }
        return [];
    }, []);

    // --- SESSION INITIALIZATION ---
    useEffect(() => {
        const initSession = async () => {
            try {
                // Clear old images from IndexedDB
                localDbService.clearOldImages().catch(e => console.warn("IDB clear error:", e));

                const session = await CacheService.get<{ user: User, token: string, timestamp: number }>(CACHE_KEYS.SESSION);
                if (session && session.user) {
                    let userWithPerms = { ...session.user };
                    if (session.token) {
                        tokenRef.current = session.token;
                        localStorage.setItem('token', session.token);
                        // Refresh permissions from backend
                        const perms = await fetchPermissions(session.token);
                        userWithPerms.Permissions = perms;
                    }
                    
                    // Fetch static data first to ensure permissions can be refreshed correctly
                    await fetchData(false);
                    
                    setCurrentUser(userWithPerms);
                    
                    const currentView = new URLSearchParams(window.location.search).get('view');
                    if (currentView === 'order_metadata') {
                        setAppState('order_metadata');
                    } else if (currentView !== 'series_player' && currentView !== 'watch' && currentView !== 'confirm_delivery' && currentView !== 'entertainment' && currentView !== 'short_player' && currentView !== 'long_player' && currentView !== 'print_label') {
                        setAppState('role_selection');
                    }
                } else {
                    await fetchData(false);
                }
            } catch (e) {
                console.warn("Session init error:", e);
            } finally {
                setIsGlobalLoading(false);
            }
        };
        initSession();
    }, [fetchData, setCurrentUser, setAppState, fetchPermissions]);

    const login = async (user: User, token: string) => {
        tokenRef.current = token;
        localStorage.setItem('token', token);
        
        // Fetch permissions before setting current user to ensure hasPermission is ready
        const perms = await fetchPermissions(token);
        const userWithPerms = { ...user, Permissions: perms };
        
        setCurrentUser(userWithPerms);
        await CacheService.set(CACHE_KEYS.SESSION, { user: userWithPerms, token, timestamp: Date.now() });
        await fetchData(true);
        setAppState('role_selection');
    };

    const setChatVisibility = useCallback((visible: boolean) => {
        // Implementation for chat visibility if needed
    }, []);

    const shouldShowHeader = useMemo(() => {
        if (appState === 'login' || appState === 'user_journey' || appState === 'admin_dashboard' || appState === 'confirm_delivery' || appState === 'entertainment' || appState === 'watch' || appState === 'series_player' || appState === 'long_player' || appState === 'short_player' || appState === 'cambodia_map' || appState === 'print_label' || appState === 'fulfillment' || appState === 'order_metadata') return false;
        return true;
    }, [appState]);

    const containerClass = useMemo(() => {
        if (appState === 'entertainment' || appState === 'watch' || appState === 'series_player' || appState === 'long_player' || appState === 'short_player' || appState === 'cambodia_map' || appState === 'print_label' || appState === 'fulfillment' || appState === 'order_metadata') return 'w-full';
        return (appState === 'admin_dashboard' || appState === 'role_selection' || appState === 'user_journey') ? 'w-full' : 'w-full px-2 sm:px-6';
    }, [appState, selectedTeam]);

    const paddingClass = useMemo(() => {
        if (appState === 'login' || appState === 'confirm_delivery' || appState === 'entertainment' || appState === 'watch' || appState === 'series_player' || appState === 'long_player' || appState === 'short_player' || appState === 'cambodia_map' || appState === 'print_label' || appState === 'fulfillment' || appState === 'order_metadata') return 'pt-0 pb-0';
        
        // Base header padding
        let topPadding = isMobile ? 'pt-16' : 'pt-20';
        
        if (originalAdminUser) {
            topPadding = isMobile ? 'pt-[104px]' : 'pt-[120px]';
        }

        if (!shouldShowHeader) topPadding = 'pt-0';
        
        const isActionView = appState === 'create_order' || appState === 'user_journey';
        const isCenteredView = appState === 'role_selection' || (appState === 'user_journey' && !selectedTeam);
        const finalTopPadding = isCenteredView ? 'pt-0' : topPadding;
        const bottomPadding = (isCenteredView || isActionView) ? 'pb-10' : 'pb-20 md:pb-8';

        return `${finalTopPadding} ${bottomPadding}`;
    }, [appState, shouldShowHeader, isMobile, originalAdminUser, selectedTeam]);

    const legacyContextValue = useMemo(() => ({
        currentUser, appData, orders, isOrdersLoading, isSyncing, login, logout, refreshData, refreshTimestamp,
        originalAdminUser, returnToAdmin: () => {}, previewImage: (u: string) => setPreviewImageUrl(convertGoogleDriveUrl(u)),
        updateCurrentUser: (u: any) => setCurrentUser(prev => prev ? {...prev, ...u} : null),
        setUnreadCount, unreadCount, updateProductInData: () => {}, apiKey: '',
        appState, setAppState, setOriginalAdminUser, fetchData, fetchOrders, setCurrentUser, setChatVisibility,
        hasPermission, updatePermission: async (role: string, feature: string, isEnabled: boolean) => {
            try {
                const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
                const token = session?.token || tokenRef.current;
                const headers: HeadersInit = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const response = await fetch(`${WEB_APP_URL}/api/admin/permissions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([{ Role: role, Feature: feature, IsEnabled: isEnabled }])
                });
                if (response.ok) {
                    await fetchData(true);
                    showNotification("សិទ្ធិត្រូវបានធ្វើបច្ចុប្បន្នភាព", "success");
                }
            } catch (e) {
                console.error("Permission update failed", e);
            }
        },
        isSidebarCollapsed, setIsSidebarCollapsed, setIsChatOpen,
        isMobileMenuOpen, setIsMobileMenuOpen,
        language, setLanguage,
        showNotification,
        mobilePageTitle, setMobilePageTitle,
        advancedSettings, setAdvancedSettings,
        selectedTeam, setSelectedTeam,
        selectedMovieId, setSelectedMovieId,
        lastMessage, setOrders
    }), [
        currentUser, appData, orders, isOrdersLoading, isSyncing, login, logout, refreshData, refreshTimestamp,
        originalAdminUser, setUnreadCount, unreadCount, appState, setAppState, setOriginalAdminUser,
        fetchData, fetchOrders, setCurrentUser, setChatVisibility, hasPermission,
        isSidebarCollapsed, setIsSidebarCollapsed, setIsChatOpen, isMobileMenuOpen, 
        setIsMobileMenuOpen, language, setLanguage, showNotification, mobilePageTitle, 
        setMobilePageTitle, advancedSettings, setAdvancedSettings, selectedTeam, setSelectedTeam,
        selectedMovieId, setSelectedMovieId, lastMessage, setOrders
    ]);

    if (isGlobalLoading) return <div className="flex h-screen items-center justify-center bg-dark" style={{ backgroundColor: 'var(--bg-dark)' }}><Spinner size="lg" /></div>;

    return (
        <AppContext.Provider value={legacyContextValue as any}>
            <div className={`theme-wrapper h-screen w-full overflow-hidden flex flex-col ${advancedSettings.uiTheme ? `ui-${advancedSettings.uiTheme}` : ''} ${advancedSettings.themeMode ? `theme-${advancedSettings.themeMode}` : 'theme-dark'}`}>
                {/* GLOBAL PREMIUM BACKGROUND */}
                <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden pointer-events-none z-0" style={{ backgroundColor: 'var(--bg-dark)' }}>
                    {advancedSettings.uiTheme !== 'binance' && (
                        <>
                            <div className="absolute top-[-10%] left-[-10%] w-[100%] sm:w-[70%] h-[60%] sm:h-[70%] bg-blue-600/15 rounded-full blur-[80px] sm:blur-[120px] animate-pulse"></div>
                            <div className="absolute bottom-[-10%] right-[-10%] w-[100%] sm:w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[80px] sm:blur-[120px]" style={{ animationDelay: '3s' }}></div>
                            <div className="absolute top-[20%] right-[10%] w-[50%] sm:w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[60px] sm:blur-[100px]" style={{ animationDelay: '1.5s' }}></div>
                        </>
                    )}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] mix-blend-overlay"></div>
                </div>

                <div className="relative z-10 flex flex-col h-full w-full overflow-hidden">

                    <Suspense fallback={<div className="flex h-full items-center justify-center bg-transparent"><Spinner size="lg" /></div>}>
                        {appState === 'cambodia_map' ? (
                            <CambodiaMapPage />
                        ) : appState === 'order_metadata' ? (
                            <OrderMetadataView orderId={new URLSearchParams(window.location.search).get('id') || ''} />
                        ) : appState === 'print_label' ? (
                            <PrintLabelPage />
                        ) : appState === 'confirm_delivery' ? (
                            <DeliveryAgentView orderIds={confirmIds} returnOrderIds={returnIds} failedOrderIds={failedIdsParam} storeName={confirmStore} />
                        ) : appState === 'watch' ? (
                            <div id="app-main-scroll-container" className="flex-grow overflow-y-auto w-full h-full">
                                <NetflixEntertainment guestMovieId={selectedMovieId} />
                            </div>
                        ) : appState === 'admin_dashboard' ? (
                            <div className="flex-grow overflow-hidden relative flex flex-col h-full w-full">
                                 {originalAdminUser && <ImpersonationBanner />}
                                 <AdminDashboard />
                                 {!isMobileMenuOpen && <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}
                            </div>
                        ) : (currentUser || appState === 'series_player' || appState === 'long_player' || appState === 'short_player') && appState !== 'login' ? (
                            <div className="flex flex-col h-full w-full overflow-hidden">
                                {originalAdminUser && <ImpersonationBanner />}
                                {shouldShowHeader && <Header appState={appState} onBackToRoleSelect={() => setAppState('role_selection')} />}
                                <main className={`flex-grow overflow-hidden relative flex flex-col ${appState === 'role_selection' || (appState === 'user_journey' && !selectedTeam) ? 'bg-transparent' : ''}`}>
                                    <div id="app-main-scroll-container" className={`flex-grow ${appState === 'fulfillment' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} ${containerClass} ${paddingClass} transition-all duration-300`}>
                                        {appState === 'user_journey' && <UserJourney onBackToRoleSelect={() => setAppState('role_selection')} />}
                                        {appState === 'create_order' && <CreateOrderPage team={selectedTeam} onSaveSuccess={() => setAppState('user_journey')} onCancel={() => setAppState('user_journey')} />}
                                        {appState === 'fulfillment' && <FulfillmentPage />}
                                        {appState === 'entertainment' && <NetflixEntertainment />}
                                        {appState === 'series_player' && <SeriesPlayerPage />}
                                        {appState === 'long_player' && <LongFilmPlayerPage />}
                                        {appState === 'short_player' && <ShortFilmPlayerPage />}
                                        {appState === 'role_selection' && (
                                            <RoleSelectionPage onSelect={(s) => {
                                                if (s === 'user_journey') setSelectedTeam('');
                                                setAppState(s as any);
                                            }} />
                                        )}
                                    </div>
                                </main>
                                {!isMobileMenuOpen && <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}
                            </div>
                        ) : (
                            <LoginPage onLoginSuccess={() => setAppState('role_selection')} />
                        )}
                    </Suspense>
                    
                    {advancedSettings.enableFloatingAlerts && (
                        <NotificationStack notifications={notifications} onRemove={removeNotification} />
                    )}

                    {previewImageUrl && (
                        <Modal isOpen={true} onClose={() => setPreviewImageUrl(null)} maxWidth="max-w-5xl" zIndex="z-[300]">
                            <div className="relative bg-transparent h-[85vh] flex flex-col p-4 w-full" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 z-50 w-10 h-10 bg-red-600/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl transition-all border border-white/20 active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                                
                                {previewImageUrl.includes('drive.google.com') ? (
                                    <iframe 
                                        src={convertGoogleDriveUrl(previewImageUrl, 'preview')} 
                                        className="w-full h-full rounded-xl border-0 bg-black/20"
                                        allow="autoplay"
                                        title="Preview"
                                    />
                                ) : (
                                    <div className="flex-1 flex items-center justify-center overflow-hidden">
                                        <img src={previewImageUrl} className="max-h-full max-w-full object-contain rounded-xl shadow-2xl" alt="Preview" />
                                    </div>
                                )}
                            </div>
                        </Modal>
                    )}
                </div>
            </div>
        </AppContext.Provider>
    );
};

const App: React.FC = () => {
    return (
        <UIProvider>
            <UserProvider>
                <OrderProvider>
                    <AppContent />
                </OrderProvider>
            </UserProvider>
        </UIProvider>
    );
};

export default App;
