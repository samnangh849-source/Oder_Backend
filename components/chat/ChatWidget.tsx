import React, { useState, useContext, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';
import { ChatMessage, User, BackendChatMessage } from '../../types';
import { CacheService, CACHE_KEYS } from '../../services/cacheService';
import Spinner from '../common/Spinner';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { compressImage } from '../../utils/imageCompressor';
import { WEB_APP_URL, NOTIFICATION_SOUNDS } from '../../constants';
import AudioPlayer from './AudioPlayer';
import { fileToBase64, fileToDataUrl, convertGoogleDriveUrl } from '../../utils/fileUtils';
import UserAvatar from '../common/UserAvatar';
import ChatMembers from './ChatMembers';
import { requestNotificationPermission, sendSystemNotification } from '../../utils/notificationUtils';
import { getTimestamp } from '../../utils/dateUtils';
import { useSoundEffects } from '../../hooks/useSoundEffects';

interface ChatWidgetProps {
    isOpen: boolean;
    onClose: () => void;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type ActiveTab = 'chat' | 'users';

const MemoizedAudioPlayer = React.memo(AudioPlayer);

const ChatWidget: React.FC<ChatWidgetProps> = ({ isOpen, onClose }) => {
    const { currentUser, appData, previewImage, setUnreadCount, showNotification, advancedSettings, language, isOrdersLoading, isSyncing } = useContext(AppContext);
    const CACHE_KEY = useMemo(() => currentUser ? `chatHistoryCache_${currentUser.UserName}` : null, [currentUser]);

    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingIntervalRef = useRef<any>(null);

    const { playNotify, playClick } = useSoundEffects();

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        if (!CACHE_KEY) return [];
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached && cached !== "undefined") {
                const parsed = JSON.parse(cached) as ChatMessage[];
                return parsed.slice(-30); 
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
    const [pendingImage, setPendingImage] = useState<string | null>(null);
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

    useEffect(() => {
        if (CACHE_KEY && archivedMessagesRef.current.length === 0) {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached && cached !== "undefined") {
                    const parsed = JSON.parse(cached) as ChatMessage[];
                    if (parsed.length > 30) archivedMessagesRef.current = parsed.slice(0, -30);
                }
            } catch (e) {}
        }
    }, [CACHE_KEY]);

    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

    const syncUsers = useCallback(async () => {
        if (appData.users?.length) { setAllUsers(appData.users); return; }
        setIsUsersLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${WEB_APP_URL}/api/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.status === 'success') setAllUsers(json.data);
        } catch (e) { console.warn("User fetch failed", e); }
        finally { setIsUsersLoading(false); }
    }, [appData.users]);

    useEffect(() => { syncUsers(); }, [syncUsers]);

    const handleStartRecording = async () => {
        try {
            await startRecording();
            setRecordingTime(0);
            recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (e) { showNotification("Microphone Access Denied", "error"); }
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
                const durationStr = formatTime(recordingTime);
                await handleSendMessage(base64data, 'audio', durationStr);
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
        const user = appData.users?.find(u => (u.UserName || '').toLowerCase() === (msg.UserName || '').toLowerCase());
        const normalizedType = (msg.MessageType || 'text').toLowerCase();
        let contentUrl = msg.Content || '';
        let duration = undefined;

        if (normalizedType === 'audio' && msg.FileID) {
             contentUrl = `${WEB_APP_URL}/api/chat/audio/${msg.FileID}`;
             duration = msg.Content; 
        } else if (normalizedType === 'image') {
             if (!contentUrl && msg.FileID) {
                 // Use thumbnail API which is more reliable for public/shared files
                 contentUrl = `https://drive.google.com/thumbnail?id=${msg.FileID}&sz=w1000`;
             }
             contentUrl = contentUrl.startsWith('http') ? (contentUrl.includes('drive.google.com/uc?') ? convertGoogleDriveUrl(contentUrl) : contentUrl) : convertGoogleDriveUrl(contentUrl);
        }

        return {
            id: msg.Timestamp || String(Date.now()),
            backendId: msg.id,
            user: msg.UserName,
            fullName: user?.FullName || msg.UserName,
            avatar: user?.ProfilePictureURL || '',
            content: contentUrl,
            timestamp: msg.Timestamp || new Date().toISOString(),
            type: normalizedType as any,
            fileID: msg.FileID,
            duration: duration,
            isOptimistic: false,
            isDeleted: (msg as any).IsDeleted || false,
            isPinned: (msg as any).IsPinned || false,
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

            if (!isMutedRef.current) {
                playNotify();
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
            const token = localStorage.getItem('token');
            const url = forceFull ? `${WEB_APP_URL}/api/chat/messages` : `${WEB_APP_URL}/api/chat/messages?limit=30`;
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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

    const handlersRef = useRef({ fetchHistory, transformBackendMessage, setAndCacheMessages, processNotifications });
    useEffect(() => {
        handlersRef.current = { fetchHistory, transformBackendMessage, setAndCacheMessages, processNotifications };
    }, [fetchHistory, transformBackendMessage, setAndCacheMessages, processNotifications]);

    useEffect(() => {
        if (!currentUser) return;
        let ws: WebSocket | null = null;
        let isDisposed = false;
        
        const connectWS = async () => {
            if (isDisposed) return;
            // Use wss if the backend URL is https, otherwise follow frontend protocol
            const protocol = WEB_APP_URL.startsWith('https') ? 'wss' : (window.location.protocol === 'https:' ? 'wss' : 'ws');
            const host = WEB_APP_URL.replace(/^https?:\/\//, '');
            
            try {
                const session = await CacheService.get<{ token: string }>(CACHE_KEYS.SESSION);
                const token = session?.token || localStorage.getItem('token') || '';
                
                ws = new WebSocket(`${protocol}://${host}/api/chat/ws?token=${encodeURIComponent(token)}`);
                wsRef.current = ws;

                ws.onopen = () => { 
                    if (isDisposed) { ws?.close(); return; }
                    setConnectionStatus('connected'); 
                    handlersRef.current.fetchHistory(); 
                };

                ws.onmessage = (e) => {
                    if (isDisposed) return;
                    try {
                        const data = JSON.parse(e.data);
                        const type = data.type || data.Type || data.action || data.Action;
                        const payload = data.data || data.payload || data.Payload || data;

                        if (type === 'new_message' || type === 'NEW_MESSAGE') {
                            const msg = handlersRef.current.transformBackendMessage(payload);
                            handlersRef.current.setAndCacheMessages(prev => {
                                const optimisticIndex = prev.findIndex(m => 
                                    m.isOptimistic && (m.user || '').toLowerCase() === (msg.user || '').toLowerCase() &&
                                    ((m.type === 'text' && m.content.trim() === msg.content.trim()) || (m.type !== 'text' && m.type === msg.type))
                                );
                                if (optimisticIndex !== -1) {
                                    const next = [...prev];
                                    next[optimisticIndex] = msg;
                                    return next;
                                }
                                if (prev.some(m => m.id === msg.id)) return prev;
                                return [...prev, msg];
                            });
                            handlersRef.current.processNotifications([msg]);
                            if (isUserAtBottomRef.current) setTimeout(() => scrollToBottom('smooth'), 100);
                        }
                        
                        if (type === 'upload_complete' || type === 'UPLOAD_COMPLETE') {
                            const messageId = payload.message_id || payload.messageId;
                            const url = payload.url;
                            const fileId = payload.file_id || payload.fileId;
                            
                            if (messageId) {
                                handlersRef.current.setAndCacheMessages(prev => prev.map(m => {
                                    if (String(m.id) === String(messageId)) {
                                        return {
                                            ...m,
                                            content: url || m.content,
                                            fileID: fileId || m.fileID,
                                            isOptimistic: false
                                        };
                                    }
                                    return m;
                                }));
                            }
                        }
                    } catch (err) {}
                };

                ws.onclose = () => {
                    if (isDisposed) return;
                    setConnectionStatus('disconnected');
                    setTimeout(connectWS, 5000);
                };

                ws.onerror = () => ws?.close();
            } catch (err) { setTimeout(connectWS, 5000); }
        };

        connectWS();
        return () => { isDisposed = true; if (ws) ws.close(); };
    }, [currentUser?.UserName]);

    const handleScroll = () => {
        if (!chatBodyRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
        isUserAtBottomRef.current = isAtBottom;
        setShowScrollBottom(!isAtBottom);

        if (scrollTop < 10 && !isLoadingOlder && !fetchInProgressRef.current) {
            if (archivedMessagesRef.current.length > 0) {
                setIsLoadingOlder(true);
                const prevH = scrollHeight;
                setTimeout(() => {
                    const chunk = archivedMessagesRef.current.splice(-30);
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

    useEffect(() => {
        if (messages.length > prevMessagesLengthRef.current && isUserAtBottomRef.current) {
            scrollToBottom('smooth');
        }
        prevMessagesLengthRef.current = messages.length;
    }, [messages]);

    const handleSendMessage = async (content: string, type: 'text' | 'image' | 'audio', duration?: string) => {
        if (!content.trim() && type === 'text') return;
        
        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: ChatMessage = {
            id: tempId,
            user: currentUser?.UserName || '',
            fullName: currentUser?.FullName || '',
            avatar: currentUser?.ProfilePictureURL || '',
            content: content,
            timestamp: new Date().toISOString(),
            type: type,
            isOptimistic: true,
            duration: duration,
            replyTo: replyingTo ? { id: replyingTo.id, user: replyingTo.fullName, content: replyingTo.content, type: replyingTo.type } : undefined
        };

        setAndCacheMessages(prev => [...prev, optimisticMsg]);
        if (type === 'text') setNewMessage('');
        const wasAtBottom = isUserAtBottomRef.current;
        setReplyingTo(null);
        if (wasAtBottom) setTimeout(() => scrollToBottom('smooth'), 50);

        try {
            const token = localStorage.getItem('token');
            const payload: any = { UserName: currentUser?.UserName, MessageType: type.charAt(0).toUpperCase() + type.slice(1), Content: content };
            if (type === 'audio' && duration) { payload.Content = duration; payload.AudioData = content; }
            if (replyingTo) payload.ReplyTo = { ID: replyingTo.id, User: replyingTo.fullName, Content: replyingTo.content, Type: replyingTo.type };
            
            const res = await fetch(`${WEB_APP_URL}/api/chat/send`, { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }, 
                body: JSON.stringify(payload) 
            });
            if (!res.ok) throw new Error("Send failed");
            if (!isMuted) { playClick(); }
        } catch (e) { 
            setAndCacheMessages(prev => prev.map(m => m.id === tempId ? { ...m, isError: true } : m));
            showNotification(language === 'km' ? "ផ្ញើសារមិនចូល" : "Message failed to send", "error"); 
        }
    };

    const handleFileSelect = async (file: File) => {
        setIsUploading(true);
        try {
            const compressed = await compressImage(file, 'balanced');
            const dataUrl = await fileToDataUrl(compressed);
            setPendingImage(dataUrl);
        } catch (e) { alert("Image error"); } 
        finally { setIsUploading(false); }
    };

    const handleSendPendingImage = async () => {
        if (!pendingImage) return;
        setIsUploading(true);
        try {
            await handleSendMessage(pendingImage, 'image');
            setPendingImage(null);
        } catch (e) {} 
        finally { setIsUploading(false); }
    };

    const handleImageError = useCallback(async (msg: ChatMessage) => {
        if (!msg.content?.includes('/images/temp/') || !msg.backendId) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${WEB_APP_URL}/api/chat/message/${msg.backendId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await res.json();
            if (result.status === 'success' && result.data) {
                const updated = transformBackendMessage(result.data);
                if (updated.content !== msg.content) {
                    setAndCacheMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: updated.content, fileID: updated.fileID } : m));
                }
            }
        } catch {}
    }, [transformBackendMessage, setAndCacheMessages]);

    const getDateLabel = (timestamp: string) => {
        const d = new Date(timestamp);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return language === 'km' ? 'ថ្ងៃនេះ' : 'Today';
        const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return language === 'km' ? 'ម្សិលមិញ' : 'Yesterday';
        return d.toLocaleDateString(language === 'km' ? 'km-KH' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    };

    return (
        <div className={`chat-widget-container ${!isOpen ? 'closed' : ''}`}>
            <style>{`
                .chat-bubble { position: relative; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .chat-bubble:active { transform: scale(0.98); }
                .date-separator { position: sticky; top: 10px; z-index: 10; display: flex; justify-content: center; margin: 20px 0; pointer-events: none; }
                .date-label { background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(10px); padding: 4px 12px; border-radius: 20px; font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.4); border: 1px solid rgba(255,255,255,0.05); }
                .recording-pulse { animation: pulse-red 1.5s infinite; }
                @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
            `}</style>

            <div className="chat-header !bg-gray-900/80 !backdrop-blur-2xl border-b border-white/5 !py-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-blue-400 animate-spin' : connectionStatus === 'connected' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500 animate-pulse'}`}></div>
                        {connectionStatus === 'connected' && !isSyncing && <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20"></div>}
                    </div>
                    <div>
                        <h3 className="font-black text-white uppercase text-xs tracking-widest">Team Portal</h3>
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter leading-none mt-0.5">{isSyncing ? 'Syncing Context' : connectionStatus === 'connected' ? 'Live Connection' : 'Reconnecting...'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => { setIsMuted(!isMuted); localStorage.setItem('chatMuted', String(!isMuted)); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">{isMuted ? '🔇' : '🔔'}</button>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all active:scale-90 text-xl">&times;</button>
                </div>
            </div>
            
            <div className="chat-tabs bg-gray-900/40 p-1 flex border-b border-white/5">
                <button onClick={() => setActiveTab('chat')} className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-white/5 text-white' : 'text-gray-600 hover:text-gray-400'}`}>Chat</button>
                <button onClick={() => setActiveTab('users')} className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition-all ${activeTab === 'users' ? 'bg-white/5 text-white' : 'text-gray-600 hover:text-gray-400'}`}>Members</button>
            </div>

            <div className="chat-body custom-scrollbar bg-[#020617] h-[480px] overflow-y-auto relative" ref={chatBodyRef} onScroll={handleScroll}>
                {activeTab === 'chat' ? (
                    <div className="p-4 space-y-1">
                        {isLoadingOlder && <div className="flex justify-center py-4"><Spinner size="sm" /></div>}
                        
                        {messages.length === 0 && !isOrdersLoading && (
                            <div className="h-full flex flex-col items-center justify-center py-20 opacity-20 text-center">
                                <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeWidth={2}/></svg>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Messages Yet</p>
                            </div>
                        )}

                        {messages.map((msg, i) => {
                            const isMe = msg.user === currentUser?.UserName;
                            const prevMsg = messages[i - 1];
                            const nextMsg = messages[i + 1];
                            const isSameUserPrev = prevMsg && prevMsg.user === msg.user;
                            const isSameUserNext = nextMsg && nextMsg.user === msg.user;
                            
                            const showDate = !prevMsg || new Date(prevMsg.timestamp).toDateString() !== new Date(msg.timestamp).toDateString();
                            const showAvatar = !isMe && !isSameUserNext;

                            return (
                                <React.Fragment key={msg.id + i}>
                                    {showDate && (
                                        <div className="date-separator">
                                            <span className="date-label">{getDateLabel(msg.timestamp)}</span>
                                        </div>
                                    )}
                                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isSameUserPrev ? 'mt-0.5' : 'mt-4'} group/msg relative`}>
                                        <div className={`flex max-w-[85%] gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                                            {!isMe && (
                                                <div className="w-8 shrink-0 flex flex-col justify-end">
                                                    {showAvatar ? <UserAvatar avatarUrl={msg.avatar} name={msg.fullName} size="sm" /> : <div className="w-8" />}
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                {!isMe && !isSameUserPrev && <p className="text-[9px] font-black text-blue-500/60 ml-3 mb-1 uppercase tracking-widest">{msg.fullName}</p>}
                                                <div className={`chat-bubble relative px-4 py-2.5 rounded-[1.5rem] shadow-2xl transition-all ${
                                                    isMe 
                                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none' 
                                                        : 'bg-white/[0.03] text-gray-200 border border-white/5 rounded-tl-none backdrop-blur-xl'
                                                } ${(msg as any).isError ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                                                    {msg.replyTo && (
                                                        <div className="mb-2 p-2 bg-black/30 rounded-xl border-l-4 border-blue-500 text-[10px] opacity-60 truncate italic max-w-[200px]">
                                                            <b>{msg.replyTo.user}</b>: {msg.replyTo.content}
                                                        </div>
                                                    )}
                                                    {msg.type === 'text' && <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
                                                    {msg.type === 'image' && (
                                                        <div className="relative group/img overflow-hidden rounded-xl bg-black/20 min-h-[100px] min-w-[150px]">
                                                            <img
                                                                src={convertGoogleDriveUrl(msg.content)}
                                                                className="rounded-xl w-full cursor-pointer hover:scale-105 transition-transform duration-500"
                                                                onClick={() => previewImage(msg.content)}
                                                                onError={() => handleImageError(msg)}
                                                                alt="Chat"
                                                            />
                                                            {msg.isOptimistic && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Spinner size="sm" /></div>}
                                                        </div>
                                                    )}
                                                    {msg.type === 'audio' && <MemoizedAudioPlayer src={msg.content} duration={msg.duration} isMe={isMe} />}
                                                    
                                                    <div className={`flex items-center gap-1.5 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'} opacity-40`}>
                                                        {msg.isOptimistic && (
                                                            <span className="text-[7px] font-black uppercase tracking-widest animate-pulse text-blue-200">Sending</span>
                                                        )}
                                                        {(msg as any).isError && (
                                                            <span className="text-[7px] font-black uppercase text-red-400">Failed</span>
                                                        )}
                                                        <p className="text-[8px] font-bold">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                                    </div>
                                                    
                                                    {!isMe && (
                                                        <button 
                                                            onClick={() => setReplyingTo(msg)} 
                                                            className="absolute top-0 -right-10 opacity-0 group-hover/msg:opacity-100 p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-500 transition-all active:scale-90"
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" strokeWidth={3}/></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                ) : <ChatMembers users={allUsers} loading={isUsersLoading} onRefresh={syncUsers} />}
            </div>

            {activeTab === 'chat' && (
                <div className="p-4 bg-gray-900/90 backdrop-blur-3xl border-t border-white/5 relative">
                    {replyingTo && (
                        <div className="flex items-center justify-between bg-white/5 p-2 mb-3 rounded-xl text-[10px] animate-reveal border border-white/5">
                            <span className="truncate opacity-60">Replying to <b className="text-blue-400">{replyingTo.fullName}</b></span>
                            <button onClick={() => setReplyingTo(null)} className="w-5 h-5 flex items-center justify-center hover:bg-white/10 rounded-full">&times;</button>
                        </div>
                    )}

                    {pendingImage && (
                        <div className="absolute inset-x-0 bottom-full mb-2 p-4 bg-gray-950/95 backdrop-blur-2xl border-t border-white/10 animate-reveal z-20 rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                            <div className="relative group max-w-[180px] mx-auto">
                                <img src={convertGoogleDriveUrl(pendingImage)} className="max-h-40 rounded-2xl mx-auto border-2 border-blue-500/30 shadow-2xl object-contain" alt="Preview" />
                                <button onClick={() => setPendingImage(null)} className="absolute -top-2 -right-2 w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-500 transition-all active:scale-90">&times;</button>
                            </div>
                            <div className="flex justify-center gap-3 mt-5">
                                <button onClick={() => setPendingImage(null)} className="px-6 py-2.5 bg-white/5 text-gray-500 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all">Cancel</button>
                                <button onClick={handleSendPendingImage} className="px-10 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 flex items-center gap-2" disabled={isUploading}>{isUploading ? <Spinner size="xs" /> : "Send Image"}</button>
                            </div>
                        </div>
                    )}

                    {isRecording ? (
                        <div className="flex items-center justify-between bg-red-500/5 p-2 rounded-2xl border border-red-500/20 recording-pulse">
                            <div className="flex items-center gap-3 ml-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                                <span className="text-red-500 font-black text-[11px] uppercase tracking-widest">Rec {formatTime(recordingTime)}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleCancelRecording} className="px-4 py-2 text-[9px] font-black uppercase text-gray-500 hover:text-white transition-colors">Discard</button>
                                <button onClick={handleStopAndSendAudio} className="px-6 py-2 bg-red-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-red-600/20 active:scale-95">Send</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-end gap-2.5">
                            <button onClick={() => fileInputRef.current?.click()} className="mb-1 w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-gray-400 hover:bg-blue-600/10 hover:text-blue-400 transition-all active:scale-90 shadow-inner" disabled={isUploading}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2.5}/></svg>
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => e.target.files && handleFileSelect(e.target.files[0])} />
                            
                            <div className="flex-grow relative">
                                <textarea 
                                    value={newMessage} 
                                    onChange={e => setNewMessage(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage(newMessage, 'text'))} 
                                    placeholder={language === 'km' ? 'វាយសារនៅទីនេះ...' : "Message..."} 
                                    className="w-full bg-black/40 text-white rounded-2xl py-3 px-4 text-sm font-medium resize-none focus:ring-2 focus:ring-blue-500/30 border border-white/5 shadow-inner custom-scrollbar min-h-[44px] max-h-[120px]" 
                                    rows={1} 
                                    disabled={isUploading} 
                                />
                            </div>

                            {newMessage.trim() ? (
                                <button onClick={() => handleSendMessage(newMessage, 'text')} className="mb-1 w-11 h-11 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center active:scale-90 transition-all">
                                    <svg className="w-5 h-5 fill-current transform rotate-45 -translate-x-0.5 translate-y-0.5" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                                </button>
                            ) : (
                                <button onClick={handleStartRecording} className="mb-1 w-11 h-11 bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 rounded-xl flex items-center justify-center active:scale-90 transition-all border border-white/5">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" strokeWidth={2.5}/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" strokeWidth={2.5}/></svg>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {showScrollBottom && (
                <button 
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-24 right-6 w-9 h-9 bg-blue-600/90 text-white rounded-full shadow-2xl flex items-center justify-center animate-bounce z-30 backdrop-blur-md border border-white/20"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 14l-7 7-7-7" strokeWidth={3}/></svg>
                </button>
            )}
        </div>
    );
};

export default ChatWidget;
