
import React, { useState } from 'react';
import { AppData, ParsedOrder } from '../../../types';
import SearchableProvinceDropdown from '../SearchableProvinceDropdown';
import ShippingMethodDropdown from '../../common/ShippingMethodDropdown';
import SearchablePageDropdown from '../../common/SearchablePageDropdown';
import DriverSelector from '../DriverSelector';
import Modal from '../../common/Modal';
import { convertGoogleDriveUrl } from '../../../utils/fileUtils';

interface EditCustomerPanelProps {
    formData: ParsedOrder;
    appData: AppData;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    onPageSelect: (val: string) => void;
    onProvinceSelect: (val: string) => void;
    onDistrictChange: (val: string) => void;
    onSangkatChange: (val: string) => void;
    onShippingMethodSelect: (method: any) => void;
    onDriverSelect: (driverName: string) => void;
    onBankChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    selectedDistrict: string;
    selectedSangkat: string;
    bankLogo: string;
}

const EditCustomerPanel: React.FC<EditCustomerPanelProps> = ({
    formData, appData, onChange, onPageSelect, onProvinceSelect, onDistrictChange, onSangkatChange,
    onShippingMethodSelect, onDriverSelect, onBankChange,
    selectedDistrict, selectedSangkat, bankLogo
}) => {
    const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);

    // Derived state for dropdowns based on appData and current selection
    const provinces = [...new Set(appData.locations.map((loc: any) => loc.Province))];
    const districts = [...new Set(appData.locations.filter((loc: any) => loc.Province === formData.Location).map((loc: any) => loc.District))].sort();
    const sangkats = [...new Set(appData.locations.filter((loc: any) => loc.Province === formData.Location && loc.District === selectedDistrict).map((loc: any) => loc.Sangkat))].sort();
    
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

    const carrierLogo = React.useMemo(() => {
        const phoneNumber = formData['Customer Phone'] || '';
        if (phoneNumber.length < 2 || !appData.phoneCarriers) return '';
        const foundCarrier = appData.phoneCarriers.find((carrier: any) => 
            (carrier.Prefixes || '').split(',').some((prefix: string) => phoneNumber.startsWith(prefix.trim()))
        );
        return foundCarrier ? convertGoogleDriveUrl(foundCarrier.CarrierLogoURL) : '';
    }, [formData['Customer Phone'], appData.phoneCarriers]);

    return (
        <div className="flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar pr-1 pb-20 lg:pb-2">
            {/* Customer Info Card */}
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-sm p-4 flex-shrink-0">
                <h3 className="text-[11px] font-medium text-[#848E9C] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <div className="w-1 h-3 bg-[#FCD535] rounded-sm"></div>
                    Customer Information
                </h3>
                <div className="space-y-3 relative z-10">
                    <div className="mb-3">
                        <SearchablePageDropdown 
                            pages={appData.pages.filter(p => p.Team === formData.Team)} 
                            selectedPageName={formData.Page || ''} 
                            onSelect={(page) => onPageSelect(page.PageName)} 
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">Customer Name</label>
                            <input type="text" name="Customer Name" value={formData['Customer Name'] || ''} onChange={onChange} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm py-2 px-3 text-sm text-[#EAECEF] placeholder-[#474D57] focus:border-[#FCD535] outline-none transition-colors" placeholder="Name" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">Phone Number</label>
                            <div className="relative">
                                <input type="tel" name="Customer Phone" value={formData['Customer Phone'] || ''} onChange={onChange} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm py-2 px-3 font-mono text-sm text-[#EAECEF] placeholder-[#474D57] focus:border-[#FCD535] outline-none transition-colors pr-10" placeholder="012345678" required />
                                <div className="absolute right-3 top-0 bottom-0 flex items-center justify-center pointer-events-none">
                                    {carrierLogo && <img src={carrierLogo} alt="Carrier" className="h-5 w-auto object-contain opacity-70" />}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                        <div className="space-y-1">
                            <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">Province / Location</label>
                            <SearchableProvinceDropdown provinces={provinces} selectedProvince={formData.Location || ''} onSelect={onProvinceSelect} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">District</label>
                                <select value={selectedDistrict} onChange={(e) => onDistrictChange(e.target.value)} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm py-2 px-2 text-[11px] font-medium text-[#EAECEF] outline-none focus:border-[#FCD535] disabled:opacity-50" disabled={!formData.Location}>
                                    <option value="">Select District</option>
                                    {districts.map((d: string) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">Sangkat</label>
                                <select value={selectedSangkat} onChange={(e) => onSangkatChange(e.target.value)} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm py-2 px-2 text-[11px] font-medium text-[#EAECEF] outline-none focus:border-[#FCD535] disabled:opacity-50" disabled={!selectedDistrict}>
                                    <option value="">Select Sangkat</option>
                                    {sangkats.map((s: string) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">Address Details</label>
                            <input type="text" name="Address Details" value={formData['Address Details'] || ''} onChange={onChange} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm py-2 px-3 text-[11px] text-[#EAECEF] placeholder-[#474D57] focus:border-[#FCD535] outline-none transition-colors" placeholder="House #, Street..." />
                        </div>
                    </div>
                </div>
            </div>

            {/* Logistics & Payment Card */}
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-sm p-4 flex-shrink-0">
                <h3 className="text-[11px] font-medium text-[#848E9C] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <div className="w-1 h-3 bg-[#FCD535] rounded-sm"></div>
                    Logistics & Payment
                </h3>
                <div className="space-y-3 relative z-10">
                    <div className="space-y-1">
                        <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">Shipping Method</label>
                        <ShippingMethodDropdown methods={appData.shippingMethods || []} selectedMethodName={formData['Internal Shipping Method'] || ''} onSelect={onShippingMethodSelect} />
                    </div>
                    
                    {currentShippingMethod?.RequireDriverSelection && (
                        <div className="space-y-2 pt-1 border-t border-[#2B3139]">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-medium text-[#848E9C] uppercase ml-1">Driver Selection</label>
                                {!formData['Internal Shipping Details'] && <span className="text-[9px] text-[#F6465D] font-bold">* Required</span>}
                            </div>
                            
                            <div 
                                onClick={() => setIsDriverModalOpen(true)}
                                className={`
                                    relative p-2 rounded-sm border transition-all cursor-pointer flex items-center gap-3
                                    ${selectedDriver 
                                        ? 'bg-[#0B0E11] border-[#2B3139] hover:border-[#FCD535]' 
                                        : 'bg-[#0B0E11] border-[#F6465D]/30 border-dashed hover:border-[#F6465D]/60'}
                                `}
                            >
                                {selectedDriver ? (
                                    <>
                                        <img 
                                            src={convertGoogleDriveUrl(selectedDriver.ImageURL)} 
                                            alt={selectedDriver.DriverName}
                                            className="w-10 h-10 rounded-sm object-cover border border-[#2B3139]" 
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[#EAECEF] font-bold text-[12px] truncate">{selectedDriver.DriverName}</p>
                                            <p className="text-[9px] text-[#848E9C] font-medium uppercase tracking-wider">Tap to change</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full py-1.5 flex items-center justify-center gap-2 text-[#848E9C] hover:text-[#EAECEF]">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        <span className="font-bold text-[11px] uppercase tracking-wider">Select Driver</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                            <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">Internal Cost ($)</label>
                            <input type="text" inputMode="decimal" name="Internal Cost" value={formData['Internal Cost']} onChange={onChange} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm py-2 px-3 text-[#FCD535] font-bold text-sm text-center outline-none focus:border-[#FCD535]" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-[#848E9C] font-medium uppercase ml-1">Payment Status</label>
                            <select name="Payment Status" value={formData['Payment Status']} onChange={onChange} className={`w-full py-2 px-2 rounded-sm font-bold text-[11px] uppercase outline-none transition-colors border ${formData['Payment Status'] === 'Paid' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/20' : 'bg-[#F6465D]/10 text-[#F6465D] border-[#F6465D]/20'}`}>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Paid">Paid</option>
                            </select>
                        </div>
                    </div>

                    {formData['Payment Status'] === 'Paid' && (
                        <div className="flex items-center gap-3 bg-[#0B0E11] p-2 rounded-sm border border-[#2B3139]">
                            <select value={formData['Payment Info']} onChange={onBankChange} className="bg-transparent border-none text-[11px] font-bold flex-grow text-[#EAECEF] focus:ring-0 outline-none">
                                <option value="">Select Bank...</option>
                                {filteredBanks.map((b: any) => <option key={b.BankName} value={b.BankName}>{b.BankName}</option>)}
                            </select>
                            {bankLogo && <img src={bankLogo} className="w-8 h-8 object-contain bg-[#1E2329] p-1 rounded-sm border border-[#2B3139]" alt="" />}
                        </div>
                    )}
                </div>
            </div>

            {/* Note Input Card */}
            <div className="bg-[#1E2329] border border-[#2B3139] rounded-sm p-4 flex-shrink-0">
                <textarea name="Note" value={formData.Note || ''} onChange={onChange} rows={2} className="w-full bg-[#0B0E11] border border-[#2B3139] rounded-sm text-[11px] font-medium p-3 text-[#EAECEF] placeholder-[#474D57] outline-none focus:border-[#FCD535] resize-none" placeholder="Add a note..." />
            </div>

            {/* Driver Selection Modal */}
            {isDriverModalOpen && (
                <Modal isOpen={true} onClose={() => setIsDriverModalOpen(false)} maxWidth="max-w-2xl">
                    <div className="p-4 bg-[#1E2329] rounded-sm border border-[#2B3139]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-[#EAECEF] flex items-center gap-2">
                                <div className="w-1 h-4 bg-[#FCD535] rounded-sm"></div>
                                Select Driver
                            </h3>
                            <button onClick={() => setIsDriverModalOpen(false)} className="p-1 text-[#848E9C] hover:text-[#EAECEF]">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
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

export default EditCustomerPanel;
