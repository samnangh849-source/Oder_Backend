import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '@/context/AppContext';
import { WEB_APP_URL } from '@/constants';
import Spinner from '@/components/common/Spinner';
import { ParsedOrder } from '@/types';
import FulfillmentDashboard from '@/pages/FulfillmentDashboard';
import PackagingView from '@/pages/PackagingView';
import DriverDeliveryView from '@/pages/DriverDeliveryView';
import InventoryManagement from '@/components/admin/InventoryManagement';
import DeliveryListGeneratorModal from '@/components/orders/DeliveryListGeneratorModal';

const FulfillmentPage: React.FC = () => {
    const { orders, isOrdersLoading, appData } = useContext(AppContext);
    const [activeSubView, setActiveSubView] = useState<'dashboard' | 'packaging' | 'delivery' | 'inventory'>('dashboard');
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);

    if (isOrdersLoading && orders.length === 0) {
        return <div className="flex h-screen items-center justify-center bg-[#0B0E11]"><Spinner size="lg" /></div>;
    }

    return (
        <div className="flex flex-col h-full relative bg-[#0B0E11] text-[#EAECEF] font-sans">
            {activeSubView === 'delivery' && (
                <div className="fixed top-20 right-6 z-[60] animate-reveal">
                    <button 
                        onClick={() => setIsDeliveryModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#FCD535] hover:bg-[#E5C02A] text-[#0B0E11] rounded-sm transition-all active:scale-95 group font-bold"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        <span className="text-[10px] uppercase tracking-wider">Delivery List</span>
                    </button>
                </div>
            )}

            <div className="flex-1 min-h-0 animate-reveal pb-16">
                {activeSubView === 'dashboard' && <FulfillmentDashboard orders={orders} onOpenDeliveryList={() => setIsDeliveryModalOpen(true)} />}
                {activeSubView === 'packaging' && <PackagingView orders={orders} />}
                {activeSubView === 'delivery' && <DriverDeliveryView onOpenDeliveryList={() => setIsDeliveryModalOpen(true)} />}
                {activeSubView === 'inventory' && <InventoryManagement />}
            </div>

            <DeliveryListGeneratorModal 
                isOpen={isDeliveryModalOpen} 
                onClose={() => setIsDeliveryModalOpen(false)} 
                orders={orders} 
                appData={appData} 
            />

            {/* Premium Floating Bottom Navigation - Binance Terminal Style */}
            <div className="fixed bottom-0 left-0 right-0 z-[70] border-t border-[#2B3139] bg-[#181A20]">
                <div className="w-full max-w-lg mx-auto flex items-center justify-between">
                    <button 
                        onClick={() => setActiveSubView('dashboard')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${activeSubView === 'dashboard' ? 'text-[#FCD535]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        <span className="text-[10px] font-medium">Ops Hub</span>
                        {activeSubView === 'dashboard' && <div className="absolute bottom-0 w-8 h-0.5 bg-[#FCD535]"></div>}
                    </button>
                    <button 
                        onClick={() => setActiveSubView('packaging')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${activeSubView === 'packaging' ? 'text-[#FCD535]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-[10px] font-medium">Pack</span>
                        {activeSubView === 'packaging' && <div className="absolute bottom-0 w-8 h-0.5 bg-[#FCD535]"></div>}
                    </button>
                    <button 
                        onClick={() => setActiveSubView('delivery')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${activeSubView === 'delivery' ? 'text-[#FCD535]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span className="text-[10px] font-medium">Ship</span>
                        {activeSubView === 'delivery' && <div className="absolute bottom-0 w-8 h-0.5 bg-[#FCD535]"></div>}
                    </button>
                    <button 
                        onClick={() => setActiveSubView('inventory')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${activeSubView === 'inventory' ? 'text-[#FCD535]' : 'text-[#848E9C] hover:text-[#EAECEF]'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                        <span className="text-[10px] font-medium">Stock</span>
                        {activeSubView === 'inventory' && <div className="absolute bottom-0 w-8 h-0.5 bg-[#FCD535]"></div>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FulfillmentPage;
