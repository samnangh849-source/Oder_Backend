import React, { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { User, AppData, ParsedOrder } from './types';
import { WEB_APP_URL } from './constants';
import { useUrlState } from './hooks/useUrlState';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import Spinner from './components/common/Spinner';
import Modal from './components/common/Modal';
import { AppContext, Language } from './context/AppContext';
import BackgroundMusic from './components/common/BackgroundMusic';
import { CacheService, CACHE_KEYS } from './services/cacheService';
import NotificationStack from './components/common/NotificationStack';
import { UIProvider, useUI } from './context/UIContext';
import { UserProvider, useUser } from './context/UserContext';
import { OrderProvider, useOrders } from './context/OrderContext';

// Retry helper for lazy loading components
const lazyRetry = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  name: string
): React.LazyExoticComponent<T> => {
  return React.lazy(async () => {
    try {
      return await importFn();
    } catch (error: any) {
      console.error(`Failed to load ${name}:`, error);
      if (error.message?.includes('dynamically imported module') || error.message?.includes('Importing a module script failed')) {
        const storageKey = `retry_load_${name}`;
        const hasRetried = sessionStorage.getItem(storageKey);
        if (!hasRetried) {
          sessionStorage.setItem(storageKey, 'true');
          window.location.reload();
          return new Promise(() => {});
        }
      }
      throw error;
    }
  });
};

const LoginPage = lazyRetry(() => import('./pages/LoginPage'), 'LoginPage');
const RoleSelectionPage = lazyRetry(() => import('./pages/RoleSelectionPage'), 'RoleSelectionPage');
const AdminDashboard = lazyRetry(() => import('./pages/AdminDashboard'), 'AdminDashboard');
const UserJourney = lazyRetry(() => import('./pages/UserJourney'), 'UserJourney');
const CreateOrderPage = lazyRetry(() => import('./pages/CreateOrderPage'), 'CreateOrderPage');
const DeliveryAgentView = lazyRetry(() => import('./components/orders/DeliveryAgentView'), 'DeliveryAgentView');
const FulfillmentPage = lazyRetry(() => import('./pages/FulfillmentPage'), 'FulfillmentPage');
const Header = lazyRetry(() => import('./components/common/Header'), 'Header');
const ImpersonationBanner = lazyRetry(() => import('./components/common/ImpersonationBanner'), 'ImpersonationBanner');
const ChatWidget = lazyRetry(() => import('./components/chat/ChatWidget'), 'ChatWidget');

