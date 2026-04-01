import React, { useState, useContext } from 'react';
import { AppContext } from '@/context/AppContext';
import Spinner from '@/components/common/Spinner';
import FulfillmentDashboard from '@/pages/FulfillmentDashboard';
import PackagingView from '@/pages/PackagingView';
import DriverDeliveryView from '@/pages/DriverDeliveryView';
import InventoryManagement from '@/components/admin/InventoryManagement';
import DeliveryListGeneratorModal from '@/components/orders/DeliveryListGeneratorModal';

/**
 * Industrial Terminal Theme
 * Clean, High-density, Professional
 */
const themeVars: React.CSSProperties = {
    '--t-bg': '#0B0E11',
    '--t-surface': '#1E2329',
    '--t-surface-alt': '#2B3139',
    '--t-border': '#2B3139',
    '--t-text': '#EAECEF',
    '--t-muted': '#848E9C',
    '--t-accent': '#FCD535',
    '--t-success': '#0ECB81',
    '--t-danger': '#F6465D',
    '--t-radius': '2px',
} as React.CSSProperties;

const FulfillmentPage: React.FC = () => {
    const { orders, isOrdersLoading, appData } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<'hub' | 'pack' | 'ship' | 'stock'>('pack');
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

    if (isOrdersLoading && orders.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0B0E11]">
                <div className="w-10 h-10 border-2 border-[#FCD535] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="terminal-root flex flex-col h-full overflow-hidden" style={themeVars}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800&display=swap');

                .terminal-root {
                    font-family: 'Inter', sans-serif;
                    background: var(--t-bg);
                    color: var(--t-text);
                }

                .t-nav-strip {
                    height: 40px;
                    background: var(--t-surface);
                    border-bottom: 1px solid var(--t-border);
                    display: flex;
                    padding: 0 12px;
                    gap: 4px;
                }

                .t-nav-btn {
                    height: 100%;
                    padding: 0 16px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: var(--t-muted);
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    transition: all 0.15s;
                    border-bottom: 2px solid transparent;
                }

                .t-nav-btn:hover {
                    color: var(--t-text);
                    background: rgba(255,255,255,0.02);
                }

                .t-nav-btn.active {
                    color: var(--t-accent);
                    border-bottom-color: var(--t-accent);
                }

                .t-sys-info {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding-right: 8px;
                }

                .t-pill {
                    font-family: 'Roboto Mono', monospace;
                    font-size: 10px;
                    color: var(--t-muted);
                }

                main {
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                }

                .t-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
                .t-scroll::-webkit-scrollbar-track { background: var(--t-bg); }
                .t-scroll::-webkit-scrollbar-thumb { background: var(--t-surface-alt); }
            `}</style>

            {/* Subtle Top Navigation Strip (Replaces Header) */}
            <div className="t-nav-strip">
                {[
                    { id: 'pack', label: 'Packaging' },
                    { id: 'hub', label: 'Operations Hub' },
                    { id: 'ship', label: 'Outbound' },
                    { id: 'stock', label: 'Inventory' }
                ].map(tab => (
                    <div 
                        key={tab.id}
                        className={`t-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id as any)}
                    >
                        {tab.label}
                    </div>
                ))}

                <div className="t-sys-info hidden sm:flex">
                    <div className="t-pill flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0ECB81]"></div>
                        CORE_READY
                    </div>
                    <div className="t-pill font-bold text-[#FCD535]">
                        REF: {new Date().toLocaleTimeString('km-KH', { hour12: false })}
                    </div>
                </div>
            </div>

            <main className="flex-1 overflow-hidden flex flex-col">
                {activeTab === 'hub' && <FulfillmentDashboard orders={orders} onOpenDeliveryList={() => setIsDeliveryModalOpen(true)} />}
                {activeTab === 'pack' && <PackagingView orders={orders} />}
                {activeTab === 'ship' && <DriverDeliveryView onOpenDeliveryList={() => setIsDeliveryModalOpen(true)} />}
                {activeTab === 'stock' && <InventoryManagement />}
            </main>

            <DeliveryListGeneratorModal 
                isOpen={isDeliveryModalOpen} 
                onClose={() => setIsDeliveryModalOpen(false)} 
                orders={orders} 
                appData={appData} 
            />
        </div>
    );
};

export default FulfillmentPage;
