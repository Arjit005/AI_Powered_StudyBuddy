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
                
                // Only treat user as logged in if valid auth_token and isAuth flag exist
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

        document.addEventListener('pointerdown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('storage', syncUser);
            window.removeEventListener('auth-change', syncUser);
            document.removeEventListener('pointerdown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('auth_token');
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
        <header className="sticky top-0 z-50 bg-[#0b0f17]/90 backdrop-blur-xl border-b border-emerald-950/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Brand Logo */}
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center group-hover:border-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                                <Brain className="h-5 w-5 text-emerald-400 group-hover:scale-105 transition-transform" />
                            </div>
                            <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                                Study Buddy
                            </span>
                        </Link>

                        {/* Navigation Links (Organized into Clean Tabs + Dropdowns) */}
                        <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium">
                            <Link
                                to="/chat"
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                                    location.pathname === '/chat'
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                                        : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-800/50'
                                }`}
                            >
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                <span>AI Tutor</span>
                            </Link>

                            {/* Study Tools Dropdown */}
                            <div className="relative" ref={toolsRef}>
                                <button
                                    onClick={() => {
                                        setOpenMenu(toolsOpen ? null : { name: 'tools', locationKey: location.key });
                                    }}
                                    aria-expanded={toolsOpen}
                                    aria-haspopup="true"
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                        isToolsActive || toolsOpen
                                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                                            : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-800/50'
                                    }`}
                                >
                                    <GraduationCap className="w-4 h-4 text-emerald-400" />
                                    <span>Study Tools</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${toolsOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                                </button>

                                {toolsOpen && (
                                    <div className="absolute top-11 left-0 w-64 p-2 bg-[#0e1626] border border-emerald-500/20 rounded-2xl shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150" role="menu">
                                        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
                                                                ? 'bg-emerald-500/20 text-emerald-300' 
                                                                : 'hover:bg-slate-800/60 text-slate-200 hover:text-white'
                                                        }`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold">{tool.label}</div>
                                                            <div className="text-[11px] text-slate-400 leading-tight">{tool.desc}</div>
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
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                        isWorkspaceActive || workspaceOpen
                                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                                            : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-800/50'
                                    }`}
                                >
                                    <FolderKanban className="w-4 h-4 text-emerald-400" />
                                    <span>Workspace</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${workspaceOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                                </button>

                                {workspaceOpen && (
                                    <div className="absolute top-11 left-0 w-64 p-2 bg-[#0e1626] border border-emerald-500/20 rounded-2xl shadow-2xl z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150" role="menu">
                                        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
                                                                ? 'bg-emerald-500/20 text-emerald-300' 
                                                                : 'hover:bg-slate-800/60 text-slate-200 hover:text-white'
                                                        }`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-emerald-500/30 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-semibold">{item.label}</div>
                                                            <div className="text-[11px] text-slate-400 leading-tight">{item.desc}</div>
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
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    location.pathname === '/progress'
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                                        : 'text-slate-300 hover:text-emerald-300 hover:bg-slate-800/50'
                                }`}
                            >
                                Analytics
                            </Link>
                        </nav>
                    </div>

                    {/* Right Side: Quick Search & Profile / Auth */}
                    <div className="flex items-center gap-3">
                        {/* Command Palette Trigger */}
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('study-buddy:open-palette'))}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-emerald-500/30 text-xs transition-all"
                            title="Quick Search (Ctrl+K)"
                        >
                            <Search className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline text-xs">Search</span>
                            <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-white/10 font-mono">⌘K</kbd>
                        </button>

                        {user ? (
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 pl-2.5 py-1 pr-1 bg-slate-900/80 border border-slate-800 rounded-xl">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs uppercase">
                                        {typeof user.username === 'string' && user.username ? user.username.slice(0, 2) : 'SB'}
                                    </div>
                                    <span className="text-xs text-slate-300 max-w-[90px] truncate hidden sm:inline">
                                        {typeof user.username === 'string' ? user.username : (typeof user.email === 'string' ? user.email.split('@')[0] : 'Student')}
                                    </span>
                                </div>

                                <button
                                    onClick={handleLogout}
                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all"
                                    title="Log out"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
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
                                    className="text-xs font-semibold text-slate-950 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                                >
                                    Sign Up
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
