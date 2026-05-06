
import React, { useState } from 'react';
import { AppData, ParsedOrder } from '../../../types';
import ShippingMethodDropdown from '../../common/ShippingMethodDropdown';
import DriverSelector from '../DriverSelector';
import Modal from '../../common/Modal';
import { convertGoogleDriveUrl } from '../../../utils/fileUtils';

interface EditLogisticsPanelProps {
    formData: ParsedOrder;
    appData: AppData;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onShippingMethodSelect: (method: any) => void;
    onDriverSelect: (driverName: string) => void;
    onBankChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    bankLogo: string;
}

const EditLogisticsPanel: React.FC<EditLogisticsPanelProps> = ({
    formData, appData, onChange, onShippingMethodSelect, onDriverSelect, onBankChange, bankLogo
}) => {
    const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
    
    const currentShippingMethod = appData.shippingMethods?.find(m => m.MethodName === formData['Internal Shipping Method']);
    const selectedDriver = appData.drivers?.find(d => d.DriverName === formData['Internal Shipping Details']);

    const filteredBanks = React.useMemo(() => {
        if (!appData.bankAccounts) return [];
        const store = formData['Fulfillment Store'];
        if (!store) return appData.bankAccounts;
        
        return appData.bankAccounts.filter((bank: any) => {
            const assignedStores = bank.AssignedStores || '';
            if (!assignedStores || assignedStores.trim() === '') return true;
            const storesList = assignedStores.split(',').map((s: string) => s.trim().toLowerCase());
            return storesList.includes(store.toLowerCase()) || storesList.includes('all');
        });
    }, [appData.bankAccounts, formData['Fulfillment Store']]);

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* Logistics & Payment Card */}
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-xl p-5 flex-shrink-0 h-full shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-lg bg-[#FCD535]/10 flex items-center justify-center border border-[#FCD535]/20">
                        <svg className="w-5 h-5 text-[#FCD535]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[#EAECEF] uppercase tracking-wider">Logistics & Payment</h3>
                        <p className="text-[10px] text-[#848E9C] font-medium uppercase tracking-widest mt-0.5">Shipping and financial details</p>
                    </div>
                </div>

                <div className="space-y-6 relative z-10">
                    <div className="space-y-2">
                        <label className="text-[10px] text-[#848E9C] font-bold uppercase tracking-widest ml-1">Shipping Method</label>
                        <ShippingMethodDropdown methods={appData.shippingMethods || []} selectedMethodName={formData['Internal Shipping Method'] || ''} onSelect={onShippingMethodSelect} />
                    </div>
                    
                    {currentShippingMethod?.RequireDriverSelection && (
                        <div className="space-y-2 pt-4 border-t border-[#2B3139]">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-[#848E9C] uppercase tracking-widest ml-1">Selected Driver</label>
                                {!formData['Internal Shipping Details'] && <span className="text-[9px] text-[#F6465D] font-black animate-pulse">ACTION REQUIRED</span>}
                            </div>
                            
                            <div 
                                onClick={() => setIsDriverModalOpen(true)}
                                className={`
                                    relative p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-4
                                    ${selectedDriver 
                                        ? 'bg-[#0B0E11] border-[#2B3139] hover:border-[#FCD535] group' 
                                        : 'bg-[#0B0E11] border-[#F6465D]/30 border-dashed hover:border-[#F6465D]'}
                                `}
                            >
                                {selectedDriver ? (
                                    <>
                                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-[#2B3139] group-hover:border-[#FCD535] transition-all">
                                            <img 
                                                src={convertGoogleDriveUrl(selectedDriver.ImageURL)} 
                                                alt={selectedDriver.DriverName}
                                                className="w-full h-full object-cover" 
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[#EAECEF] font-bold text-sm truncate uppercase">{selectedDriver.DriverName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#2B3139] text-[#848E9C] font-bold uppercase">Active Driver</span>
                                                <span className="text-[9px] text-[#FCD535] font-bold">Tap to change</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full py-2 flex items-center justify-center gap-2 text-[#848E9C] hover:text-[#FCD535]">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                        <span className="font-bold text-xs uppercase tracking-widest">Assign Driver</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                            <label className="text-[10px] text-[#848E9C] font-bold uppercase tracking-widest ml-1">Internal Cost</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-sm font-bold text-[#474D57] group-focus-within:text-[#FCD535] transition-colors">$</span>
                                </div>
                                <input 
                                    type="text" 
                                    inputMode="decimal" 
                                    name="Internal Cost" 
                                    value={formData['Internal Cost']} 
                                    onChange={onChange} 
                                    className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-lg py-2.5 pl-7 pr-3 text-[#EAECEF] font-bold text-base outline-none focus:border-[#FCD535] transition-all" 
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] text-[#848E9C] font-bold uppercase tracking-widest ml-1">Payment Status</label>
                            <select 
                                name="Payment Status" 
                                value={formData['Payment Status']} 
                                onChange={onChange} 
                                className={`w-full py-2.5 px-3 rounded-lg font-bold text-xs uppercase outline-none transition-all border ${
                                    formData['Payment Status'] === 'Paid' 
                                    ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/30 focus:border-[#0ECB81]' 
                                    : 'bg-[#F6465D]/10 text-[#F6465D] border-[#F6465D]/30 focus:border-[#F6465D]'
                                } cursor-pointer`}
                            >
                                <option value="Unpaid">Unpaid</option>
                                <option value="Paid">Paid</option>
                            </select>
                        </div>
                    </div>

                    {formData['Payment Status'] === 'Paid' && (
                        <div className="space-y-3 pt-4 border-t border-[#2B3139] animate-fade-in">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] text-[#848E9C] font-bold uppercase tracking-widest">Receiving Bank</label>
                                <span className="text-[9px] font-bold text-[#FCD535] uppercase">{filteredBanks.length} Available</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                {filteredBanks.map((bank: any) => {
                                    const isSelected = formData['Payment Info'] === bank.BankName;
                                    return (
                                        <button
                                            key={bank.BankName}
                                            type="button"
                                            onClick={() => onBankChange({ target: { value: bank.BankName } } as any)}
                                            className={`
                                                group flex items-center gap-3 p-2.5 rounded-xl border transition-all
                                                ${isSelected 
                                                    ? 'bg-[#FCD535]/10 border-[#FCD535] shadow-[0_4px_12px_rgba(252,213,53,0.1)]' 
                                                    : 'bg-[#0B0E11] border-[#2B3139] hover:border-[#474D57]'}
                                            `}
                                        >
                                            <div className={`w-9 h-9 rounded-lg overflow-hidden bg-white/10 border transition-all ${isSelected ? 'border-[#FCD535]' : 'border-[#2B3139] group-hover:border-[#474D57]'}`}>
                                                <img src={convertGoogleDriveUrl(bank.LogoURL)} className="w-full h-full object-contain" alt="" />
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase truncate transition-colors ${isSelected ? 'text-[#FCD535]' : 'text-[#848E9C] group-hover:text-[#EAECEF]'}`}>
                                                {bank.BankName}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Driver Selection Modal */}
            {isDriverModalOpen && (
                <Modal isOpen={true} onClose={() => setIsDriverModalOpen(false)} maxWidth="max-w-2xl">
                    <div className="p-4 bg-[#1E2329] rounded-none border-2 border-[#FCD535]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-[#FCD535] uppercase tracking-tighter flex items-center gap-3">
                                <div className="w-2 h-6 bg-[#FCD535]"></div>
                                Select Driver
                            </h3>
                            <button onClick={() => setIsDriverModalOpen(false)} className="p-1 text-[#848E9C] hover:text-[#F6465D] transition-colors">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            <DriverSelector 
                                drivers={appData.drivers || []}
                                selectedDriverName={formData['Internal Shipping Details'] || ''}
                                onSelect={(name) => {
                                    onDriverSelect(name);
                                    setIsDriverModalOpen(false);
                                }}
                            />
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default EditLogisticsPanel;
