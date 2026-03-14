import React, { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { User, AppData, ParsedOrder } from './types';
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
import Header from './components/common/Header';
import Spinner from './components/common/Spinner';
import ChatWidget from './components/chat/ChatWidget';
import Modal from './components/common/Modal';
import DeliveryAgentView from './components/orders/DeliveryAgentView';
import NotificationStack from './components/common/NotificationStack';
import BackgroundMusic from './components/common/BackgroundMusic';
import ImpersonationBanner from './components/common/ImpersonationBanner';
import { AppContext, AdvancedSettings } from './context/AppContext';
import { UIProvider, useUI } from './context/UIContext';
import { UserProvider, useUser } from './context/UserContext';
import { OrderProvider, useOrder } from './context/OrderContext';
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
        orders, appData, isOrdersLoading, isSyncing, refreshTimestamp, fetchData, fetchOrders, refreshData
    } = useOrder();

    const [appState, setAppState] = useUrlState<'login' | 'user_journey' | 'admin_dashboard' | 'create_order' | 'fulfillment' | 'role_selection' | 'confirm_delivery'>('view', 'login');
    const [selectedTeam, setSelectedTeam] = useUrlState<string>('team', '');
    const [mobilePageTitle, setMobilePageTitle] = useState<string | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [language, setLanguage] = useState<'en' | 'km'>(() => (localStorage.getItem('language') as any) || 'km');
    const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(() => {
        const saved = localStorage.getItem('advancedSettings');
        return saved ? JSON.parse(saved) : { enableFloatingAlerts: true, enablePrivacyMode: false, notificationVolume: 0.5, notificationSound: 'default' };
    });

    const tokenRef = useRef<string | null>(null);
    const isMobile = window.innerWidth < 768;

    // --- SYNC SETTINGS ---
    useEffect(() => { localStorage.setItem('language', language); }, [language]);
    useEffect(() => { localStorage.setItem('advancedSettings', JSON.stringify(advancedSettings)); }, [advancedSettings]);

    // Handle initial state and auth
    useEffect(() => {
        if (!currentUser && appState !== 'login' && appState !== 'confirm_delivery') {
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
    useEffect(() => {
        if (currentUser && appData.permissions) {
            const rolePerms = appData.permissions.filter(p => p.role === currentUser.Role);
            if (rolePerms.length > 0) {
                // Check if perms actually changed before updating to prevent infinite loops
                const currentPermsStr = JSON.stringify(currentUser.Permissions || []);
                const nextPermsStr = JSON.stringify(rolePerms);
                if (currentPermsStr !== nextPermsStr) {
                    setCurrentUser(prev => prev ? { ...prev, Permissions: rolePerms } : null);
                }
            }
        }
    }, [currentUser?.Role, appData.permissions, currentUser?.Permissions, setCurrentUser]);

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
                    setCurrentUser(userWithPerms);
                    fetchData(false);
                    setAppState('role_selection');
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
        fetchData(true);
        setAppState('role_selection');
    };

    const setChatVisibility = useCallback((visible: boolean) => {
        // Implementation for chat visibility if needed
    }, []);

    const shouldShowHeader = useMemo(() => {
        if (appState === 'login' || appState === 'admin_dashboard' || appState === 'confirm_delivery') return false;
        return true;
    }, [appState]);

    const containerClass = useMemo(() => 
        (appState === 'admin_dashboard' || appState === 'role_selection' || (appState === 'user_journey' && !selectedTeam)) ? 'w-full' : 'w-full px-2 sm:px-6', 
    [appState, selectedTeam]);

    const paddingClass = useMemo(() => {
        if (appState === 'login' || appState === 'confirm_delivery') return 'pt-0 pb-0';
        
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
        setAppState, setOriginalAdminUser, fetchData, fetchOrders, setCurrentUser, setChatVisibility,
        hasPermission, updatePermission: async (role: string, feature: string, isEnabled: boolean) => {
            try {
                const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
                const token = session?.token || tokenRef.current;
                const headers: HeadersInit = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const response = await fetch(`${WEB_APP_URL}/api/admin/permissions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify([{ role, feature, isEnabled }])
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
        selectedTeam, setSelectedTeam
    }), [
        currentUser, appData, orders, isOrdersLoading, isSyncing, login, logout, refreshData, refreshTimestamp,
        originalAdminUser, setUnreadCount, unreadCount, setAppState, setOriginalAdminUser,
        fetchData, fetchOrders, setCurrentUser, setChatVisibility, hasPermission,
        isSidebarCollapsed, setIsSidebarCollapsed, setIsChatOpen, isMobileMenuOpen, 
        setIsMobileMenuOpen, language, setLanguage, showNotification, mobilePageTitle, 
        setMobilePageTitle, advancedSettings, setAdvancedSettings, selectedTeam, setSelectedTeam
    ]);

    if (isGlobalLoading) return <div className="flex h-screen items-center justify-center bg-[#020617]"><Spinner size="lg" /></div>;

    return (
        <AppContext.Provider value={legacyContextValue as any}>
            {/* GLOBAL PREMIUM BACKGROUND */}
            <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden pointer-events-none z-0 bg-[#020617]">
                <div className="absolute top-[-10%] left-[-10%] w-[100%] sm:w-[70%] h-[60%] sm:h-[70%] bg-blue-600/15 rounded-full blur-[80px] sm:blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[100%] sm:w-[60%] h-[60%] bg-indigo-600/15 rounded-full blur-[80px] sm:blur-[120px]" style={{ animationDelay: '3s' }}></div>
                <div className="absolute top-[20%] right-[10%] w-[50%] sm:w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[60px] sm:blur-[100px]" style={{ animationDelay: '1.5s' }}></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] mix-blend-overlay"></div>
            </div>

            <div className="relative z-10 flex flex-col h-[100dvh] w-full overflow-hidden">
                <BackgroundMusic />
                <Suspense fallback={<div className="flex h-full items-center justify-center bg-transparent"><Spinner size="lg" /></div>}>
                    {appState === 'confirm_delivery' ? (
                        <DeliveryAgentView orderIds={confirmIds} returnOrderIds={returnIds} failedOrderIds={failedIdsParam} storeName={confirmStore} />
                    ) : appState === 'admin_dashboard' ? (
                        <div className="flex-grow overflow-hidden relative flex flex-col h-full w-full">
                             {originalAdminUser && <ImpersonationBanner />}
                             <AdminDashboard />
                             {!isMobileMenuOpen && <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />}
                        </div>
                    ) : currentUser && appState !== 'login' ? (
                        <div className="flex flex-col h-full w-full overflow-hidden">
                            {originalAdminUser && <ImpersonationBanner />}
                            {shouldShowHeader && <Header appState={appState} onBackToRoleSelect={() => setAppState('role_selection')} />}
                            <main className={`flex-grow overflow-hidden relative flex flex-col ${appState === 'role_selection' || (appState === 'user_journey' && !selectedTeam) ? 'bg-transparent' : ''}`}>
                                <div className={`flex-grow overflow-y-auto custom-scrollbar ${containerClass} ${paddingClass} transition-all duration-300`}>
                                    {appState === 'user_journey' && <UserJourney onBackToRoleSelect={() => setAppState('role_selection')} />}
                                    {appState === 'create_order' && <CreateOrderPage team={selectedTeam} onSaveSuccess={() => setAppState('user_journey')} onCancel={() => setAppState('user_journey')} />}
                                    {appState === 'fulfillment' && <FulfillmentPage />}
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
                    <Modal isOpen={true} onClose={() => setPreviewImageUrl(null)} maxWidth="max-w-4xl">
                        <div className="relative p-2">
                            <button onClick={() => setPreviewImageUrl(null)} className="absolute top-4 right-4 z-50 w-10 h-10 bg-red-600/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-2xl transition-all border border-white/20 active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
                            <img src={previewImageUrl} className="max-h-[85vh] w-full object-contain rounded-xl" alt="Preview" />
                        </div>
                    </Modal>
                )}
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
