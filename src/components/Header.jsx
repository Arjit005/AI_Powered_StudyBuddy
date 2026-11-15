import React, { useState, useEffect } from 'react';
import { Brain, LogOut, Shield, ShieldCheck, Activity, Terminal, ChevronDown, CheckCircle2, User as UserIcon, Search } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [securityOpen, setSecurityOpen] = useState(false);
    const [securityData, setSecurityData] = useState(null);
    const [apiLatency, setApiLatency] = useState('12ms');
    const [user, setUser] = useState(null);

    useEffect(() => {
        try {
            const rawUser = localStorage.getItem('user');
            if (rawUser) {
                setUser(JSON.parse(rawUser));
            }
        } catch (e) {
            console.error(e);
        }

        // Fetch security telemetry from backend with unmount & single-flight protection
        let isMounted = true;
        let isPolling = false;

        const fetchTelemetry = async () => {
            if (isPolling) return;
            isPolling = true;
            const start = performance.now();
            try {
                const res = await fetch('/api/security/status');
                const duration = Math.round(performance.now() - start);
                if (!isMounted) return;

                if (res.ok) {
                    const data = await res.json();
                    setSecurityData(data);
                    setApiLatency(`${duration}ms`);
                } else {
                    setSecurityData(null);
                    setApiLatency('Unavailable');
                }
            } catch (err) {
                if (isMounted) {
                    setSecurityData(null);
                    setApiLatency('Offline');
                }
            } finally {
                isPolling = false;
            }
        };

        fetchTelemetry();
        const interval = setInterval(fetchTelemetry, 30000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const navLinks = [
        { path: '/', label: 'Dashboard' },
        { path: '/chat', label: 'AI Tutor' },
        { path: '/sources', label: 'Sources' },
        { path: '/canvas', label: 'Canvas Studio' },
        { path: '/library', label: 'Library' },
        { path: '/quiz', label: 'Quiz' },
        { path: '/flashcards', label: 'Flashcards' },
        { path: '/summarize', label: 'Summarizer' },
        { path: '/maps', label: 'Concept Map' },
        { path: '/timer', label: 'Focus Timer' },
        { path: '/progress', label: 'Analytics' },
    ];

    return (
        <header className="sticky top-0 z-50 bg-[#0b0f17]/80 backdrop-blur-xl border-b border-emerald-950/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Brand Logo */}
                    <div className="flex items-center gap-6">
                        <Link to="/" className="flex items-center gap-2.5 group">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center group-hover:border-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                                <Brain className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                                    AI Study Buddy
                                </span>
                                <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-500/70 -mt-1">
                                    Developer Edition
                                </span>
                            </div>
                        </Link>

                        {/* Security Guard Telemetry Pill */}
                        <div className="relative hidden md:block">
                            <button
                                onClick={() => setSecurityOpen(!securityOpen)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer shadow-sm ${
                                    securityData?.shield_active 
                                        ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50 hover:bg-emerald-900/40' 
                                        : 'bg-amber-950/50 text-amber-300 border border-amber-800/50 hover:bg-amber-900/40'
                                }`}
                                title="Click to view AI Safety Shield status"
                            >
                                <span className={`w-2 h-2 rounded-full ${securityData?.shield_active ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                                <ShieldCheck className={`w-3.5 h-3.5 ${securityData?.shield_active ? 'text-emerald-400' : 'text-amber-400'}`} />
                                <span>Shield: {securityData?.shield_active ? 'Active' : 'Degraded'}</span>
                                <span className="text-emerald-500/60">|</span>
                                <span className="text-slate-400">{apiLatency}</span>
                                <ChevronDown className={`w-3 h-3 text-emerald-400 transition-transform ${securityOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Security Telemetry Popover */}
                            {securityOpen && (
                                <div className="absolute top-10 left-0 w-80 p-4 rounded-2xl glass-panel-glow border border-emerald-500/30 shadow-2xl z-50 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/20">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">Security Guard Telemetry</span>
                                        </div>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">v1.2.0</span>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-start gap-2 text-slate-300">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                            <div>
                                                <div className="font-semibold text-white">Rate Limiter & Brute-Force</div>
                                                <div className="text-[11px] text-slate-400">IP sliding-window with auto-lockout</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-slate-300">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                            <div>
                                                <div className="font-semibold text-white">Prompt Injection Guard</div>
                                                <div className="text-[11px] text-slate-400">Heuristic jailbreak & system override filter</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-slate-300">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                            <div>
                                                <div className="font-semibold text-white">Academic Safety Filter</div>
                                                <div className="text-[11px] text-slate-400">Content moderation & input sanitization</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-slate-300">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                            <div>
                                                <div className="font-semibold text-white">HTTP Security Headers</div>
                                                <div className="text-[11px] text-slate-400">nosniff, DENY-clickjack, referrer-policy</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-emerald-500/20 flex justify-between items-center text-[11px] font-mono text-emerald-400">
                                        <span>Status: ENFORCING</span>
                                        <button onClick={() => setSecurityOpen(false)} className="hover:text-white underline">Close</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Nav Links */}
                    <nav className="hidden lg:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
                        {navLinks.map((link) => {
                            const isActive = location.pathname === link.path;
                            return (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        isActive
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                                    }`}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User & Actions */}
                    <div className="flex items-center gap-2.5">
                        {/* Command Palette Trigger */}
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('study-buddy:open-palette'))}
                            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-emerald-500/40 text-xs font-mono transition-all"
                            title="Command Palette (Ctrl+K)"
                        >
                            <Search className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[11px]">Search</span>
                            <kbd className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-slate-300 border border-white/10">⌘K</kbd>
                        </button>

                        {user ? (
                            <>
                                <div className="hidden sm:flex items-center gap-2 pl-3 py-1 pr-1 bg-slate-900/80 border border-slate-800 rounded-xl">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs uppercase">
                                        {typeof user.username === 'string' && user.username ? user.username.slice(0, 2) : 'SB'}
                                    </div>
                                    <span className="text-xs font-mono text-slate-300 max-w-[100px] truncate">{user.username}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold border border-emerald-500/20">PRO</span>
                                </div>

                                <button
                                    onClick={handleLogout}
                                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-xl border border-transparent hover:border-rose-900/40 hover:bg-rose-950/20 transition-all font-medium"
                                    title="Sign out of session"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Logout</span>
                                </button>
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/login"
                                    className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition-all"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    to="/signup"
                                    className="hidden sm:inline-block text-xs font-medium text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/10 transition-all"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        )}

                        <Link
                            to="/chat"
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:from-emerald-400 hover:to-teal-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
                        >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>AI Session</span>
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
