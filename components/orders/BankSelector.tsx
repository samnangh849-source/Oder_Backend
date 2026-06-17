
import React from 'react';
import { BankAccount } from '../../types';
import { convertGoogleDriveUrl } from '../../utils/fileUtils';

interface BankSelectorProps {
    bankAccounts: BankAccount[];
    selectedBankName: string;
    onSelect: (bankName: string) => void;
    fulfillmentStore?: string;
}

const BankSelector: React.FC<BankSelectorProps> = ({ bankAccounts, selectedBankName, onSelect, fulfillmentStore }) => {
    const filteredBanks = React.useMemo(() => {
        if (!bankAccounts) return [];
        if (!fulfillmentStore) return bankAccounts;

        return bankAccounts.filter((bank) => {
            const assignedStores = bank.AssignedStores || '';
            // If empty or undefined, show to all
            if (!assignedStores || assignedStores.trim() === '') return true;
            
            const storesList = assignedStores.split(',').map((s) => s.trim().toLowerCase());
            const currentStore = fulfillmentStore.trim().toLowerCase();
            
            return storesList.includes(currentStore) || storesList.includes('all');
        });
    }, [bankAccounts, fulfillmentStore]);

    if (!filteredBanks || filteredBanks.length === 0) {
        return (
            <div className="p-4 text-center border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">No Bank Accounts Available for {fulfillmentStore || 'this store'}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 animate-fade-in-down">
            {filteredBanks.map((bank) => {
                const isSelected = selectedBankName === bank.BankName;
                
                return (
                    <button
                        key={bank.BankName}
                        type="button"
                        onClick={() => onSelect(bank.BankName)}
                        className={`
                            relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all duration-200 group
                            ${isSelected 
                                ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.2)]' 
                                : 'bg-gray-900/60 border-gray-700 hover:border-gray-500 hover:bg-gray-800'}
                        `}
                    >
                        {/* Logo */}
                        <div className={`
                            w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center bg-white p-1 mb-2 sm:mb-3 transition-transform duration-300
                            ${isSelected ? 'scale-110 shadow-lg' : 'grayscale group-hover:grayscale-0'}
                        `}>
                            {bank.LogoURL ? (
                                <img 
                                    src={convertGoogleDriveUrl(bank.LogoURL)} 
                                    alt={bank.BankName} 
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                            )}
                        </div>

                        {/* Name */}
                        <span className={`
                            text-[10px] font-black uppercase tracking-wider text-center leading-tight
                            ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}
                        `}>
                            {bank.BankName}
                        </span>

                        {/* Checkmark Badge */}
                        {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-md animate-scale-in">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default BankSelector;
