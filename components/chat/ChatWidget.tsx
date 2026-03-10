
import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { ChatMessage, User, BackendChatMessage } from '../../types';
import Spinner from '../common/Spinner';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { compressImage } from '../../utils/imageCompressor';
import { WEB_APP_URL, SOUND_URLS, NOTIFICATION_SOUNDS } from '../../constants';
import AudioPlayer from './AudioPlayer';
import { fileToBase64, convertGoogleDriveUrl } from '../../utils/fileUtils';
import UserAvatar from '../common/UserAvatar';
import ChatMembers from './ChatMembers';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';
import { getTimestamp } from '../../utils/dateUtils';

interface ChatWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type ActiveTab = 'chat' | 'users';

const MemoizedAudioPlayer = React.memo(AudioPlayer);

const ChatWidget: React.FC<ChatWidgetProps> = ({ isOpen, onClose }) => {
    const { currentUser, appData, previewImage, setUnreadCount, showNotification, advancedSettings } = useContext(AppContext);
    const CACHE_KEY = useMemo(() => currentUser ? `chatHistoryCache_${currentUser.UserName}` : null, [currentUser]);

    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingIntervalRef = useRef<any>(null);

    const soundNotification = useRef<HTMLAudioElement | null>(null);
    const soundSent = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        soundNotification.current = new Audio(SOUND_URLS.NOTIFICATION);
        soundSent.current = new Audio(SOUND_URLS.SENT);
    }, []);

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        if (!CACHE_KEY) return [];
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached && cached !== "undefined") {
                const parsed = JSON.parse(cached) as ChatMessage[];
                return parsed.slice(-20); 
            }
            return [];
        } catch (e) { return []; }
    });

    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isUsersLoading, setIsUsersLoading] = useState(false);
    
    const [newMessage, setNewMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSendingAudio, setIsSendingAudio] = useState(false);
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('chatMuted') === 'true');
    const [isHistoryLoading, setIsHistoryLoading] = useState(false); 
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const isOpenRef = useRef(isOpen);
    
    const isMutedRef = useRef(isMuted);
    const lastNotifiedMessageIdRef = useRef<string | null>(null);
    const archivedMessagesRef = useRef<ChatMessage[]>([]);
    const fetchInProgressRef = useRef(false);
    const hasScrolledToBottomRef = useRef(false);
    const isUserAtBottomRef = useRef(true);
    const prevMessagesLengthRef = useRef(messages.length);

    const pinnedMessages = useMemo(() => messages.filter(m => m.isPinned && !m.isDeleted), [messages]);

    useEffect(() => {
        if (CACHE_KEY && archivedMessagesRef.current.length === 0) {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached && cached !== "undefined") {
                    const parsed = JSON.parse(cached) as ChatMessage[];
                    if (parsed.length > 20) archivedMessagesRef.current = parsed.slice(0, -20);
                }
            } catch (e) {}
        }
    }, [CACHE_KEY]);

    useEffect(() => {
        const soundId = advancedSettings?.notificationSound || 'default';
        const soundObj = NOTIFICATION_SOUNDS.find(s => s.id === soundId) || NOTIFICATION_SOUNDS[0];
        const volume = advancedSettings?.notificationVolume ?? 1.0;
        if (soundNotification.current) { soundNotification.current.src = soundObj.url; soundNotification.current.volume = volume; }
        if (soundSent.current) { soundSent.current.volume = volume; }
    }, [advancedSettings?.notificationSound, advancedSettings?.notificationVolume]);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

    const syncUsers = useCallback(async () => {
        if (appData.users?.length) { setAllUsers(appData.users); return; }
        setIsUsersLoading(true);
        try {
            const res = await fetch(`${WEB_APP_URL}/api/users`);
            const json = await res.json();
            if (json.status === 'success') setAllUsers(json.data);
        } catch (e) { console.warn("User fetch failed", e); }
        finally { setIsUsersLoading(false); }
    }, [appData.users]);

    useEffect(() => { syncUsers(); }, [syncUsers]);

    const handleStartRecording = async () => {
        await startRecording();
        setRecordingTime(0);
        recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    };

    const handleCancelRecording = async () => {
        await stopRecording(); 
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        setRecordingTime(0);
    };

    const handleStopAndSendAudio = async () => {
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        setIsSendingAudio(true);
        try {
            const audioBlob = await stopRecording();
            if (!audioBlob) throw new Error("No audio captured");
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                await handleSendMessage(base64data, 'audio');
                setIsSendingAudio(false);
                setRecordingTime(0);
            };
        } catch (e) {
            setIsSendingAudio(false);
            setRecordingTime(0);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const setAndCacheMessages = useCallback((updater: React.SetStateAction<ChatMessage[]>) => {
        setMessages(prev => {
            const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
            if (CACHE_KEY) {
                const fullHistory = [...archivedMessagesRef.current, ...next];
                localStorage.setItem(CACHE_KEY, JSON.stringify(fullHistory.slice(-500)));
            }
            return next;
        });
    }, [CACHE_KEY]);

    const transformBackendMessage = useCallback((msg: BackendChatMessage): ChatMessage => {
        const user = appData.users?.find(u => u.UserName === msg.UserName);
        const normalizedType = (msg.MessageType || 'text').toLowerCase();
        let contentUrl = msg.Content;
        let duration = undefined;

        if ((normalizedType === 'audio' || normalizedType === 'video') && msg.FileID) {
             contentUrl = `${WEB_APP_URL}/api/chat/${normalizedType}/${msg.FileID}`;
             duration = msg.Content; 
        } else if (normalizedType === 'image') {
             contentUrl = convertGoogleDriveUrl(msg.Content);
        }

        return {
            id: msg.Timestamp,
            user: msg.UserName,
            fullName: user?.FullName || msg.UserName,
            avatar: user?.ProfilePictureURL || '',
            content: contentUrl,
            timestamp: msg.Timestamp,
            type: normalizedType as any,
            fileID: msg.FileID,
            duration: duration,
            isOptimistic: false,
            isDeleted: msg.IsDeleted,
            isPinned: msg.IsPinned,
            replyTo: msg.ReplyTo ? {
                id: msg.ReplyTo.ID,
                user: msg.ReplyTo.User,
                content: msg.ReplyTo.Content,
                type: msg.ReplyTo.Type
            } : undefined
        };
    }, [appData.users]); 

    const processNotifications = useCallback((sortedMessages: ChatMessage[]) => {
        if (sortedMessages.length === 0) return;
        const lastId = lastNotifiedMessageIdRef.current;
        let newMessages: ChatMessage[] = [];
        const now = Date.now();
        const recencyThreshold = 2 * 60 * 1000;

        if (!lastId) {
             lastNotifiedMessageIdRef.current = sortedMessages[sortedMessages.length - 1].id;
             return;
        }

        const lastIndex = sortedMessages.findIndex(m => m.id === lastId);
        if (lastIndex !== -1) newMessages = sortedMessages.slice(lastIndex + 1);
        else newMessages = sortedMessages.filter(m => m.id > lastId);

        newMessages.forEach(msg => {
            if (msg.user === currentUser?.UserName) return;
            const msgTime = getTimestamp(msg.timestamp);
            if (now - msgTime > recencyThreshold) return;

            if (!isMutedRef.current && soundNotification.current) {
                soundNotification.current.currentTime = 0;
                soundNotification.current.play().catch(() => {});
            }
            if (document.hidden || !isOpenRef.current) {
                sendSystemNotification(msg.fullName || msg.user, msg.type === 'text' ? msg.content : `Sent a ${msg.type}`);
                if (!isOpenRef.current) setUnreadCount(p => p + 1);
            }
        });

        if (newMessages.length > 0) lastNotifiedMessageIdRef.current = newMessages[newMessages.length - 1].id;
    }, [currentUser, setUnreadCount]);

    const fetchHistory = useCallback(async (forceFull = false, isScrollTriggered = false) => {
        if (fetchInProgressRef.current) return;
        fetchInProgressRef.current = true;
        const container = chatBodyRef.current;
        const previousScrollHeight = container ? container.scrollHeight : 0;
        
        try {
            const url = forceFull ? `${WEB_APP_URL}/api/chat/messages` : `${WEB_APP_URL}/api/chat/messages?limit=20`;
            const res = await fetch(url);
            const result = await res.json();
            if (result.status === 'success') {
                const history = result.data.map(transformBackendMessage);
                const sortedHistory = history.sort((a: ChatMessage, b: ChatMessage) => getTimestamp(a.timestamp) - getTimestamp(b.timestamp));
                
                setAndCacheMessages(prev => {
                    const seenIds = new Set();
                    const combined = [...prev, ...sortedHistory].filter(m => {
                        if (seenIds.has(m.id)) return false;
                        seenIds.add(m.id);
                        return true;
                    }).sort((a, b) => getTimestamp(a.timestamp) - getTimestamp(b.timestamp));
                    return combined;
                });

                if (isScrollTriggered && container) {
                    requestAnimationFrame(() => {
                        container.scrollTop = container.scrollHeight - previousScrollHeight;
                    });
                }
            }
        } catch (e) {} finally { fetchInProgressRef.current = false; }
    }, [transformBackendMessage, setAndCacheMessages]);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior });
    };

    useEffect(() => {
        let ws: WebSocket | null = null;
        
        const connectWS = async () => {
            const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
            const host = WEB_APP_URL.replace(/^https?:\/\//, '');
            
            // Get token for authentication
            const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
            const token = session?.token ? encodeURIComponent(session.token) : '';
            
            ws = new WebSocket(`${protocol}://${host}/api/chat/ws?token=Bearer%20${token}`);
            wsRef.current = ws;

            ws.onopen = () => { 
                setConnectionStatus('connected'); 
                fetchHistory(); 
            };

            ws.onmessage = (e) => {
                const data = JSON.parse(e.data);
                
                // 1. ករណីមានសារថ្មីចូល (អាចជាអក្សរ ឬរូបភាព Base64)
                if (data.action === 'new_message') {
                    const msg = transformBackendMessage(data.payload);
                    setAndCacheMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
                    processNotifications([msg]);
                    if (isUserAtBottomRef.current) setTimeout(() => scrollToBottom('smooth'), 100);
                }
                
                // 2. ករណី Backend Upload រូបភាពទៅ Drive ចប់ (ប្តូរពី Base64 មកប្រើ URL ផ្លូវការ)
                if (data.action === 'upload_complete') {
                    const payload = data.payload; // រួមមាន Message ID, FileID និង Content (URL ថ្មី)
                    setAndCacheMessages(prev => prev.map(m => {
                        // ឆែករកសារដែលត្រូវប្តូរតាមរយៈ ID ឬ Timestamp
                        if (m.id === payload.Timestamp || m.id === String(payload.id)) {
                            return {
                                ...m,
                                content: convertGoogleDriveUrl(payload.Content),
                                fileID: payload.FileID,
                                isOptimistic: false // បញ្ជាក់ថាជារូបភាពពិតប្រាកដក្នុង Server
                            };
                        }
                        return m;
                    }));
                }
            };

            ws.onclose = () => {
                setConnectionStatus('disconnected');
                // Reconnect after 5 seconds if still open
                if (isOpenRef.current) {
                    setTimeout(connectWS, 5000);
                }
            };
        };

        connectWS();
        return () => { if (ws) ws.close(); };
    }, [fetchHistory, transformBackendMessage, setAndCacheMessages, processNotifications]);

    const handleScroll = () => {
        if (!chatBodyRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        isUserAtBottomRef.current = isAtBottom;
        setShowScrollBottom(!isAtBottom);

        if (scrollTop < 10 && !isLoadingOlder && !fetchInProgressRef.current) {
            if (archivedMessagesRef.current.length > 0) {
                setIsLoadingOlder(true);
                const prevH = scrollHeight;
                setTimeout(() => {
                    const chunk = archivedMessagesRef.current.splice(-20);
                    setAndCacheMessages(prev => [...chunk, ...prev]);
                    requestAnimationFrame(() => { if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight - prevH; });
                    setIsLoadingOlder(false);
                }, 300);
            }
        }
    };

    useEffect(() => {
        if (isOpen && !hasScrolledToBottomRef.current) {
            scrollToBottom('auto');
            hasScrolledToBottomRef.current = true;
        }
    }, [isOpen]);

    // Handle auto-scroll on new messages ONLY if user is at bottom
    useEffect(() => {
        if (messages.length > prevMessagesLengthRef.current) {
            if (isUserAtBottomRef.current) scrollToBottom('smooth');
        }
        prevMessagesLengthRef.current = messages.length;
    }, [messages]);

    const handleSendMessage = async (content: string, type: 'text' | 'image' | 'audio') => {
        if (!content.trim() && type === 'text') return;
        try {
            const payload = { UserName: currentUser?.UserName, MessageType: type.charAt(0).toUpperCase() + type.slice(1), Content: content };
            if (replyingTo) (payload as any).ReplyTo = { ID: replyingTo.id, User: replyingTo.fullName, Content: replyingTo.content, Type: replyingTo.type };
            
            await fetch(`${WEB_APP_URL}/api/chat/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (type === 'text') setNewMessage('');
            setReplyingTo(null);
            isUserAtBottomRef.current = true;
            scrollToBottom('smooth');
            if (!isMuted) { soundSent.current?.play().catch(() => {}); }
        } catch (e) { alert("បញ្ជូនសារបរាជ័យ"); }
    };

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const compressed = await compressImage(file);
            const base64 = await fileToBase64(compressed);
            await handleSendMessage(base64, 'image');
        } catch (e) { alert("បញ្ជូនរូបភាពបរាជ័យ"); }
        finally { setIsUploading(false); }
    };

    return (
        <div className={`chat-widget-container ${!isOpen ? 'closed' : ''}`}>
            <div className="chat-header">
                <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500 animate-pulse'}`}></div>
                    <h3 className="font-black text-white uppercase text-sm">Team Chat</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { setIsMuted(!isMuted); localStorage.setItem('chatMuted', String(!isMuted)); }} className="p-2 text-gray-400 hover:text-white">{isMuted ? '🔇' : '🔔'}</button>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-400">&times;</button>
                </div>
            </div>
            
            <div className="chat-tabs bg-gray-900/50 p-1 flex">
                <button onClick={() => setActiveTab('chat')} className={`flex-1 text-xs font-bold py-2 rounded-lg ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Chat</button>
                <button onClick={() => setActiveTab('users')} className={`flex-1 text-xs font-bold py-2 rounded-lg ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>Members</button>
            </div>

            <div className="chat-body custom-scrollbar bg-[#0f172a] h-[450px] overflow-y-auto relative" ref={chatBodyRef} onScroll={handleScroll}>
                {activeTab === 'chat' ? (
                    <div className="p-4 space-y-6">
                        {isLoadingOlder && <div className="text-center text-[10px] text-gray-500 py-2">Loading older...</div>}
                        {messages.map((msg, i) => {
                            const isMe = msg.user === currentUser?.UserName;
                            const showAvatar = i === 0 || messages[i - 1].user !== msg.user;
                            return (
                                <div key={msg.id + i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group/msg relative`}>
                                    <div className={`flex max-w-[85%] gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                        <div className="w-8 flex-shrink-0 flex flex-col justify-end">
                                            {showAvatar && <UserAvatar avatarUrl={msg.avatar} name={msg.fullName} size="sm" />}
                                        </div>
                                        <div className={`relative px-4 py-2.5 rounded-2xl shadow-lg ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm border border-white/5'}`}>
                                            {msg.replyTo && <div className="mb-2 p-2 bg-black/20 rounded-lg border-l-2 border-blue-400 text-[10px] opacity-70 truncate"><b>{msg.replyTo.user}</b>: {msg.replyTo.content}</div>}
                                            {!isMe && showAvatar && <p className="text-[10px] font-black text-blue-400 mb-1 uppercase">{msg.fullName}</p>}
                                            {msg.type === 'text' && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                                            {msg.type === 'image' && <img src={msg.content} className="rounded-xl max-w-full" onClick={() => previewImage(msg.content)} />}
                                            {msg.type === 'audio' && <MemoizedAudioPlayer src={msg.content} duration={msg.duration} isMe={isMe} />}
                                            <p className="text-[9px] opacity-50 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                            {!isMe && <button onClick={() => setReplyingTo(msg)} className="absolute top-0 -right-8 opacity-0 group-hover/msg:opacity-100 p-1 bg-gray-900 rounded-lg text-gray-400 hover:text-white transition-all">↩️</button>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                ) : <ChatMembers users={allUsers} loading={isUsersLoading} />}
            </div>

            {activeTab === 'chat' && (
                <div className="p-3 bg-gray-900 border-t border-gray-800 relative">
                    {replyingTo && (
                        <div className="flex items-center justify-between bg-gray-800 p-2 mb-2 rounded-lg text-xs animate-fade-in-up">
                            <span className="truncate">Replying to <b>{replyingTo.fullName}</b></span>
                            <button onClick={() => setReplyingTo(null)}>&times;</button>
                        </div>
                    )}
                    {isRecording ? (
                        <div className="flex items-center justify-between bg-red-500/10 p-2 rounded-2xl border border-red-500/50 animate-pulse">
                            <span className="text-red-500 font-mono text-sm ml-2">Recording {formatTime(recordingTime)}</span>
                            <div className="flex gap-2">
                                <button onClick={handleCancelRecording} className="p-2 text-gray-400">Cancel</button>
                                <button onClick={handleStopAndSendAudio} className="p-2 bg-blue-600 text-white rounded-full">Send</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-blue-400">📷</button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => e.target.files && handleFileUpload(e.target.files[0])} />
                            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(newMessage, 'text'))} placeholder="Type a message..." className="flex-grow bg-gray-800 text-white rounded-2xl py-2 px-4 text-sm resize-none focus:ring-1 focus:ring-blue-500 border-none" rows={1} />
                            {newMessage.trim() ? <button onClick={() => handleSendMessage(newMessage, 'text')} className="p-2 bg-blue-600 text-white rounded-xl">➤</button> : <button onClick={handleStartRecording} className="p-2 bg-gray-800 text-gray-400 rounded-xl hover:text-red-500">🎤</button>}
                        </div>
                    )}
                </div>
            )}
            
            {showScrollBottom && (
                <button 
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-24 right-6 w-10 h-10 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center animate-bounce z-30"
                >
                    ↓
                </button>
            )}
        </div>
    );
};

export default ChatWidget;
