
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

    return (
        <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar pr-2 pb-20 lg:pb-2">
            {/* Customer Info Card */}
            <div className="bg-gray-800/40 border border-white/5 rounded-[2rem] p-5 shadow-lg relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <svg className="w-24 h-24 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                </div>
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.25em] mb-4 relative z-10 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                    ព័ត៌មានអតិថិជន
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
                        <input type="text" name="Customer Name" value={formData['Customer Name'] || ''} onChange={onChange} className="form-input !py-3.5 bg-gray-900/80 border-gray-700 rounded-xl font-bold text-sm text-white placeholder-gray-600 focus:border-blue-500" placeholder="ឈ្មោះអតិថិជន" required />
                        <input type="tel" name="Customer Phone" value={formData['Customer Phone'] || ''} onChange={onChange} className="form-input !py-3.5 bg-gray-900/80 border-gray-700 rounded-xl font-mono font-black text-sm text-blue-300 placeholder-gray-600 focus:border-blue-500" placeholder="លេខទូរស័ព្ទ" required />
                    </div>
                    
                    <div className="space-y-3 pt-2">
                        <SearchableProvinceDropdown provinces={provinces} selectedProvince={formData.Location || ''} onSelect={onProvinceSelect} />
                        <div className="grid grid-cols-2 gap-3">
                            <select value={selectedDistrict} onChange={(e) => onDistrictChange(e.target.value)} className="form-select bg-gray-900/80 border-gray-700 rounded-xl text-xs font-bold text-gray-300 h-12" disabled={!formData.Location}>
                                <option value="">ស្រុក/ខណ្ឌ</option>
                                {districts.map((d: string) => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select value={selectedSangkat} onChange={(e) => onSangkatChange(e.target.value)} className="form-select bg-gray-900/80 border-gray-700 rounded-xl text-xs font-bold text-gray-300 h-12" disabled={!selectedDistrict}>
                                <option value="">ឃុំ/សង្កាត់</option>
                                {sangkats.map((s: string) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <input type="text" name="Address Details" value={formData['Address Details'] || ''} onChange={onChange} className="form-input !py-3.5 bg-gray-900/80 border-gray-700 rounded-xl text-xs font-bold text-white placeholder-gray-600 focus:border-blue-500" placeholder="ផ្ទះលេខ, ផ្លូវ..." />
                    </div>
                </div>
            </div>

            {/* Logistics & Payment Card */}
            <div className="bg-gray-800/40 border border-white/5 rounded-[2rem] p-5 shadow-lg relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <svg className="w-24 h-24 text-orange-500" fill="currentColor" viewBox="0 0 24 24"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                </div>
                <h3 className="text-xs font-black text-orange-400 uppercase tracking-[0.25em] mb-4 relative z-10 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                    ដឹកជញ្ជូន & ទូទាត់
                </h3>
                <div className="space-y-4 relative z-10">
                    <ShippingMethodDropdown methods={appData.shippingMethods || []} selectedMethodName={formData['Internal Shipping Method'] || ''} onSelect={onShippingMethodSelect} />
                    
                    {currentShippingMethod?.RequireDriverSelection && (
                        <div className="space-y-3 pt-2 border-t border-white/5 animate-fade-in">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">ជ្រើសរើសអ្នកដឹក</label>
                                {!formData['Internal Shipping Details'] && <span className="text-[9px] text-red-400 font-bold animate-pulse">* Required</span>}
                            </div>
                            
                            <div 
                                onClick={() => setIsDriverModalOpen(true)}
                                className={`
                                    relative p-3 rounded-2xl border transition-all cursor-pointer group flex items-center gap-4 shadow-lg
                                    ${selectedDriver 
                                        ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-blue-500/30 hover:border-blue-500/50' 
                                        : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10 border-dashed'}
                                `}
                            >
                                {selectedDriver ? (
                                    <>
                                        <img 
                                            src={convertGoogleDriveUrl(selectedDriver.ImageURL)} 
                                            alt={selectedDriver.DriverName}
                                            className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-sm" 
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-black text-sm truncate">{selectedDriver.DriverName}</p>
                                            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider mt-0.5">Driver Selected</p>
                                        </div>
                                        <div className="bg-black/40 p-2.5 rounded-xl border border-white/10 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-colors text-gray-500 shadow-inner">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full py-2 flex items-center justify-center gap-3 text-gray-500 group-hover:text-red-400 transition-colors">
                                        <span className="bg-gray-800 p-2 rounded-full border border-gray-700 group-hover:border-red-500/50 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                        </span>
                                        <span className="font-bold text-xs uppercase tracking-wider">Tap to Select Driver</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="relative group">
                            <label className="text-[8px] font-black text-gray-500 uppercase absolute -top-2 left-2 bg-[#161f32] px-1 group-focus-within:text-orange-400 transition-colors">Cost ($)</label>
                            <input type="text" inputMode="decimal" name="Internal Cost" value={formData['Internal Cost']} onChange={onChange} className="form-input !py-2.5 !px-3 bg-gray-900/80 border-gray-700 rounded-xl font-black text-orange-400 text-sm text-center focus:border-orange-500" />
                        </div>
                        <div className="relative group">
                            <label className="text-[8px] font-black text-gray-500 uppercase absolute -top-2 left-2 bg-[#161f32] px-1 group-focus-within:text-white transition-colors">Status</label>
                            <select name="Payment Status" value={formData['Payment Status']} onChange={onChange} className={`form-select !py-2.5 !px-2 rounded-xl font-black text-xs uppercase border-none w-full ${formData['Payment Status'] === 'Paid' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'bg-red-900/40 text-red-400 border border-red-500/20'}`}>
                                <option value="Unpaid">Unpaid</option>
                                <option value="Paid">Paid</option>
                            </select>
                        </div>
                    </div>

                    {formData['Payment Status'] === 'Paid' && (
                        <div className="flex items-center gap-3 animate-fade-in bg-black/30 p-2 rounded-2xl border border-white/5">
                            <select value={formData['Payment Info']} onChange={onBankChange} className="form-select bg-transparent border-none text-xs font-bold flex-grow text-white focus:ring-0">
                                <option value="">Select Bank...</option>
                                {filteredBanks.map((b: any) => <option key={b.BankName} value={b.BankName}>{b.BankName}</option>)}
                            </select>
                            {bankLogo && <img src={bankLogo} className="w-10 h-10 object-contain bg-white/10 p-1 rounded-xl border border-white/10" alt="" />}
                        </div>
                    )}
                </div>
            </div>

            {/* Note Input Card */}
            <div className="bg-gray-800/40 border border-white/5 rounded-[2rem] p-5 shadow-lg mt-auto flex-shrink-0">
                <textarea name="Note" value={formData.Note || ''} onChange={onChange} rows={3} className="form-textarea bg-gray-900/80 border-gray-700 rounded-xl text-xs font-bold w-full resize-none text-gray-300 placeholder-gray-600 focus:border-blue-500" placeholder="ចំណាំ..." />
            </div>

            {/* Driver Selection Modal */}
            {isDriverModalOpen && (
                <Modal isOpen={true} onClose={() => setIsDriverModalOpen(false)} maxWidth="max-w-3xl">
                    <div className="p-6 sm:p-8 bg-[#0f172a] rounded-[2.5rem] border border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                                Select Driver
                            </h3>
                            <button onClick={() => setIsDriverModalOpen(false)} className="w-10 h-10 rounded-2xl bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-all hover:bg-gray-700 active:scale-90">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 bg-black/20 rounded-3xl p-2 border border-white/5">
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
