import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Terminal, Cpu, Database, Zap, Layers, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';

const Hero = () => {
    return (
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-24 lg:pb-32 bg-[#080B11]">
            {/* MotionSites Atmospheric Aura (Subtle Cyber Cyan/Violet Glow) */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-cyan-500/10 via-emerald-500/10 to-violet-500/10 blur-[130px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                {/* Tech Stack Banner */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 font-mono text-xs mb-8 shadow-2xl backdrop-blur-md">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400 font-semibold">AI Study Buddy v2.0</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400">4-Tier Model Waterfall</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-cyan-400">Neon Cloud PostgreSQL</span>
                </div>

                {/* Main Heading with MotionSites Kinetic Typography */}
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
                    Learn Faster with <br />
                    <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                        Cognitive AI Tutoring
                    </span>
                </h1>

                <p className="text-base sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-sans font-normal">
                    Experience self-healing multi-model intelligence. Master complex subjects through 
                    Socratic coaching, active recall 3D flashcards, deterministic quizzes, and interactive mind maps.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                    <Link
                        to="/chat"
                        className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-bold text-sm sm:text-base rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2.5 group"
                    >
                        <Terminal className="w-4 h-4" />
                        <span>Launch Study Console</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                        to="/quiz"
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-300 font-semibold text-sm sm:text-base hover:text-white hover:border-emerald-500/40 transition-all flex items-center justify-center gap-2 backdrop-blur-md"
                    >
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span>Take Practice Quiz</span>
                    </Link>
                </div>

                {/* Developer Architecture Spec Pills */}
                <div className="pt-8 border-t border-slate-800/80 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-emerald-400 mb-1">
                            <Cpu className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">Failover Gateway</span>
                        </div>
                        <div className="text-sm font-bold text-white">4 AI Tiers</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">Gemini + OpenRouter + NIM</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-teal-400 mb-1">
                            <Database className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">Neon Serverless</span>
                        </div>
                        <div className="text-sm font-bold text-white">PostgreSQL 18.7</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">High availability pool</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-cyan-400 mb-1">
                            <Layers className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">Vector Index</span>
                        </div>
                        <div className="text-sm font-bold text-white">Pinecone RAG</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">Single-index namespaces</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
                        <div className="flex items-center gap-2 text-amber-400 mb-1">
                            <Flame className="w-4 h-4" />
                            <span className="text-xs font-mono font-semibold">24/7 Awake</span>
                        </div>
                        <div className="text-sm font-bold text-white">QStash Pinger</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">Zero cold start latency</div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