const AppContent: React.FC = () => {
    const { 
        language, setLanguage, isSidebarCollapsed, setIsSidebarCollapsed,
        isMobileMenuOpen, setIsMobileMenuOpen, unreadCount, setUnreadCount,
        mobilePageTitle, setMobilePageTitle, advancedSettings, setAdvancedSettings,
        isChatOpen, setIsChatOpen, isChatVisible, setChatVisibility,
        showNotification, notifications, removeNotification
    } = useUI();

    const { 
        currentUser, setCurrentUser, originalAdminUser, setOriginalAdminUser,
        hasPermission, logout: userLogout 
    } = useUser();

    const { 
        orders, setOrders, appData, setAppData,
        isOrdersLoading, setIsOrdersLoading,
        isGlobalLoading, setIsGlobalLoading,
        refreshTimestamp, setRefreshTimestamp
    } = useOrders();

    const [appState, setAppState] = useUrlState<'login' | 'role_selection' | 'admin_dashboard' | 'user_journey' | 'confirm_delivery' | 'fulfillment' | 'create_order'>('view', 'login');
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [selectedTeam, setSelectedTeam] = useUrlState<string>('team', '');
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    
    const workerRef = useRef<Worker | null>(null);
    const tokenRef = useRef<string | null>(null);
    const urlParams = new URLSearchParams(window.location.search);

    // Initialize Web Worker
    useEffect(() => {
        workerRef.current = new Worker(new URL('./services/dataWorker.ts', import.meta.url), { type: 'module' });
        return () => workerRef.current?.terminate();
    }, []);

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

    useOrderNotifications();

    const logout = useCallback(async () => {
        userLogout();
        tokenRef.current = null;
        setAppState('login');
        await CacheService.remove(CACHE_KEYS.SESSION);
        await CacheService.remove(CACHE_KEYS.APP_DATA);
        await CacheService.remove(CACHE_KEYS.ALL_ORDERS);
        setAppData({
            users: [], products: [], pages: [], locations: [],
            shippingMethods: [], drivers: [], bankAccounts: [],
            phoneCarriers: [], colors: [], stores: [], settings: [], targets: [],
            inventory: [], stockTransfers: [], returns: [],
            roles: [], permissions: [], orders: []
        });
        setOrders([]);
    }, [userLogout, setAppState, setAppData, setOrders]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = useCallback(async (force = false) => {
        if (!force) {
            const cachedData = await CacheService.get<AppData>(CACHE_KEYS.APP_DATA);
            if (cachedData) {
                setAppData(cachedData);
                setIsGlobalLoading(false);
            }
        }

        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || tokenRef.current;
            const headers: HeadersInit = {
                'Content-Type': 'application/json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Fetch both static-data and users in parallel for efficiency
            const [staticRes, usersRes] = await Promise.all([
                fetch(`${WEB_APP_URL}/api/static-data`, { headers }),
                fetch(`${WEB_APP_URL}/api/users`, { headers })
            ]);

            if (staticRes.ok) {
                const staticResult = await staticRes.json();
                const usersResult = usersRes.ok ? await usersRes.json() : { data: [] };

                if (staticResult.status === 'success') {
                    const rawData = staticResult.data || {};
                    const usersList = usersResult.status === 'success' ? usersResult.data : (rawData.users || rawData.Users || []);

                    setAppData(prev => {
                            // 1. NORMALIZE COLLECTIONS (Prevent 'roles' vs 'Roles' duplication)
                            const roles = rawData.roles || rawData.Roles || prev.roles || [];
                            const products = rawData.products || rawData.Products || prev.products || [];
                            const pages = rawData.pages || rawData.TeamsPages || rawData.Pages || prev.pages || [];
                            const permissions = rawData.rolePermissions || rawData.permissions || rawData.Permissions || prev.permissions || [];
                            const locations = rawData.locations || rawData.Locations || prev.locations || [];
                            const settings = rawData.settings || rawData.Settings || prev.settings || [];
                            const inventory = rawData.inventory || rawData.Inventory || prev.inventory || [];
                            const shippingMethods = rawData.shippingMethods || rawData.ShippingMethods || prev.shippingMethods || [];

                            // 2. ENSURE ADMIN ROLE EXISTS
                            const adminRoleExists = Array.isArray(roles) && roles.some((r: any) => (r.roleName || '').toLowerCase() === 'admin');
                            
                            if (!adminRoleExists) {
                                console.log("Admin role missing, creating automatically...");
                                const maxId = roles.reduce((max: number, r: any) => Math.max(max, Number(r.id) || 0), 0);
                                const newAdminRole = {
                                    id: maxId + 1,
                                    roleName: 'Admin',
                                    description: 'System Administrator with full access'
                                };
                                roles.push(newAdminRole);
                                
                                const syncAdminRole = async () => {
                                    try {
                                        const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
                                        const token = session?.token || tokenRef.current;
                                        if (token) {
                                            await fetch(`${WEB_APP_URL}/api/admin/roles`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                                body: JSON.stringify(newAdminRole)
                                            });
                                        }
                                    } catch (err) { console.error("Failed to auto-sync Admin role:", err); }
                                };
                                syncAdminRole();
                            }

                            // 3. BUILD CLEAN OBJECT (Overwriting old case-variations)
                            const processedData: AppData = {
                                ...prev,
                                ...rawData, // Keep other arbitrary metadata
                                users: usersList,
                                roles: roles,
                                products: products,
                                pages: pages,
                                permissions: permissions,
                                locations: locations,
                                settings: settings,
                                inventory: inventory,
                                shippingMethods: shippingMethods
                            };

                            // Force clean duplicate keys from the root object if they exist
                            const duplicateKeys = ['Roles', 'Products', 'TeamsPages', 'Pages', 'Permissions', 'RolePermissions', 'Locations', 'Settings', 'Inventory', 'ShippingMethods'];
                            duplicateKeys.forEach(k => { if (k in processedData && k.toLowerCase() in processedData) delete (processedData as any)[k]; });

                            CacheService.set(CACHE_KEYS.APP_DATA, processedData);
                            return processedData;
                        });
                }
            }
        } catch (e) {
            console.error("Data Fetch Error:", e);
        } finally {
            setIsGlobalLoading(false);
        }
    }, [setAppData, setIsGlobalLoading]);

    const fetchOrders = useCallback(async (force = false) => {
        if (!force) {
            const cachedOrders = await CacheService.get<ParsedOrder[]>(CACHE_KEYS.ALL_ORDERS);
            if (cachedOrders && Array.isArray(cachedOrders)) {
                setOrders(cachedOrders);
            }
        }

        if (orders.length === 0 || force) setIsOrdersLoading(true);
        try {
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token || tokenRef.current;
            const headers: HeadersInit = {
                'Content-Type': 'application/json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Try /api/admin/orders first, then fallback to /api/orders if not authorized or not found
            let endpoint = `${WEB_APP_URL}/api/admin/orders`;
            let response = await fetch(endpoint, { headers });
            
            if (response.status === 404 || response.status === 403 || response.status === 401) {
                endpoint = `${WEB_APP_URL}/api/orders`;
                response = await fetch(endpoint, { headers });
            }
            
            if (response.ok) {
                const result = await response.json();
                if (result.status === 'success' && workerRef.current) {
                    const rawData = (result.data || []).filter((o: any) => 
                        o !== null && 
                        o['Order ID'] !== 'Opening Balance' && 
                        o['Order ID'] !== 'Opening_Balance'
                    );
                    
                    workerRef.current.onmessage = async (e) => {
                        if (e.data.action === 'parseOrdersComplete') {
                            let parsed = e.data.payload.parsed || [];
                            setOrders(parsed);
                            await CacheService.set(CACHE_KEYS.ALL_ORDERS, parsed);
                            setIsOrdersLoading(false);
                        }
                    };
                    workerRef.current.postMessage({ action: 'parseOrders', payload: { rawData } });
                } else {
                    setIsOrdersLoading(false);
                }
            } else {
                if (response.status === 401) {
                    console.warn("Session expired during orders fetch");
                }
                setIsOrdersLoading(false);
            }
        } catch (e) {
            console.warn("Orders Fetch Error:", e);
            setIsOrdersLoading(false);
        }
    }, [orders.length, setOrders, setIsOrdersLoading]);

    const refreshData = useCallback(async () => {
        await Promise.all([fetchData(true), fetchOrders(true)]);
        setRefreshTimestamp(Date.now());
    }, [fetchData, fetchOrders, setRefreshTimestamp]);

    useEffect(() => {
        if (currentUser && appData.permissions?.length) {
            const userRoles = (currentUser.Role || '').split(',').map(r => r.trim());
            const rolePerms = appData.permissions.filter(p => userRoles.includes(p.role));
            const currentPermsStr = JSON.stringify(currentUser.Permissions || []);
            const newPermsStr = JSON.stringify(rolePerms);
            if (currentPermsStr !== newPermsStr) {
                setCurrentUser(prev => prev ? {...prev, Permissions: rolePerms} : null);
            }
        }
    }, [currentUser?.Role, appData.permissions, setCurrentUser]);

    useEffect(() => {
        if (currentUser) fetchOrders();
    }, [currentUser, fetchOrders]);

    // --- SESSION INITIALIZATION ---
    useEffect(() => {
        const initSession = async () => {
            try {
                const session = await CacheService.get<{ user: User, token: string, timestamp: number }>(CACHE_KEYS.SESSION);
                if (session && session.user) {
                    setCurrentUser(session.user);
                    if (session.token) tokenRef.current = session.token;
                    // Fetch fresh data in background
                    fetchData(false);
                    // Determine app state
                    setAppState('role_selection');
                } else {
                    // No session, still need to fetch static data for login page (languages etc)
                    await fetchData(false);
                }
            } catch (e) {
                console.warn("Session init error:", e);
            } finally {
                setIsGlobalLoading(false);
            }
        };
        initSession();
    }, [fetchData, setCurrentUser, setAppState, setIsGlobalLoading]);

    const login = async (user: User, token: string) => {
        setCurrentUser(user);
        tokenRef.current = token;
        await CacheService.set(CACHE_KEYS.SESSION, { user, token, timestamp: Date.now() });
        fetchData(true);
        setAppState('role_selection');
    };

    const shouldShowHeader = useMemo(() => {
        if (appState === 'login') return false;
        return true;
    }, [appState]);

    const containerClass = useMemo(() => 
        (appState === 'admin_dashboard' || appState === 'role_selection' || (appState === 'user_journey' && !selectedTeam)) ? 'w-full' : 'w-full px-2 sm:px-6', 
    [appState, selectedTeam]);

    const paddingClass = useMemo(() => {
        if (appState === 'login') return 'pt-0 pb-0';
        const basePadding = isMobile ? 'pt-20' : (appState === 'user_journey' || appState === 'create_order' || appState === 'role_selection' ? 'pt-16' : 'pt-24');
        return `${shouldShowHeader ? basePadding : 'pt-0'} pb-24 md:pb-8`;
    }, [appState, shouldShowHeader, isMobile]);

    // Use a memoized context value to provide compatibility for existing components
    const legacyContextValue = useMemo(() => ({
        currentUser, appData, orders, isOrdersLoading, login, logout, refreshData, refreshTimestamp,
        originalAdminUser, returnToAdmin: () => {}, previewImage: (u: string) => setPreviewImageUrl(u),
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
        currentUser, appData, orders, isOrdersLoading, login, logout, refreshData, refreshTimestamp,
        originalAdminUser, setUnreadCount, unreadCount, setAppState, setOriginalAdminUser,
        fetchData, fetchOrders, setCurrentUser, setChatVisibility, hasPermission,
        isSidebarCollapsed, setIsSidebarCollapsed, setIsChatOpen, isMobileMenuOpen, 
        setIsMobileMenuOpen, language, setLanguage, showNotification, mobilePageTitle, 
        setMobilePageTitle, advancedSettings, setAdvancedSettings, selectedTeam, setSelectedTeam
    ]);

    if (isGlobalLoading) return <div className="flex h-screen items-center justify-center bg-gray-950"><Spinner size="lg" /></div>;

    return (
        <AppContext.Provider value={legacyContextValue as any}>
            {/* GLOBAL PREMIUM BACKGROUND - Dynamic Viewport Fixed */}
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
                    ) : currentUser && appState !== 'login' ? (
                        <>
                            {originalAdminUser && <ImpersonationBanner />}
                            {shouldShowHeader && <Header appState={appState} onBackToRoleSelect={() => setAppState('role_selection')} />}
                            <main className={`${containerClass} ${paddingClass} transition-all duration-300 ${appState === 'fulfillment' ? 'h-full overflow-hidden' : 'h-full overflow-y-auto custom-scrollbar'} ${appState === 'role_selection' || (appState === 'user_journey' && !selectedTeam) ? 'bg-transparent' : ''}`}>
                                {appState === 'admin_dashboard' && <AdminDashboard />}
                                {appState === 'user_journey' && <UserJourney onBackToRoleSelect={() => setAppState('role_selection')} />}
                                {appState === 'create_order' && <CreateOrderPage team={selectedTeam} onSaveSuccess={() => setAppState('user_journey')} onCancel={() => setAppState('user_journey')} />}
                                {appState === 'fulfillment' && <FulfillmentPage />}
                                {appState === 'role_selection' && <RoleSelectionPage onSelect={(s) => setAppState(s as any)} />}
                            </main>
                            <ChatWidget isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
                        </>
                    ) : (
                        <LoginPage />
                    )}
                </Suspense>
                
                {advancedSettings.enableFloatingAlerts && (
                    <NotificationStack 
                        notifications={notifications} 
                        onRemove={removeNotification} 
                    />
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
