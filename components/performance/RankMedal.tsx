
import React from 'react';

const RankMedal: React.FC<{ rank: number }> = ({ rank }) => {
    const styles = {
        1: { emoji: '🥇', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-500', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.4)]' },
        2: { emoji: '🥈', bg: 'bg-gray-300/20', border: 'border-gray-300/50', text: 'text-gray-300', glow: 'shadow-[0_0_15px_rgba(209,213,219,0.3)]' },
        3: { emoji: '🥉', bg: 'bg-orange-600/20', border: 'border-orange-600/50', text: 'text-orange-600', glow: 'shadow-[0_0_15px_rgba(234,88,12,0.3)]' },
    }[rank as 1|2|3];

    if (styles) {
        return (
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${styles.bg} ${styles.border} ${styles.text} ${styles.glow} border-2 animate-bounce-slow`}>
                <span className="text-xl">{styles.emoji}</span>
            </div>
        );
    }
    return (
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-800 border border-gray-700 text-gray-500 font-black text-sm italic">
            #{rank}
        </div>
    );
};

export default RankMedal;
