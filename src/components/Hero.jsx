import React, { useState } from 'react';
import { Sparkles, ArrowRight, Cpu, Database, Layers, Flame, Bot, BookOpen, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import SpotlightCard from './ui/SpotlightCard';

const Hero = () => {
    const [activeTab, setActiveTab] = useState('chat');
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
            {/* MotionSites Atmospheric Aura (Cyber Cyan/Emerald Aurora Beams) */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-cyan-500/15 via-emerald-500/15 to-violet-500/10 blur-[140px] rounded-full pointer-events-none" />
            
            {/* Subtle Matrix/Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370d_1px,transparent_1px),linear-gradient(to_bottom,#1f29370d_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                {/* Tech Stack Banner */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 font-mono text-xs mb-8 shadow-2xl backdrop-blur-md">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-semibold">AI Study Buddy v2.1</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">Smart AI Tutor</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-cyan-400">Interactive 3D Study Tools</span>
                </div>

                {/* Main Heading with Kinetic Typography */}
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.12]">
                    Learn Smarter with <br />
                    <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                        Your Personal AI Tutor
                    </span>
                </h1>

                <p className="text-base sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-sans font-normal">
                    Master any subject faster through conversational AI tutoring, active-recall 3D flashcards,
                    practice quizzes, and interactive visual concept maps.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
                    <Link
                        to="/chat"
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-bold text-sm sm:text-base rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2.5 group"
                    >
                        <Bot className="w-4 h-4" />
                        <span>Start Studying Free</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                        to="/flashcards"
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 font-semibold text-sm sm:text-base hover:text-white hover:border-emerald-500/40 transition-all flex items-center justify-center gap-2 backdrop-blur-md"
                    >
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span>Try 3D Flashcards</span>
                    </Link>
                </div>

                {/* MotionSites Live Interactive Showcase Window */}
                <div className="max-w-4xl mx-auto mb-16 rounded-3xl p-1 bg-gradient-to-b from-slate-700/40 via-slate-800/20 to-transparent shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                    <div className="rounded-[22px] bg-[#0A0D14] border border-slate-800/80 overflow-hidden text-left">
                        {/* Window Header */}
                        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                                <span className="ml-2 text-xs font-mono text-slate-400 hidden sm:inline">study-buddy-console ~/v2.1</span>
                            </div>

                            {/* Live Demo Tabs */}
                            <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800" role="tablist" aria-label="Feature showcase tabs" onKeyDown={handleTabKeyDown}>
                                <button
                                    type="button"
                                    role="tab"
                                    id="tab-chat"
                                    tabIndex={activeTab === 'chat' ? 0 : -1}
                                    aria-selected={activeTab === 'chat'}
                                    aria-controls="panel-chat"
                                    onClick={() => setActiveTab('chat')}
                                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                                        activeTab === 'chat' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Bot className="w-3.5 h-3.5" />
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
                                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
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
                                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
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
                            {activeTab === 'chat' && (
                                <div role="tabpanel" id="panel-chat" aria-labelledby="tab-chat" className="space-y-4">
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
                                        <ul className="list-disc pl-4 space-y-1 text-slate-400">
                                            <li><span className="text-emerald-300 font-semibold">Light Reaction:</span> Chlorophyll absorbs sunlight and splits water molecules (H₂O), releasing oxygen (O₂).</li>
                                            <li><span className="text-teal-300 font-semibold">Calvin Cycle:</span> Plants capture carbon dioxide (CO₂) to synthesize glucose (sugar) for food.</li>
                                            <li><span className="text-cyan-300 font-semibold">Key Equation:</span> 6CO₂ + 6H₂O + Sunlight → C₆H₁₂O₆ + 6O₂</li>
                                        </ul>
                                        <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                            <span>AI Tutor v2.1</span>
                                            <span className="text-emerald-400">✓ Grounded with your study notes</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'flashcards' && (
                                <div role="tabpanel" id="panel-flashcards" aria-labelledby="tab-flashcards" className="p-6 rounded-2xl bg-slate-950 border border-emerald-500/30 text-center space-y-3">
                                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-semibold border border-emerald-500/20">
                                        Active Card 1 of 12 • Biology Deck
                                    </span>
                                    <h4 className="text-lg font-bold text-white">
                                        What is the primary function of Mitochondria?
                                    </h4>
                                    <p className="text-slate-400 text-xs">
                                        Known as the powerhouse of the cell, mitochondria generate most of the chemical energy (ATP) needed for cellular biochemical reactions.
                                    </p>
                                    <div className="pt-2 flex justify-center gap-3">
                                        <span className="px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 text-xs border border-rose-900/50">1: Hard</span>
                                        <span className="px-2.5 py-1 rounded-lg bg-amber-950/40 text-amber-300 text-xs border border-amber-900/50">2: Good</span>
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-950/40 text-emerald-300 text-xs border border-emerald-900/50">3: Mastered</span>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'maps' && (
                                <div role="tabpanel" id="panel-maps" aria-labelledby="tab-maps" className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 space-y-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                                        <span>Concept Map: Cell Biology Hierarchy</span>
                                        <span className="text-teal-400">Interactive Concept Flow</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">Animal Cell</span>
                                        <span className="px-2 py-1.5 text-slate-500">──&gt;</span>
                                        <span className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold">Nucleus (DNA)</span>
                                        <span className="px-2 py-1.5 text-slate-500">──&gt;</span>
                                        <span className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-300 font-bold">Mitochondria (ATP Energy)</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Student Feature Highlights */}
                <div className="pt-8 border-t border-slate-800/80 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                    <SpotlightCard className="p-4">
                        <div className="flex items-center gap-2 text-emerald-400 mb-1">
                            <Cpu className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">AI Tutor</span>
                        </div>
                        <div className="text-sm font-bold text-white">Smart Explanations</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Step-by-step guidance on any topic</div>
                    </SpotlightCard>

                    <SpotlightCard className="p-4" spotlightColor="rgba(20, 184, 166, 0.15)">
                        <div className="flex items-center gap-2 text-teal-400 mb-1">
                            <Database className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">Your Notes & PDFs</span>
                        </div>
                        <div className="text-sm font-bold text-white">Source-Grounded</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Chat directly with your study materials</div>
                    </SpotlightCard>

                    <SpotlightCard className="p-4" spotlightColor="rgba(59, 130, 246, 0.15)">
                        <div className="flex items-center gap-2 text-cyan-400 mb-1">
                            <Layers className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">Active Recall</span>
                        </div>
                        <div className="text-sm font-bold text-white">3D Flashcards</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Spaced repetition for exam retention</div>
                    </SpotlightCard>

                    <SpotlightCard className="p-4" spotlightColor="rgba(245, 158, 11, 0.15)">
                        <div className="flex items-center gap-2 text-amber-400 mb-1">
                            <Flame className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">Deep Focus</span>
                        </div>
                        <div className="text-sm font-bold text-white">Study Analytics</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Focus timer & streak tracking</div>
                    </SpotlightCard>
                </div>
            </div>
        </section>
    );
};

export default Hero;
