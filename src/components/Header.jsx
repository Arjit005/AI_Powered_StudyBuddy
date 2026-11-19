import React, { useState, useEffect, useRef } from 'react';
import { 
    Brain, 
    LogOut, 
    ChevronDown, 
    Search,
    Sparkles,
    FolderKanban,
    GraduationCap,
    HelpCircle,
    Layers,
    FileText,
    GitFork,
    Clock,
    FileSpreadsheet,
    Palette,
    Bookmark
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [openMenu, setOpenMenu] = useState(null);
    const openMenuRef = useRef(openMenu);
    const toolsOpen = openMenu?.name === 'tools' && openMenu.locationKey === location.key;
    const workspaceOpen = openMenu?.name === 'workspace' && openMenu.locationKey === location.key;
    const toolsRef = useRef(null);
    const workspaceRef = useRef(null);

    useEffect(() => {
        openMenuRef.current = openMenu;
    }, [openMenu]);

    useEffect(() => {
        const syncUser = () => {
            try {
                const token = localStorage.getItem('auth_token');
                const isAuth = localStorage.getItem('isAuthenticated') === 'true';
                const rawUser = localStorage.getItem('user');
                
                if (token && isAuth && rawUser) {
                    const parsed = JSON.parse(rawUser);
                    if (parsed && typeof parsed === 'object') {
                        setUser(parsed);
                        return;
                    }
                }
                setUser(null);
            } catch (e) {
                console.error(e);
                setUser(null);
            }
        };
        syncUser();
        window.addEventListener('storage', syncUser);
        window.addEventListener('auth-change', syncUser);

        const handleClickOutside = (e) => {
            const target = e.target;
            const insideTools = toolsRef.current && target instanceof Node && toolsRef.current.contains(target);
            const insideWorkspace = workspaceRef.current && target instanceof Node && workspaceRef.current.contains(target);

            if (!insideTools && !insideWorkspace) {
                setOpenMenu(null);
                return;
            }

            if (openMenuRef.current?.name === 'tools' && !insideTools) {
                setOpenMenu(null);
            }

            if (openMenuRef.current?.name === 'workspace' && !insideWorkspace) {
                setOpenMenu(null);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setOpenMenu(null);
            }
        };

        window.addEventListener('click', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('storage', syncUser);
            window.removeEventListener('auth-change', syncUser);
            window.removeEventListener('click', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('user');
        setUser(null);
        window.dispatchEvent(new Event('auth-change'));
        navigate('/login');
    };

    const studyTools = [
        { path: '/quiz', label: 'Quiz', desc: 'Test knowledge with 10-Q MCQs', icon: HelpCircle },
        { path: '/flashcards', label: 'Flashcards', desc: 'Active recall & flip decks', icon: Layers },
        { path: '/summarize', label: 'Summarizer', desc: 'Instant key takeaways', icon: FileText },
        { path: '/maps', label: 'Concept Map', desc: 'Visual relation diagrams', icon: GitFork },
        { path: '/timer', label: 'Focus Timer', desc: 'Pomodoro study sessions', icon: Clock },
    ];

    const workspaceItems = [
        { path: '/sources', label: 'Sources', desc: 'Upload study files & notes', icon: FileSpreadsheet },
        { path: '/canvas', label: 'Canvas Studio', desc: 'Visual whiteboard & notes', icon: Palette },
        { path: '/library', label: 'Saved Library', desc: 'Bookmarks & archived decks', icon: Bookmark },
    ];

    const isToolsActive = studyTools.some(t => location.pathname === t.path);
    const isWorkspaceActive = workspaceItems.some(w => location.pathname === w.path);

    return (
        <header className="sticky top-0 z-40 bg-[#0b0f17]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0b0f17]/80 border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Brand Logo (FIX-08: Emerald-only hue) */}
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-3 group focus-visible:ring-2 focus-visible:ring-emerald-500/70 rounded-xl p-1">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:border-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                <Brain className="h-5 w-5 text-emerald-400 group-hover:scale-105 transition-transform" />
                            </div>
                            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                                Study Buddy
                            </span>
                        </Link>

                        {/* Navigation Links (FIX-09: active underline & state indicator) */}
                        <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium">
                            <Link
                                to="/chat"
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all relative ${
                                    location.pathname === '/chat'
                                        ? 'bg-white/[0.08] text-white font-semibold'
                                        : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                                } focus-visible:ring-2 focus-visible:ring-emerald-500/70`}
                            >
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                <span>AI Tutor</span>
                                {location.pathname === '/chat' && (
                                    <span className="absolute bottom-[-10px] left-3 right-3 h-[2px] bg-emerald-400 rounded-full" />
                                )}
                            </Link>

                            {/* Study Tools Dropdown */}
                            <div className="relative" ref={toolsRef}>
                                <button
                                    onClick={() => {
                                        setOpenMenu(toolsOpen ? null : { name: 'tools', locationKey: location.key });
                                    }}
                                    aria-expanded={toolsOpen}
                                    aria-haspopup="true"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative ${
                                        isToolsActive || toolsOpen
                                            ? 'bg-white/[0.08] text-white font-semibold'
                                            : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                                    } focus-visible:ring-2 focus-visible:ring-emerald-500/70`}
                                >
                                    <GraduationCap className="w-4 h-4 text-emerald-400" />
                                    <span>Study Tools</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${toolsOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                                    {isToolsActive && (
                                        <span className="absolute bottom-[-10px] left-3 right-3 h-[2px] bg-emerald-400 rounded-full" />
                                    )}
                                </button>

                                {toolsOpen && (
                                    <div className="absolute top-11 left-0 w-64 p-2 bg-[#0e1626] border border-white/15 rounded-2xl shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150" role="menu">
                                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            Practice & Memorize
                                        </div>
                                        <div className="space-y-1">
                                            {studyTools.map((tool) => {
                                                const Icon = tool.icon;
                                                const active = location.pathname === tool.path;
                                                return (
                                                    <Link
                                                        key={tool.path}
                                                        to={tool.path}
                                                        role="menuitem"
                                                        className={`flex items-start gap-3 p-2 rounded-xl transition-all ${
                                                            active 
                                                                ? 'bg-emerald-500/20 text-emerald-300 font-semibold' 
                                                                : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                                                        }`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold">{tool.label}</div>
                                                            <div className="text-xs text-slate-400 leading-tight">{tool.desc}</div>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Workspace Dropdown */}
                            <div className="relative" ref={workspaceRef}>
                                <button
                                    onClick={() => {
                                        setOpenMenu(workspaceOpen ? null : { name: 'workspace', locationKey: location.key });
                                    }}
                                    aria-expanded={workspaceOpen}
                                    aria-haspopup="true"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all relative ${
                                        isWorkspaceActive || workspaceOpen
                                            ? 'bg-white/[0.08] text-white font-semibold'
                                            : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                                    } focus-visible:ring-2 focus-visible:ring-emerald-500/70`}
                                >
                                    <FolderKanban className="w-4 h-4 text-emerald-400" />
                                    <span>Workspace</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${workspaceOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                                    {isWorkspaceActive && (
                                        <span className="absolute bottom-[-10px] left-3 right-3 h-[2px] bg-emerald-400 rounded-full" />
                                    )}
                                </button>

                                {workspaceOpen && (
                                    <div className="absolute top-11 left-0 w-64 p-2 bg-[#0e1626] border border-white/15 rounded-2xl shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150" role="menu">
                                        <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            Content & Notes
                                        </div>
                                        <div className="space-y-1">
                                            {workspaceItems.map((item) => {
                                                const Icon = item.icon;
                                                const active = location.pathname === item.path;
                                                return (
                                                    <Link
                                                        key={item.path}
                                                        to={item.path}
                                                        className={`flex items-start gap-3 p-2 rounded-xl transition-all ${
                                                            active 
                                                                ? 'bg-emerald-500/20 text-emerald-300 font-semibold' 
                                                                : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                                                        }`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold">{item.label}</div>
                                                            <div className="text-xs text-slate-400 leading-tight">{item.desc}</div>
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Link
                                to="/progress"
                                className={`px-3 py-1.5 rounded-lg transition-all relative ${
                                    location.pathname === '/progress'
                                        ? 'bg-white/[0.08] text-white font-semibold'
                                        : 'text-slate-300 hover:text-white hover:bg-white/[0.04]'
                                } focus-visible:ring-2 focus-visible:ring-emerald-500/70`}
                            >
                                <span>Analytics</span>
                                {location.pathname === '/progress' && (
                                    <span className="absolute bottom-[-10px] left-3 right-3 h-[2px] bg-emerald-400 rounded-full" />
                                )}
                            </Link>
                        </nav>
                    </div>

                    {/* Right Side: Quick Search & Profile / Auth */}
                    <div className="flex items-center gap-3">
                        {/* Command Palette Trigger */}
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('study-buddy:open-palette'))}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/15 text-slate-300 hover:text-white hover:border-emerald-500/40 text-xs transition-all focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                            title="Quick Search (Ctrl+K)"
                        >
                            <Search className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline text-xs">Search</span>
                            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-slate-800 text-xs text-slate-300 border border-white/10 font-mono">⌘K</kbd>
                        </button>

                        {user ? (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 pl-2.5 py-1 pr-1 bg-slate-900/80 border border-white/15 rounded-xl">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs uppercase">
                                        {typeof user.username === 'string' && user.username ? user.username.slice(0, 2) : 'SB'}
                                    </div>
                                    <span className="text-xs text-slate-300 max-w-[90px] truncate hidden sm:inline">
                                        {typeof user.username === 'string' ? user.username : (typeof user.email === 'string' ? user.email.split('@')[0] : 'Student')}
                                    </span>
                                </div>

                                <button
                                    onClick={handleLogout}
                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                                    title="Log out"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Link
                                    to="/login"
                                    className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/15 hover:border-slate-700 bg-slate-900/60 transition-all focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                                >
                                    Sign In
                                </Link>
                                <Link
                                    to="/signup"
                                    className="text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-3.5 py-1.5 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                                >
                                    Get Started
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
