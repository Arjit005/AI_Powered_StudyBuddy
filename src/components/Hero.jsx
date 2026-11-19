import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, BookOpen, Share2, GraduationCap, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const Hero = () => {
    const [activeTab, setActiveTab] = useState('chat');
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        try {
            const token = localStorage.getItem('auth_token');
            const isAuth = localStorage.getItem('isAuthenticated') === 'true';
            return !!(token && isAuth);
        } catch {
            return false;
        }
    });

    useEffect(() => {
        const checkAuth = () => {
            try {
                const token = localStorage.getItem('auth_token');
                const isAuth = localStorage.getItem('isAuthenticated') === 'true';
                setIsLoggedIn(!!(token && isAuth));
            } catch {
                setIsLoggedIn(false);
            }
        };
        window.addEventListener('storage', checkAuth);
        window.addEventListener('auth-change', checkAuth);
        return () => {
            window.removeEventListener('storage', checkAuth);
            window.removeEventListener('auth-change', checkAuth);
        };
    }, []);

    const tabs = ['chat', 'flashcards', 'maps'];

    const handleTabKeyDown = (e) => {
        const currIndex = tabs.indexOf(activeTab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const next = tabs[(currIndex + 1) % tabs.length];
            setActiveTab(next);
            document.getElementById(`tab-${next}`)?.focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = tabs[(currIndex - 1 + tabs.length) % tabs.length];
            setActiveTab(prev);
            document.getElementById(`tab-${prev}`)?.focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            setActiveTab(tabs[0]);
            document.getElementById(`tab-${tabs[0]}`)?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            setActiveTab(tabs[tabs.length - 1]);
            document.getElementById(`tab-${tabs[tabs.length - 1]}`)?.focus();
        }
    };

    return (
        <section className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32 bg-[#07090E]">
            {/* Emerald Atmospheric Aura (FIX-08: single emerald ramp, no cyan/violet drift) */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-emerald-500/15 via-emerald-600/10 to-teal-500/10 blur-[140px] rounded-full pointer-events-none" />
            
            {/* Subtle Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370d_1px,transparent_1px),linear-gradient(to_bottom,#1f29370d_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                {/* Tech Stack Banner (FIX-10, FIX-14: no v2.1 jargon, 12px font) */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-white/15 text-slate-300 font-sans text-xs mb-8 shadow-2xl backdrop-blur-md">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-emerald-400 font-semibold">AI Study Companion</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300">Grounded Research RAG</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300">Interactive 3D Study Tools</span>
                </div>

                {/* Main Heading (FIX-08: Emerald-only ramp, no cyan gradient) */}
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.12]">
                    Learn Smarter with <br />
                    <span className="bg-gradient-to-r from-emerald-300 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                        Your Personal AI Tutor
                    </span>
                </h1>

                <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto mb-10 leading-relaxed font-sans font-normal">
                    Master any subject faster through conversational AI tutoring, active-recall 3D flashcards,
                    practice quizzes, and interactive visual concept maps.
                </p>

                {/* CTAs (FIX-15: Unambiguous graduation-cap/play glyph, logged-in session detection) */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
                    <Link
                        to="/chat"
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-sm sm:text-base rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2.5 group focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                    >
                        <GraduationCap className="w-5 h-5 text-slate-950" />
                        <span>{isLoggedIn ? "Continue Studying" : "Start Studying Free"}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                        to="/flashcards"
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/80 border border-white/15 text-slate-300 font-semibold text-sm sm:text-base hover:text-white hover:border-emerald-500/40 transition-all flex items-center justify-center gap-2 backdrop-blur-md focus-visible:ring-2 focus-visible:ring-emerald-500/70"
                    >
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span>Try 3D Flashcards</span>
                    </Link>
                </div>

                {/* Live Interactive Showcase Window */}
                <div className="max-w-4xl mx-auto mb-16 rounded-3xl p-1 bg-gradient-to-b from-slate-700/40 via-slate-800/20 to-transparent shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                    <div className="rounded-[22px] bg-[#0A0D14] border border-white/15 overflow-hidden text-left">
                        {/* Window Header (FIX-14: remove ~/v2.1) */}
                        <div className="px-4 py-3 bg-slate-900/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                                <span className="ml-2 text-xs font-mono text-slate-400 hidden sm:inline">study-buddy-console</span>
                            </div>

                            {/* Live Demo Tabs */}
                            <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10" role="tablist" aria-label="Feature showcase tabs" onKeyDown={handleTabKeyDown}>
                                <button
                                    type="button"
                                    role="tab"
                                    id="tab-chat"
                                    tabIndex={activeTab === 'chat' ? 0 : -1}
                                    aria-selected={activeTab === 'chat'}
                                    aria-controls="panel-chat"
                                    onClick={() => setActiveTab('chat')}
                                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                                        activeTab === 'chat' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>AI Socratic Chat</span>
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    id="tab-flashcards"
                                    tabIndex={activeTab === 'flashcards' ? 0 : -1}
                                    aria-selected={activeTab === 'flashcards'}
                                    aria-controls="panel-flashcards"
                                    onClick={() => setActiveTab('flashcards')}
                                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                                        activeTab === 'flashcards' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    <span>3D Active Recall</span>
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    id="tab-maps"
                                    tabIndex={activeTab === 'maps' ? 0 : -1}
                                    aria-selected={activeTab === 'maps'}
                                    aria-controls="panel-maps"
                                    onClick={() => setActiveTab('maps')}
                                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                                        activeTab === 'maps' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>Concept Maps</span>
                                </button>
                            </div>
                        </div>

                        {/* Window Body */}
                        <div className="p-6 font-mono text-xs sm:text-sm">
                            <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat" hidden={activeTab !== 'chat'} className={activeTab === 'chat' ? "space-y-4" : "hidden"}>
                                <div className="flex items-start gap-3">
                                    <span className="text-emerald-400 font-bold">Student:</span>
                                    <span className="text-slate-300">How does Photosynthesis work in plants?</span>
                                </div>
                                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-slate-300 leading-relaxed">
                                    <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>AI Tutor (Step-by-Step Explanation):</span>
                                    </div>
                                    <p>
                                        Photosynthesis is how green plants convert light energy into chemical energy:
                                    </p>
                                    <ul className="list-disc pl-5 space-y-1 text-slate-300">
                                        <li>Light Reactions: Chlorophyll absorbs sunlight to produce ATP and NADPH.</li>
                                        <li>Calvin Cycle: ATP powers CO₂ fixation into energy-rich glucose.</li>
                                    </ul>
                                </div>
                            </div>

                            <div role="tabpanel" id="panel-flashcards" aria-labelledby="tab-flashcards" hidden={activeTab !== 'flashcards'} className={activeTab === 'flashcards' ? "space-y-4" : "hidden"}>
                                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-[#0e1626] border border-emerald-500/20 text-center space-y-3">
                                    <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Active Recall Card #1</div>
                                    <p className="text-base sm:text-lg text-white font-sans font-semibold">
                                        What is the primary role of Chlorophyll in photosynthesis?
                                    </p>
                                    <div className="text-xs text-slate-400 font-sans">
                                        Click flip to reveal definition and test memory retention.
                                    </div>
                                </div>
                            </div>

                            <div role="tabpanel" id="panel-maps" aria-labelledby="tab-maps" hidden={activeTab !== 'maps'} className={activeTab === 'maps' ? "space-y-4" : "hidden"}>
                                <div className="p-6 rounded-2xl bg-slate-950 border border-white/10 text-center space-y-3">
                                    <div className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Concept Relation Flow</div>
                                    <div className="flex items-center justify-center gap-3 text-xs sm:text-sm text-slate-300 flex-wrap">
                                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">Sunlight + H₂O</span>
                                        <span>→</span>
                                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">Thylakoid Membrane</span>
                                        <span>→</span>
                                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">Glucose (C₆H₁₂O₆)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
