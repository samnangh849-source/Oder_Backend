
import React from 'react';
import { User } from '../../types';
import UserAvatar from '../common/UserAvatar';

interface ChatMembersProps {
    users: User[];
    loading: boolean;
    onRefresh: () => void;
}

const ChatMembers: React.FC<ChatMembersProps> = ({ users, loading, onRefresh }) => {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-gray-500">Loading members...</span>
            </div>
        );
    }

    if (!users || users.length === 0) {
        return (
            <div className="text-center text-gray-500 py-10 flex flex-col items-center">
                <p className="text-xs uppercase tracking-widest mb-2">(No members found)</p>
                <button 
                    onClick={onRefresh}
                    className="text-[10px] text-blue-400 hover:text-white underline"
                >
                    Retry Loading
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-3 animate-fade-in">
            {users.map(u => (
                <div key={u.UserName} className="flex items-center gap-4 p-3 rounded-2xl bg-gray-800/40 border border-white/5 hover:bg-gray-800 transition-colors cursor-default group">
                    <UserAvatar avatarUrl={u.ProfilePictureURL} name={u.FullName} size="md" className="ring-2 ring-blue-500/20 group-hover:ring-blue-500/50 transition-all" />
                    <div>
                        <p className="text-sm font-black text-white">{u.FullName}</p>
                        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">@{u.UserName}</p>
                    </div>
                    <div className={`ml-auto flex flex-col items-end gap-1`}>
                        <div className={`w-2 h-2 rounded-full ${u.IsSystemAdmin ? 'bg-yellow-500 shadow-[0_0_5px_#eab308]' : 'bg-blue-500 shadow-[0_0_5px_#3b82f6]'}`}></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ChatMembers;
