import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
    Send, Bot, User, Trash2, Shield, Copy, Check, Download, Sparkles, 
    Clock, RefreshCw, Plus, MessageSquare, 
    PanelLeft, ChevronRight, Brain, Cpu, Layers
} from 'lucide-react';
import StructuredMessage from './StructuredMessage';

const SUGGESTED_PROMPTS = [
    "Draw an Architecture Diagram of Microservices with API Gateway in Mermaid",
    "Explain Database Indexing & B-Trees with a visual flowchart",
    "Sequence diagram of OAuth 2.0 Authorization Code Grant",
    "Explain React 19 Server Components vs Client Components with a diagram",
];

const DEFAULT_GREETING = {
    role: 'ai',
    content: "👋 Hello! I am your **AI Study Buddy (Developer Edition)**.\n\nI am equipped with a **Hybrid Memory Architecture** (Tier-1 Short-Term Buffer + Tier-2 Long-Term Episodic Memory) and support **Multi-Session Management**.\n\nYou can create new chat sessions or switch between past topics in the left drawer. What would you like to master today?",
    shield: 'Active'
};

const ChatInterface = () => {
    // Session state
    const [conversations, setConversations] = useState([]);
    const [activeConvId, setActiveConvId] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [memoryModalOpen, setMemoryModalOpen] = useState(false);

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const messagesEndRef = useRef(null);

    // Concurrency / Race Condition tracking refs
    const activeConvIdRef = useRef(activeConvId);
    useEffect(() => {
        activeConvIdRef.current = activeConvId;
    }, [activeConvId]);
    const historyRequestGenRef = useRef(0);
    const location = useLocation();

    useEffect(() => {
        if (location.state?.triggerNewChat) {
            handleNewChat();
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 1. Fetch Conversations List on Mount
    const fetchConversations = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/conversations', { headers });
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
                if (data.length > 0 && !activeConvIdRef.current) {
                    setActiveConvId(data[0].id);
                }
            }
        } catch (err) {
            console.error("Error loading conversations:", err);
        }
    };

    // 2. Fetch Chat History for Active Conversation with generation guard
    const fetchChatHistory = async (convId) => {
        setLoadingHistory(true);
        const thisGen = ++historyRequestGenRef.current;
        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const url = convId ? `/api/chat?conversation_id=${convId}` : '/api/chat';
            const res = await fetch(url, { headers });
            
            // Check if this response is still for the current request generation and conversation
            if (thisGen !== historyRequestGenRef.current || convId !== activeConvIdRef.current) {
                return;
            }

            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    setMessages(data.map(item => ({
                        id: item.id,
                        role: item.role,
                        content: item.content,
                        shield: 'Active',
                        timestamp: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
                    })));
                } else {
                    setMessages([DEFAULT_GREETING]);
                }
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
        if (activeConvId) {
            fetchChatHistory(activeConvId);
        } else if (conversations.length === 0) {
            // Check if there are default chats
            fetchChatHistory(null);
        }
    }, [activeConvId]);

    useEffect(() => {
        if (!loadingHistory) {
            scrollToBottom();
        }
    }, [messages, isLoading, loadingHistory]);

    // Create New Chat Session
    const handleNewChat = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/conversations', {
                method: 'POST',
                headers,
                body: JSON.stringify({ title: 'New Study Session' })
            });

            if (res.ok) {
                const newConv = await res.json();
                setConversations(prev => [newConv, ...prev]);
                setActiveConvId(newConv.id);
                setMessages([DEFAULT_GREETING]);
            }
        } catch (err) {
            console.error("Error creating new session:", err);
        }
    };

    // Delete Session
    const handleDeleteSession = async (convId, e) => {
        e.stopPropagation();
        if (!confirm("Delete this entire study session?")) return;

        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/conversations/${convId}`, {
                method: 'DELETE',
                headers
            });

            if (res.ok) {
                const remaining = conversations.filter(c => c.id !== convId);
                setConversations(remaining);
                if (activeConvId === convId) {
                    if (remaining.length > 0) {
                        setActiveConvId(remaining[0].id);
                    } else {
                        setActiveConvId(null);
                        setMessages([DEFAULT_GREETING]);
                    }
                }
            }
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
        try {
            const token = localStorage.getItem('auth_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const url = activeConvId ? `/api/chat?conversation_id=${activeConvId}` : '/api/chat';
            const res = await fetch(url, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Unable to clear this session. Please try again.');
            setMessages([
                {
                    role: 'ai',
                    content: "🧹 Session memory cleared. What topic shall we explore next in this session?",
                    shield: 'Active'
                }
            ]);
            fetchConversations();
        } catch (err) {
            console.error(err);
            alert("Error clearing session memory.");
        }
    };

    const sendMessage = async (messageText) => {
        const textToSend = messageText || input;
        if (!textToSend.trim() || isLoading) return;

        const originatingConvId = activeConvId;
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userMessage = { role: 'user', content: textToSend, timestamp: currentTime };
        setMessages(prev => [...prev, userMessage]);
        if (!messageText) setInput('');
        setIsLoading(true);

        try {
            const token = localStorage.getItem('auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // 1. Attempt Real-Time SSE Token Streaming
            let streamSuccess = false;
            let accumulatedText = '';
            const streamMsgId = Date.now();
            let streamConvId = originatingConvId;

            try {
                const streamResponse = await fetch('/api/chat/stream', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ 
                        message: textToSend,
                        conversation_id: originatingConvId
                    }),
                });

                if (streamResponse.ok && streamResponse.body) {
                    const reader = streamResponse.body.getReader();
                    const decoder = new TextDecoder('utf-8');

                    // Insert initial streaming message only if user is still on the originating conversation
                    if (originatingConvId === activeConvIdRef.current) {
                        setMessages(prev => [
                            ...prev,
                            {
                                id: streamMsgId,
                                role: 'ai',
                                content: '',
                                isStreaming: true,
                                shield: 'Active',
                                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                        ]);
                    }

                    let doneReading = false;
                    let buffer = '';

                    while (!doneReading) {
                        const { value, done } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });

                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed.startsWith('data:')) continue;
                            const dataStr = trimmed.replace(/^data:\s*/, '');
                            if (dataStr === '[DONE]') {
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

                            if (parsed.conversation_id && parsed.conversation_id !== activeConvIdRef.current) {
                                streamConvId = parsed.conversation_id;
                                if (originatingConvId === activeConvIdRef.current || activeConvIdRef.current === null) {
                                    setActiveConvId(parsed.conversation_id);
                                    fetchConversations();
                                }
                            }
                            if (parsed.token) {
                                accumulatedText += parsed.token;
                                if (originatingConvId === activeConvIdRef.current || activeConvIdRef.current === streamConvId) {
                                    setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: accumulatedText } : m));
                                }
                            }
                        }
                    }

                    if (!doneReading) {
                        if (accumulatedText.length === 0) {
                            setMessages(prev => prev.filter(m => m.id !== streamMsgId));
                            throw new Error('Streaming connection closed unexpectedly before response was received.');
                        } else {
                            // Truncated stream EOF without [DONE]: indicate interrupted state
                            setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, isStreaming: false, content: accumulatedText + "\n\n*(Generation interrupted)*" } : m));
                            fetchConversations();
                            streamSuccess = true;
                            return;
                        }
                    }

                    // Mark streaming complete
                    setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, isStreaming: false } : m));
                    fetchConversations();
                    streamSuccess = true;
                    return;
                }
            } catch (streamErr) {
                console.warn('SSE Streaming connection failed:', streamErr);
                if (accumulatedText.length > 0) {
                    setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, isStreaming: false } : m));
                    return;
                }
                setMessages(prev => prev.filter(m => m.id !== streamMsgId));
            }

            if (!streamSuccess) {
                // 2. Fallback to standard synchronous endpoint
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ 
                        message: textToSend,
                        conversation_id: originatingConvId
                    }),
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.detail || 'Network response failed');
                }

                const data = await response.json();
                
                // If user switched conversation during in-flight generation, do not append to new room
                if (originatingConvId !== activeConvIdRef.current) {
                    if (originatingConvId === null && activeConvIdRef.current !== null) {
                        return;
                    } else if (originatingConvId !== null) {
                        return;
                    }
                }

                if (data.conversation_id && data.conversation_id !== activeConvId) {
                    setActiveConvId(data.conversation_id);
                    fetchConversations();
                } else {
                    fetchConversations();
                }

                const aiMessage = {
                    role: 'ai',
                    content: data.response,
                    shield: data.safety_shield || 'Active',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
                setMessages(prev => [...prev, aiMessage]);
            }
        } catch (error) {
            console.error('Error:', error);
            if (originatingConvId === activeConvIdRef.current) {
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
            if (originatingConvId === activeConvIdRef.current || activeConvIdRef.current === null) {
                setIsLoading(false);
            }
        }
    };

    const activeConv = conversations.find(c => c.id === activeConvId);

    return (
        <section className="py-6 sm:py-8">
            <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
                {/* Main Two-Column Container */}
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

                        {/* Sessions List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {conversations.length === 0 ? (
                                <div className="text-center py-10 px-4 text-slate-500 font-mono text-xs">
                                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p>No past sessions.</p>
                                    <button onClick={handleNewChat} className="mt-2 text-emerald-400 hover:underline">Create first chat</button>
                                </div>
                            ) : (
                                conversations.map((conv) => {
                                    const isActive = conv.id === activeConvId;
                                    return (
                                        <div
                                            key={conv.id}
                                            onClick={() => setActiveConvId(conv.id)}
                                            className={`group p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between text-xs border ${
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
                                                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                        <span>{conv.message_count} msgs</span>
                                                        {conv.long_term_summary && (
                                                            <span className="text-[9px] px-1 rounded bg-teal-500/20 text-teal-300">Hybrid</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={(e) => handleDeleteSession(conv.id, e)}
                                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-all"
                                                title="Delete this session"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Sidebar Footer: Hybrid Memory Status Card */}
                        <div className="p-3 border-t border-emerald-950/60 bg-[#080b12]">
                            <button
                                onClick={() => setMemoryModalOpen(true)}
                                className="w-full p-2.5 rounded-xl glass-panel text-left flex items-center justify-between text-xs hover:border-emerald-500/40 transition-all group"
                            >
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                    <div>
                                        <div className="font-bold text-slate-200 text-[11px]">Hybrid Memory</div>
                                        <div className="text-[10px] text-slate-500 font-mono">Tier-1 + Tier-2 Active</div>
                                    </div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                            </button>
                        </div>
                    </div>

                    {/* RIGHT: Active Chat Console */}
                    <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-[#0b0f17]/95 to-[#0e1626]/90">
                        {/* Top Header Bar */}
                        <div className="px-4 sm:px-6 py-3.5 bg-[#0e1626]/90 border-b border-emerald-950/60 flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <button
                                    onClick={() => setSidebarOpen(!sidebarOpen)}
                                    className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                                    title={sidebarOpen ? "Collapse Sessions Drawer" : "Expand Sessions Drawer"}
                                >
                                    <PanelLeft className="w-4 h-4" />
                                </button>

                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-bold text-white tracking-wide truncate">
                                            {activeConv ? activeConv.title : "AI Tutor Interactive Console"}
                                        </h2>
                                        <button
                                            onClick={() => setMemoryModalOpen(true)}
                                            className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                                            title="View Hybrid Memory Architecture Telemetry"
                                        >
                                            <Brain className="w-3 h-3 text-emerald-400" />
                                            <span>Hybrid Memory: Online</span>
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-mono truncate">
                                        {loadingHistory ? 'Restoring study session...' : `${messages.length} messages in working state`}
                                    </p>
                                </div>
                            </div>

                            {/* Top Utility Controls */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchChatHistory(activeConvId)}
                                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-700/50 transition-colors text-xs flex items-center gap-1.5 font-mono"
                                    title="Reload chat from database"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                                    <span className="hidden sm:inline">Sync</span>
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

                        {/* Chat Messages Body */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                            {loadingHistory && (
                                <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500 font-mono text-xs">
                                    <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                    <span>Restoring study conversation & learning context...</span>
                                </div>
                            )}

                            {!loadingHistory && messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'ai' && (
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-1 shadow-sm">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                    )}

                                    <div className={`relative group max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 sm:p-5 transition-all text-sm leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none shadow-[0_4px_20px_rgba(16,185,129,0.25)]'
                                            : msg.isError
                                            ? 'bg-rose-950/40 border border-rose-800/60 text-rose-200 rounded-bl-none'
                                            : 'bg-[#131b2e]/90 border border-white/5 text-slate-200 rounded-bl-none shadow-md backdrop-blur-md'
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

                                        <StructuredMessage content={msg.content} />
                                        {msg.isStreaming && (
                                            <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1 translate-y-0.5 rounded-sm" title="Streaming response..." />
                                        )}

                                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                                            {msg.role === 'ai' && !msg.isError ? (
                                                <span className="flex items-center gap-1 text-emerald-500/80">
                                                    <Shield className="w-2.5 h-2.5" /> Verified by Safety Guard
                                                </span>
                                            ) : (
                                                <span className="text-slate-400">Student</span>
                                            )}
                                            {msg.timestamp && (
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Clock className="w-2.5 h-2.5" /> {msg.timestamp}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {msg.role === 'user' && (
                                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1 shadow-sm">
                                            <User className="w-4 h-4" />
                                        </div>
                                    )}
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
                                        <span className="text-xs font-mono text-slate-400 ml-2">Reasoning with Hybrid Memory...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Suggested Chips (Only if fresh chat) */}
                        {messages.length <= 2 && (
                            <div className="px-4 py-2 bg-[#0d1422] border-t border-emerald-950/30 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
                                <span className="text-slate-500 font-mono flex items-center gap-1 shrink-0 text-[11px]">
                                    <Sparkles className="w-3 h-3 text-emerald-400" /> Quick Topics:
                                </span>
                                {SUGGESTED_PROMPTS.map((prompt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(prompt)}
                                        className="px-3 py-1 rounded-full bg-slate-900 hover:bg-emerald-950/70 border border-slate-800 hover:border-emerald-700/60 text-slate-300 hover:text-emerald-300 shrink-0 transition-all font-mono text-[11px]"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Chat Input Bar */}
                        <div className="p-4 bg-[#0e1626]/95 border-t border-emerald-950/60">
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
                                    placeholder="Ask a question in this session... (Hybrid Memory automatically retains context)"
                                    maxLength={3000}
                                    disabled={isLoading}
                                    className="w-full pl-4 pr-24 py-3.5 rounded-2xl glass-input text-sm font-sans placeholder:text-slate-500 text-slate-100"
                                />
                                <div className="absolute right-2 flex items-center gap-2">
                                    <span className={`text-[10px] font-mono hidden sm:inline ${input.length > 2500 ? 'text-amber-400' : 'text-slate-500'}`}>
                                        {input.length}/3000
                                    </span>
                                    <button
                                        type="submit"
                                        disabled={!input.trim() || isLoading}
                                        className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </form>
                        </div>
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
                                    <h3 className="text-base font-bold text-white">Hybrid Memory Architecture</h3>
                                    <p className="text-xs text-slate-400 font-mono">Cognitive Memory Engine Telemetry</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setMemoryModalOpen(false)}
                                className="text-xs font-mono text-slate-400 hover:text-white"
                            >
                                Close [ESC]
                            </button>
                        </div>

                        {/* Tier 1 Box */}
                        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Cpu className="w-4 h-4 text-emerald-400" />
                                    <span className="text-xs font-bold text-emerald-300 font-mono uppercase">Tier 1: Short-Term Working Buffer</span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">ACTIVE</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Retains the last <strong>8 conversation turns</strong> verbatim to guarantee immediate conversational coherence, variable bindings, and detailed code-snippet context.
                            </p>
                        </div>

                        {/* Tier 2 Box */}
                        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-teal-400" />
                                    <span className="text-xs font-bold text-teal-300 font-mono uppercase">Tier 2: Episodic Long-Term Memory</span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-400 font-bold">COMPACTOR</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                When a session extends beyond working capacity, older turns are distilled into rolling executive concept bullet points, eliminating context limits while permanently preserving learned insights.
                            </p>
                            {activeConv && activeConv.long_term_summary ? (
                                <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto">
                                    {activeConv.long_term_summary}
                                </div>
                            ) : (
                                <div className="text-[11px] font-mono text-slate-500 pt-1">
                                    Status: Awaiting session depth (&gt;10 turns) to trigger automatic consolidation.
                                </div>
                            )}
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={() => setMemoryModalOpen(false)}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ChatInterface;
