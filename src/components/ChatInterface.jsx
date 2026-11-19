import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    Send, Bot, User, Trash2, Shield, Copy, Check, Download, Sparkles, 
    Clock, RefreshCw, Plus, MessageSquare, Square,
    PanelLeft, ChevronRight, Brain, X, BookOpen, ExternalLink
} from 'lucide-react';
import StructuredMessage from './StructuredMessage';
import { apiRequest } from '../config/apiClient';

const SUGGESTED_PROMPTS = [
    "Explain how Photosynthesis works with a simple step-by-step diagram",
    "Help me understand Calculus derivatives and integrals with real-life examples",
    "Explain Database Indexing & B-Trees with a visual flowchart",
    "Summarize the key events and causes of World War II",
];

const DEFAULT_GREETING = {
    role: 'ai',
    content: "👋 Hello! I am your **AI Study Buddy**.\n\nI can help you understand complex concepts, create structured study notes, explain difficult topics step-by-step, and generate visual diagrams.\n\nYou can start a new study session or review past sessions in the left drawer. What would you like to learn today?",
    shield: 'Active',
    citations: []
};

// Pluralization helper
const formatCount = (count, singular, plural = `${singular}s`) => {
    return `${count} ${count === 1 ? singular : plural}`;
};

// Relative date helper
const formatRelativeDate = (dateString) => {
    if (!dateString) return '';
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const diffMs = now - d;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
};

