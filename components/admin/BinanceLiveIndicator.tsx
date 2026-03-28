import React from 'react';

interface BinanceLiveIndicatorProps {
    isSyncing?: boolean;
    language?: 'en' | 'km';
}

const BinanceLiveIndicator: React.FC<BinanceLiveIndicatorProps> = ({ isSyncing = false, language = 'en' }) => {
    if (isSyncing) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#FCD535]/10 border border-[#FCD535]/20 text-[9px] font-semibold text-[#FCD535] uppercase tracking-widest" style={{ borderRadius: '2px' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FCD535] animate-pulse" />
                {language === 'km' ? 'កំពុងធ្វើសមកាលកម្ម...' : 'Syncing...'}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0ECB81]/10 border border-[#0ECB81]/20 text-[9px] font-semibold text-[#0ECB81] uppercase tracking-widest" style={{ borderRadius: '2px' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#0ECB81] animate-pulse" />
            {language === 'km' ? 'ប្រព័ន្ធដំណើរការល្អ' : 'System Online'}
        </div>
    );
};

export default BinanceLiveIndicator;
