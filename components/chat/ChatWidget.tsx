
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
import { getTimestamp, formatChatDate } from '../../utils/dateUtils';

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

    // Audio Recorder Hook
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingIntervalRef = useRef<any>(null);

    // Sound Refs - Lazy initialization to avoid creating Audio objects on every render
    const soundNotification = useRef<HTMLAudioElement | null>(null);
    const soundSent = useRef<HTMLAudioElement | null>(null);

    // Initialize audio objects once
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
                return parsed.slice(-20); // Only show last 20 initially
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
    const [isLoadingOlder, setIsLoadingOlder] = useState(false); // State for loading older messages
    
    // Mention State
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentionList, setShowMentionList] = useState(false);

    // Reply & Pin State
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatBodyRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const isOpenRef = useRef(isOpen);
    
    const allUsersRef = useRef(allUsers);
    const currentUserRef = useRef(currentUser);
    const isMutedRef = useRef(isMuted);
    const lastNotifiedMessageIdRef = useRef<string | null>(null);
    const archivedMessagesRef = useRef<ChatMessage[]>([]); // Store older messages here
    const hasAttemptedFullLoadRef = useRef(false); // Track if full history was ever requested
    const abortControllerRef = useRef<AbortController | null>(null);
    const fetchInProgressRef = useRef(false);
    const hasScrolledToBottomRef = useRef(false); // Track initial scroll to bottom
    const isOpeningRef = useRef(false); // Track if widget is currently being opened

    // Derived Pinned Messages
    const pinnedMessages = useMemo(() => messages.filter(m => m.isPinned && !m.isDeleted), [messages]);

    // Initialize archive from cache on mount
    useEffect(() => {
        if (CACHE_KEY && archivedMessagesRef.current.length === 0) {
            try {
                const cached = localStorage.getItem(CACHE_KEY);
                if (cached && cached !== "undefined") {
                    const parsed = JSON.parse(cached) as ChatMessage[];
                    if (parsed.length > 20) {
                        archivedMessagesRef.current = parsed.slice(0, -20);
                    }
                }
            } catch (e) {}
        }
    }, [CACHE_KEY]);

    useEffect(() => {
        const soundId = advancedSettings?.notificationSound || 'default';
        const soundObj = NOTIFICATION_SOUNDS.find(s => s.id === soundId) || NOTIFICATION_SOUNDS[0];
        const volume = advancedSettings?.notificationVolume ?? 1.0;

        if (soundNotification.current) {
            soundNotification.current.src = soundObj.url;
            soundNotification.current.volume = volume;
        }
        if (soundSent.current) {
            soundSent.current.volume = volume;
        }
    }, [advancedSettings?.notificationSound, advancedSettings?.notificationVolume]);

    useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

    // Initialize lastNotifiedMessageIdRef
    useEffect(() => {
        if (messages.length > 0 && !lastNotifiedMessageIdRef.current) {
            // Sort to ensure we get the latest
            const sorted = [...messages].sort((a, b) => getTimestamp(a.timestamp) - getTimestamp(b.timestamp));
            lastNotifiedMessageIdRef.current = sorted[sorted.length - 1].id;
        }
    }, []); // Run once on mount to set initial baseline

    // --- User Data Synchronization ---
    const syncUsers = useCallback(async () => {
        if (appData.users && appData.users.length > 0) {
            setAllUsers(appData.users);
            setIsUsersLoading(false);
            return;
        }
        setIsUsersLoading(true);
        try {
            const res = await fetch(`${WEB_APP_URL}/api/users`);
            const json = await res.json();
            if (json.status === 'success' && Array.isArray(json.data)) {
                setAllUsers(json.data);
            }
        } catch (e) {
            console.warn("Fallback user fetch failed", e);
        } finally {
            setIsUsersLoading(false);
        }
    }, [appData.users]);

    useEffect(() => {
        syncUsers();
    }, [syncUsers]);

    // Reset Unread Count
    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        } else {
            hasScrolledToBottomRef.current = false; // Reset on close
        }
    }, [isOpen, setUnreadCount]);

    // Request Permission for System Notifications on Mount
    useEffect(() => {
        requestNotificationPermission();
    }, []);

    // --- Audio Workflow (FIXED: Extract ID from URL if needed) ---
    const handleStartRecording = async () => {
        await startRecording();
        setRecordingTime(0);
        recordingIntervalRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);
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
            // 1. Get Blob from recorder
            const audioBlob = await stopRecording();
            if (!audioBlob) throw new Error("No audio captured");

            // 2. Convert to Base64 for Upload
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const rawBase64 = base64data.split(',')[1];
                
                try {
                    // 3. Upload to /api/upload-image to get FileID
                    const uploadResponse = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileData: rawBase64,
                            fileName: `voice_${Date.now()}.webm`,
                            mimeType: 'audio/webm',
                            userName: currentUser?.UserName || 'unknown'
                        })
                    });

                    const uploadResult = await uploadResponse.json();
                    if (!uploadResponse.ok || uploadResult.status !== 'success') {
                        throw new Error(uploadResult.message || 'Audio upload failed');
                    }

                    // 4. Extract FileID
                    // Try getting direct ID first, otherwise extract from URL
                    let fileId = uploadResult.fileId || uploadResult.id; 
                    
                    if (!fileId && uploadResult.url) {
                        const match = uploadResult.url.match(/(?:d\/|id=)([^/?&]+)/);
                        if (match && match[1]) {
                            fileId = match[1];
                        }
                    }

                    if (!fileId) {
                        console.error("Could not determine FileID from upload result:", uploadResult);
                        throw new Error("Failed to get File ID");
                    }
                    
                    // 5. Send Message (Content = Duration, FileID = ID)
                    const durationContent = formatTime(recordingTime); 
                    
                    await handleSendMessage(durationContent, 'audio', fileId);

                } catch (err) {
                    console.error("Audio Upload Workflow Failed", err);
                    alert("ការបញ្ជូនសម្លេងបរាជ័យ (Failed to upload audio).");
                } finally {
                    setIsSendingAudio(false);
                    setRecordingTime(0);
                }
            };
        } catch (e) {
            console.error("Recording Error", e);
            setIsSendingAudio(false);
            setRecordingTime(0);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    // -----------------------------

    const setAndCacheMessages = useCallback((updater: React.SetStateAction<ChatMessage[]>) => {
        setMessages(prev => {
            const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
            if (CACHE_KEY) {
                // Combine archive and current messages for full history
                const fullHistory = [...archivedMessagesRef.current, ...next];
                localStorage.setItem(CACHE_KEY, JSON.stringify(fullHistory.slice(-500)));
            }
            return next;
        });
    }, [CACHE_KEY]);

    const transformBackendMessage = useCallback((msg: BackendChatMessage): ChatMessage => {
        const user = allUsersRef.current.find(u => u.UserName === msg.UserName);
        const normalizedType = (msg.MessageType || 'text').toLowerCase();
        
        let contentUrl = msg.Content;
        let duration = undefined;

        // Construct URL if it's audio/video and has FileID
        if ((normalizedType === 'audio' || normalizedType === 'video') && msg.FileID) {
             contentUrl = `${WEB_APP_URL}/api/chat/${normalizedType}/${msg.FileID}`;
             duration = msg.Content; // The raw content from backend is the duration
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
            type: normalizedType as 'text' | 'image' | 'audio' | 'video',
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
    }, []); 

    const processNotifications = useCallback((sortedMessages: ChatMessage[]) => {
        if (sortedMessages.length === 0) return;

        // Determine new messages
        const lastId = lastNotifiedMessageIdRef.current;
        let newMessages: ChatMessage[] = [];

        // Current time for recency check (avoid spamming old messages)
        const now = Date.now();
        const recencyThreshold = 2 * 60 * 1000; // 2 minutes

        if (!lastId) {
             // If first load, just mark the last one and return
             lastNotifiedMessageIdRef.current = sortedMessages[sortedMessages.length - 1].id;
             return;
        }

        // Find messages strictly after lastId
        // Assuming sorted by timestamp asc
        const lastIndex = sortedMessages.findIndex(m => m.id === lastId);
        if (lastIndex !== -1) {
            newMessages = sortedMessages.slice(lastIndex + 1);
        } else {
             // If lastId not found (maybe cleared?), check timestamps? 
             // Or just check if there are messages with timestamp > lastId's timestamp (if we stored it)
             // Simpler: assume if ID mismatch, scan all for newer timestamp
             // Ideally ids are timestamps.
             newMessages = sortedMessages.filter(m => m.id > lastId);
        }

        newMessages.forEach(msg => {
            const isMe = msg.user === currentUserRef.current?.UserName;
            
            // Skip own messages
            if (isMe) return;

            // RECENCY CHECK: Only notify if the message is recent (within 2 minutes)
            // This prevents spamming notifications for old messages on startup
            const msgTime = getTimestamp(msg.timestamp);
            if (now - msgTime > recencyThreshold) return;

            // Global Notification Trigger
            const isNewOrder = msg.content && msg.content.includes('📢 NEW ORDER:');
            const isSystemAlert = msg.content && msg.content.includes('📢 SYSTEM_ALERT:');
            const isStatusUpdate = msg.content && (
                msg.content.includes('[PACKED]') || 
                msg.content.includes('[DISPATCHED]') || 
                msg.content.includes('[DELIVERED]') ||
                msg.content.includes('[BULK DISPATCH]') ||
                msg.content.includes('[BULK DELIVERED]')
            );

            if (isNewOrder || isSystemAlert || isStatusUpdate) {
                let alertMsg = msg.content;
                if (isNewOrder) alertMsg = msg.content.replace('📢 NEW ORDER:', '').trim();
                else if (isSystemAlert) alertMsg = msg.content.replace('📢 SYSTEM_ALERT:', '').trim();
                // For status updates, we keep the content as is but can clean markdown if needed
                alertMsg = alertMsg.replace(/\*\*/g, ''); 
                
                showNotification(alertMsg, isStatusUpdate ? 'info' : 'success');
                
                if (!isMutedRef.current && soundNotification.current) {
                    soundNotification.current.currentTime = 0;
                    soundNotification.current.play().catch(e => console.warn("Audio play failed", e));
                }
                
                const title = isStatusUpdate ? "បច្ចុប្បន្នភាពកញ្ចប់ឥវ៉ាន់ 📦" : "ការកម្មង់ថ្មី 📦";
                sendSystemNotification(title, alertMsg);
            } else {
                // Standard User Message
                const senderName = msg.fullName || msg.user;
                let contentPreview = msg.content;
                
                if (msg.type === 'image') contentPreview = '📷 Sent an image';
                else if (msg.type === 'audio') contentPreview = '🎤 Sent a voice message';
                
                showNotification(`${senderName}: ${contentPreview}`, 'info');
                
                if (document.hidden || !isOpenRef.current) {
                    sendSystemNotification(senderName, contentPreview);
                    if (!isOpenRef.current) setUnreadCount(p => p + 1);
                }

                if (!isMutedRef.current && soundNotification.current) {
                    soundNotification.current.currentTime = 0;
                    soundNotification.current.play().catch(() => {});
                }
            }
        });

        // Update Ref
        if (newMessages.length > 0) {
            lastNotifiedMessageIdRef.current = newMessages[newMessages.length - 1].id;
        }
    }, [showNotification, setUnreadCount]);

    const fetchHistory = useCallback(async (forceFull = false, isScrollTriggered = false) => {
        // Use a flag to avoid concurrent fetches if polling and initial fetch collide
        if (fetchInProgressRef.current) return;
        
        const isInitialLoad = messages.length === 0;
        if (isInitialLoad && isOpenRef.current) setIsHistoryLoading(true);
        fetchInProgressRef.current = true;

        // Save scroll height if we're about to load older messages to preserve position
        const container = chatBodyRef.current;
        const previousScrollHeight = isScrollTriggered && container ? container.scrollHeight : 0;

        // Abort previous request if still running (iOS Standard for cleaner network)
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        try {
            // Determine if we should fetch full history or just the last few messages
            const isFullFetch = forceFull;
            const url = isFullFetch ? `${WEB_APP_URL}/api/chat/messages` : `${WEB_APP_URL}/api/chat/messages?days=2&limit=20`;
            
            if (isFullFetch) hasAttemptedFullLoadRef.current = true;

            const res = await fetch(url, { signal });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const result = await res.json();
            if (result.status === 'success') {
                const history = result.data.map(transformBackendMessage);
                // Sort by timestamp ASC
                const sortedHistory = history.sort((a: ChatMessage, b: ChatMessage) => getTimestamp(a.timestamp) - getTimestamp(b.timestamp));
                
                // Process Notifications
                processNotifications(sortedHistory);

                setAndCacheMessages(prev => {
                    const prevOptimistics = prev.filter(m => m.isOptimistic);
                    const prevNonOptimistic = prev.filter(m => !m.isOptimistic);
                    
                    // 1. Gather ALL known messages (Visible + Archive + New)
                    const allKnownNonOptimistic = [
                        ...prevNonOptimistic,
                        ...archivedMessagesRef.current,
                        ...sortedHistory
                    ];
                    
                    // 2. Deduplicate and Sort
                    const seenIds = new Set();
                    const deduplicated = allKnownNonOptimistic.filter(m => {
                        if (seenIds.has(m.id)) return false;
                        seenIds.add(m.id);
                        return true;
                    }).sort((a, b) => getTimestamp(a.timestamp) - getTimestamp(b.timestamp));

                    // 3. Determine visible messages using anchor-based logic
                    let nextVisible: ChatMessage[] = [];
                    let nextArchived: ChatMessage[] = [];

                    if (isOpeningRef.current || prevNonOptimistic.length === 0) {
                        nextVisible = deduplicated.slice(-20);
                        nextArchived = deduplicated.slice(0, -20);
                    } else {
                        // Find anchor index of the oldest currently visible non-optimistic message
                        const oldestId = prevNonOptimistic[0].id;
                        let anchorIndex = deduplicated.findIndex(m => m.id === oldestId);
                        
                        if (anchorIndex === -1) {
                            // Fallback if anchor lost: use relative position from bottom
                            anchorIndex = Math.max(0, deduplicated.length - prevNonOptimistic.length);
                        }

                        // If scroll triggered, expand visibility by moving the anchor up
                        if (isScrollTriggered) {
                            anchorIndex = Math.max(0, anchorIndex - 20);
                        }

                        nextVisible = deduplicated.slice(anchorIndex);
                        nextArchived = deduplicated.slice(0, anchorIndex);
                    }

                    // Update archive ref for future scroll-ups
                    archivedMessagesRef.current = nextArchived;
                    isOpeningRef.current = false; // Reset opening flag

                    // Restore scroll position after render if this was a scroll-triggered fetch
                    if (isScrollTriggered && previousScrollHeight > 0) {
                        requestAnimationFrame(() => {
                            if (chatBodyRef.current) {
                                const newScrollHeight = chatBodyRef.current.scrollHeight;
                                chatBodyRef.current.scrollTop = newScrollHeight - previousScrollHeight;
                            }
                        });
                    }

                    // --- OPTIMISTIC RESOLUTION ---
                    const unresolvedOptimistics = prevOptimistics.filter(opt => {
                        const isResolved = nextVisible.some(real => 
                            real.user === opt.user && 
                            real.type === opt.type && 
                            (real.content === opt.content || Math.abs(getTimestamp(real.timestamp) - getTimestamp(opt.timestamp)) < 15000)
                        );
                        const isExpired = (Date.now() - getTimestamp(opt.timestamp)) > 30000;
                        return !isResolved && !isExpired;
                    });

                    return [...nextVisible, ...unresolvedOptimistics].sort((a, b) => getTimestamp(a.timestamp) - getTimestamp(b.timestamp));
                });
            }
        } catch (e: any) { 
            if (e.name !== 'AbortError') {
                console.warn("Chat history service unavailable"); 
            }
        } finally { 
            setIsHistoryLoading(false); 
            fetchInProgressRef.current = false;
        }
    }, [transformBackendMessage, setAndCacheMessages, processNotifications, isOpenRef, messages.length]);

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
        }
    };

    // WebSocket
    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const host = WEB_APP_URL.replace(/^https?:\/\//, '');
        const wsUrl = `${protocol}://${host}/api/chat/ws`;

        const setupWs = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) return;

            setConnectionStatus('connecting');
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setConnectionStatus('connected');
                // Initial fetch on connect
                fetchHistory();
            };

            ws.onclose = () => {
                setConnectionStatus('disconnected');
                setTimeout(setupWs, 3000);
            };

            ws.onmessage = (e) => {
                try {
                    const data = JSON.parse(e.data);
                    if (data.action === 'new_message') {
                        const backendMsg = data.payload;
                        const msg = transformBackendMessage(backendMsg);
                        
                        // We use processNotifications here by constructing a list? 
                        // Or just let fetchHistory handle it via polling?
                        // Ideally we handle it immediately here.
                        
                        // Check if we already processed this ID (via polling)
                        if (lastNotifiedMessageIdRef.current && msg.id <= lastNotifiedMessageIdRef.current) {
                            // Already notified via polling
                        } else {
                            // Notify immediately
                            processNotifications([msg]);
                            // Note: processNotifications handles filtering 'isMe'
                        }

                        setAndCacheMessages(prev => {
                            if (prev.some(m => m.id === msg.id)) return prev;
                            
                            // Precise Optimistic Replacement
                            const optimisticIndex = prev.findIndex(m => 
                                m.isOptimistic && 
                                m.user === msg.user && 
                                m.type === msg.type &&
                                (m.type === 'text' ? m.content === msg.content : true)
                            );
                            
                            if (optimisticIndex !== -1) {
                                const newArr = [...prev];
                                newArr[optimisticIndex] = msg;
                                return newArr;
                            }
                            return [...prev, msg];
                        });
                        
                        if (isOpenRef.current) {
                             setTimeout(() => scrollToBottom('smooth'), 100);
                        }
                    }
                } catch (err) { console.error("WS Message Error", err); }
            };
        };
        setupWs();
        return () => { wsRef.current?.close(); };
    }, [processNotifications, transformBackendMessage, setAndCacheMessages]); // Added dependencies

    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
            isOpeningRef.current = true;
            fetchHistory();
        } else {
            hasScrolledToBottomRef.current = false; // Reset on close
        }
    }, [isOpen, fetchHistory, setUnreadCount]);
    useEffect(() => {
        const interval = setInterval(() => {
             // iOS Optimization: Only fetch when tab is active to save resources
             // Background notifications still work via WS or when user returns
             if (document.visibilityState === 'visible') {
                 fetchHistory();
             }
        }, 3000);

        return () => {
            clearInterval(interval);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, [fetchHistory]);

    // Auto-Scroll & Load More Logic
    const handleScroll = () => {
        if (!chatBodyRef.current) return;
        
        const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
        
        // 1. Show/Hide "Scroll to Bottom" button
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
        setShowScrollBottom(!isNearBottom);

        // 2. Load More Messages (Scroll to Top) - using < 5px buffer for reliability
        if (scrollTop < 5 && !isLoadingOlder && !isHistoryLoading) {
            if (archivedMessagesRef.current.length > 0) {
                setIsLoadingOlder(true);
                
                // Save current scroll metrics to restore position accurately
                const container = chatBodyRef.current;
                const previousScrollHeight = container.scrollHeight;

                // Small delay to show "Loading..." indicator for UX
                setTimeout(() => {
                    // Take last 20 from archive (most recent of the old ones)
                    const chunk = archivedMessagesRef.current.splice(-20);
                    if (chunk.length > 0) {
                        // Use setAndCacheMessages to ensure LocalStorage stays in sync
                        setAndCacheMessages(prev => [...chunk, ...prev]);
                        
                        // Restore scroll position precisely
                        requestAnimationFrame(() => {
                            if (container) {
                                const newScrollHeight = container.scrollHeight;
                                container.scrollTop = newScrollHeight - previousScrollHeight;
                            }
                        });
                    }
                    setIsLoadingOlder(false);
                }, 400);
            } else if (!hasAttemptedFullLoadRef.current) {
                // Archive is empty and we haven't tried full load yet - fetch full history
                fetchHistory(true, true);
            }
        }
    };

    useEffect(() => {
        if (!isOpen || activeTab !== 'chat' || isHistoryLoading) return;
        const container = chatBodyRef.current;
        if (container) {
            const { scrollTop, scrollHeight, clientHeight } = container;
            // If we are near bottom, or it's initial load (hasn't scrolled yet), or it's our message
            const isAtBottom = scrollHeight - scrollTop - clientHeight < 250;
            const lastMessage = messages[messages.length - 1];
            const isMe = lastMessage?.user === currentUser?.UserName;
            
            // Scroll to bottom logic:
            // 1. Mandatory on initial load (!hasScrolledToBottomRef.current)
            // 2. When I send a message (isMe)
            // 3. When an optimistic message appears
            // 4. When we are already looking at the bottom (isAtBottom)
            
            if (isMe || lastMessage?.isOptimistic || isAtBottom || !hasScrolledToBottomRef.current) {
                const behavior = (!hasScrolledToBottomRef.current) ? 'auto' : 'smooth';
                scrollToBottom(behavior);
                
                // Mark initial scroll as done
                if (messages.length > 0) {
                    hasScrolledToBottomRef.current = true;
                }
            }
        } else {
            scrollToBottom('auto');
        }
    }, [messages, isOpen, activeTab, isHistoryLoading]);
    const handleSendMessage = async (content: string, type: 'text' | 'image' | 'audio', fileId?: string) => {
        if (!content && type === 'text') return;

        const sendingUser = currentUserRef.current;
        if (!sendingUser) {
            alert("Please login to send messages.");
            return;
        }

        const tempId = Date.now().toString();
        let displayContent = content;
        let msgDuration = undefined;
        
        if (type === 'image' && !content.startsWith('http') && !content.startsWith('data:')) {
            displayContent = `data:image/jpeg;base64,${content}`;
        } else if (type === 'audio' && fileId) {
            displayContent = `${WEB_APP_URL}/api/chat/audio/${fileId}`;
            msgDuration = content; // Recording duration string (e.g. "0:05")
        }
        
        const optimisticMsg: ChatMessage = {
            id: tempId,
            user: sendingUser.UserName || 'Unknown',
            fullName: sendingUser.FullName || 'Me',
            avatar: sendingUser.ProfilePictureURL || '',
            content: displayContent,
            timestamp: new Date().toISOString(),
            type: type,
            fileID: fileId,
            duration: msgDuration,
            isOptimistic: true,
            replyTo: replyingTo ? {
                id: replyingTo.id,
                user: replyingTo.fullName || replyingTo.user,
                content: replyingTo.content,
                type: replyingTo.type
            } : undefined
        };

        setMessages(prev => [...prev, optimisticMsg]);
        if (type === 'text') setNewMessage('');
        setReplyingTo(null); // Clear reply state

        const messageType = type.charAt(0).toUpperCase() + type.slice(1);

        try {
            const payload: any = { 
                userName: sendingUser.UserName, 
                UserName: sendingUser.UserName,
                type: messageType,
                MessageType: messageType,
                content: content.trim(),
                Content: content.trim()
            };

            if (fileId) {
                payload.FileID = fileId;
                payload.fileId = fileId;
            }

            if (optimisticMsg.replyTo) {
                payload.ReplyTo = {
                    ID: optimisticMsg.replyTo.id,
                    User: optimisticMsg.replyTo.user,
                    Content: optimisticMsg.replyTo.content,
                    Type: optimisticMsg.replyTo.type
                };
            }

            const response = await fetch(`${WEB_APP_URL}/api/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server returned ${response.status}: ${errorText}`);
            }

            if (!isMuted) {
                soundSent.current.currentTime = 0;
                soundSent.current.play().catch(() => {});
            }
        } catch (e) {
            console.error("Send Error:", e);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            if (type === 'text') setNewMessage(content);
            alert("ការបញ្ជូនសារបរាជ័យ (Send Failed). Please try again.");
        }
    };

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        try {
            const compressed = await compressImage(file);
            const base64 = await fileToBase64(compressed);
            
            // Upload first
            const uploadResponse = await fetch(`${WEB_APP_URL}/api/upload-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileData: base64,
                    fileName: `img_${Date.now()}.jpg`,
                    mimeType: 'image/jpeg',
                    userName: currentUser?.UserName || 'unknown'
                })
            });

            const uploadResult = await uploadResponse.json();
            if (!uploadResponse.ok || uploadResult.status !== 'success') {
                throw new Error(uploadResult.message || 'Image upload failed');
            }

            // Extract FileID
            let fileId = uploadResult.fileId || uploadResult.id;
            if (!fileId && uploadResult.url) {
                const match = uploadResult.url.match(/(?:d\/|id=)([^/?&]+)/);
                if (match && match[1]) fileId = match[1];
            }

            if (!fileId) throw new Error("Failed to get File ID");

            // Send Message with FileID
            await handleSendMessage(uploadResult.url, 'image', fileId); 

        } catch (e) {
            console.error("Image Upload Error:", e);
            alert("ការបញ្ជូនរូបភាពបរាជ័យ (Failed to upload image).");
        } finally { 
            setIsUploading(false); 
        }
    };

    // --- Message Actions ---
    const handleDeleteMessage = async (msgId: string) => {
        if (!confirm("Are you sure you want to delete this message?")) return;
        
        // Optimistic Update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true } : m));

        try {
            await fetch(`${WEB_APP_URL}/api/chat/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: msgId, userName: currentUser?.UserName })
            });
        } catch (e) { console.error("Delete failed", e); }
    };

    const handlePinMessage = async (msgId: string, isPinned: boolean) => {
        // Optimistic Update
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isPinned: !isPinned } : m));

        try {
            await fetch(`${WEB_APP_URL}/api/chat/pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: msgId, isPinned: !isPinned, userName: currentUser?.UserName })
            });
        } catch (e) { console.error("Pin failed", e); }
    };

    const handleDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Mention Handling ---
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewMessage(val);

        // Detect if user is typing a mention (last word starts with @)
        const lastWord = val.split(/[\s\n]+/).pop();
        if (lastWord && lastWord.startsWith('@')) {
            setMentionQuery(lastWord.slice(1)); // Remove @
            setShowMentionList(true);
        } else {
            setShowMentionList(false);
        }
    };

    const insertMention = (username: string) => {
        const words = newMessage.split(/([\s\n]+)/);
        const lastWordIndex = words.length - 1;
        // Replace last word (the incomplete mention) with the full username
        words[lastWordIndex] = `@${username} `; 
        
        setNewMessage(words.join(''));
        setShowMentionList(false);
        setMentionQuery('');
        
        // Refocus input
        const textarea = document.querySelector('.chat-input-area textarea') as HTMLTextAreaElement;
        if (textarea) textarea.focus();
    };

    const renderMessageContent = (content: string) => {
        // Split by spaces to find mentions but preserve newlines
        // A simple regex to find @words
        const parts = content.split(/(@[\w\u1780-\u17FF]+)/g); // Supports Khmer characters in names if needed
        
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                const username = part.slice(1);
                // Check if it's a valid user (optional, but good for highlighting)
                const isValidUser = allUsers.some(u => u.UserName === username || u.FullName === username);
                
                if (isValidUser || part.length > 2) {
                    return (
                        <span key={i} className="text-blue-300 font-bold bg-blue-500/20 px-1 rounded-md mx-0.5">
                            {part}
                        </span>
                    );
                }
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className={`chat-widget-container ${!isOpen ? 'closed' : ''}`}>
            <div className="chat-header">
                <div className="title-group flex items-center gap-2">
                    <div className={`connection-status w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-yellow-500 animate-pulse'}`}></div>
                    <h3 className="font-black text-white uppercase tracking-wider text-sm">Team Chat</h3>
                </div>
                <div className="controls flex items-center gap-2">
                    <button onClick={() => {
                        const newMuted = !isMuted;
                        setIsMuted(newMuted);
                        localStorage.setItem('chatMuted', String(newMuted));
                        if (!newMuted) {
                            requestNotificationPermission().then(granted => {
                                if (granted) console.log("Notification permission granted via toggle");
                            });
                        }
                    }} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                        {isMuted ? '🔇' : '🔔'}
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors text-gray-400">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
            
            <div className="chat-tabs bg-gray-900/50 p-1">
                <button onClick={() => setActiveTab('chat')} className={`text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'chat' ? 'active bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Chat Stream</button>
                <button onClick={() => setActiveTab('users')} className={`text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'users' ? 'active bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>Members</button>
            </div>

            {/* Redesigned Pinned Messages Header */}
            {activeTab === 'chat' && pinnedMessages.length > 0 && (
                <div className="bg-gray-900/90 backdrop-blur-md border-b border-white/5 p-2.5 flex items-center gap-3 sticky top-0 z-30 shadow-2xl">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                        <svg className="w-4 h-4 text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/>
                        </svg>
                    </div>
                    
                    <div className="flex-grow overflow-hidden">
                        <div className="flex gap-3 overflow-x-auto custom-scrollbar no-scrollbar py-0.5 px-0.5 snap-x">
                            {pinnedMessages.map((msg, idx) => (
                                <div 
                                    key={msg.id} 
                                    className="flex-shrink-0 min-w-[180px] max-w-[220px] bg-white/5 hover:bg-white/10 rounded-xl p-2 border border-white/5 cursor-pointer transition-all active:scale-95 snap-center group/pin"
                                    onClick={() => document.getElementById(`msg-${msg.id}`)?.scrollIntoView({behavior: 'smooth', block: 'center'})}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className="text-[10px] font-black text-yellow-500/80 uppercase tracking-wider truncate">Pinned #{idx + 1}</p>
                                        <p className="text-[9px] font-bold text-gray-500">{msg.fullName}</p>
                                    </div>
                                    <p className="text-[11px] text-gray-200 truncate leading-tight">
                                        {msg.type === 'text' ? msg.content : msg.type === 'image' ? '📷 Photo' : msg.type === 'audio' ? '🎤 Voice' : '🎥 Video'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {pinnedMessages.length > 1 && (
                        <div className="flex-shrink-0 bg-gray-800 px-2 py-1 rounded-lg border border-white/5 shadow-inner">
                            <p className="text-[10px] font-black text-gray-400">{pinnedMessages.length}</p>
                        </div>
                    )}
                </div>
            )}

            <div 
                className="chat-body custom-scrollbar bg-[#0f172a] relative"
                ref={chatBodyRef}
                onScroll={handleScroll}
            >
                {activeTab === 'chat' ? (
                    <div className="chat-messages p-4 space-y-6 min-h-full pb-20">
                        {isLoadingOlder && (
                            <div className="flex justify-center py-2 animate-fade-in">
                                <div className="bg-gray-800/80 border border-white/5 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                                    <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading messages...</span>
                                </div>
                            </div>
                        )}
                        {isHistoryLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                <Spinner size="md" />
                                <span className="text-xs text-gray-500">Loading history...</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-center opacity-50">
                                <svg className="w-16 h-16 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                <p className="text-xs font-black uppercase tracking-widest text-gray-500">No messages yet</p>
                                <p className="text-[10px] text-gray-600 mt-1">Start the conversation!</p>
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isMe = msg.user === currentUser?.UserName;
                                const user = allUsers.find(u => u.UserName === msg.user);
                                const showAvatar = index === 0 || messages[index - 1].user !== msg.user;
                                const isSystemAlert = msg.content.includes('SYSTEM_ALERT') || msg.content.includes('NEW ORDER');
                                
                                // Date Separator Logic
                                const currentDate = formatChatDate(msg.timestamp);
                                const previousDate = index > 0 ? formatChatDate(messages[index - 1].timestamp) : null;
                                const showDateSeparator = currentDate !== previousDate;

                                return (
                                    <React.Fragment key={msg.id + index}>
                                        {showDateSeparator && (
                                            <div className="flex justify-center my-6">
                                                <div className="bg-gray-800/50 border border-gray-700/50 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 shadow-sm">
                                                    {currentDate}
                                                </div>
                                            </div>
                                        )}
                                        <div id={`msg-${msg.id}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-fade-in-up group/msg relative`}>
                                        {isSystemAlert ? (
                                            <div className="w-full flex justify-center my-2">
                                                <div className="bg-blue-900/40 border border-blue-500/30 rounded-xl px-4 py-2 text-[10px] font-bold text-blue-300 text-center shadow-lg">
                                                    {msg.content.replace('📢 SYSTEM_ALERT:', '').replace('📢 NEW ORDER:', '').trim()}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={`flex max-w-[85%] gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                                <div className={`flex-shrink-0 w-8 flex flex-col justify-end`}>
                                                    {showAvatar ? (
                                                        <UserAvatar avatarUrl={user?.ProfilePictureURL || msg.avatar} name={user?.FullName || msg.fullName} size="sm" className="ring-2 ring-white/10" />
                                                    ) : <div className="w-8"></div>}
                                                </div>
                                                
                                                <div className={`relative px-4 py-3 shadow-lg transition-all ${
                                                    isMe 
                                                    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                                                    : 'bg-gray-800 text-gray-200 rounded-2xl rounded-tl-sm border border-white/5'
                                                } ${msg.isOptimistic ? 'opacity-70' : ''} ${msg.isDeleted ? 'italic opacity-60 border-dashed border-gray-600' : ''}`}>
                                                    
                                                    {/* Quoted Reply */}
                                                    {msg.replyTo && !msg.isDeleted && (
                                                        <div className={`mb-2 p-2 rounded-lg border-l-4 text-xs ${isMe ? 'bg-blue-700/50 border-blue-300' : 'bg-gray-900/50 border-gray-600'}`}>
                                                            <p className="font-bold opacity-80">{msg.replyTo.user}</p>
                                                            <p className="truncate opacity-70">{msg.replyTo.type === 'text' ? msg.replyTo.content : `[${msg.replyTo.type}]`}</p>
                                                        </div>
                                                    )}

                                                    {!isMe && showAvatar && <p className="text-[10px] font-black text-blue-400 mb-1 uppercase tracking-wider">{user?.FullName || msg.fullName}</p>}
                                                    
                                                    {msg.isDeleted ? (
                                                        <p className="text-sm text-gray-400">🚫 This message was deleted</p>
                                                    ) : (
                                                        <>
                                                            {msg.type === 'text' && <p className="leading-relaxed text-sm whitespace-pre-wrap">{renderMessageContent(msg.content)}</p>}
                                                            {msg.type === 'image' && <img src={msg.content} loading="lazy" className="rounded-xl max-w-full cursor-pointer hover:opacity-90 transition-opacity border border-black/20" onClick={() => previewImage(msg.content)} alt="attachment" />}
                                                            {msg.type === 'audio' && <MemoizedAudioPlayer src={msg.content} duration={msg.duration} isMe={isMe} />}
                                                            {msg.type === 'video' && (
                                                                <video controls className="rounded-xl max-w-full border border-black/20" style={{maxHeight: '200px'}}>
                                                                    <source src={msg.content} type="video/mp4" />
                                                                    Your browser does not support the video tag.
                                                                </video>
                                                            )}
                                                        </>
                                                    )}
                                                    
                                                    <div className="flex items-center justify-end gap-1.5 mt-1.5 border-t border-white/5 pt-1.5">
                                                        {msg.isPinned && (
                                                            <div className="flex items-center gap-1 bg-yellow-500/10 px-1.5 py-0.5 rounded-md border border-yellow-500/20 mr-auto">
                                                                <svg className="w-2.5 h-2.5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/></svg>
                                                                <span className="text-[8px] font-black text-yellow-500/80 uppercase tracking-tighter">Pinned</span>
                                                            </div>
                                                        )}
                                                        <p className={`text-[9px] font-medium ${isMe ? 'text-blue-200' : 'text-gray-500'}`}>
                                                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </p>
                                                        {msg.isOptimistic && <svg className="w-3 h-3 text-white/50 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                                    </div>

                                                    {/* Message Actions (Hover) */}
                                                    {!msg.isDeleted && !msg.isOptimistic && (
                                                        <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover/msg:opacity-100 transition-all duration-300 transform group-hover/msg:translate-x-0 ${isMe ? 'translate-x-2' : '-translate-x-2'} flex flex-col gap-1.5 p-1 z-10`}>
                                                            <button onClick={() => setReplyingTo(msg)} className="p-2 bg-gray-900/80 backdrop-blur-sm text-gray-400 hover:text-blue-400 rounded-xl shadow-xl border border-white/10 transition-all hover:scale-110 active:scale-90" title="Reply">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                                                            </button>
                                                            
                                                            <button onClick={() => handlePinMessage(msg.id, !!msg.isPinned)} className={`p-2 bg-gray-900/80 backdrop-blur-sm rounded-xl shadow-xl border border-white/10 transition-all hover:scale-110 active:scale-90 ${msg.isPinned ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' : 'text-gray-400 hover:text-yellow-500'}`} title={msg.isPinned ? "Unpin" : "Pin"}>
                                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6l1 1 1-1v-6h5v-2l-2-2z"/></svg>
                                                            </button>

                                                            {(msg.type === 'image' || msg.type === 'video') && (
                                                                <button onClick={() => handleDownload(msg.content, `${msg.type}_${msg.id}.${msg.type === 'video' ? 'mp4' : 'jpg'}`)} className="p-2 bg-gray-900/80 backdrop-blur-sm text-gray-400 hover:text-emerald-400 rounded-xl shadow-xl border border-white/10 transition-all hover:scale-110 active:scale-90" title="Download">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                                                </button>
                                                            )}

                                                            {isMe && (
                                                                <button onClick={() => handleDeleteMessage(msg.id)} className="p-2 bg-gray-900/80 backdrop-blur-sm text-red-400 hover:bg-red-500/20 rounded-xl shadow-xl border border-red-500/20 transition-all hover:scale-110 active:scale-90" title="Delete">
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>
            ) : (
                <ChatMembers users={allUsers} loading={isUsersLoading} onRefresh={syncUsers} />
            )}
        </div>

            {activeTab === 'chat' && showScrollBottom && (
                <button 
                    onClick={() => scrollToBottom('smooth')} 
                    className="absolute bottom-24 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-900/50 hover:bg-blue-500 transition-all animate-bounce z-50 flex items-center justify-center w-10 h-10 border border-blue-400/30"
                    title="Scroll to bottom"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                </button>
            )}

            {activeTab === 'chat' && (
                <div className="chat-input-area p-3 bg-gray-900 border-t border-gray-800 relative z-20">
                    {/* Mention Suggestions Popup */}
                    {showMentionList && (
                        <div className="absolute bottom-full left-4 mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl w-64 max-h-60 overflow-y-auto custom-scrollbar z-50 animate-fade-in-up flex flex-col">
                            <div className="p-2 sticky top-0 bg-gray-800/95 backdrop-blur border-b border-gray-700 z-10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Suggested Members</p>
                            </div>
                            {allUsers
                                .filter(u => 
                                    (u.FullName?.toLowerCase().includes(mentionQuery.toLowerCase()) || 
                                    u.UserName?.toLowerCase().includes(mentionQuery.toLowerCase())) &&
                                    u.UserName !== currentUser?.UserName
                                )
                                .slice(0, 10)
                                .map(user => (
                                    <button
                                        key={user.UserID}
                                        onClick={() => insertMention(user.UserName)}
                                        className="w-full flex items-center gap-3 p-2 hover:bg-white/5 transition-colors text-left group border-b border-gray-700/50 last:border-0"
                                    >
                                        <UserAvatar name={user.FullName} avatarUrl={user.ProfilePictureURL} size="sm" className="ring-1 ring-white/10" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-gray-200 group-hover:text-blue-400 truncate">{user.FullName}</p>
                                            <p className="text-[10px] text-gray-500 truncate">@{user.UserName}</p>
                                        </div>
                                    </button>
                                ))
                            }
                            {allUsers.filter(u => u.FullName?.toLowerCase().includes(mentionQuery.toLowerCase()) || u.UserName?.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && (
                                <div className="p-4 text-center text-gray-500 text-[10px] uppercase tracking-wider">No matching members</div>
                            )}
                        </div>
                    )}

                    {/* Reply Preview */}
                    {replyingTo && (
                        <div className="flex items-center justify-between bg-gray-800/80 border-l-4 border-blue-500 p-2 mb-2 rounded-r-lg animate-fade-in-up">
                            <div className="flex flex-col text-xs overflow-hidden">
                                <span className="font-bold text-blue-400">Replying to {replyingTo.fullName || replyingTo.user}</span>
                                <span className="text-gray-400 truncate">{replyingTo.type === 'text' ? replyingTo.content : `[${replyingTo.type}]`}</span>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-gray-700 rounded-full text-gray-500 hover:text-white">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    )}

                    {isRecording ? (
                        <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-2xl border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-fade-in relative overflow-hidden h-[60px]">
                             {/* Animated Waveform Background */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none gap-1 px-10">
                                {[...Array(20)].map((_, i) => (
                                    <div 
                                        key={i} 
                                        className="w-1 bg-red-500 rounded-full animate-pulse" 
                                        style={{ 
                                            height: `${30 + Math.random() * 50}%`, 
                                            animationDuration: `${0.6 + Math.random() * 0.4}s`,
                                            animationDelay: `${Math.random() * 0.5}s`
                                        }} 
                                    />
                                ))}
                            </div>

                            {/* Blinking Dot */}
                            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-full relative z-10 ml-1">
                                <div className="w-3 h-3 bg-red-500 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                                <div className="absolute w-2 h-2 bg-red-500 rounded-full"></div>
                            </div>
                            
                            {/* Timer */}
                            <div className="flex-grow flex flex-col justify-center relative z-10">
                                <p className="text-white font-black text-lg font-mono tracking-widest leading-none">{formatTime(recordingTime)}</p>
                                <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest mt-0.5">Recording...</p>
                            </div>
                            
                            {/* Controls */}
                            <div className="flex gap-2 relative z-10 mr-1">
                                <button 
                                    onClick={handleCancelRecording} 
                                    className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all active:scale-90"
                                    title="Cancel"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                                <button 
                                    onClick={handleStopAndSendAudio} 
                                    className="p-2.5 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-90 hover:scale-105"
                                    title="Send"
                                >
                                    <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-end gap-2 relative">
                            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded-xl transition-all flex-shrink-0 h-[44px] w-[44px] flex items-center justify-center" title="Attach Image">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => e.target.files && handleFileUpload(e.target.files[0])} />
                            
                            <div className="flex-grow relative">
                                <textarea 
                                    value={newMessage} 
                                    onChange={handleInputChange} 
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage(newMessage, 'text');
                                        }
                                    }}
                                    placeholder="Type a message..." 
                                    className="w-full bg-gray-800 text-white rounded-2xl py-3 pl-4 pr-10 border-transparent focus:border-blue-500 focus:ring-0 resize-none text-sm custom-scrollbar"
                                    rows={1}
                                    style={{minHeight: '44px', maxHeight: '100px'}}
                                />
                            </div>

                            {newMessage.trim() ? (
                                <button onClick={() => handleSendMessage(newMessage, 'text')} className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all hover:bg-blue-500 flex-shrink-0 h-[44px] w-[44px] flex items-center justify-center">
                                    <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                                </button>
                            ) : (
                                <button onClick={handleStartRecording} disabled={isSendingAudio} className="p-3 bg-gray-800 text-white rounded-xl border border-gray-700 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 transition-all active:scale-95 group flex-shrink-0 h-[44px] w-[44px] flex items-center justify-center">
                                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                </button>
                            )}
                        </div>
                    )}
                    {(isUploading || isSendingAudio) && (
                        <div className="absolute inset-x-0 bottom-full bg-blue-600/90 text-white text-[10px] font-black uppercase tracking-widest text-center py-1">
                            Processing Transfer...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ChatWidget;