const ChatInterface = () => {
    // Session state
    const [conversations, setConversations] = useState([]);
    const [conversationsLoaded, setConversationsLoaded] = useState(false);
    const [activeConvId, setActiveConvId] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [memoryModalOpen, setMemoryModalOpen] = useState(false);

    // Citation side rail state (FIX-02, FIX-03)
    const [selectedCitation, setSelectedCitation] = useState(null);
    const [railOpen, setRailOpen] = useState(false);
    const triggerPillRef = useRef(null);

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);

    // Concurrency / Race Condition tracking refs
    const activeConvIdRef = useRef(activeConvId);
    useEffect(() => {
        activeConvIdRef.current = activeConvId;
    }, [activeConvId, conversations.length]);
    const historyRequestGenRef = useRef(0);
    const location = useLocation();

    useEffect(() => {
        if (location.state?.triggerNewChat) {
            handleNewChat();
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const activeSendCountRef = useRef(0);
    const sendGenerationRef = useRef(0);
    const invalidatedConvsRef = useRef(new Set());
    const abortControllerRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchConversationsGenRef = useRef(0);

    // 1. Fetch Conversations List on Mount
    const fetchConversations = async () => {
        const thisFetchGen = ++fetchConversationsGenRef.current;
        try {
            const data = await apiRequest('/api/conversations', { auth: 'required' });
            if (thisFetchGen !== fetchConversationsGenRef.current) return;
            setConversations(data);
            if (data.length > 0 && !activeConvIdRef.current) {
                activeConvIdRef.current = data[0].id;
                setActiveConvId(data[0].id);
            }
        } catch (err) {
            console.error("Error loading conversations:", err);
        } finally {
            if (thisFetchGen === fetchConversationsGenRef.current) {
                setConversationsLoaded(true);
            }
        }
    };

    // 2. Fetch Chat History for Active Conversation
    const fetchChatHistory = async (convId) => {
        setLoadingHistory(true);
        const thisGen = ++historyRequestGenRef.current;
        try {
            const url = convId ? `/api/chat?conversation_id=${convId}` : '/api/chat';
            const data = await apiRequest(url, { auth: 'required' });
            
            if (thisGen !== historyRequestGenRef.current || convId !== activeConvIdRef.current) {
                return;
            }

            if (data && data.length > 0) {
                setMessages(data.map(item => ({
                    id: item.id,
                    role: item.role,
                    content: item.content,
                    citations: item.citations || [],
                    shield: 'Active',
                    timestamp: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
                })));
            } else {
                setMessages([DEFAULT_GREETING]);
            }
        } catch (err) {
            console.error("Error loading messages:", err);
            if (thisGen === historyRequestGenRef.current && convId === activeConvIdRef.current) {
                setMessages([DEFAULT_GREETING]);
            }
        } finally {
            if (thisGen === historyRequestGenRef.current) {
                setLoadingHistory(false);
            }
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (!conversationsLoaded) return;
        if (activeConvId) {
            fetchChatHistory(activeConvId);
        } else {
            historyRequestGenRef.current++;
            setLoadingHistory(false);
            if (conversations.length === 0) {
                fetchChatHistory(null);
            } else {
                setMessages([DEFAULT_GREETING]);
            }
        }
    }, [activeConvId, conversationsLoaded, conversations.length]);

    useEffect(() => {
        if (!loadingHistory) {
            scrollToBottom();
        }
    }, [messages, isLoading, loadingHistory]);

    // Handle Citation Click
    const handleSelectCitation = (citation, pillElement) => {
        if (pillElement) {
            triggerPillRef.current = pillElement;
        }
        setSelectedCitation(citation);
        setRailOpen(true);
    };

    const handleCloseRail = () => {
        setRailOpen(false);
        if (triggerPillRef.current && typeof triggerPillRef.current.focus === 'function') {
            triggerPillRef.current.focus();
        }
    };

    // Keyboard ESC to close rail
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && railOpen) {
                handleCloseRail();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [railOpen]);

    // Create New Chat Session
    const handleNewChat = async () => {
        try {
            const newConv = await apiRequest('/api/conversations', {
                method: 'POST',
                auth: 'required',
                json: { title: 'New Study Session' },
            });
            setConversations(prev => [newConv, ...prev]);
            setActiveConvId(newConv.id);
            setMessages([DEFAULT_GREETING]);
        } catch (err) {
            console.error("Error creating new session:", err);
        }
    };

    // Delete Session
    const handleDeleteSession = async (convId, e) => {
        e.stopPropagation();
        if (!confirm("Delete this entire study session?")) return;
        invalidatedConvsRef.current.add(convId);
        sendGenerationRef.current += 1;

        try {
            await apiRequest(`/api/conversations/${convId}`, {
                method: 'DELETE',
                auth: 'required',
                responseType: 'none',
            });

            setConversations(prev => {
                const remaining = prev.filter(c => c.id !== convId);
                if (activeConvIdRef.current === convId) {
                    if (remaining.length > 0) {
                        activeConvIdRef.current = remaining[0].id;
                        setActiveConvId(remaining[0].id);
                    } else {
                        activeConvIdRef.current = null;
                        setActiveConvId(null);
                        setMessages([DEFAULT_GREETING]);
                    }
                }
                return remaining;
            });
        } catch (err) {
            console.error("Error deleting session:", err);
        }
    };

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleExportMarkdown = () => {
        const activeConv = conversations.find(c => c.id === activeConvId);
        const title = activeConv ? activeConv.title : 'Study Session';
        const markdown = `# 🎓 ${title}\n\n` + messages.map(m => `### ${m.role === 'user' ? '🧑 Student' : '🤖 AI Study Buddy'}\n\n${m.content}\n`).join('\n---\n\n');
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const clearCurrentChat = async () => {
        if (!confirm("Clear messages in this current study session?")) return;
        const targetConv = activeConvId;
        const clearKey = targetConv || 'current';
        try {
            const url = activeConvId ? `/api/chat?conversation_id=${activeConvId}` : '/api/chat';
            await apiRequest(url, {
                method: 'DELETE',
                auth: 'required',
                responseType: 'none',
            });
            
            invalidatedConvsRef.current.add(clearKey);
            sendGenerationRef.current += 1;
            invalidatedConvsRef.current.delete(clearKey);

            setMessages([
                {
                    role: 'ai',
                    content: "🧹 Session memory cleared. What topic shall we explore next in this session?",
                    shield: 'Active',
                    citations: []
                }
            ]);
            fetchConversations();
        } catch (err) {
            console.error("Error clearing chat:", err);
        }
    };

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    // Send Message
    const sendMessage = async (presetPrompt = null) => {
        const textToSend = (presetPrompt || input).trim();
        if (!textToSend || isLoading) return;

        const originatingConvId = activeConvIdRef.current;
        const thisSendGen = ++sendGenerationRef.current;
        const clearKey = originatingConvId || 'current';

        const isStillCurrentConv = () => {
            return (
                thisSendGen === sendGenerationRef.current &&
                originatingConvId === activeConvIdRef.current &&
                !invalidatedConvsRef.current.has(clearKey)
            );
        };

        const userMessage = {
            role: 'user',
            content: textToSend,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, userMessage]);
        if (!presetPrompt) setInput('');
        setIsLoading(true);
        activeSendCountRef.current += 1;

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            let streamSuccess = false;
            let streamAccepted = false;
            let accumulatedText = '';
            let streamCitations = [];
            const streamMsgId = 'stream-' + Date.now();
            let streamConvId = originatingConvId;

            // RAF throttling state
            let rafPending = false;
            let pendingText = '';
            const scheduleUpdate = () => {
                if (rafPending) return;
                rafPending = true;
                requestAnimationFrame(() => {
                    rafPending = false;
                    if (isStillCurrentConv()) {
                        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: pendingText, citations: streamCitations } : m));
                    }
                });
            };

            try {
                const token = localStorage.getItem('auth_token');
                const streamUrl = originatingConvId ? `/api/chat/stream?conversation_id=${originatingConvId}` : '/api/chat/stream';
                const response = await fetch(streamUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        message: textToSend,
                        conversation_id: originatingConvId
                    }),
                    signal: abortController.signal
                });

                if (response.ok && response.body) {
                    streamAccepted = true;
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    if (isStillCurrentConv()) {
                        setMessages(prev => [
                            ...prev,
                            {
                                id: streamMsgId,
                                role: 'ai',
                                content: '',
                                citations: [],
                                isStreaming: true,
                                shield: 'Active',
                                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                        ]);
                    }

                    let doneReading = false;
                    let receivedDone = false;
                    let buffer = '';

                    while (!doneReading) {
                        const { value, done } = await reader.read();
                        if (!isStillCurrentConv() || abortController.signal.aborted) {
                            reader.cancel().catch(() => {});
                            return;
                        }
                        if (done) {
                            buffer += decoder.decode();
                            doneReading = true;
                        } else {
                            buffer += decoder.decode(value, { stream: true });
                        }

                        const lines = buffer.split('\n');
                        if (done) {
                            buffer = '';
                        } else {
                            buffer = lines.pop() ?? '';
                        }

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed.startsWith('data:')) continue;
                            const dataStr = trimmed.replace(/^data:\s*/, '');
                            if (dataStr === '[DONE]') {
                                receivedDone = true;
                                doneReading = true;
                                break;
                            }

                            let parsed = null;
                            try {
                                parsed = JSON.parse(dataStr);
                            } catch {
                                continue;
                            }

                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }

                            if (parsed.conversation_id) {
                                streamConvId = parsed.conversation_id;
                                if (originatingConvId === activeConvIdRef.current || (originatingConvId === null && activeConvIdRef.current === null)) {
                                    activeConvIdRef.current = parsed.conversation_id;
                                    setActiveConvId(parsed.conversation_id);
                                    fetchConversations();
                                }
                            }
                            if (parsed.citations) {
                                streamCitations = parsed.citations;
                                if (isStillCurrentConv()) {
                                    setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, citations: streamCitations } : m));
                                }
                            }
                            if (parsed.token || parsed.chunk) {
                                accumulatedText += (parsed.token || parsed.chunk);
                                pendingText = accumulatedText;
                                scheduleUpdate();
                            }
                        }
                    }

                    if (!receivedDone && accumulatedText.length === 0) {
                        if (isStillCurrentConv()) {
                            setMessages(prev => prev.filter(m => m.id !== streamMsgId));
                        }
                        throw new Error('Streaming connection closed unexpectedly before response was received.');
                    } else if (!receivedDone) {
                        if (isStillCurrentConv()) {
                            setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, isStreaming: false, content: accumulatedText + "\n\n*(Generation stopped)*" } : m));
                        }
                        fetchConversations();
                        streamSuccess = true;
                        return;
                    }

                    if (isStillCurrentConv()) {
                        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, isStreaming: false, content: accumulatedText, citations: streamCitations } : m));
                    }
                    fetchConversations();
                    streamSuccess = true;
                    return;
                }
            } catch (streamErr) {
                if (abortController.signal.aborted) {
                    if (isStillCurrentConv()) {
                        setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, isStreaming: false, content: accumulatedText + "\n\n*(Generation stopped by student)*" } : m));
                    }
                    fetchConversations();
                    return;
                }
                console.warn('SSE Streaming connection failed:', streamErr);
                if (accumulatedText.length > 0) {
                    if (isStillCurrentConv()) {
                        setMessages(prev => prev.map(m => m.id === streamMsgId ? { 
                            ...m, 
                            content: m.content + '\n\n*(Response interrupted due to network issue)*',
                            isStreaming: false,
                            isInterrupted: true 
                        } : m));
                        fetchConversations();
                    }
                    return;
                }
                if (isStillCurrentConv()) {
                    setMessages(prev => prev.filter(m => m.id !== streamMsgId));
                }
            }

            if (!streamSuccess) {
                if (streamAccepted) {
                    if (accumulatedText.length === 0 && isStillCurrentConv()) {
                        setMessages(prev => [
                            ...prev,
                            {
                                role: 'ai',
                                content: '⚠️ **Stream Interrupted**: The server began generating your response, but the network stream closed prematurely. Please try again.',
                                isError: true
                            }
                        ]);
                    }
                    return;
                }

                // Fallback to standard synchronous endpoint
                const data = await apiRequest('/api/chat', {
                    method: 'POST',
                    auth: 'required',
                    json: {
                        message: textToSend,
                        conversation_id: originatingConvId
                    },
                });
                
                if (!isStillCurrentConv()) return;

                if (data.conversation_id && data.conversation_id !== activeConvId) {
                    streamConvId = data.conversation_id;
                    activeConvIdRef.current = data.conversation_id;
                    setActiveConvId(data.conversation_id);
                    fetchConversations();
                } else {
                    fetchConversations();
                }

                const aiMessage = {
                    role: 'ai',
                    content: data.response,
                    citations: data.citations || [],
                    shield: data.safety_shield || 'Active',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setMessages(prev => [...prev, aiMessage]);
            }
        } catch (error) {
            console.error('Error:', error);
            if (isStillCurrentConv()) {
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'ai',
                        content: `⚠️ **Session Error**: ${error.message || 'Unable to connect to AI engine. Please check your network or try again in a moment.'}`,
                        isError: true
                    }
                ]);
            }
        } finally {
            activeSendCountRef.current = Math.max(0, activeSendCountRef.current - 1);
            if (activeSendCountRef.current === 0) {
                setIsLoading(false);
            }
        }
    };

    const activeConv = conversations.find(c => c.id === activeConvId);

    // Group conversations by date bucket (FIX-04)
    const groupedConversations = conversations.reduce((acc, conv) => {
        const bucket = formatRelativeDate(conv.updated_at || conv.created_at) || 'Earlier';
        if (!acc[bucket]) acc[bucket] = [];
        acc[bucket].push(conv);
        return acc;
    }, {});

    // Active session all citations for rail default
    const allSessionCitations = messages
        .filter(m => m.role === 'ai' && m.citations && m.citations.length > 0)
        .flatMap(m => m.citations);

    return (
        <section className="py-4 sm:py-6">
            <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
                {/* Main Viewport Container */}
                <div className="flex h-[780px] w-full rounded-3xl glass-panel shadow-2xl overflow-hidden border border-emerald-950/40 relative">
                    
                    {/* LEFT SIDEBAR: Multi-Session Manager */}
                    <div className={`transition-all duration-300 border-r border-emerald-950/60 bg-[#090d15]/95 flex flex-col ${
                        sidebarOpen ? 'w-72 sm:w-80' : 'w-0 -ml-72 sm:-ml-80'
                    } overflow-hidden shrink-0 z-20`}>
                        {/* Sidebar Header */}
                        <div className="p-4 border-b border-emerald-950/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                                    Study Sessions
                                </span>
                            </div>
                            <button
                                onClick={handleNewChat}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                title="Start a fresh chat session"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>New Chat</span>
                            </button>
                        </div>

                        {/* Sessions List with Date Buckets (FIX-04) */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-4">
                            {conversations.length === 0 ? (
                                <div className="text-center py-10 px-4 text-slate-500 font-mono text-xs">
                                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p>No past sessions.</p>
                                    <button onClick={handleNewChat} className="mt-2 text-emerald-400 hover:underline">Create first chat</button>
                                </div>
                            ) : (
                                Object.entries(groupedConversations).map(([bucketName, convs]) => (
                                    <div key={bucketName} className="space-y-1.5">
                                        <div className="px-2 text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                                            {bucketName}
                                        </div>
                                        {convs.map((conv) => {
                                            const isActive = conv.id === activeConvId;
                                            return (
                                                <div
                                                    key={conv.id}
                                                    onClick={() => setActiveConvId(conv.id)}
                                                    title={conv.title || "Study Session"}
                                                    className={`group p-2.5 rounded-2xl cursor-pointer transition-all flex items-center justify-between text-xs border ${
                                                        isActive
                                                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                                            : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                                                        <div className="min-w-0">
                                                            <div className="font-semibold truncate max-w-[170px] text-slate-100">
                                                                {conv.title || "Study Session"}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                                <span>{formatCount(conv.message_count || 0, 'msg')}</span>
                                                                {conv.updated_at && (
                                                                    <span className="text-[10px] text-slate-600">· {formatRelativeDate(conv.updated_at)}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => handleDeleteSession(conv.id, e)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-all shrink-0"
                                                        title="Delete this session"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Sidebar Footer */}
                        <div className="p-3 border-t border-emerald-950/60 bg-[#080b12]">
                            <button
                                onClick={() => setMemoryModalOpen(true)}
                                className="w-full p-2.5 rounded-xl glass-panel text-left flex items-center justify-between text-xs hover:border-emerald-500/40 transition-all group"
                            >
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                    <div>
                                        <div className="font-bold text-slate-200 text-[11px]">Smart Memory</div>
                                        <div className="text-[10px] text-slate-500">Context Saved Across Chats</div>
                                    </div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                        </div>
                    </div>

                    {/* MAIN TWO-COLUMN CHAT & CITATION VIEWPORT (FIX-03) */}
                    <div className="flex-1 flex h-full min-w-0 bg-gradient-to-b from-[#0b0f17]/95 to-[#0e1626]/90 relative">
                        
                        {/* Center Messages Column */}
                        <main className="flex-1 flex flex-col min-w-0 h-full">
                            {/* Top Header Bar */}
                            <div className="px-4 sm:px-6 py-3 bg-[#0e1626]/90 border-b border-emerald-950/60 flex items-center justify-between min-w-0 shrink-0">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <button
                                        onClick={() => setSidebarOpen(!sidebarOpen)}
                                        className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                                        title={sidebarOpen ? "Collapse Sessions Drawer" : "Expand Sessions Drawer"}
                                    >
                                        <PanelLeft className="w-4 h-4" />
                                    </button>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h2 className="text-sm font-bold text-white tracking-wide truncate max-w-full">
                                                {activeConv ? activeConv.title : "AI Study Companion"}
                                            </h2>
                                            <button
                                                onClick={() => setMemoryModalOpen(true)}
                                                className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors shrink-0"
                                                title="View Smart Memory Details"
                                            >
                                                <Brain className="w-3 h-3 text-emerald-400" />
                                                <span>Smart Memory</span>
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-slate-400 truncate">
                                            {loadingHistory ? 'Restoring study session...' : `${formatCount(messages.length, 'message')} in this session`}
                                        </p>
                                    </div>
                                </div>

                                {/* Top Utility Controls */}
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <button
                                        onClick={() => setRailOpen(!railOpen)}
                                        className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 font-mono transition-colors ${
                                            railOpen 
                                                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' 
                                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-300'
                                        }`}
                                        title="View Grounded Source References"
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Sources</span>
                                    </button>
                                    <button
                                        onClick={() => fetchChatHistory(activeConvId)}
                                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-700/50 transition-colors text-xs flex items-center gap-1.5 font-mono"
                                        title="Reload chat from database"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                                        <span className="hidden sm:inline">Sync sources</span>
                                    </button>
                                    <button
                                        onClick={handleExportMarkdown}
                                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-700/50 transition-colors text-xs flex items-center gap-1.5 font-mono"
                                        title="Export conversation to Markdown"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Export</span>
                                    </button>
                                    <button
                                        onClick={clearCurrentChat}
                                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-800/50 transition-colors text-xs flex items-center gap-1.5 font-mono"
                                        title="Clear conversation history in this session"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Clear</span>
                                    </button>
                                </div>
                            </div>

                            {/* Chat Messages Body with max-w-[72ch] Centering (FIX-01, FIX-03, FIX-05) */}
                            <div 
                                ref={scrollContainerRef}
                                className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5 pb-20"
                            >
                                <div className="mx-auto w-full max-w-[72ch] space-y-5">
                                    {loadingHistory && (
                                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500 font-mono text-xs">
                                            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                            <span>Restoring study conversation & learning context...</span>
                                        </div>
                                    )}

                                    {!loadingHistory && messages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex flex-col gap-1.5 my-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                                        >
                                            <div className="flex items-center gap-2 px-1 text-xs font-mono text-slate-400">
                                                <span className="font-semibold text-slate-300">
                                                    {msg.role === 'user' ? 'You' : 'AI Study Assistant'}
                                                </span>
                                                {msg.timestamp && (
                                                    <span className="text-slate-400">· {msg.timestamp}</span>
                                                )}
                                            </div>

                                            <div className="flex gap-3 sm:gap-4 w-full">
                                                {msg.role === 'ai' && (
                                                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-1 shadow-sm">
                                                        <Bot className="w-4 h-4" />
                                                    </div>
                                                )}

                                                <div className={`relative group transition-all text-sm leading-relaxed ${
                                                    msg.role === 'user'
                                                        ? 'ml-auto max-w-[52ch] rounded-2xl p-4 sm:p-5 bg-emerald-500/15 border border-emerald-500/30 text-white rounded-br-none shadow-[0_4px_20px_rgba(16,185,129,0.2)]'
                                                        : msg.isError
                                                        ? 'max-w-[90%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-bl-none'
                                                        : 'max-w-[90%] sm:max-w-[85%] rounded-2xl p-4 sm:p-5 bg-[#131b2e]/90 border border-white/10 text-slate-200 rounded-bl-none shadow-md backdrop-blur-md'
                                                }`}>
                                                    <button
                                                        onClick={() => handleCopy(msg.content, idx)}
                                                        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-black/40 hover:bg-black/60 text-slate-300 transition-all text-xs"
                                                        title="Copy message"
                                                    >
                                                        {copiedIndex === idx ? (
                                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>

                                                    <StructuredMessage 
                                                        content={msg.content} 
                                                        citations={msg.citations || []}
                                                        onSelectCitation={(cit) => handleSelectCitation(cit)}
                                                    />
                                                    {msg.isStreaming && (
                                                        <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1 translate-y-0.5 rounded-sm" title="Streaming response..." />
                                                    )}

                                                    {msg.role === 'ai' && !msg.isError && msg.citations && msg.citations.length > 0 && (
                                                        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
                                                            <span className="flex items-center gap-1 text-emerald-400">
                                                                <Shield className="w-3 h-3" />
                                                                {msg.citations.length} sources cited
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {msg.role === 'user' && (
                                                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1 shadow-sm">
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {isLoading && !messages.some(m => m.isStreaming) && (
                                        <div className="flex gap-3 justify-start">
                                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                                <Bot className="w-4 h-4 animate-pulse" />
                                            </div>
                                            <div className="bg-[#131b2e]/90 border border-white/5 p-4 rounded-2xl rounded-bl-none flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
                                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0.4s' }} />
                                                <span className="text-xs font-mono text-slate-400 ml-2">AI Tutor is thinking...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* Suggested Chips with right fade mask (FIX-21 / B3) */}
                            {messages.length <= 2 && (
                                <div 
                                    className="px-4 py-2 bg-[#0d1422] border-t border-emerald-950/30 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar shrink-0"
                                    style={{
                                        maskImage: 'linear-gradient(to right, black 85%, transparent)',
                                        WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent)'
                                    }}
                                >
                                    <span className="text-slate-400 font-mono flex items-center gap-1 shrink-0 text-xs">
                                        <Sparkles className="w-3 h-3 text-emerald-400" /> Quick Topics:
                                    </span>
                                    {[
                                        "Photosynthesis step-by-step diagram",
                                        "Calculus derivatives with real examples",
                                        "Database Indexing & B-Trees",
                                        "Causes of World War II"
                                    ].map((prompt, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setInput(prompt)}
                                            className="px-3 py-1 rounded-full bg-slate-900 hover:bg-emerald-950/70 border border-white/15 hover:border-emerald-500/50 text-slate-300 hover:text-white shrink-0 transition-all font-mono text-xs max-w-[42ch] truncate cursor-pointer"
                                            title={prompt}
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Sticky Chat Input Bar */}
                            <div className="p-4 bg-[#0e1626]/95 border-t border-emerald-950/60 shrink-0">
                                <div className="mx-auto w-full max-w-[72ch]">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            sendMessage();
                                        }}
                                        className="relative flex items-center"
                                    >
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Ask a question in this session... (Context automatically retained)"
                                            maxLength={3000}
                                            disabled={isLoading}
                                            className="w-full pl-4 pr-24 py-3.5 rounded-2xl glass-input text-sm font-sans placeholder:text-slate-500 text-slate-100"
                                        />
                                        <div className="absolute right-2 flex items-center gap-2">
                                            <span className={`text-[10px] font-mono hidden sm:inline ${input.length > 2500 ? 'text-amber-400' : 'text-slate-500'}`}>
                                                {input.length}/3000
                                            </span>
                                            {isLoading ? (
                                                <button
                                                    type="button"
                                                    onClick={handleStopGeneration}
                                                    className="px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white flex items-center gap-1.5 text-xs font-mono transition-all active:scale-95 shadow-[0_0_15px_rgba(225,29,72,0.4)]"
                                                    title="Stop generating response"
                                                >
                                                    <Square className="w-3.5 h-3.5 fill-current" />
                                                    <span className="hidden sm:inline">Stop</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="submit"
                                                    disabled={!input.trim()}
                                                    className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                                    title="Send message"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </main>

                        {/* RIGHT SOURCE RAIL / SLIDE-OVER (FIX-02, FIX-03) */}
                        <aside className={`
                            ${railOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0 xl:block'}
                            fixed xl:static inset-y-0 right-0 z-30 xl:z-auto
                            w-[min(360px,90vw)] xl:w-[340px] shrink-0
                            bg-[#090d16] xl:bg-[#090d16]/90
                            border-l border-white/10 flex flex-col h-full
                            transition-transform duration-300 ease-in-out shadow-2xl xl:shadow-none
                        `}>
                            {/* Rail Header */}
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-emerald-400" />
                                    <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                                        Source Citations
                                    </h3>
                                </div>
                                <button
                                    onClick={handleCloseRail}
                                    className="p-1.5 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                                    aria-label="Close source rail"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Rail Body */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {selectedCitation ? (
                                    <div className="space-y-3 animate-in fade-in duration-200">
                                        <div className="flex items-center justify-between">
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/40">
                                                Citation [{selectedCitation.n || '1'}]
                                            </span>
                                            {selectedCitation.source_id && (
                                                <span className="text-[11px] font-mono text-slate-500">
                                                    ID: #{selectedCitation.source_id}
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                                            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                                                <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                <span className="truncate">{selectedCitation.source_title || 'Uploaded Document'}</span>
                                            </h4>
                                            {selectedCitation.locator && (
                                                <div className="text-[11px] font-mono text-slate-400">
                                                    Locator: {selectedCitation.locator}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5">
                                            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
                                                Grounded Excerpt:
                                            </span>
                                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-slate-200 text-xs leading-relaxed font-sans">
                                                <span className="bg-emerald-500/20 px-1 py-0.5 rounded text-emerald-200">
                                                    {selectedCitation.quote || selectedCitation.text || "Direct excerpt from study corpus supporting this statement."}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : allSessionCitations.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                                            All Citations in this Session:
                                        </div>
                                        {allSessionCitations.map((cit, i) => (
                                            <div 
                                                key={i}
                                                onClick={() => setSelectedCitation(cit)}
                                                className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 cursor-pointer transition-all space-y-1.5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-emerald-400">[{cit.n || i + 1}] {cit.source_title || 'Document'}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                                                    {cit.quote || "Document excerpt"}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center space-y-2 text-slate-500 font-mono text-xs">
                                        <BookOpen className="w-8 h-8 mx-auto opacity-30 text-emerald-400" />
                                        <p>No citations for this session yet.</p>
                                        <p className="text-[11px] text-slate-600">Upload materials in Sources to enable grounded retrieval.</p>
                                    </div>
                                )}
                            </div>

                            {/* Session Context Card Footer */}
                            <div className="p-4 border-t border-white/10 bg-[#070a10] text-[11px] font-mono text-slate-400 space-y-1">
                                <div className="flex justify-between">
                                    <span>Active Session:</span>
                                    <span className="text-slate-200 font-semibold truncate max-w-[150px]">{activeConv?.title || 'Default'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Messages:</span>
                                    <span className="text-slate-200">{messages.length}</span>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>

            {/* Hybrid Memory Architecture Telemetry Modal */}
            {memoryModalOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setMemoryModalOpen(false)}
                >
                    <div
                        className="glass-panel-glow max-w-xl w-full rounded-3xl p-6 sm:p-8 border border-emerald-500/30 shadow-2xl space-y-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                                    <Brain className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Smart Study Memory</h3>
                                    <p className="text-xs text-slate-400">How your AI Tutor remembers your sessions</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setMemoryModalOpen(false)}
                                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                            Study Buddy combines short-term conversational context with an episodic long-term memory buffer so you can continue learning across sessions seamlessly.
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ChatInterface;
